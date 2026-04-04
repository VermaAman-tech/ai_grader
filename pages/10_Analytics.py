import json
from collections import Counter

import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.llm_service import LLMService
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Analytics & Insights", page_icon="G", layout="wide")
inject_theme_css()
render_header(
    "10. Analytics & Insights",
    "AI-powered grading statistics, class performance, and detailed question-wise analysis.",
)

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

if not courses:
    st.warning("Create a course first.")
    st.stop()

course_labels = [f"{course.id} | {course.code} | {course.name}" for course in courses]
selected_course_label = st.selectbox("Select course", course_labels)
selected_course_id = int(selected_course_label.split("|", 1)[0].strip())

with session_scope() as db:
    exams = (
        db.query(Exam)
        .filter(Exam.course_id == selected_course_id)
        .order_by(Exam.created_at.desc())
        .all()
    )

if not exams:
    st.warning("Create an exam first.")
    st.stop()

exam_labels = [f"{exam.id} | {exam.name}" for exam in exams]
selected_exam_label = st.selectbox("Select exam", exam_labels)
selected_exam_id = int(selected_exam_label.split("|", 1)[0].strip())

# Fetch data for the selected exam
with session_scope() as db:
    rubrics = db.query(Rubric).filter(Rubric.exam_id == selected_exam_id).order_by(Rubric.question_order.asc()).all()
    submissions = db.query(Submission).filter(Submission.exam_id == selected_exam_id, Submission.status == "done").all()
    sub_ids = [s.id for s in submissions]
    
    if not sub_ids:
        st.info("No fully graded submissions for this exam yet. Go to '06. Grade' to process uploaded PDFs.")
        st.stop()

    grades = db.query(Grade).filter(Grade.submission_id.in_(sub_ids)).all()
    students = db.query(Student).filter(Student.course_id == selected_course_id).all()

student_dict = {s.id: s for s in students}
rubric_dict = {r.id: r for r in rubrics}

# Data preparation
records = []
total_exam_marks = sum(r.max_marks for r in rubrics)

# Calculate student totals
student_totals = {}
for g in grades:
    if g.submission_id not in student_totals:
        student_totals[g.submission_id] = 0.0
    student_totals[g.submission_id] += g.awarded_marks

scores_list = list(student_totals.values())
if not scores_list:
    st.warning("No grades data available.")
    st.stop()

avg_score = sum(scores_list) / len(scores_list)
max_score = max(scores_list)
min_score = min(scores_list)

st.markdown("---")
st.markdown("## 📊 Overall Exam Statistics")

# High-level metrics
k1, k2, k3, k4, k5 = st.columns(5)
k1.metric("Total Graded", f"{len(submissions)} Students")
k2.metric("Total Exam Marks", f"{total_exam_marks} pts")
k3.metric("Class Average", f"{avg_score:.2f} pts", f"{(avg_score/total_exam_marks*100):.1f}%")
k4.metric("Highest Score", f"{max_score:.2f} pts")
k5.metric("Lowest Score", f"{min_score:.2f} pts")

st.markdown("### Score Distribution")
# Display a histogram of scores
hist_data = pd.DataFrame(scores_list, columns=["Total Score"])
st.bar_chart(hist_data["Total Score"].value_counts(bins=10).sort_index())

# Calculate hardest question
question_stats = []
for r in rubrics:
    q_grades = [g for g in grades if g.rubric_id == r.id]
    if not q_grades:
        continue
    avg_q = sum(g.awarded_marks for g in q_grades) / len(q_grades)
    perc_q = (avg_q / r.max_marks) * 100 if r.max_marks > 0 else 0
    question_stats.append({
        "Question": r.question_no,
        "Avg Score": avg_q,
        "Max Marks": r.max_marks,
        "Percentage": perc_q,
        "ID": r.id
    })

q_stats_df = pd.DataFrame(question_stats)
if not q_stats_df.empty:
    toughest_q = q_stats_df.loc[q_stats_df["Percentage"].idxmin()]
    st.error(f"**📉 Toughest Concept Alert:** Students struggled the most with **{toughest_q['Question']}** (Average: {toughest_q['Avg Score']:.2f} / {toughest_q['Max Marks']:.2f} marks, {toughest_q['Percentage']:.1f}%).")

st.markdown("---")
st.markdown("## 🔍 Question-wise Deep Dive & AI Analysis")
st.info("Analyze exact friction points for each question, including commonly missed rubric items and AI-generated conceptual summaries.")

