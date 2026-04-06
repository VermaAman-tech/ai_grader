import json
from collections import Counter

import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.llm_service import LLMService
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Analytics — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header(
    "Analytics & Insights",
    "Class performance statistics, question difficulty analysis, and AI-powered curriculum recommendations.",
    "📊",
)

# ── Selectors ──
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

# ── Data load ──
with session_scope() as db:
    rubrics = (
        db.query(Rubric)
        .filter(Rubric.exam_id == selected_exam_id)
        .order_by(Rubric.question_order.asc())
        .all()
    )
    submissions = (
        db.query(Submission)
        .filter(Submission.exam_id == selected_exam_id, Submission.status == "done")
        .all()
    )
    sub_ids = [s.id for s in submissions]

    if not sub_ids:
        st.markdown(
            '<div class="gw-info-card" style="text-align:center; padding:2rem;">'
            '<div style="font-size:2rem; margin-bottom:0.5rem;">📊</div>'
            '<div style="color:#475569;">No graded submissions yet for this exam.<br>'
            'Go to <strong>06. Grade</strong> to process uploaded PDFs first.</div>'
            '</div>',
            unsafe_allow_html=True,
        )
        st.stop()

    grades = db.query(Grade).filter(Grade.submission_id.in_(sub_ids)).all()
    students = db.query(Student).filter(Student.course_id == selected_course_id).all()

student_dict = {s.id: s for s in students}
rubric_dict = {r.id: r for r in rubrics}
total_exam_marks = sum(r.max_marks for r in rubrics)

# ── Compute totals ──
student_totals: dict[int, float] = {}
for g in grades:
    effective = g.override_marks if g.override_marks is not None else g.awarded_marks
    student_totals[g.submission_id] = student_totals.get(g.submission_id, 0.0) + effective

scores_list = list(student_totals.values())
if not scores_list:
    st.warning("No grade data available for this exam.")
    st.stop()

