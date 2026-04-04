import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Student
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Courses", page_icon="G", layout="wide")
inject_theme_css()
render_header("01. Courses", "Create and manage courses.")

with st.form("create_course", clear_on_submit=True):
    col1, col2, col3 = st.columns([2, 1, 1])
    course_name = col1.text_input("Course name", placeholder="Machine Learning")
    course_code = col2.text_input("Course code", placeholder="CS601")
    semester = col3.text_input("Semester", placeholder="Spring 2026")
    create_clicked = st.form_submit_button("Create course", type="primary")

if create_clicked:
    name = course_name.strip()
    code = course_code.strip().upper()
    semester_value = semester.strip() or None

    if not name or not code:
        st.error("Course name and code are required.")
    else:
        with session_scope() as db:
            duplicate = (
                db.query(Course)
                .filter(Course.code == code, Course.semester == semester_value)
                .one_or_none()
            )
            if duplicate:
                st.warning("A course with the same code and semester already exists.")
            else:
                db.add(Course(name=name, code=code, semester=semester_value))
                st.success("Course created.")
                st.rerun()

with session_scope() as db:
    courses = db.query(Course).order_by(Course.created_at.desc()).all()
    rows = []
    for course in courses:
        rows.append(
            {
                "ID": course.id,
                "Code": course.code,
                "Name": course.name,
                "Semester": course.semester or "",
                "Exams": db.query(Exam).filter(Exam.course_id == course.id).count(),
                "Students": db.query(Student).filter(Student.course_id == course.id).count(),
            }
        )

st.markdown("### Existing Courses")
if rows:
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
else:
    st.info("No courses yet.")

if courses:
    delete_labels = [f"{course.id} | {course.code} | {course.name}" for course in courses]
    selected_delete = st.selectbox("Delete course", [""] + delete_labels, index=0)
    delete_clicked = st.button("Delete selected course", type="secondary", disabled=not selected_delete)
    if delete_clicked and selected_delete:
        course_id = int(selected_delete.split("|", 1)[0].strip())
        with session_scope() as db:
            target = db.get(Course, course_id)
            if target:
                db.delete(target)
                st.success("Course deleted.")
                st.rerun()
