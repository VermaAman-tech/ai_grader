from dotenv import load_dotenv
import streamlit as st

from db.database import ensure_runtime_dirs, init_db, session_scope
from db.models import Course, Exam, Student, Submission
from ui.theme import inject_theme_css, render_header


load_dotenv()
init_db()
ensure_runtime_dirs()

st.set_page_config(
    page_title="Grader Prototype",
    page_icon="G",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_theme_css()

render_header(
    "Grader Prototype",
    "Create course, create exam, upload roster, define rubric, upload PDFs, run OCR plus LLM grading, export Excel.",
)

st.markdown(
    """
    <span class="gw-chip">No login</span>
    <span class="gw-chip">SQLite file DB</span>
    <span class="gw-chip">Streamlit only</span>
    <span class="gw-chip">Question detector fallback enabled</span>
    """,
    unsafe_allow_html=True,
)

with session_scope() as db:
    courses_count = db.query(Course).count()
    exams_count = db.query(Exam).count()
    students_count = db.query(Student).count()
    submissions_count = db.query(Submission).count()

k1, k2, k3, k4 = st.columns(4)
with k1:
    st.metric("Courses", courses_count)
with k2:
    st.metric("Exams", exams_count)
with k3:
    st.metric("Students", students_count)
with k4:
    st.metric("Submissions", submissions_count)

st.markdown("## Core Loop")
st.markdown(
    "Create Course -> Create Exam -> Upload Roster (Excel) -> Define Rubric -> Upload Student PDFs -> OCR plus LLM grading -> Download Excel"
)

st.info(
    "Use the sidebar pages in order from 01 to 07. Build and verify one student end-to-end before running a full class batch."
)
