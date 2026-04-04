import os
from datetime import datetime
from pathlib import Path

import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Submission
from services.export_service import export_exam_gradebook
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Export", page_icon="G", layout="wide")
inject_theme_css()
render_header("07. Export", "Generate and download final Excel gradebook.")

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
    total_submissions = db.query(Submission).filter(Submission.exam_id == selected_exam_id).count()
    done_submissions = (
        db.query(Submission)
        .filter(Submission.exam_id == selected_exam_id, Submission.status == "done")
        .count()
    )

st.metric("Graded submissions", f"{done_submissions} / {total_submissions}")

if st.button("Generate gradebook", type="primary", use_container_width=True):
    export_dir = Path(os.getenv("EXPORT_DIR", "data/exports"))
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = export_dir / f"exam_{selected_exam_id}_gradebook_{stamp}.xlsx"
    output = export_exam_gradebook(selected_exam_id, str(file_path))
    st.session_state["latest_export_path"] = output
    st.success("Gradebook generated.")

latest = st.session_state.get("latest_export_path")
if latest and Path(latest).exists():
    with open(latest, "rb") as handle:
        st.download_button(
            label="Download Excel",
            data=handle,
            file_name=Path(latest).name,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )
