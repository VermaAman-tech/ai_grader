import base64
import os
import random
import re
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

import fitz
from huggingface_hub import InferenceClient
from PIL import Image

from utils.helpers import normalize_question_no, to_float

try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None


@dataclass
class OCRPage:
    page_number: int
    text: str
    image_url: str = ""


class OCRService:
    def __init__(self) -> None:
        self.mode = os.getenv("OCR_MODE", "auto").strip().lower()
        self.min_text_chars = int(max(0.0, to_float(os.getenv("OCR_MIN_TEXT_CHARS", 20), 20)))
        self._can_use_tesseract = bool(pytesseract and shutil.which("tesseract"))
        self.ocr_api_key = self._first_non_empty(
            os.getenv("OCR_HF_TOKEN", ""),
            os.getenv("OCR_LLM_API_KEY", ""),
            os.getenv("HF_TOKEN", ""),
            os.getenv("LLM_API_KEY", ""),
        )
        self.ocr_provider = self._first_non_empty(
            os.getenv("OCR_HF_PROVIDER", ""),
            os.getenv("HF_PROVIDER", ""),
            "auto",
        )
        self.ocr_model = os.getenv("OCR_LLM_MODEL", "Qwen/Qwen3-VL-8B-Instruct").strip()
        self.ocr_fallback_models = [
            model.strip()
            for model in os.getenv("OCR_LLM_FALLBACK_MODELS", "").split(",")
            if model.strip()
        ]
        self.ocr_timeout = to_float(os.getenv("OCR_LLM_TIMEOUT_SECONDS", 90), 90.0)
        self.ocr_max_retries = max(1, int(to_float(os.getenv("OCR_LLM_MAX_RETRIES", 3), 3)))

    def extract_pages(self, pdf_path: str) -> list[OCRPage]:
        path = Path(pdf_path)
        if not path.exists():
            raise FileNotFoundError(f"Submission file not found: {pdf_path}")

        pages: list[OCRPage] = []
        with fitz.open(pdf_path) as document:
            for index, page in enumerate(document, start=1):
                text = (page.get_text("text") or "").strip()
                if len(text) < self.min_text_chars:
                    text = self._recover_page_text(page, text)
                pages.append(
                    OCRPage(
                        page_number=index, 
                        text=self._normalize_page_text(text), 
                        image_url=self._page_to_data_url(page)
                    )
                )
        return pages

    def _recover_page_text(self, page: fitz.Page, extracted_text: str) -> str:
        base_text = (extracted_text or "").strip()
        mode = self.mode or "auto"

        if mode in {"auto", "vision"}:
            vision_text = self._ocr_page_with_vision_llm(page).strip()
            if vision_text:
                return vision_text

        if mode in {"auto", "tesseract"} and self._can_use_tesseract:
            tesseract_text = self._ocr_page_with_tesseract(page).strip()
            if tesseract_text:
                return tesseract_text

        return base_text

    def detect_question_pages(self, pages: list[OCRPage], question_no: str) -> list[int]:
        patterns = self._build_question_patterns(question_no)
        detected: list[int] = []
        for page in pages:
            lowered = page.text.lower()
            if any(re.search(pattern, lowered) for pattern in patterns):
                detected.append(page.page_number)
        return detected

    def collect_answer_text(self, pages: list[OCRPage], page_numbers: list[int]) -> str:
        page_lookup = {page.page_number: page.text for page in pages}
        chunks: list[str] = []
        for page_no in sorted(set(page_numbers)):
            content = (page_lookup.get(page_no) or "").strip()
            if content:
                chunks.append(f"[Page {page_no}]\n{content}")
        return "\n\n".join(chunks)

    def _ocr_page_with_tesseract(self, page: fitz.Page) -> str:
        if not self._can_use_tesseract:
            return ""
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        return pytesseract.image_to_string(image)

    def _ocr_page_with_vision_llm(self, page: fitz.Page) -> str:
        if not (self.ocr_api_key and self.ocr_model):
            return ""

        image_data_url = self._page_to_data_url(page)
        models_to_try = [self.ocr_model] + [
            model for model in self.ocr_fallback_models if model != self.ocr_model
        ]

        if not models_to_try:
            return ""

        prompt = (
            "Extract all readable text from this page. Return plain text only. "
            "Preserve line breaks and answer structure. Do not summarize."
        )

        client_kwargs = {
            "api_key": self.ocr_api_key,
            "timeout": self.ocr_timeout,
        }
        if self.ocr_provider:
            client_kwargs["provider"] = self.ocr_provider
        client = InferenceClient(**client_kwargs)
        for model_name in models_to_try:
            for attempt in range(1, self.ocr_max_retries + 1):
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        temperature=0.0,
                        max_tokens=2500,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {"type": "image_url", "image_url": {"url": image_data_url}},
                                ],
                            }
                        ],
                    )
                    content = self._extract_message_content(response)
                    if content.strip():
                        return content
                    break

                except Exception as exc:
                    status_code = self._extract_status_code(str(exc))
                    if self._is_retryable_error(status_code, str(exc)) and attempt < self.ocr_max_retries:
                        wait_seconds = min(20.0, (2 ** (attempt - 1)) + random.uniform(0.1, 0.6))
                        time.sleep(wait_seconds)
                        continue
                    break

        return ""

    @staticmethod
    def _extract_message_content(payload: dict) -> str:
        choices = getattr(payload, "choices", None)
        if not choices and isinstance(payload, dict):
            choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""

        first = choices[0]
        message = getattr(first, "message", None)
        if message is None and isinstance(first, dict):
            message = first.get("message")
        if message is None:
            return ""

        content = getattr(message, "content", None)
        if content is None and isinstance(message, dict):
            content = message.get("content", "")
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                item_type = item.get("type") if isinstance(item, dict) else getattr(item, "type", None)
                text = item.get("text") if isinstance(item, dict) else getattr(item, "text", None)
                if item_type == "text" and text:
                    chunks.append(str(text))
            return "\n".join(chunks)

        return str(content)

    @staticmethod
    def _extract_status_code(error_text: str) -> int | None:
        match = re.search(r"\b([45]\d{2})\b", error_text or "")
        if not match:
            return None
        code = int(match.group(1))
        return code if 400 <= code <= 599 else None

    @staticmethod
    def _is_retryable_error(status_code: int | None, error_text: str) -> bool:
        if status_code in {408, 409, 425, 429}:
            return True
        if status_code and status_code >= 500:
            return True
        lowered = (error_text or "").lower()
        return any(
            marker in lowered
            for marker in [
                "timed out",
                "timeout",
                "temporarily unavailable",
                "connection",
            ]
        )

    @staticmethod
    def _page_to_data_url(page: fitz.Page) -> str:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        png_bytes = pixmap.tobytes("png")
        encoded = base64.b64encode(png_bytes).decode("ascii")
        return f"data:image/png;base64,{encoded}"

    @staticmethod
    def _normalize_page_text(text: str) -> str:
        normalized = re.sub(r"\r", "\n", text or "")
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    @staticmethod
    def _build_question_patterns(question_no: str) -> list[str]:
        normalized = normalize_question_no(question_no)
        token = normalized[1:] if normalized.startswith("q") else normalized
        token = re.escape(token)
        patterns = [
            rf"\b{re.escape(normalized)}\b",
            rf"\bq\s*{token}\b",
            rf"\bquestion\s*{token}\b",
        ]
        if token and token[0].isdigit():
            patterns.append(rf"\b{token}\b")
        return patterns

    @staticmethod
    def _first_non_empty(*values: str) -> str:
        for value in values:
            cleaned = str(value or "").strip()
            if cleaned:
                return cleaned
        return ""