llm = LLMService()

for r in rubrics:
    q_grades = [g for g in grades if g.rubric_id == r.id]
    if not q_grades:
        continue
    
    avg_q = sum(g.awarded_marks for g in q_grades) / len(q_grades)
    
    with st.expander(f"Question {r.question_no} | Avg: {avg_q:.2f} / {r.max_marks:.2f} marks", expanded=False):
        st.markdown(f"**Question Text:** {r.question_text}")
        
        c1, c2 = st.columns([1, 1])
        
        # Commonly missed points logic
        missed_counter = Counter()
        for g in q_grades:
            try:
                missing = json.loads(g.missing_points_json or "[]")
                for m in missing:
                    missed_counter[m] += 1
            except:
                pass
                
        with c1:
            st.markdown("**Top Missed Key Points:**")
            if missed_counter:
                for point, count in missed_counter.most_common(5):
                    st.markdown(f"- ❌ `{point}` (Missed by {count}/{len(q_grades)} students)")
            else:
                st.success("Students hit most key points successfully!")
                
        with c2:
            st.markdown("**Score Spread (Out of Total)**")
            q_scores = [g.awarded_marks for g in q_grades]
            st.bar_chart(pd.DataFrame(q_scores, columns=["Marks"])["Marks"].value_counts().sort_index())
            
        # AI Button
        if st.button(f"🤖 Generate AI Actionable Summary for {r.question_no}", key=f"ai_gen_{r.id}"):
            with st.spinner("Analyzing all student answers natively via AI..."):
                # Compile student performance context for the prompt
                context_samples = []
                for g in q_grades[:15]:  # Limit to 15 to fit context window safely
                    context_samples.append(
                        f"Score: {g.awarded_marks}/{r.max_marks}\n"
                        f"Student Answer Text: {g.ocr_text[:300]}...\n"
                        f"Missing Points mapped by Grader: {g.missing_points_json}\n---"
                    )
                context_str = "\n".join(context_samples)
                
                prompt = (
                    "You are an expert Professor evaluating student answers. Analysing the aggregated data below for a specific exam question, "
                    "provide a highly detailed but actionable summary of where students are lagging, which parts they understood properly, "
                    "and any common misconceptions judging by their partial and full answers. "
                    "Make it structured with markdown headings, bullet points, and a 'Recommendations for Next Lecture' section.\n\n"
                    f"### Question Data\nQuestion Number: {r.question_no}\nQuestion: {r.question_text}\nMax Marks: {r.max_marks}\n\n"
                    f"### Sample Student Performances\n{context_str}"
                )
                
                try:
                    ai_analysis_response = llm.chat(
                        messages=[{"role": "user", "content": prompt}],
                        system_prompt="You are an expert academic evaluator generating curriculum feedback.",
                        temperature=0.3
                    )
                    st.markdown("### ✨ AI Question Summary & Feedback")
                    st.info(ai_analysis_response)
                except Exception as e:
                    st.error(f"Failed to generate AI Insights: {e}")

st.markdown("---")
st.markdown("## 🎓 Overall Class Synthesis")
if st.button("🧠 Generate Full Exam AI Synthesis Report", type="primary"):
    with st.spinner("Distilling insights across the entire exam syllabus..."):
        # Build synthesis prompt
        synthesis_data = f"Course: {selected_course_label}\nExam: {selected_exam_label}\nClass Average: {avg_score:.2f}/{total_exam_marks} ({(avg_score/total_exam_marks*100):.1f}%)\n\n"
        for qs in question_stats:
            synthesis_data += f"- {qs['Question']}: Avg {qs['Avg Score']:.2f}/{qs['Max Marks']} ({qs['Percentage']:.1f}%). Toughest: {qs['Percentage'] < 50.0}\n"
            
        prompt = (
            "You are a department head reviewing an exam's outcome. "
            "Given the high-level grading statistics over the entire syllabus below, write an active, encouraging, and highly specific "
            "evaluation report on the class's overall performance. Suggest overall curriculum adjustments."
            f"\n\n{synthesis_data}"
        )
        
        try:
            ai_synthesis_response = llm.chat(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a data-driven Department Head providing exam overviews.",
                temperature=0.3
            )
            st.success("### 📜 Final Syllabus Executive Summary")
            st.markdown(ai_synthesis_response)
        except Exception as e:
            st.error(f"Failed to generate Class Synthesis: {e}")
