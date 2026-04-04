import json

import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.grading_service import grade_submission
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Grade", page_icon="G", layout="wide")
inject_theme_css()
render_header("06. OCR and LLM Grading", "Run grading and review results question by question.")

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.warning("Create a course first.")
    st.stop()

course_labels = [f"{course.id} | {course.code} | {course.name}" for course in courses]
selected_course_label = st.selectbox("Select course", course_labels)
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())

with session_scope() as db:
    exams = (
        db.query(Exam)
        .filter(Exam.course_id == selected_course_id)
        .order_by(Exam.created_at.desc())
        .all()
    )

if not exams:
    st.warning("Create an exam first.")
    st.stop()

exam_labels = [f"{exam.id} | {exam.name}" for exam in exams]
selected_exam_label = st.selectbox("Select exam", exam_labels)
selected_exam_id = int(selected_exam_label.split("|", 1)[0].strip())

with session_scope() as db:
    rubrics = (
        db.query(Rubric)
        .filter(Rubric.exam_id == selected_exam_id)
        .order_by(Rubric.question_order.asc(), Rubric.id.asc())
        .all()
    )
    submissions = db.query(Submission).filter(Submission.exam_id == selected_exam_id).all()
    students = {
        student.id: student
        for student in db.query(Student).filter(Student.course_id == selected_course_id).all()
    }
    grades = (
        db.query(Grade)
        .join(Submission, Submission.id == Grade.submission_id)
        .filter(Submission.exam_id == selected_exam_id)
        .all()
    )

if not rubrics:
    st.warning("Define rubric first.")
    st.stop()

if not submissions:
    st.warning("Upload submissions first.")
    st.stop()

grades_by_submission: dict[int, list[Grade]] = {}
for grade in grades:
    grades_by_submission.setdefault(grade.submission_id, []).append(grade)

pending = [submission for submission in submissions if submission.status == "pending"]
grading = [submission for submission in submissions if submission.status == "grading"]
done = [submission for submission in submissions if submission.status == "done"]
errors = [submission for submission in submissions if submission.status == "error"]

c1, c2, c3, c4 = st.columns(4)
with c1:
    st.metric("Pending", len(pending))
with c2:
    st.metric("Grading", len(grading))
with c3:
    st.metric("Done", len(done))
with c4:
    st.metric("Errors", len(errors))

if pending:
    if st.button(f"Grade all pending ({len(pending)})", type="primary"):
        fallback_summary: dict[str, list[int]] = {}
        progress = st.progress(0.0)
        status_box = st.empty()
        for index, submission in enumerate(pending, start=1):
            student = students.get(submission.student_id)
            status_box.info(f"Grading {student.name if student else submission.student_id}")

            result = grade_submission(
                submission_id=submission.id,
                progress_callback=lambda message: status_box.info(message),
            )
            if result["fallback_questions"]:
                fallback_summary[str(submission.id)] = result["fallback_questions"]

            progress.progress(index / len(pending))

        status_box.success("Batch grading complete.")
        if fallback_summary:
            st.warning("Detector fallback was used for some submissions.")
            st.json(fallback_summary)
        st.rerun()

st.markdown("### Review")

rubric_lookup = {rubric.id: rubric for rubric in rubrics}
max_total = sum(rubric.max_marks for rubric in rubrics)

summary_rows = []
for submission in submissions:
    student = students.get(submission.student_id)
    per_submission_grades = grades_by_submission.get(submission.id, [])
    total = 0.0
    for grade in per_submission_grades:
        total += grade.override_marks if grade.override_marks is not None else grade.awarded_marks
    summary_rows.append(
        {
            "Submission ID": submission.id,
            "Roll number": student.roll_number if student else "",
            "Student": student.name if student else "Unknown",
            "Status": submission.status,
            "Total": round(total, 2),
            "Max": round(max_total, 2),
            "Error": submission.error_message or "",
        }
    )

st.dataframe(pd.DataFrame(summary_rows), use_container_width=True, hide_index=True)

for submission in submissions:
    student = students.get(submission.student_id)
    student_title = student.name if student else f"Student {submission.student_id}"
    with st.expander(f"{student_title} | status: {submission.status} | submission: {submission.id}", expanded=False):
        if st.button("Regrade this submission", key=f"regrade_{submission.id}"):
            with session_scope() as db:
                target = db.get(Submission, submission.id)
                if target:
                    target.status = "pending"
                    target.error_message = None
            grade_submission(submission.id)
            st.success("Regrade complete.")
            st.rerun()

        per_submission_grades = sorted(
            grades_by_submission.get(submission.id, []),
            key=lambda item: item.question_no,
        )

        if not per_submission_grades:
            st.info("No grade rows yet.")
            continue

        for grade in per_submission_grades:
            rubric = rubric_lookup.get(grade.rubric_id)
            max_marks = rubric.max_marks if rubric else 0.0
            effective = grade.override_marks if grade.override_marks is not None else grade.awarded_marks
            st.markdown(f"**{grade.question_no}**: {round(effective, 2)} / {round(max_marks, 2)}")
            st.caption(grade.feedback)

            matched = json.loads(grade.matched_points_json or "[]")
            missing = json.loads(grade.missing_points_json or "[]")
            if matched:
                st.write("Matched points:", matched)
            if missing:
                st.write("Missing points:", missing)

            with st.form(f"override_{grade.id}"):
                o1, o2 = st.columns([1, 2])
                override_marks = o1.number_input(
                    "Override marks",
                    min_value=0.0,
                    max_value=float(max_marks),
                    value=float(effective),
                    step=0.5,
                    key=f"override_marks_{grade.id}",
                )
                override_note = o2.text_input(
                    "Override note",
                    value=grade.override_note or "",
                    key=f"override_note_{grade.id}",
                )
                save_override = st.form_submit_button("Save override")

            if save_override:
                with session_scope() as db:
                    target = db.get(Grade, grade.id)
                    if target:
                        target.override_marks = float(override_marks)
                        target.override_note = override_note.strip() or None
                st.success("Override saved.")
                st.rerun()

            if grade.ocr_text:
                show_ocr = st.toggle("Show OCR text", key=f"show_ocr_{grade.id}")
                if show_ocr:
                    st.text_area(
                        "OCR text",
                        value=grade.ocr_text,
                        height=180,
                        key=f"ocr_text_{grade.id}",
                    )
