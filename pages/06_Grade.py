import json

import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.grading_service import grade_submission
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Grade — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header(
    "Grade Submissions",
    "Run automated OCR + LLM grading, review results, and override marks question by question.",
    "⚙️",
)

# ── Course & Exam Selectors ──
with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.markdown(
        '<div class="gw-warning-card">📚 No courses found. Create a course first.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

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

# ── Load Data ──
with session_scope() as db:
    rubrics = (
        db.query(Rubric)
        .filter(Rubric.exam_id == selected_exam_id)
        .order_by(Rubric.question_order.asc(), Rubric.id.asc())
        .all()
    )
    submissions = db.query(Submission).filter(Submission.exam_id == selected_exam_id).all()
    students = {
        student.id: student
        for student in db.query(Student).filter(Student.course_id == selected_course_id).all()
    }
    grades = (
        db.query(Grade)
        .join(Submission, Submission.id == Grade.submission_id)
        .filter(Submission.exam_id == selected_exam_id)
        .all()
    )

if not rubrics:
    st.markdown(
        '<div class="gw-warning-card">📋 No rubric defined. Define rubric questions on the Rubric page first.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

if not submissions:
    st.markdown(
        '<div class="gw-warning-card">📄 No submissions found. Upload student PDFs on the Submissions page first.</div>',
        unsafe_allow_html=True,
    )
    st.stop()

# ── Derived State ──
grades_by_submission: dict[int, list[Grade]] = {}
for grade in grades:
    grades_by_submission.setdefault(grade.submission_id, []).append(grade)

rubric_lookup = {rubric.id: rubric for rubric in rubrics}
max_total = sum(rubric.max_marks for rubric in rubrics)

pending = [s for s in submissions if s.status == "pending"]
grading = [s for s in submissions if s.status == "grading"]
done = [s for s in submissions if s.status == "done"]
errors = [s for s in submissions if s.status == "error"]
total = len(submissions)

render_divider()

# ── Tabs ──
tab_overview, tab_review = st.tabs(["📊  Overview & Batch Grading", "🔍  Per-Student Review"])

# ═══════════════════════════════════════════════
# TAB 1 — OVERVIEW & BATCH GRADING
# ═══════════════════════════════════════════════
with tab_overview:

    # KPI row
    render_section_title("Grading Status")
    k1, k2, k3, k4 = st.columns(4)
    with k1:
        st.markdown(
            f'<div class="gw-kpi">'
            f'<div class="gw-kpi-title">⏳ Pending</div>'
            f'<div class="gw-kpi-value">{len(pending)}</div>'
            f'<div class="gw-kpi-sub">awaiting grading</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    with k2:
        st.markdown(
            f'<div class="gw-kpi">'
            f'<div class="gw-kpi-title">⚙️ Grading</div>'
            f'<div class="gw-kpi-value">{len(grading)}</div>'
            f'<div class="gw-kpi-sub">in progress</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    with k3:
        st.markdown(
            f'<div class="gw-kpi">'
            f'<div class="gw-kpi-title">✅ Done</div>'
            f'<div class="gw-kpi-value">{len(done)}</div>'
            f'<div class="gw-kpi-sub">graded</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    with k4:
        st.markdown(
            f'<div class="gw-kpi">'
            f'<div class="gw-kpi-title">❌ Errors</div>'
            f'<div class="gw-kpi-value">{len(errors)}</div>'
            f'<div class="gw-kpi-sub">need attention</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)
    if total > 0:
        pct_done = len(done) / total
        st.progress(
            pct_done,
            text=f"Progress: {len(done)} / {total} graded ({pct_done * 100:.1f}%)",
        )

    render_divider()

    # ── Batch Grade Button ──
    if pending:
        render_section_title("Run Grading")
        btn_col, info_col = st.columns([1, 2])
        with btn_col:
            run_all = st.button(
                f"▶  Grade All Pending  ({len(pending)})",
                type="primary",
                use_container_width=True,
            )
        with info_col:
            st.markdown(
                '<div class="gw-info-card" style="padding:0.65rem 0.9rem; margin:0;">'
                '<span style="color:#7dd3fc; font-size:0.82rem; font-weight:600;">🤖 How it works</span><br>'
                '<span style="color:#64748b; font-size:0.79rem;">'
                'OCR extracts text from each PDF, then LLM evaluates answers against your rubric.<br>'
                '⏱ ~30–60 s per submission depending on PDF size and model availability.'
                '</span>'
                '</div>',
                unsafe_allow_html=True,
            )

        if run_all:
            fallback_summary: dict[str, list[int]] = {}
            progress_bar = st.progress(0.0)
            status_box = st.empty()

            for index, submission in enumerate(pending, start=1):
                student = students.get(submission.student_id)
                name = student.name if student else f"Student {submission.student_id}"
                status_box.info(f"⚙️ Grading **{name}** ({index}/{len(pending)})...")

                result = grade_submission(
                    submission_id=submission.id,
                    progress_callback=lambda msg: status_box.info(msg),
                )
                if result["fallback_questions"]:
                    fallback_summary[str(submission.id)] = result["fallback_questions"]

                progress_bar.progress(index / len(pending))

            status_box.success(
                f"✅ Batch grading complete — {len(pending)} submissions processed."
            )
            if fallback_summary:
                st.warning(
                    "⚠️ Question-detector fallback was used for some submissions "
                    "(all pages were graded for those questions)."
                )
                with st.expander("View fallback details"):
                    st.json(fallback_summary)
            st.rerun()
    else:
        if total > 0:
            st.markdown(
                '<div class="gw-success-card">✅ All submissions have been graded. '
                'Switch to the <strong>Per-Student Review</strong> tab to inspect results.</div>',
                unsafe_allow_html=True,
            )

    render_divider()

    # ── Summary Table ──
    render_section_title("Grade Summary")

    summary_rows = []
    for submission in submissions:
        student = students.get(submission.student_id)
        per_sub_grades = grades_by_submission.get(submission.id, [])
        total_score = sum(
            g.override_marks if g.override_marks is not None else g.awarded_marks
            for g in per_sub_grades
        )
        pct = (total_score / max_total * 100) if max_total > 0 else 0
        summary_rows.append(
            {
                "Roll": student.roll_number if student else "—",
                "Student": student.name if student else "Unknown",
                "Status": submission.status.title(),
                "Score": round(total_score, 2),
                "Max": round(max_total, 2),
                "Percentage": round(pct, 1),
                "Error": submission.error_message or "",
            }
        )

    if summary_rows:
        df_summary = pd.DataFrame(summary_rows)
        # Sort by percentage descending for quick overview
        df_summary = df_summary.sort_values("Percentage", ascending=False).reset_index(drop=True)
        st.dataframe(
            df_summary,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Score": st.column_config.NumberColumn("Score", format="%.2f"),
                "Max": st.column_config.NumberColumn("Max", format="%.2f"),
                "Percentage": st.column_config.ProgressColumn(
                    "Percentage",
                    format="%.1f%%",
                    min_value=0,
                    max_value=100,
                ),
                "Error": st.column_config.TextColumn("Error Note", width="medium"),
            },
        )

        # Class stats
        graded_pcts = [r["Percentage"] for r in summary_rows if r["Status"] == "Done"]
        if graded_pcts:
            render_divider()
            render_section_title("Class Statistics")
            cs1, cs2, cs3, cs4 = st.columns(4)
            cs1.metric("Class Average", f"{sum(graded_pcts)/len(graded_pcts):.1f}%")
            cs2.metric("Highest Score", f"{max(graded_pcts):.1f}%")
            cs3.metric("Lowest Score", f"{min(graded_pcts):.1f}%")
            pass_count = sum(1 for p in graded_pcts if p >= 40)
            cs4.metric("Pass Rate (≥40%)", f"{pass_count/len(graded_pcts)*100:.0f}%")


# ═══════════════════════════════════════════════
# TAB 2 — PER-STUDENT REVIEW
# ═══════════════════════════════════════════════
with tab_review:

    render_section_title("Detailed Review & Grade Override")

    # Filter & sort controls
    ctrl1, ctrl2, ctrl3 = st.columns([2, 2, 2])
    with ctrl1:
        filter_status = st.radio(
            "Filter by status",
            ["All", "Pending", "Done", "Error"],
            horizontal=True,
        )
    with ctrl2:
        sort_by = st.radio(
            "Sort by",
            ["Name", "Score ↑", "Score ↓"],
            horizontal=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # Apply filter
    if filter_status == "All":
        filtered_submissions = list(submissions)
    else:
        filtered_submissions = [
            s for s in submissions if s.status.lower() == filter_status.lower()
        ]

    # Apply sort
    def _sort_key(sub):
        per_sub = grades_by_submission.get(sub.id, [])
        score = sum(
            g.override_marks if g.override_marks is not None else g.awarded_marks
            for g in per_sub
        )
        student = students.get(sub.student_id)
        name = student.name if student else ""
        return (name, score)

    if sort_by == "Name":
        filtered_submissions.sort(key=lambda s: (students.get(s.student_id).name if students.get(s.student_id) else ""))
    elif sort_by == "Score ↑":
        filtered_submissions.sort(key=lambda s: sum(
            g.override_marks if g.override_marks is not None else g.awarded_marks
            for g in grades_by_submission.get(s.id, [])
        ))
    elif sort_by == "Score ↓":
        filtered_submissions.sort(key=lambda s: sum(
            g.override_marks if g.override_marks is not None else g.awarded_marks
            for g in grades_by_submission.get(s.id, [])
        ), reverse=True)

    if not filtered_submissions:
        st.markdown(
            '<div class="gw-info-card" style="text-align:center; padding:2rem;">'
            '<div style="font-size:1.5rem; margin-bottom:0.5rem;">🔍</div>'
            '<div style="color:#475569;">No submissions match the selected filter.</div>'
            '</div>',
            unsafe_allow_html=True,
        )

    for submission in filtered_submissions:
        student = students.get(submission.student_id)
        student_name = student.name if student else f"Student {submission.student_id}"
        roll = student.roll_number if student else "—"

        per_submission_grades = grades_by_submission.get(submission.id, [])
        total_score = sum(
            g.override_marks if g.override_marks is not None else g.awarded_marks
            for g in per_submission_grades
        )
        pct = (total_score / max_total * 100) if max_total > 0 else 0

        status_icons = {"pending": "⏳", "grading": "⚙️", "done": "✅", "error": "❌"}
        status_icon = status_icons.get(submission.status, "•")

        # Score color
        score_color = "#2dd4bf" if pct >= 70 else ("#fbbf24" if pct >= 40 else "#f87171")
        pct_display = f"{pct:.1f}%" if submission.status == "done" else "—"

        expander_label = (
            f"{status_icon}  {student_name}  ({roll})  —  "
            f"{total_score:.1f} / {max_total:.1f} pts  ({pct_display})"
        )

        with st.expander(expander_label, expanded=False):

            # Header row inside expander
            hdr1, hdr2, hdr3 = st.columns([1, 1, 1])
            with hdr1:
                st.markdown(
                    f'<div class="gw-kpi" style="padding:0.7rem 0.9rem;">'
                    f'<div class="gw-kpi-title">Total Score</div>'
                    f'<div class="gw-kpi-value" style="font-size:1.3rem; color:{score_color};">'
                    f'{total_score:.1f} / {max_total:.1f}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            with hdr2:
                st.markdown(
                    f'<div class="gw-kpi" style="padding:0.7rem 0.9rem;">'
                    f'<div class="gw-kpi-title">Percentage</div>'
                    f'<div class="gw-kpi-value" style="font-size:1.3rem; color:{score_color};">'
                    f'{pct_display}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            with hdr3:
                override_count = sum(1 for g in per_submission_grades if g.override_marks is not None)
                st.markdown(
                    f'<div class="gw-kpi" style="padding:0.7rem 0.9rem;">'
                    f'<div class="gw-kpi-title">Manual Overrides</div>'
                    f'<div class="gw-kpi-value" style="font-size:1.3rem;">{override_count}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            st.markdown("<br>", unsafe_allow_html=True)

            # Action row
            act1, act2 = st.columns([1, 3])
            with act1:
                if st.button("🔄 Regrade", key=f"regrade_{submission.id}", type="secondary"):
                    with session_scope() as db:
                        target = db.get(Submission, submission.id)
                        if target:
                            target.status = "pending"
                            target.error_message = None
                    with st.spinner("Regrading..."):
                        grade_submission(submission.id)
                    st.success("✅ Regrade complete.")
                    st.rerun()

            with act2:
                if submission.error_message:
                    st.markdown(
                        f'<div class="gw-warning-card" style="padding:0.5rem 0.75rem; margin:0;">'
                        f'<strong style="color:#fbbf24;">⚠️ Error:</strong>'
                        f' <span style="color:#94a3b8; font-size:0.82rem;">{submission.error_message}</span>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

            if not per_submission_grades:
                st.markdown(
                    '<div style="color:#475569; font-size:0.85rem; padding: 1rem 0;">'
                    'No grades yet. Run grading first.</div>',
                    unsafe_allow_html=True,
                )
                continue

            render_divider()

            # ── Per-question breakdown ──
            render_section_title("Question Breakdown")
            sorted_grades = sorted(per_submission_grades, key=lambda g: g.question_no)

            for grade in sorted_grades:
                rubric = rubric_lookup.get(grade.rubric_id)
                max_marks = rubric.max_marks if rubric else 0.0
                effective = (
                    grade.override_marks if grade.override_marks is not None else grade.awarded_marks
                )
                q_pct = (effective / max_marks * 100) if max_marks > 0 else 0
                score_cls = "high" if q_pct >= 70 else ("mid" if q_pct >= 40 else "low")
                override_badge = (
                    ' <span style="color:#fbbf24; font-size:0.72rem; '
                    'background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.2); '
                    'border-radius:4px; padding:0.1rem 0.4rem;">✏️ overridden</span>'
                    if grade.override_marks is not None
                    else ""
                )

                st.markdown(
                    f'<div style="margin: 0.9rem 0 0.4rem 0; display:flex; align-items:center; gap:0.6rem;">'
                    f'<span style="font-weight:700; color:#e2e8f0; font-size:0.95rem;">{grade.question_no}</span>'
                    f'<span class="gw-score gw-score-{score_cls}">{effective:.1f} / {max_marks:.1f}</span>'
                    f'{override_badge}'
                    f'</div>',
                    unsafe_allow_html=True,
                )

                # Confidence
                if grade.confidence is not None and grade.confidence > 0:
                    conf_pct = int(grade.confidence * 100) if grade.confidence <= 1 else int(grade.confidence)
                    conf_color = (
                        "#2dd4bf" if conf_pct >= 80 else ("#fbbf24" if conf_pct >= 50 else "#f87171")
                    )
                    st.markdown(
                        f'<span style="color:#475569; font-size:0.75rem;">AI Confidence: '
                        f'<span style="color:{conf_color}; font-weight:600;">{conf_pct}%</span></span>',
                        unsafe_allow_html=True,
                    )

                # Feedback
                if grade.feedback:
                    st.markdown(
                        f'<div style="color:#94a3b8; font-size:0.85rem; line-height:1.6; '
                        f'margin: 0.35rem 0 0.5rem 0; padding: 0.5rem 0.75rem; '
                        f'background:rgba(15,23,42,0.4); border-left:2px solid rgba(56,189,248,0.2); '
                        f'border-radius:0 6px 6px 0;">'
                        f'{grade.feedback}'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

                # Matched / Missing points
                matched = json.loads(grade.matched_points_json or "[]")
                missing = json.loads(grade.missing_points_json or "[]")

                if matched or missing:
                    mp1, mp2 = st.columns(2)
                    with mp1:
                        if matched:
                            st.markdown(
                                '<div style="color:#2dd4bf; font-size:0.78rem; font-weight:600; '
                                'margin-bottom:0.25rem;">✅ Matched Points</div>',
                                unsafe_allow_html=True,
                            )
                            for pt in matched:
                                st.markdown(
                                    f'<div style="color:#64748b; font-size:0.78rem; '
                                    f'padding-left:0.5rem;">• {pt}</div>',
                                    unsafe_allow_html=True,
                                )
                    with mp2:
                        if missing:
                            st.markdown(
                                '<div style="color:#f87171; font-size:0.78rem; font-weight:600; '
                                'margin-bottom:0.25rem;">❌ Missing Points</div>',
                                unsafe_allow_html=True,
                            )
                            for pt in missing:
                                st.markdown(
                                    f'<div style="color:#64748b; font-size:0.78rem; '
                                    f'padding-left:0.5rem;">• {pt}</div>',
                                    unsafe_allow_html=True,
                                )

                # Override form
                st.markdown("<br>", unsafe_allow_html=True)
                with st.form(f"override_{grade.id}"):
                    st.markdown(
                        '<div style="color:#94a3b8; font-size:0.8rem; font-weight:600; '
                        'margin-bottom:0.5rem;">✏️ Manual Override</div>',
                        unsafe_allow_html=True,
                    )
                    ov1, ov2 = st.columns([1, 2])
                    override_marks = ov1.number_input(
                        "Override marks",
                        min_value=0.0,
                        max_value=float(max_marks),
                        value=float(effective),
                        step=0.5,
                        key=f"override_marks_{grade.id}",
                    )
                    override_note = ov2.text_input(
                        "Reason for override",
                        value=grade.override_note or "",
                        placeholder="e.g. Partially correct approach, diagram missing",
                        key=f"override_note_{grade.id}",
                    )
                    save_override = st.form_submit_button(
                        "💾 Save Override", type="primary"
                    )

                if save_override:
                    with session_scope() as db:
                        target = db.get(Grade, grade.id)
                        if target:
                            target.override_marks = float(override_marks)
                            target.override_note = override_note.strip() or None
                    st.success("Override saved.")
                    st.rerun()

                # OCR text toggle
                if grade.ocr_text:
                    show_ocr = st.toggle(
                        "📄 Show extracted OCR text", key=f"show_ocr_{grade.id}"
                    )
                    if show_ocr:
                        st.text_area(
                            "Extracted OCR text",
                            value=grade.ocr_text,
                            height=180,
                            key=f"ocr_text_{grade.id}",
                            disabled=True,
                        )

                st.markdown(
                    '<hr style="border:none; border-top:1px solid rgba(56,189,248,0.07); margin:0.75rem 0;">',
                    unsafe_allow_html=True,
                )
