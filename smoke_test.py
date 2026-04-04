import os
import uuid
from pathlib import Path

import fitz

from db.database import ensure_runtime_dirs, init_db, session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.export_service import export_exam_gradebook
from services.grading_service import grade_submission


def create_sample_pdf(path: Path) -> None:
    doc = fitz.open()
    page1 = doc.new_page()
    page1.insert_text(
        (72, 72),
        (
            "Q1 Explain gradient descent.\n"
            "Gradient descent updates parameters opposite to the gradient and uses a learning rate."
        ),
    )
    page2 = doc.new_page()
    page2.insert_text(
        (72, 72),
        (
            "Q2 Define overfitting.\n"
            "Overfitting is when a model memorizes training data and fails to generalize."
        ),
    )
    doc.save(path)
    doc.close()


def main() -> None:
    init_db()
    ensure_runtime_dirs()
    run_id = uuid.uuid4().hex[:8].upper()

    with session_scope() as db:
        course = Course(name=f"Smoke Course {run_id}", code=f"SMK{run_id}", semester="2026")
        db.add(course)
        db.flush()

        exam = Exam(course_id=course.id, name="Prototype Smoke", exam_type="exam", total_marks=20)
        db.add(exam)
        db.flush()

        student = Student(course_id=course.id, name="Smoke Student", roll_number=f"R{run_id}", email="smoke@test")
        db.add(student)
        db.flush()

        db.add_all(
            [
                Rubric(
                    exam_id=exam.id,
                    question_no="Q1",
                    question_order=1,
                    question_text="Explain gradient descent.",
                    max_marks=10,
                    key_points_json='[{"point":"opposite to the gradient", "marks":5}, {"point":"learning rate", "marks":5}]',
                    grading_notes="Award partial credit for one correct concept.",
                ),
                Rubric(
                    exam_id=exam.id,
                    question_no="Q2",
                    question_order=2,
                    question_text="Define overfitting.",
                    max_marks=10,
                    key_points_json='[{"point":"memorizes training data", "marks":5}, {"point":"poor generalization", "marks":5}]',
                    grading_notes="Accept equivalent wording.",
                ),
            ]
        )
        db.flush()

        upload_dir = Path(os.getenv("UPLOAD_DIR", "data/uploads")) / f"smoke_{run_id}"
        upload_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = upload_dir / "submission.pdf"
        create_sample_pdf(pdf_path)

        submission = Submission(
            exam_id=exam.id,
            student_id=student.id,
            file_name=pdf_path.name,
            file_path=str(pdf_path),
            status="pending",
        )
        db.add(submission)
        db.flush()

        submission_id = submission.id
        exam_id = exam.id

    result = grade_submission(submission_id)
    export_path = Path(os.getenv("EXPORT_DIR", "data/exports")) / f"smoke_report_{run_id}.xlsx"
    export_exam_gradebook(exam_id, str(export_path))

    with session_scope() as db:
        grade_rows = db.query(Grade).filter(Grade.submission_id == submission_id).count()

    print(f"graded_questions={result['graded_questions']}")
    print(f"fallback_questions={','.join(result['fallback_questions']) or 'none'}")
    print(f"grade_rows={grade_rows}")
    print(f"export_file={export_path}")


if __name__ == "__main__":
    main()
