from dotenv import load_dotenv
import streamlit as st

from db.database import ensure_runtime_dirs, init_db, session_scope
from db.models import Course, Exam, Grade, Student, Submission
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


load_dotenv()
init_db()
ensure_runtime_dirs()

st.set_page_config(
    page_title="Grader — AI Exam Grading",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_theme_css()

# ── Sidebar branding ──
with st.sidebar:
    st.markdown(
        """
        <div style="padding: 0.5rem 0 1.2rem 0; border-bottom: 1px solid rgba(56,189,248,0.1); margin-bottom: 1rem;">
            <div style="font-size: 1.2rem; font-weight: 800; color: #e2e8f0; letter-spacing: -0.3px;">
                🎓 Grader
            </div>
            <div style="font-size: 0.72rem; color: #475569; margin-top: 0.2rem; font-weight: 500;">
                AI-Powered Exam Grading System
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

render_header(
    "Dashboard",
    "AI-powered exam grading — OCR + LLM grading with analytics.",
    "🎓",
)

# ── Chips ──
st.markdown(
    """
    <span class="gw-chip">🔒 Single-user</span>
    <span class="gw-chip">💾 SQLite</span>
    <span class="gw-chip gw-chip-success">🤖 LLM Grading</span>
    <span class="gw-chip">🔍 Vision OCR</span>
    <span class="gw-chip gw-chip-success">📊 Analytics</span>
    """,
    unsafe_allow_html=True,
)

st.markdown("<br>", unsafe_allow_html=True)

# ── Live Stats ──
with session_scope() as db:
    courses_count = db.query(Course).count()
    exams_count = db.query(Exam).count()
    students_count = db.query(Student).count()
    submissions_count = db.query(Submission).count()
    done_count = db.query(Submission).filter(Submission.status == "done").count()
    error_count = db.query(Submission).filter(Submission.status == "error").count()
    pending_count = db.query(Submission).filter(Submission.status == "pending").count()
    grades_count = db.query(Grade).count()

c1, c2, c3, c4 = st.columns(4)
with c1:
    st.metric("Courses", courses_count, help="Total courses created")
with c2:
    st.metric("Exams", exams_count, help="Total exams across all courses")
with c3:
    st.metric("Students", students_count, help="Total enrolled students")
with c4:
    graded_pct = f"{done_count/submissions_count*100:.0f}%" if submissions_count > 0 else "—"
    st.metric("Submissions", submissions_count, delta=graded_pct + " graded" if submissions_count > 0 else None)

render_divider()

# ── Grading Status ──
if submissions_count > 0:
    render_section_title("Grading Status")
    s1, s2, s3, s4 = st.columns(4)
    with s1:
        st.metric("✅ Done", done_count)
    with s2:
        st.metric("⏳ Pending", pending_count)
    with s3:
        st.metric("❌ Errors", error_count)
    with s4:
        st.metric("📝 Grade Rows", grades_count)

    # Progress bar
    if submissions_count > 0:
        pct = done_count / submissions_count
        st.progress(pct, text=f"Grading progress: {done_count}/{submissions_count} submissions complete ({pct*100:.1f}%)")

    render_divider()

# ── Workflow Guide ──
render_section_title("Workflow — Follow Steps In Order")

# Determine step completion
step_states = [
    ("01", "Create Course", "Set up your course with code and semester", courses_count > 0),
    ("02", "Create Exam", "Define exam type and total marks", exams_count > 0),
    ("03", "Upload Roster", "Import student list from Excel or CSV", students_count > 0),
    ("04", "Define Rubric", "Set questions, key points, and marks", False),  # checked separately
    ("05", "Upload PDFs", "Upload student answer PDFs", submissions_count > 0),
    ("06", "Run Grading", "OCR + LLM automated grading", done_count > 0),
    ("07", "Export Results", "Download final Excel gradebook", False),
]

# Check rubric count
with session_scope() as db:
    from db.models import Rubric
    rubric_count = db.query(Rubric).count()
step_states[3] = ("04", "Define Rubric", "Set questions, key points, and marks", rubric_count > 0)

for num, label, desc, done in step_states:
    if done:
        state_cls = "gw-step-done"
        num_cls = "gw-step-num-done"
        icon = "✓"
    else:
        # Find first incomplete
        first_incomplete = next((i for i, (_, _, _, d) in enumerate(step_states) if not d), None)
        current_idx = next((i for i, (n, _, _, _) in enumerate(step_states) if n == num), 0)
        if first_incomplete == current_idx:
            state_cls = "gw-step-active"
            num_cls = "gw-step-num-active"
            icon = num
        else:
            state_cls = "gw-step-pending"
            num_cls = "gw-step-num-pending"
            icon = num

    st.markdown(
        f"""
        <div class="gw-step {state_cls}">
            <div class="gw-step-num {num_cls}">{icon}</div>
            <div>
                <div class="gw-step-label">{label}</div>
                <div class="gw-step-desc">{desc}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

render_divider()

# ── Quick Tips ──
render_section_title("Quick Start Tips")
col_a, col_b = st.columns(2)
with col_a:
    st.markdown(
        """
        <div class="gw-info-card">
            <strong style="color: #7dd3fc; font-size: 0.85rem;">📂 File Naming</strong>
            <p style="color: #64748b; font-size: 0.8rem; margin: 0.4rem 0 0 0;">
                Name student PDFs with their roll number:<br>
                <code>22CS014_midterm.pdf</code>
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown(
        """
        <div class="gw-info-card">
            <strong style="color: #7dd3fc; font-size: 0.85rem;">🤖 Auto-Generate Rubrics</strong>
            <p style="color: #64748b; font-size: 0.8rem; margin: 0.4rem 0 0 0;">
                Upload your exam paper PDF on the Rubric page to automatically extract questions and key points.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
with col_b:
    st.markdown(
        """
        <div class="gw-info-card">
            <strong style="color: #7dd3fc; font-size: 0.85rem;">✏️ Manual Overrides</strong>
            <p style="color: #64748b; font-size: 0.8rem; margin: 0.4rem 0 0 0;">
                After grading, review individual answers on the Grade page and override any marks with a note.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown(
        """
        <div class="gw-info-card">
            <strong style="color: #7dd3fc; font-size: 0.85rem;">📊 Analytics</strong>
            <p style="color: #64748b; font-size: 0.8rem; margin: 0.4rem 0 0 0;">
                Use page 10 for AI-powered class insights, question difficulty analysis, and curriculum recommendations.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
