import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Rubric, Submission
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Exams — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header("Exams", "Create and manage exams under a selected course.", "📝")

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.markdown(
        '<div class="gw-warning-card">📚 No courses found. '
        '<a href="/" style="color:#38bdf8">Create a course first</a> on the Courses page.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

# ── Course selector ──
render_section_title("Select Course")
course_labels = [f"{course.id} | {course.code} — {course.name}" for course in courses]
selected_course_label = st.selectbox("Course", course_labels, label_visibility="collapsed")
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())
selected_course = next(c for c in courses if c.id == selected_course_id)

st.markdown(
    f'<span class="gw-chip gw-chip-success">📘 {selected_course.code}</span>'
    f'<span class="gw-chip">{selected_course.name}</span>'
    f'<span class="gw-chip">{selected_course.semester or "No semester"}</span>',
    unsafe_allow_html=True,
)

render_divider()

# ── Create Exam ──
render_section_title("Create New Exam")
with st.form("create_exam", clear_on_submit=True):
    c1, c2, c3 = st.columns([3, 1.5, 1.5])
    exam_name = c1.text_input("Exam name", placeholder="e.g. Midterm 1")
    exam_type = c2.selectbox("Type", ["exam", "quiz", "assignment"])
    total_marks = c3.number_input("Total marks", min_value=1.0, value=100.0, step=5.0)
    create_exam_clicked = st.form_submit_button("➕ Create Exam", type="primary", use_container_width=True)

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
                st.warning(f"An exam named **{name}** already exists in this course.")
            else:
                db.add(
                    Exam(
                        course_id=selected_course_id,
                        name=name,
                        exam_type=exam_type,
                        total_marks=float(total_marks),
                    )
                )
                st.success(f"✅ Exam **{name}** created successfully!")
                st.rerun()

render_divider()

# ── Existing Exams ──
with session_scope() as db:
    exams = (
        db.query(Exam)
        .filter(Exam.course_id == selected_course_id)
        .order_by(Exam.created_at.desc())
        .all()
    )
    rows = []
    for exam in exams:
        rubric_cnt = db.query(Rubric).filter(Rubric.exam_id == exam.id).count()
        submission_cnt = db.query(Submission).filter(Submission.exam_id == exam.id).count()
        done_cnt = db.query(Submission).filter(Submission.exam_id == exam.id, Submission.status == "done").count()
        rows.append(
            {
                "ID": exam.id,
                "Name": exam.name,
                "Type": exam.exam_type.title(),
                "Total Marks": exam.total_marks,
                "Questions": rubric_cnt,
                "Submissions": submission_cnt,
                "Graded": done_cnt,
                "Created": exam.created_at.strftime("%d %b %Y") if exam.created_at else "—",
            }
        )

render_section_title(f"Exams in {selected_course.code} ({len(rows)})")
if rows:
    st.dataframe(
        pd.DataFrame(rows),
        use_container_width=True,
        hide_index=True,
        column_config={
            "ID": st.column_config.NumberColumn("ID", width="small"),
            "Total Marks": st.column_config.NumberColumn("Marks", format="%.0f"),
            "Questions": st.column_config.NumberColumn("Questions", width="small"),
            "Submissions": st.column_config.NumberColumn("Submitted", width="small"),
            "Graded": st.column_config.NumberColumn("Graded", width="small"),
        },
    )

    render_divider()
    render_section_title("Delete Exam")
    st.markdown(
        '<div class="gw-warning-card"><strong style="color:#fbbf24">⚠️ Warning:</strong>'
        ' <span style="color:#94a3b8; font-size:0.85rem">Deleting an exam removes all its rubrics, submissions, and grades.</span></div>',
        unsafe_allow_html=True,
    )
    delete_labels = [f"{exam.id} | {exam.name} ({exam.exam_type})" for exam in exams]
    selected_delete = st.selectbox("Select exam to delete", ["— Select —"] + delete_labels, index=0, label_visibility="collapsed")
    if st.button("🗑️ Delete Selected Exam", type="secondary", disabled=(selected_delete == "— Select —")):
        exam_id = int(selected_delete.split("|", 1)[0].strip())
        with session_scope() as db:
            target = db.get(Exam, exam_id)
            if target:
                db.delete(target)
                st.success("Exam deleted.")
                st.rerun()
else:
    st.markdown(
        '<div class="gw-info-card" style="text-align:center; padding: 2rem;">'
        '<div style="font-size:2rem; margin-bottom:0.5rem;">📋</div>'
        '<div style="color:#475569;">No exams yet for this course. Create your first exam above.</div>'
        '</div>',
        unsafe_allow_html=True,
    )
