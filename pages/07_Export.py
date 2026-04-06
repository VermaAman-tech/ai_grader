import os
from datetime import datetime
from pathlib import Path

import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.export_service import export_exam_gradebook
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Export — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header(
    "Export Gradebook",
    "Generate and download the final Excel gradebook with all scores and feedback.",
    "📊",
)

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.markdown(
        '<div class="gw-warning-card">📚 No courses found. Create a course first.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

# ── Selectors ──
render_section_title("Select Course & Exam")
col_a, col_b = st.columns(2)
course_labels = [f"{course.id} | {course.code} — {course.name}" for course in courses]
selected_course_label = col_a.selectbox("Course", course_labels)
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())

with session_scope() as db:
    exams = (
        db.query(Exam)
        .filter(Exam.course_id == selected_course_id)
        .order_by(Exam.created_at.desc())
        .all()
    )

if not exams:
    st.markdown(
        '<div class="gw-warning-card">📝 No exams found. Create an exam first.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

exam_labels = [f"{exam.id} | {exam.name}" for exam in exams]
selected_exam_label = col_b.selectbox("Exam", exam_labels)
selected_exam_id = int(selected_exam_label.split("|", 1)[0].strip())

render_divider()

# ── Stats ──
with session_scope() as db:
    total_submissions = db.query(Submission).filter(Submission.exam_id == selected_exam_id).count()
    done_submissions = (
        db.query(Submission)
        .filter(Submission.exam_id == selected_exam_id, Submission.status == "done")
        .count()
    )
    error_submissions = (
        db.query(Submission)
        .filter(Submission.exam_id == selected_exam_id, Submission.status == "error")
        .count()
    )
    rubric_count = db.query(Rubric).filter(Rubric.exam_id == selected_exam_id).count()
    grade_count = (
        db.query(Grade)
        .join(Submission, Submission.id == Grade.submission_id)
        .filter(Submission.exam_id == selected_exam_id)
        .count()
    )

render_section_title("Grading Completion")

sc1, sc2, sc3, sc4 = st.columns(4)
sc1.metric("Total Submissions", total_submissions)
sc2.metric("Graded", done_submissions)
sc3.metric("Errors", error_submissions)
sc4.metric("Grade Rows", grade_count)

if total_submissions > 0:
    pct = done_submissions / total_submissions
    st.progress(pct, text=f"Graded: {done_submissions}/{total_submissions} ({pct*100:.1f}%)")

    if done_submissions == 0:
        st.markdown(
            '<div class="gw-warning-card">⚠️ <strong style="color:#fbbf24">No graded submissions yet.</strong>'
            ' <span style="color:#94a3b8; font-size:0.85rem">Run grading on the Grade page first.</span></div>',
            unsafe_allow_html=True,
        )
    elif done_submissions < total_submissions:
        st.markdown(
            f'<div class="gw-warning-card">ℹ️ <strong style="color:#fbbf24">{total_submissions - done_submissions} submissions</strong>'
            f' <span style="color:#94a3b8; font-size:0.85rem">are not yet graded. You can still export partial results.</span></div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div class="gw-success-card">✅ <strong style="color:#2dd4bf">All submissions graded!</strong>'
            ' <span style="color:#94a3b8; font-size:0.85rem">Ready for full export.</span></div>',
            unsafe_allow_html=True,
        )

render_divider()

# ── Generate ──
render_section_title("Generate Gradebook")
st.markdown(
    """
    <div class="gw-info-card">
        <strong style="color:#7dd3fc; font-size:0.85rem;">📋 What's included in the export</strong>
        <div style="color:#64748b; font-size:0.82rem; margin-top:0.4rem; line-height:1.7;">
            • Student roll numbers and names<br>
            • Per-question scores (with overrides applied)<br>
            • Total score and percentage<br>
            • AI feedback per question<br>
            • Grade status (done / pending / error)
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

col_gen, col_dl = st.columns([1, 1])

with col_gen:
    if st.button("📊 Generate Gradebook", type="primary", use_container_width=True, disabled=(done_submissions == 0)):
        with st.spinner("Generating Excel gradebook..."):
            export_dir = Path(os.getenv("EXPORT_DIR", "data/exports"))
            export_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = export_dir / f"exam_{selected_exam_id}_gradebook_{stamp}.xlsx"
            output = export_exam_gradebook(selected_exam_id, str(file_path))
            st.session_state["latest_export_path"] = output
        st.success("✅ Gradebook generated successfully!")
        st.rerun()

with col_dl:
    latest = st.session_state.get("latest_export_path")
    if latest and Path(latest).exists():
        with open(latest, "rb") as handle:
            file_bytes = handle.read()
        st.download_button(
            label="⬇️ Download Excel Gradebook",
            data=file_bytes,
            file_name=Path(latest).name,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
            type="primary",
        )
        file_size_kb = len(file_bytes) / 1024
        st.markdown(
            f'<div style="color:#475569; font-size:0.75rem; text-align:center; margin-top:0.3rem;">'
            f'📁 {Path(latest).name} ({file_size_kb:.1f} KB)</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div style="color:#475569; font-size:0.85rem; padding: 1rem; text-align:center; border: 1px dashed rgba(56,189,248,0.1); border-radius:10px;">'
            'Generate gradebook first to enable download.</div>',
            unsafe_allow_html=True,
        )

# ── Previous exports ──
export_dir = Path(os.getenv("EXPORT_DIR", "data/exports"))
if export_dir.exists():
    existing_exports = sorted(export_dir.glob(f"exam_{selected_exam_id}_gradebook_*.xlsx"), reverse=True)
    if len(existing_exports) > 1:
        render_divider()
        render_section_title("Previous Exports")
        for export_file in existing_exports[:5]:
            modified = datetime.fromtimestamp(export_file.stat().st_mtime).strftime("%d %b %Y %H:%M")
            size_kb = export_file.stat().st_size / 1024
            ec1, ec2 = st.columns([3, 1])
            with ec1:
                st.markdown(
                    f'<div style="color:#94a3b8; font-size:0.82rem;">'
                    f'📄 {export_file.name} <span style="color:#475569;">({size_kb:.1f} KB • {modified})</span></div>',
                    unsafe_allow_html=True,
                )
            with ec2:
                with open(export_file, "rb") as f:
                    st.download_button(
                        label="⬇️",
                        data=f.read(),
                        file_name=export_file.name,
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key=f"dl_{export_file.name}",
                    )
