import os
import re
from pathlib import Path

import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Rubric, Student, Submission
from ui.theme import inject_theme_css, render_header
from utils.helpers import normalize_roll


def infer_roll_from_filename(file_name: str) -> str:
    stem = Path(file_name).stem
    tokens = re.findall(r"[A-Za-z0-9]+", stem)
    numeric_tokens = [token for token in tokens if any(ch.isdigit() for ch in token)]
    candidate = numeric_tokens[0] if numeric_tokens else (tokens[0] if tokens else stem)
    return normalize_roll(candidate)


st.set_page_config(page_title="Submissions", page_icon="G", layout="wide")
inject_theme_css()
render_header("05. Upload Student PDFs", "Upload one PDF per student. File name should include roll number.")

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
    students = (
        db.query(Student)
        .filter(Student.course_id == selected_course_id)
        .order_by(Student.roll_number.asc().nullslast(), Student.name.asc())
        .all()
    )
    rubric_count = db.query(Rubric).filter(Rubric.exam_id == selected_exam_id).count()

if not students:
    st.warning("Upload roster before uploading PDFs.")
    st.stop()

if rubric_count == 0:
    st.info("⚠️ Note: You have not defined any rubrics yet. You can still upload PDFs, but you cannot grade them until rubrics are added in the '04. Rubric' page.")

uploaded_files = st.file_uploader(
    "Upload student PDFs",
    type=["pdf"],
    accept_multiple_files=True,
    help="Use filenames like 22CS014_midterm.pdf so roll matching is automatic.",
)

if uploaded_files:
    if st.button("Save uploads", type="primary"):
        upload_root = Path(os.getenv("UPLOAD_DIR", "data/uploads")) / f"exam_{selected_exam_id}"
        upload_root.mkdir(parents=True, exist_ok=True)

        matched = 0
        replaced = 0
        unmatched: list[str] = []

        with session_scope() as db:
            fresh_students = db.query(Student).filter(Student.course_id == selected_course_id).all()
            by_roll = {
                normalize_roll(student.roll_number): student
                for student in fresh_students
                if student.roll_number
            }

            for uploaded in uploaded_files:
                inferred_roll = infer_roll_from_filename(uploaded.name)
                student = by_roll.get(inferred_roll)
                if not student:
                    unmatched.append(uploaded.name)
                    continue

                save_path = upload_root / f"student_{student.id}.pdf"
                with open(save_path, "wb") as handle:
                    handle.write(uploaded.getvalue())

                existing = (
                    db.query(Submission)
                    .filter(
                        Submission.exam_id == selected_exam_id,
                        Submission.student_id == student.id,
                    )
                    .one_or_none()
                )
                if existing:
                    existing.file_name = uploaded.name
                    existing.file_path = str(save_path)
                    existing.status = "pending"
                    existing.error_message = None
                    replaced += 1
                else:
                    db.add(
                        Submission(
                            exam_id=selected_exam_id,
                            student_id=student.id,
                            file_name=uploaded.name,
                            file_path=str(save_path),
                            status="pending",
                        )
                    )
                matched += 1

        st.success(f"Matched and saved: {matched} files. Replaced existing: {replaced}.")
        if unmatched:
            st.warning("These files did not match any student roll number:")
            st.write(unmatched)
        st.rerun()

with session_scope() as db:
    submissions = (
        db.query(Submission, Student)
        .join(Student, Student.id == Submission.student_id)
        .filter(Submission.exam_id == selected_exam_id)
        .order_by(Student.roll_number.asc().nullslast(), Student.name.asc())
        .all()
    )

st.markdown("### Current Submission Status")
if submissions:
    table = []
    for submission, student in submissions:
        table.append(
            {
                "Submission ID": submission.id,
                "Roll number": student.roll_number or "",
                "Student": student.name,
                "File": submission.file_name,
                "Status": submission.status,
                "Error": submission.error_message or "",
            }
        )
    st.dataframe(pd.DataFrame(table), use_container_width=True, hide_index=True)

    if st.button("Reset all submissions to pending"):
        with session_scope() as db:
            targets = db.query(Submission).filter(Submission.exam_id == selected_exam_id).all()
            for row in targets:
                row.status = "pending"
                row.error_message = None
        st.success("Submission statuses reset to pending.")
        st.rerun()
else:
    st.info("No PDFs uploaded for this exam yet.")
