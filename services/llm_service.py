import os
import random
import re
import time

from huggingface_hub import InferenceClient

from utils.helpers import clamp, safe_parse_json, to_float
from utils.prompts import GRADING_SYSTEM_PROMPT, build_grading_prompt


class LLMService:
    def __init__(self) -> None:
        self.api_key = self._first_non_empty(
            os.getenv("HF_TOKEN", ""),
            os.getenv("LLM_API_KEY", ""),
        )
        self.provider = self._first_non_empty(os.getenv("HF_PROVIDER", ""), "auto")
        self.model = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip()
        self.fallback_models = [
            model.strip()
            for model in os.getenv("LLM_FALLBACK_MODELS", "").split(",")
            if model.strip()
        ]
        self.timeout = to_float(os.getenv("LLM_TIMEOUT_SECONDS", 60), 60.0)
        self.max_retries = int(to_float(os.getenv("LLM_MAX_RETRIES", 5), 5))

    def grade_answer(
        self,
        question_no: str,
        question_text: str,
        max_marks: float,
        key_points: list[dict],
        grading_notes: str,
        student_answer: str,
        images_data_urls: list[str] = None,
    ) -> dict:
        answer = (student_answer or "").strip()
        if not answer and not images_data_urls:
            return {
                "score": 0.0,
                "feedback": "No readable answer text was extracted.",
                "matched_points": [],
                "missing_points": ["No answer text available"],
                "confidence": 0.1,
                "raw_response": "",
            }

        if not self.api_key:
            heuristic = self._heuristic_grade(max_marks=max_marks, key_points=key_points, answer=answer)
            heuristic["feedback"] = (
                f"{heuristic['feedback']} API key is missing, so heuristic grading was used instead of LLM output."
            )
            return heuristic

        prompt = build_grading_prompt(
            question_no=question_no,
            question_text=question_text,
            max_marks=max_marks,
            key_points=key_points,
            grading_notes=grading_notes,
            student_answer=answer,
        )
        
        user_content = [{"type": "text", "text": prompt}]
        if images_data_urls:
            for d_url in images_data_urls:
                user_content.append({"type": "image_url", "image_url": {"url": d_url}})
                
        raw_response = self._call_messages(
            messages=[
                {"role": "system", "content": GRADING_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.0,
            max_tokens=1500,
        )
        
        parsed = safe_parse_json(raw_response)
        if not parsed:
            heuristic = self._heuristic_grade(max_marks=max_marks, key_points=key_points, answer=answer)
            heuristic["feedback"] = (
                f"{heuristic['feedback']} LLM returned non-JSON output; heuristic fallback applied."
            )
            heuristic["raw_response"] = raw_response[:6000]
            return heuristic

        score = clamp(to_float(parsed.get("score"), 0.0), 0.0, max_marks)
        confidence = clamp(to_float(parsed.get("confidence"), 0.4), 0.0, 1.0)

        return {
            "score": score,
            "feedback": str(parsed.get("feedback", "")).strip() or "No feedback returned.",
            "matched_points": self._safe_string_list(parsed.get("matched_points")),
            "missing_points": self._safe_string_list(parsed.get("missing_points")),
            "confidence": confidence,
            "raw_response": raw_response[:6000],
        }

    def chat(
        self,
        messages: list[dict],
        system_prompt: str = "",
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("LLM_API_KEY is missing.")

        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)
        return self._call_messages(full_messages, temperature=temperature, max_tokens=max_tokens)

    def _call_chat_completion(self, prompt: str) -> str:
        return self._call_messages(
            messages=[
                {"role": "system", "content": GRADING_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            max_tokens=1200,
        )

    def _call_messages(self, messages: list[dict], temperature: float, max_tokens: int) -> str:
        models_to_try = [self.model] + [model for model in self.fallback_models if model != self.model]

        if not models_to_try:
            raise RuntimeError("No model configured. Set LLM_MODEL in .env.")

        client_kwargs = {
            "api_key": self.api_key,
            "timeout": self.timeout,
        }
        if self.provider:
            client_kwargs["provider"] = self.provider
        client = InferenceClient(**client_kwargs)
        model_errors: list[str] = []

        for model_name in models_to_try:
            last_error = None
            is_vision_model = "vl" in model_name.lower() or "vision" in model_name.lower()

            for attempt in range(1, self.max_retries + 1):
                try:
                    # Filter out images for text-only models to prevent 400 errors
                    safe_messages = messages
                    if not is_vision_model:
                        safe_messages = []
                        for msg in messages:
                            if isinstance(msg.get("content"), list):
                                text_only = " ".join([c["text"] for c in msg["content"] if c.get("type") == "text"])
                                safe_messages.append({"role": msg["role"], "content": text_only})
                            else:
                                safe_messages.append(msg)

                    response = client.chat.completions.create(
                        model=model_name,
                        messages=safe_messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                    content = self._extract_message_content(response)
                    if content.strip():
                        return content

                    last_error = "Empty response content"
                    break

                except Exception as exc:  # noqa: BLE001
                    last_error = str(exc)
                    status_code = self._extract_status_code(last_error)
                    if self._is_retryable_error(status_code, last_error) and attempt < self.max_retries:
                        wait_seconds = min(20.0, (2 ** (attempt - 1)) + random.uniform(0.1, 0.7))
                        time.sleep(wait_seconds)
                        continue
                    break

            model_errors.append(f"{model_name} -> {last_error or 'unknown error'}")

        joined = " | ".join(model_errors[:6])
        raise RuntimeError(f"All configured models failed. {joined}")

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
    def _extract_message_content(response) -> str:
        choices = getattr(response, "choices", None)
        if not choices and isinstance(response, dict):
            choices = response.get("choices")
        if not choices:
            return ""

        first = choices[0]
        message = getattr(first, "message", None)
        if message is None and isinstance(first, dict):
            message = first.get("message")
        if message is None:
            return ""

        content = getattr(message, "content", None)
        if content is None and isinstance(message, dict):
            content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                text = None
                if isinstance(item, dict):
                    text = item.get("text")
                else:
                    text = getattr(item, "text", None)
                if text:
                    parts.append(str(text))
            return "\n".join(parts)
        return str(content or "")

    def _heuristic_grade(self, max_marks: float, key_points: list[dict], answer: str) -> dict:
        answer_lower = answer.lower()
        matched: list[str] = []
        missing: list[str] = []
        score = 0.0

        if not key_points:
            length_ratio = min(1.0, len(answer.split()) / 100)
            score = round(max_marks * length_ratio, 2)
            return {
                "score": score,
                "feedback": "No key points were supplied, so score was estimated from answer completeness.",
                "matched_points": [],
                "missing_points": [],
                "confidence": 0.3,
                "raw_response": "",
            }

        for point in key_points:
            point_text = str(point.get("point", "")).strip()
            marks = max(0.0, to_float(point.get("marks"), 0.0))
            keywords = self._extract_keywords(point_text)
            if keywords and any(keyword in answer_lower for keyword in keywords):
                matched.append(point_text)
                score += marks
            else:
                missing.append(point_text)

        clamped = clamp(round(score, 2), 0.0, max_marks)
        return {
            "score": clamped,
            "feedback": "Heuristic keyword matching was used to estimate marks.",
            "matched_points": matched,
            "missing_points": missing,
            "confidence": 0.35,
            "raw_response": "",
        }

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        tokens = [token for token in re.findall(r"[a-zA-Z]{4,}", (text or "").lower())]
        stop_words = {
            "that",
            "this",
            "with",
            "from",
            "have",
            "were",
            "into",
            "using",
            "should",
            "which",
            "their",
            "there",
            "about",
        }
        filtered = [token for token in tokens if token not in stop_words]
        return filtered[:6]

    @staticmethod
    def _safe_string_list(value) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return []

    @staticmethod
    def _first_non_empty(*values: str) -> str:
        for value in values:
            cleaned = str(value or "").strip()
            if cleaned:
                return cleaned
        return ""
