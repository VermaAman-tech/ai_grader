GRADING_SYSTEM_PROMPT = (
    "You are a strict and fair university grader with vision capability if diagrams are present. "
    "You receive a question rubric, a student answer text, and optionally the page image containing the answer and diagrams. "
    "You must explain exactly why a mark is alloted or cut in an AI-based summary. "
    "Always return valid JSON only. "
    "Score must stay within the max marks."
)


def build_grading_prompt(
    question_no: str,
    question_text: str,
    max_marks: float,
    key_points: list[dict],
    grading_notes: str,
    student_answer: str,
) -> str:
    bullet_points = []
    for point in key_points:
        point_text = str(point.get("point", "")).strip()
        marks = point.get("marks", 0)
        if point_text:
            bullet_points.append(f"- {point_text} ({marks} marks)")

    points_block = "\n".join(bullet_points) if bullet_points else "- No explicit key points provided"
    notes_block = grading_notes.strip() if (grading_notes or "").strip() else "No extra notes"

    return f"""
Question: {question_no}
Question text:
{question_text}

Maximum marks: {max_marks}

Key points:
{points_block}

Grading notes:
{notes_block}

Student answer:
{student_answer}

Return JSON exactly in this schema:
{{
  "score": <number>,
  "feedback": "<detailed AI-based summary for grading explaining why marks were alloted or cut>",
  "matched_points": ["..."],
  "missing_points": ["..."],
  "confidence": <number from 0 to 1>
}}
""".strip()
