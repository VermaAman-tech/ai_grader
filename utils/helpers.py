import json
import re
from typing import Any


def strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = re.sub(r"^```[a-zA-Z0-9_-]*", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned


def extract_json_object(text: str) -> str:
    cleaned = strip_code_fences(text)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return cleaned
    return cleaned[start : end + 1]


def safe_parse_json(text: str) -> dict[str, Any] | None:
    try:
        return json.loads(extract_json_object(text))
    except Exception:
        return None


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_question_no(question_no: str) -> str:
    token = (question_no or "").strip().lower()
    token = re.sub(r"\s+", "", token)
    if token and not token.startswith("q"):
        token = f"q{token}"
    return token


def normalize_roll(roll_number: str) -> str:
    token = (roll_number or "").strip().upper()
    token = re.sub(r"\s+", "", token)
    return token