avg_score = sum(scores_list) / len(scores_list)
max_score = max(scores_list)
min_score = min(scores_list)
median_score = sorted(scores_list)[len(scores_list) // 2]
pass_count = sum(1 for s in scores_list if (s / total_exam_marks * 100) >= 40)
pass_rate = (pass_count / len(scores_list) * 100) if scores_list else 0

render_divider()

# ── Overall Stats ──
render_section_title("Overall Exam Statistics")

k1, k2, k3, k4, k5 = st.columns(5)
k1.metric("Students Graded", len(submissions))
k2.metric("Class Average", f"{avg_score:.1f}", delta=f"{avg_score/total_exam_marks*100:.1f}%")
k3.metric("Highest Score", f"{max_score:.1f}")
k4.metric("Lowest Score", f"{min_score:.1f}")
k5.metric("Pass Rate (≥40%)", f"{pass_rate:.1f}%")

render_divider()

# ── Score Distribution ──
render_section_title("Score Distribution")

scores_df = pd.DataFrame({"Score": scores_list, "Percentage": [s / total_exam_marks * 100 for s in scores_list]})

col_dist, col_info = st.columns([2, 1])

with col_dist:
    # Build histogram bins
    bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    labels = [f"{b}-{bins[i+1]}%" for i, b in enumerate(bins[:-1])]
    counts = [0] * len(labels)
    for pct in scores_df["Percentage"]:
        for i in range(len(bins) - 1):
            if bins[i] <= pct < bins[i + 1] or (pct == 100 and i == len(bins) - 2):
                counts[i] += 1
                break
    hist_df = pd.DataFrame({"Range": labels, "Students": counts})
    hist_df = hist_df[hist_df["Students"] > 0]
    if not hist_df.empty:
        st.bar_chart(hist_df.set_index("Range")["Students"])

with col_info:
    st.markdown(
        f"""
        <div class="gw-kpi" style="margin-bottom:0.5rem;">
            <div class="gw-kpi-title">Median Score</div>
            <div class="gw-kpi-value">{median_score:.1f}</div>
            <div class="gw-kpi-sub">{median_score/total_exam_marks*100:.1f}% of {total_exam_marks:.0f} pts</div>
        </div>
        <div class="gw-kpi" style="margin-bottom:0.5rem;">
            <div class="gw-kpi-title">Score Range</div>
            <div class="gw-kpi-value">{max_score - min_score:.1f}</div>
            <div class="gw-kpi-sub">{min_score:.1f} – {max_score:.1f} pts</div>
        </div>
        <div class="gw-kpi">
            <div class="gw-kpi-title">Passed (≥40%)</div>
            <div class="gw-kpi-value">{pass_count} / {len(scores_list)}</div>
            <div class="gw-kpi-sub">{pass_rate:.1f}% pass rate</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

render_divider()

# ── Question Stats ──
render_section_title("Question-wise Performance")

question_stats = []
for r in rubrics:
    q_grades = [g for g in grades if g.rubric_id == r.id]
    if not q_grades:
        continue
    effective_scores = [
        (g.override_marks if g.override_marks is not None else g.awarded_marks)
        for g in q_grades
    ]
    avg_q = sum(effective_scores) / len(effective_scores)
    perc_q = (avg_q / r.max_marks) * 100 if r.max_marks > 0 else 0
    question_stats.append(
        {
            "Question": r.question_no,
            "Max Marks": r.max_marks,
            "Avg Score": round(avg_q, 2),
            "Avg %": round(perc_q, 1),
            "ID": r.id,
        }
    )

if question_stats:
    q_df = pd.DataFrame(question_stats)

    # Difficulty indicators
    toughest = q_df.loc[q_df["Avg %"].idxmin()]
    easiest = q_df.loc[q_df["Avg %"].idxmax()]

    ta, ea = st.columns(2)
    with ta:
        st.markdown(
            f'<div class="gw-warning-card">'
            f'<strong style="color:#fbbf24;">📉 Toughest Question: {toughest["Question"]}</strong><br>'
            f'<span style="color:#94a3b8; font-size:0.82rem;">'
            f'Average {toughest["Avg Score"]:.2f} / {toughest["Max Marks"]:.0f} pts ({toughest["Avg %"]:.1f}%)'
            f'</span></div>',
            unsafe_allow_html=True,
        )
    with ea:
        st.markdown(
            f'<div class="gw-success-card">'
            f'<strong style="color:#2dd4bf;">📈 Easiest Question: {easiest["Question"]}</strong><br>'
            f'<span style="color:#94a3b8; font-size:0.82rem;">'
            f'Average {easiest["Avg Score"]:.2f} / {easiest["Max Marks"]:.0f} pts ({easiest["Avg %"]:.1f}%)'
            f'</span></div>',
            unsafe_allow_html=True,
        )

    # Bar chart of avg scores
    chart_df = q_df.set_index("Question")[["Avg Score", "Max Marks"]]
    st.bar_chart(chart_df)

    # Table
    st.dataframe(
        q_df.drop(columns=["ID"]),
        use_container_width=True,
        hide_index=True,
        column_config={
            "Avg %": st.column_config.ProgressColumn(
                "Avg %",
                format="%.1f%%",
                min_value=0,
                max_value=100,
            ),
            "Avg Score": st.column_config.NumberColumn("Avg Score", format="%.2f"),
            "Max Marks": st.column_config.NumberColumn("Max Marks", format="%.0f"),
        },
    )

render_divider()

# ── Student Leaderboard ──
render_section_title("Student Score Summary")

student_rows = []
for sub in submissions:
    student = student_dict.get(sub.student_id)
    total = student_totals.get(sub.id, 0.0)
    pct = (total / total_exam_marks * 100) if total_exam_marks > 0 else 0
    grade_letter = "A" if pct >= 90 else ("B" if pct >= 75 else ("C" if pct >= 60 else ("D" if pct >= 40 else "F")))
    student_rows.append(
        {
            "Roll": student.roll_number if student else "—",
            "Name": student.name if student else f"Student {sub.student_id}",
            "Score": round(total, 2),
            "Max": round(total_exam_marks, 2),
            "Percentage": round(pct, 1),
            "Grade": grade_letter,
        }
    )

student_rows.sort(key=lambda x: x["Score"], reverse=True)
for i, row in enumerate(student_rows):
    row["Rank"] = i + 1

if student_rows:
    st.dataframe(
        pd.DataFrame(student_rows)[["Rank", "Roll", "Name", "Score", "Percentage", "Grade"]],
        use_container_width=True,
        hide_index=True,
        column_config={
            "Rank": st.column_config.NumberColumn("Rank", width="small"),
            "Percentage": st.column_config.ProgressColumn(
                "Percentage",
                format="%.1f%%",
                min_value=0,
                max_value=100,
            ),
            "Score": st.column_config.NumberColumn("Score", format="%.2f"),
        },
    )

render_divider()

# ── Question Deep Dive ──
render_section_title("Question Deep Dive & AI Analysis")
st.markdown(
    '<div style="color:#64748b; font-size:0.82rem; margin-bottom:1rem;">'
    'Expand each question to see missed key points and generate AI-powered teaching recommendations.'
    '</div>',
    unsafe_allow_html=True,
)

llm = LLMService()

for r in rubrics:
    q_grades = [g for g in grades if g.rubric_id == r.id]
    if not q_grades:
        continue

    effective_scores = [
        (g.override_marks if g.override_marks is not None else g.awarded_marks)
        for g in q_grades
    ]
    avg_q = sum(effective_scores) / len(effective_scores)
    q_pct = (avg_q / r.max_marks * 100) if r.max_marks > 0 else 0
    diff_icon = "🔴" if q_pct < 40 else ("🟡" if q_pct < 70 else "🟢")

    with st.expander(
        f"{diff_icon} {r.question_no}  —  Avg: {avg_q:.2f} / {r.max_marks:.1f} pts  ({q_pct:.1f}%)",
        expanded=False,
    ):
        st.markdown(
            f'<div style="color:#94a3b8; font-size:0.85rem; margin-bottom:1rem; line-height:1.5;">'
            f'<strong style="color:#e2e8f0;">Question:</strong> {r.question_text}'
            f'</div>',
            unsafe_allow_html=True,
        )

        dc1, dc2 = st.columns(2)

        # Missed points analysis
        missed_counter: Counter = Counter()
        for g in q_grades:
            try:
                missing = json.loads(g.missing_points_json or "[]")
                for m in missing:
                    missed_counter[m] += 1
            except Exception:
                pass

        with dc1:
            render_section_title("Top Missed Key Points")
            if missed_counter:
                for point, count in missed_counter.most_common(5):
                    pct_missed = count / len(q_grades) * 100
                    color = "#f87171" if pct_missed > 60 else ("#fbbf24" if pct_missed > 30 else "#94a3b8")
                    st.markdown(
                        f'<div style="padding:0.4rem 0; border-bottom:1px solid rgba(56,189,248,0.06);">'
                        f'<span style="color:{color}; font-size:0.82rem;">❌ {point}</span><br>'
                        f'<span style="color:#475569; font-size:0.74rem;">Missed by {count}/{len(q_grades)} students ({pct_missed:.0f}%)</span>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )
            else:
                st.markdown(
                    '<div class="gw-success-card" style="padding:0.5rem 0.75rem;">'
                    '<span style="color:#2dd4bf; font-size:0.82rem;">✅ Students covered most key points!</span>'
                    '</div>',
                    unsafe_allow_html=True,
                )

        with dc2:
            render_section_title("Score Distribution")
            q_scores = [g.awarded_marks for g in q_grades]
            score_counts = {}
            for s in q_scores:
                key = round(s, 1)
                score_counts[key] = score_counts.get(key, 0) + 1
            if score_counts:
                sc_df = pd.DataFrame(
                    sorted(score_counts.items()),
                    columns=["Score", "Count"],
                ).set_index("Score")
                st.bar_chart(sc_df["Count"])

        # AI analysis button
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button(
            f"🤖 Generate AI Teaching Recommendations for {r.question_no}",
            key=f"ai_gen_{r.id}",
            type="primary",
        ):
            with st.spinner("Analyzing student performance via AI..."):
                context_samples = []
                for g in q_grades[:15]:
                    context_samples.append(
                        f"Score: {g.awarded_marks}/{r.max_marks}\n"
                        f"Answer excerpt: {(g.ocr_text or '')[:300]}\n"
                        f"Missing points: {g.missing_points_json}\n---"
                    )
                context_str = "\n".join(context_samples)

                prompt = (
                    "You are an expert Professor evaluating student answers. "
                    "Analysing the aggregated data below for a specific exam question, "
                    "provide a highly detailed but actionable summary of where students are lagging, "
                    "which parts they understood properly, and any common misconceptions. "
                    "Structure your response with: ## What Students Got Right, ## Common Struggles, "
                    "## Misconceptions Observed, ## Recommendations for Next Lecture\n\n"
                    f"Question: {r.question_text}\nMax Marks: {r.max_marks}\n\n"
                    f"Sample Student Data:\n{context_str}"
                )

                try:
                    response = llm.chat(
                        messages=[{"role": "user", "content": prompt}],
                        system_prompt="You are an expert academic evaluator. Use markdown formatting.",
                        temperature=0.3,
                    )
                    st.markdown(
                        '<div class="gw-info-card" style="margin-top:0.75rem;">'
                        '<strong style="color:#7dd3fc; font-size:0.85rem;">✨ AI Teaching Recommendations</strong>'
                        '</div>',
                        unsafe_allow_html=True,
                    )
                    st.markdown(response)
                except Exception as e:
                    st.error(f"AI analysis failed: {e}")

render_divider()

# ── Full Exam Synthesis ──
render_section_title("Full Exam AI Synthesis Report")
st.markdown(
    '<div style="color:#64748b; font-size:0.82rem; margin-bottom:0.75rem;">'
    'Generate a comprehensive departmental summary of the entire exam performance with curriculum adjustment suggestions.'
    '</div>',
    unsafe_allow_html=True,
)

if st.button("🧠 Generate Full Exam Synthesis", type="primary", use_container_width=True):
    with st.spinner("Generating comprehensive analysis..."):
        selected_course = next((c for c in courses if c.id == selected_course_id), None)
        selected_exam = next((e for e in exams if e.id == selected_exam_id), None)

        synthesis_data = (
            f"Course: {selected_course.name if selected_course else selected_course_label}\n"
            f"Exam: {selected_exam.name if selected_exam else selected_exam_label}\n"
            f"Total Students: {len(submissions)}\n"
            f"Class Average: {avg_score:.2f}/{total_exam_marks} ({avg_score/total_exam_marks*100:.1f}%)\n"
            f"Pass Rate: {pass_rate:.1f}%\n\n"
            "Question Performance:\n"
        )
        for qs in question_stats:
            flag = "⚠️ STRUGGLING" if qs["Avg %"] < 50 else ("✅ GOOD" if qs["Avg %"] >= 70 else "📊 AVERAGE")
            synthesis_data += f"- {qs['Question']}: {qs['Avg Score']:.2f}/{qs['Max Marks']:.0f} ({qs['Avg %']:.1f}%) {flag}\n"

        prompt = (
            "You are a department head reviewing an exam's outcome. "
            "Write an encouraging but analytically rigorous evaluation report. "
            "Include: ## Executive Summary, ## Strengths, ## Areas of Concern, "
            "## Recommended Curriculum Adjustments, ## Next Steps for Instructors.\n\n"
            f"{synthesis_data}"
        )

        try:
            response = llm.chat(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a data-driven Department Head. Use clear markdown formatting.",
                temperature=0.3,
            )
            st.markdown(
                '<div class="gw-success-card" style="margin-bottom:0.75rem;">'
                '<strong style="color:#2dd4bf;">📜 Exam Synthesis Report</strong>'
                '</div>',
                unsafe_allow_html=True,
            )
            st.markdown(response)
        except Exception as e:
            st.error(f"Failed to generate synthesis: {e}")
