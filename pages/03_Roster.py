import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Student
from services.roster_service import import_roster, load_roster_dataframe
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Roster — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header("Upload Roster", "Import your student list from Excel or CSV.", "👥")

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.markdown(
        '<div class="gw-warning-card">📚 No courses found. Create a course first.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

# ── Course selector ──
render_section_title("Select Course")
course_labels = [f"{course.id} | {course.code} — {course.name}" for course in courses]
selected_course_label = st.selectbox("Course", course_labels, label_visibility="collapsed")
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())
selected_course = next(c for c in courses if c.id == selected_course_id)

# Current count
with session_scope() as db:
    current_count = db.query(Student).filter(Student.course_id == selected_course_id).count()

c1, c2 = st.columns([3, 1])
with c1:
    st.markdown(
        f'<span class="gw-chip gw-chip-success">📘 {selected_course.code}</span>'
        f'<span class="gw-chip">{selected_course.name}</span>',
        unsafe_allow_html=True,
    )
with c2:
    st.metric("Current students", current_count)

render_divider()

# ── Upload Instructions ──
render_section_title("Upload Roster File")
st.markdown(
    """
    <div class="gw-info-card">
        <strong style="color:#7dd3fc; font-size:0.85rem;">📋 File Format Requirements</strong>
        <div style="color:#64748b; font-size:0.82rem; margin-top:0.5rem; line-height:1.8;">
            <strong style="color:#94a3b8;">Required columns:</strong>
            <code>roll_number</code> (or <code>roll</code>, <code>id</code>, <code>student id</code>) &amp;
            <code>name</code> (or <code>student name</code>)<br>
            <strong style="color:#94a3b8;">Optional:</strong> <code>email</code><br>
            <strong style="color:#94a3b8;">Formats:</strong> Excel (.xlsx, .xls) or CSV
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

uploaded = st.file_uploader(
    "Drop your roster file here",
    type=["xlsx", "xls", "csv"],
    help="Excel or CSV file with student roll numbers and names",
)

if uploaded:
    file_bytes = uploaded.getvalue()
    try:
        preview_df = load_roster_dataframe(file_bytes, uploaded.name)

        st.markdown(f"**Preview** — {len(preview_df)} rows detected")
        st.dataframe(
            preview_df.head(20),
            use_container_width=True,
            hide_index=True,
        )

        col_btn, col_info = st.columns([1, 2])
        with col_btn:
            do_import = st.button("📥 Import Roster", type="primary", use_container_width=True)
        with col_info:
            st.markdown(
                '<div style="color:#475569; font-size:0.8rem; padding-top:0.5rem;">'
                'Existing students with the same roll number will be updated.</div>',
                unsafe_allow_html=True,
            )

        if do_import:
            with st.spinner("Importing roster..."):
                with session_scope() as db:
                    result = import_roster(
                        file_bytes=file_bytes,
                        file_name=uploaded.name,
                        course_id=selected_course_id,
                        db_session=db,
                    )
            st.success(f"✅ {result['message']}")

            r1, r2, r3, r4 = st.columns(4)
            r1.metric("Added", result["added"])
            r2.metric("Updated", result["updated"])
            r3.metric("Duplicates", result["duplicate_rows"])
            r4.metric("Invalid", result["invalid_rows"])
            st.rerun()

    except Exception as exc:
        st.error(f"Roster parsing failed: {exc}")

render_divider()

# ── Current Students ──
with session_scope() as db:
    students = (
        db.query(Student)
        .filter(Student.course_id == selected_course_id)
        .order_by(Student.roll_number.asc().nullslast(), Student.name.asc())
        .all()
    )

render_section_title(f"Enrolled Students ({len(students)})")

if students:
    table = [
        {
            "Roll Number": student.roll_number or "—",
            "Name": student.name,
            "Email": student.email or "—",
        }
        for student in students
    ]
    st.dataframe(
        pd.DataFrame(table),
        use_container_width=True,
        hide_index=True,
    )

    render_divider()
    st.markdown(
        '<div class="gw-warning-card"><strong style="color:#fbbf24">⚠️ Danger zone:</strong>'
        ' <span style="color:#94a3b8; font-size:0.85rem">This will remove all students and their submissions from this course.</span></div>',
        unsafe_allow_html=True,
    )
    if st.button("🗑️ Clear All Students in This Course", type="secondary"):
        with session_scope() as db:
            db.query(Student).filter(Student.course_id == selected_course_id).delete()
        st.success("All students removed for this course.")
        st.rerun()
else:
    st.markdown(
        '<div class="gw-info-card" style="text-align:center; padding: 2rem;">'
        '<div style="font-size:2rem; margin-bottom:0.5rem;">👤</div>'
        '<div style="color:#475569;">No students enrolled yet. Upload a roster file above.</div>'
        '</div>',
        unsafe_allow_html=True,
    )
