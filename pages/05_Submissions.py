import os
import re
from pathlib import Path

import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Rubric, Student, Submission
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title
from utils.helpers import normalize_roll


def infer_roll_from_filename(file_name: str) -> str:
    stem = Path(file_name).stem
    tokens = re.findall(r"[A-Za-z0-9]+", stem)
    numeric_tokens = [token for token in tokens if any(ch.isdigit() for ch in token)]
    candidate = numeric_tokens[0] if numeric_tokens else (tokens[0] if tokens else stem)
    return normalize_roll(candidate)


st.set_page_config(page_title="Submissions — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header(
    "Upload Submissions",
    "Upload student answer PDFs — filenames should include the roll number.",
    "📄",
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

with session_scope() as db:
    students = (
        db.query(Student)
        .filter(Student.course_id == selected_course_id)
        .order_by(Student.roll_number.asc().nullslast(), Student.name.asc())
        .all()
    )
    rubric_count = db.query(Rubric).filter(Rubric.exam_id == selected_exam_id).count()

if not students:
    st.markdown(
        '<div class="gw-warning-card">👥 No students found. Upload a roster first on the Roster page.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

# ── Info bar ──
ic1, ic2, ic3 = st.columns(3)
ic1.metric("Students in course", len(students))
ic2.metric("Rubric questions", rubric_count)

if rubric_count == 0:
    st.markdown(
        '<div class="gw-warning-card">⚠️ <strong style="color:#fbbf24">No rubric defined yet.</strong>'
        ' <span style="color:#94a3b8; font-size:0.85rem">You can upload PDFs now, but grading requires rubrics to be defined first.</span></div>',
        unsafe_allow_html=True,
    )

render_divider()

# ── Upload ──
render_section_title("Upload Student PDFs")
st.markdown(
    """
    <div class="gw-info-card">
        <strong style="color:#7dd3fc; font-size:0.85rem;">💡 Naming Convention</strong>
        <div style="color:#64748b; font-size:0.82rem; margin-top:0.3rem;">
            Name files with the student's roll number for automatic matching:
            <code>22CS014_midterm.pdf</code> or <code>22CS014.pdf</code>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

uploaded_files = st.file_uploader(
    "Drop student PDFs here (multiple files supported)",
    type=["pdf"],
    accept_multiple_files=True,
    help="Upload one PDF per student. Filename must contain the roll number.",
)

if uploaded_files:
    st.markdown(f"**{len(uploaded_files)} file(s) selected**")

    # Preview matches
    with session_scope() as db:
        fresh_students = db.query(Student).filter(Student.course_id == selected_course_id).all()
        by_roll = {
            normalize_roll(student.roll_number): student
            for student in fresh_students
            if student.roll_number
        }

    preview_rows = []
    for uf in uploaded_files:
        inferred = infer_roll_from_filename(uf.name)
        matched = by_roll.get(inferred)
        preview_rows.append({
            "File": uf.name,
            "Inferred Roll": inferred,
            "Matched Student": matched.name if matched else "❌ No match",
            "Status": "✅ Ready" if matched else "⚠️ Unmatched",
        })

    matched_count = sum(1 for r in preview_rows if "Ready" in r["Status"])
    unmatched_count = len(preview_rows) - matched_count

    pm1, pm2 = st.columns(2)
    pm1.metric("Matched", matched_count, delta=f"{matched_count}/{len(preview_rows)}")
    pm2.metric("Unmatched", unmatched_count, delta_color="inverse")

    st.dataframe(pd.DataFrame(preview_rows), use_container_width=True, hide_index=True)

    if st.button(f"💾 Save {matched_count} Matched Uploads", type="primary", disabled=matched_count == 0):
        upload_root = Path(os.getenv("UPLOAD_DIR", "data/uploads")) / f"exam_{selected_exam_id}"
        upload_root.mkdir(parents=True, exist_ok=True)

        matched = 0
        replaced = 0
        unmatched_files: list[str] = []

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
                    unmatched_files.append(uploaded.name)
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

        st.success(f"✅ Saved **{matched}** files ({replaced} replaced existing submissions).")
        if unmatched_files:
            st.warning(f"⚠️ {len(unmatched_files)} files did not match any student: {', '.join(unmatched_files)}")
        st.rerun()

render_divider()

# ── Submission Status ──
with session_scope() as db:
    submissions = (
        db.query(Submission, Student)
        .join(Student, Student.id == Submission.student_id)
        .filter(Submission.exam_id == selected_exam_id)
        .order_by(Student.roll_number.asc().nullslast(), Student.name.asc())
        .all()
    )

render_section_title(f"Submission Status ({len(submissions)} students)")

if submissions:
    # Status summary
    status_counts = {}
    for sub, _ in submissions:
        status_counts[sub.status] = status_counts.get(sub.status, 0) + 1

    sc_cols = st.columns(len(status_counts) or 1)
    status_icons = {"pending": "⏳", "grading": "⚙️", "done": "✅", "error": "❌"}
    for i, (status, count) in enumerate(status_counts.items()):
        sc_cols[i].metric(f"{status_icons.get(status, '•')} {status.title()}", count)

    # Progress
    total = len(submissions)
    done = status_counts.get("done", 0)
    if total > 0:
        st.progress(done / total, text=f"Grading progress: {done}/{total}")

    table = []
    for submission, student in submissions:
        table.append(
            {
                "Roll": student.roll_number or "—",
                "Student": student.name,
                "File": submission.file_name,
                "Status": submission.status.title(),
                "Error": submission.error_message or "",
            }
        )
    st.dataframe(
        pd.DataFrame(table),
        use_container_width=True,
        hide_index=True,
        column_config={
            "Status": st.column_config.TextColumn("Status"),
        },
    )

    render_divider()
    if st.button("🔄 Reset All Submissions to Pending", type="secondary"):
        with session_scope() as db:
            targets = db.query(Submission).filter(Submission.exam_id == selected_exam_id).all()
            for row in targets:
                row.status = "pending"
                row.error_message = None
        st.success("All submissions reset to pending.")
        st.rerun()
else:
    st.markdown(
        '<div class="gw-info-card" style="text-align:center; padding: 2rem;">'
        '<div style="font-size:2rem; margin-bottom:0.5rem;">📂</div>'
        '<div style="color:#475569;">No PDFs uploaded for this exam yet.</div>'
        '</div>',
        unsafe_allow_html=True,
    )
