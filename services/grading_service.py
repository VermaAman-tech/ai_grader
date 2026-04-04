import json
import os
import time
from datetime import datetime

from db.database import session_scope
from db.models import Grade, Rubric, Submission
from services.llm_service import LLMService
from services.ocr_service import OCRService
from utils.helpers import clamp, to_float


def grade_submission(
    submission_id: int,
    progress_callback=None,
    ocr_service: OCRService | None = None,
    llm_service: LLMService | None = None,
) -> dict:
    ocr = ocr_service or OCRService()
    llm = llm_service or LLMService()
    pause_seconds = max(0.0, to_float(os.getenv("LLM_REQUEST_PAUSE_SECONDS", 0.8), 0.8))

    fallback_questions: list[str] = []

    with session_scope() as db:
        submission = db.get(Submission, submission_id)
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")
        submission.status = "grading"
        submission.error_message = None
        submission_path = submission.file_path

        rubrics = (
            db.query(Rubric)
            .filter(Rubric.exam_id == submission.exam_id)
            .order_by(Rubric.question_order.asc(), Rubric.id.asc())
            .all()
        )

    if not rubrics:
        _mark_submission_error(submission_id, "No rubric found for exam")
        raise ValueError("No rubric found for this exam")

    pages = ocr.extract_pages(submission_path)
    if not pages:
        _mark_submission_error(submission_id, "Could not extract any pages from PDF")
        raise ValueError("Could not extract any pages from PDF")

    try:
        with session_scope() as db:
            submission = db.get(Submission, submission_id)
            rubrics = (
                db.query(Rubric)
                .filter(Rubric.exam_id == submission.exam_id)
                .order_by(Rubric.question_order.asc(), Rubric.id.asc())
                .all()
            )

            for index, rubric in enumerate(rubrics, start=1):
                if progress_callback:
                    progress_callback(f"Question {index}/{len(rubrics)}: {rubric.question_no}")

                detected_pages = ocr.detect_question_pages(pages, rubric.question_no)

                # Critical fallback: never skip grading if auto-detection misses a question.
                if not detected_pages:
                    detected_pages = [page.page_number for page in pages]
                    fallback_questions.append(rubric.question_no)

                answer_text = ocr.collect_answer_text(pages, detected_pages).strip()
                page_images = [p.image_url for p in pages if p.page_number in detected_pages and p.image_url]

                try:
                    key_points = json.loads(rubric.key_points_json or "[]")     
                except json.JSONDecodeError:
                    key_points = []

                result = llm.grade_answer(
                    question_no=rubric.question_no,
                    question_text=rubric.question_text,
                    max_marks=rubric.max_marks,
                    key_points=key_points,
                    grading_notes=rubric.grading_notes or "",
                    student_answer=answer_text,
                    images_data_urls=page_images,
                )

                awarded = clamp(to_float(result.get("score"), 0.0), 0.0, rubric.max_marks)
                feedback = str(result.get("feedback", "")).strip()
                if rubric.question_no in fallback_questions:
                    feedback = (
                        f"{feedback}\n\nDetector fallback applied: all pages were graded for this question."
                    ).strip()

                grade_row = (
                    db.query(Grade)
                    .filter(Grade.submission_id == submission_id, Grade.rubric_id == rubric.id)
                    .one_or_none()
                )

                if not grade_row:
                    grade_row = Grade(
                        submission_id=submission_id,
                        rubric_id=rubric.id,
                        question_no=rubric.question_no,
                    )
                    db.add(grade_row)

                grade_row.detected_pages = ",".join(str(num) for num in detected_pages)
                grade_row.ocr_text = answer_text
                grade_row.awarded_marks = awarded
                grade_row.feedback = feedback
                grade_row.matched_points_json = json.dumps(result.get("matched_points", []))
                grade_row.missing_points_json = json.dumps(result.get("missing_points", []))
                grade_row.confidence = clamp(to_float(result.get("confidence"), 0.0), 0.0, 1.0)
                grade_row.raw_response = str(result.get("raw_response", ""))
                grade_row.graded_at = datetime.utcnow()

                if pause_seconds:
                    time.sleep(pause_seconds)

            submission.status = "done"
            submission.error_message = None

        return {
            "graded_questions": len(rubrics),
            "fallback_questions": fallback_questions,
        }

    except Exception as exc:  # noqa: BLE001
        _mark_submission_error(submission_id, str(exc))
        raise


def _mark_submission_error(submission_id: int, error_message: str) -> None:
    with session_scope() as db:
        submission = db.get(Submission, submission_id)
        if submission:
            submission.status = "error"
            submission.error_message = (error_message or "")[:1000]
