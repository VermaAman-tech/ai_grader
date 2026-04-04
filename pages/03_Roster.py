import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Student
from services.roster_service import import_roster, load_roster_dataframe
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Roster", page_icon="G", layout="wide")
inject_theme_css()
render_header("03. Upload Roster", "Upload student roster from Excel or CSV.")

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.warning("Create a course first.")
    st.stop()

course_labels = [f"{course.id} | {course.code} | {course.name}" for course in courses]
selected_course_label = st.selectbox("Select course", course_labels)
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())
st.markdown("### Upload Instructions")
st.info(
    "Please upload an Excel (`.xlsx`, `.xls`) or CSV file containing your student roster.\n\n"
    "**Required Columns:**\n"
    "- `roll_number` (or `roll`, `id`, `student id`)\n"
    "- `name` (or `student name`)\n\n"
    "*Optional Columns: `email`*"
)
uploaded = st.file_uploader("Roster file", type=["xlsx", "xls", "csv"])
if uploaded:
    file_bytes = uploaded.getvalue()
    try:
        preview_df = load_roster_dataframe(file_bytes, uploaded.name)
        st.markdown("### Preview")
        st.dataframe(preview_df.head(20), use_container_width=True)

        if st.button("Import roster", type="primary"):
            with session_scope() as db:
                result = import_roster(
                    file_bytes=file_bytes,
                    file_name=uploaded.name,
                    course_id=selected_course_id,
                    db_session=db,
                )
            st.success(result["message"])
            st.info(
                (
                    f"Added: {result['added']} | Updated: {result['updated']} | "
                    f"Duplicate rows: {result['duplicate_rows']} | Invalid rows: {result['invalid_rows']}"
                )
            )
            st.rerun()
    except Exception as exc:  # noqa: BLE001
        st.error(f"Roster parsing failed: {exc}")

with session_scope() as db:
    students = (
        db.query(Student)
        .filter(Student.course_id == selected_course_id)
        .order_by(Student.roll_number.asc().nullslast(), Student.name.asc())
        .all()
    )

st.markdown("### Current Students")
if students:
    table = [
        {
            "ID": student.id,
            "Roll number": student.roll_number or "",
            "Name": student.name,
            "Email": student.email or "",
        }
        for student in students
    ]
    st.dataframe(pd.DataFrame(table), use_container_width=True, hide_index=True)

    if st.button("Clear all students in this course", type="secondary"):
        with session_scope() as db:
            db.query(Student).filter(Student.course_id == selected_course_id).delete()
        st.success("All students removed for this course.")
        st.rerun()
else:
    st.info("No students imported yet.")
