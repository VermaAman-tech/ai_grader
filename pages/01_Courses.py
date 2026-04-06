import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Student
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Courses — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header("Courses", "Create and manage your courses.", "📚")

# ── Create Course ──
render_section_title("Create New Course")
with st.form("create_course", clear_on_submit=True):
    col1, col2, col3 = st.columns([3, 1.5, 1.5])
    course_name = col1.text_input("Course name", placeholder="e.g. Machine Learning")
    course_code = col2.text_input("Course code", placeholder="e.g. CS601")
    semester = col3.text_input("Semester", placeholder="e.g. Spring 2026")
    create_clicked = st.form_submit_button("➕ Create Course", type="primary", use_container_width=True)

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
                st.warning(f"A course with code **{code}** already exists for this semester.")
            else:
                db.add(Course(name=name, code=code, semester=semester_value))
                st.success(f"✅ Course **{name}** ({code}) created successfully!")
                st.rerun()

render_divider()

# ── Existing Courses ──
with session_scope() as db:
    courses = db.query(Course).order_by(Course.created_at.desc()).all()
    rows = []
    for course in courses:
        exam_cnt = db.query(Exam).filter(Exam.course_id == course.id).count()
        student_cnt = db.query(Student).filter(Student.course_id == course.id).count()
        rows.append(
            {
                "ID": course.id,
                "Code": course.code,
                "Name": course.name,
                "Semester": course.semester or "—",
                "Exams": exam_cnt,
                "Students": student_cnt,
                "Created": course.created_at.strftime("%d %b %Y") if course.created_at else "—",
            }
        )

render_section_title(f"Existing Courses ({len(rows)})")
if rows:
    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "ID": st.column_config.NumberColumn("ID", width="small"),
            "Exams": st.column_config.NumberColumn("Exams", width="small"),
            "Students": st.column_config.NumberColumn("Students", width="small"),
        },
    )

    render_divider()
    render_section_title("Delete Course")
    st.markdown(
        '<div class="gw-warning-card"><strong style="color:#fbbf24">⚠️ Warning:</strong>'
        ' <span style="color:#94a3b8; font-size:0.85rem">Deleting a course will cascade-delete all exams, students, rubrics, submissions, and grades.</span></div>',
        unsafe_allow_html=True,
    )
    delete_labels = [f"{course.id} | {course.code} | {course.name}" for course in courses]
    selected_delete = st.selectbox("Select course to delete", ["— Select —"] + delete_labels, index=0, label_visibility="collapsed")
    if st.button("🗑️ Delete Selected Course", type="secondary", disabled=(selected_delete == "— Select —")):
        course_id = int(selected_delete.split("|", 1)[0].strip())
        with session_scope() as db:
            target = db.get(Course, course_id)
            if target:
                db.delete(target)
                st.success("Course deleted.")
                st.rerun()
else:
    st.markdown(
        '<div class="gw-info-card" style="text-align:center; padding: 2rem;">'
        '<div style="font-size:2rem; margin-bottom:0.5rem;">📭</div>'
        '<div style="color:#475569;">No courses yet. Create your first course above.</div>'
        '</div>',
        unsafe_allow_html=True,
    )
