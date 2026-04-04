import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Rubric, Submission
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Exams", page_icon="G", layout="wide")
inject_theme_css()
render_header("02. Exams", "Create exams under a selected course.")

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.warning("Create a course first on the Courses page.")
    st.stop()

course_labels = [f"{course.id} | {course.code} | {course.name}" for course in courses]
selected_course_label = st.selectbox("Select course", course_labels)
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())

with st.form("create_exam", clear_on_submit=True):
    c1, c2, c3 = st.columns([2, 1, 1])
    exam_name = c1.text_input("Exam name", placeholder="Midterm 1")
    exam_type = c2.selectbox("Type", ["exam", "quiz", "assignment"])
    total_marks = c3.number_input("Total marks", min_value=1.0, value=100.0, step=1.0)
    create_exam_clicked = st.form_submit_button("Create exam", type="primary")

if create_exam_clicked:
    name = exam_name.strip()
    if not name:
        st.error("Exam name is required.")
    else:
        with session_scope() as db:
            duplicate = (
                db.query(Exam)
                .filter(Exam.course_id == selected_course_id, Exam.name == name)
                .one_or_none()
            )
            if duplicate:
                st.warning("An exam with this name already exists in this course.")
            else:
                db.add(
                    Exam(
                        course_id=selected_course_id,
                        name=name,
                        exam_type=exam_type,
                        total_marks=float(total_marks),
                    )
                )
                st.success("Exam created.")
                st.rerun()

with session_scope() as db:
    exams = (
        db.query(Exam)
        .filter(Exam.course_id == selected_course_id)
        .order_by(Exam.created_at.desc())
        .all()
    )
    rows = []
    for exam in exams:
        rows.append(
            {
                "ID": exam.id,
                "Name": exam.name,
                "Type": exam.exam_type,
                "Total marks": exam.total_marks,
                "Rubric questions": db.query(Rubric).filter(Rubric.exam_id == exam.id).count(),
                "Submissions": db.query(Submission).filter(Submission.exam_id == exam.id).count(),
            }
        )

st.markdown("### Existing Exams")
if rows:
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
else:
    st.info("No exams for this course yet.")

if exams:
    delete_labels = [f"{exam.id} | {exam.name}" for exam in exams]
    selected_delete = st.selectbox("Delete exam", [""] + delete_labels, index=0)
    delete_exam_clicked = st.button("Delete selected exam", disabled=not selected_delete)
    if delete_exam_clicked and selected_delete:
        exam_id = int(selected_delete.split("|", 1)[0].strip())
        with session_scope() as db:
            target = db.get(Exam, exam_id)
            if target:
                db.delete(target)
                st.success("Exam deleted.")
                st.rerun()
