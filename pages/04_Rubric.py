import json
import os
import re
from pathlib import Path
import pandas as pd
import streamlit as st

from db.database import session_scope
from db.models import Course, Exam, Rubric
from ui.theme import inject_theme_css, render_header
from services.ocr_service import OCRService
from services.llm_service import LLMService

st.set_page_config(page_title="Rubric", page_icon="G", layout="wide")
inject_theme_css()
render_header("04. Rubric", "Define or edit grading rubrics. You can upload a Rubric PDF to generate questions automatically.")

def parse_key_points(raw_text: str) -> list[dict]:
    points: list[dict] = []
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]    
    for line in lines:
        if "|" in line:
            point_text, marks_text = line.rsplit("|", 1)
            try:
                marks = float(marks_text.strip())
            except ValueError:
                marks = 1.0
            points.append({"point": point_text.strip(), "marks": marks})        
        else:
            points.append({"point": line, "marks": 1.0})
    return points

def stringify_key_points(points: list[dict]) -> str:
    return "\n".join([f"{p['point']} | {p['marks']}" for p in points])

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

with session_scope() as db:
    rubrics = (
        db.query(Rubric)
        .filter(Rubric.exam_id == selected_exam_id)
        .order_by(Rubric.question_order.asc(), Rubric.id.asc())
        .all()
    )

st.markdown("### Auto-Generate from PDF")
rubric_pdf = st.file_uploader("Upload Rubric PDF / Exam Paper", type=["pdf"])
if rubric_pdf and st.button("Extract & Auto-Fill Rubrics"):
    with st.spinner("Extracting and parsing rubrics via AI..."):
        upload_dir = Path("data/uploads")
        upload_dir.mkdir(parents=True, exist_ok=True)
        temp_path = upload_dir / rubric_pdf.name
        with open(temp_path, "wb") as f:
            f.write(rubric_pdf.getbuffer())
        
        ocr = OCRService()
        llm = LLMService()
        try:
            pages = ocr.extract_pages(str(temp_path))
            full_text = "\n\n".join([p.text for p in pages])
            prompt = (
                "You are an assistant that extracts exam questions and their rubric/answers from an OCR'd exam document. "
                "Output ONLY a raw JSON array matching this schema closely:\n"
                "[\n  {\n    \"question_number\": \"Q1\",\n    \"question_text\": \"Describe gradient descent...\",\n    \"max_marks\": 10.0,\n    \"key_points\": [{\"point\": \"Mention learning rate\", \"marks\": 5.0}],\n    \"grading_notes\": \"Accept alternative formulations\"\n  }\n]\n\n"
                f"OCR Text:\n{full_text}"
            )
            response = llm.chat(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a data extractor. Output JSON only without markdown code blocks. Always return an array.",
                temperature=0.0
            )
            match = re.search(r"\[.*\]", response, re.DOTALL)
            if match:
                js = json.loads(match.group(0))
                with session_scope() as db:
                    for i, q in enumerate(js, start=1):
                        db.add(Rubric(
                            exam_id=selected_exam_id,
                            question_no=str(q.get("question_number", f"Q{i}")),
                            question_order=i,
                            question_text=str(q.get("question_text", "")),
                            max_marks=float(q.get("max_marks", 5.0)),
                            key_points_json=json.dumps(q.get("key_points", [])),
                            grading_notes=str(q.get("grading_notes", ""))
                        ))
                st.success("Successfully imported rubrics from PDF!")
                st.rerun()
            else:
                st.error("Failed to parse AI response into JSON. Raw response:")
                st.code(response)
        except Exception as e:
            st.error(f"Error extracting auto-rubric: {e}")

st.markdown("---")
st.markdown("### Add / Edit Rubric Manually")

edit_options = ["-- New Rubric --"] + [f"{r.id} | {r.question_no}" for r in rubrics]

if "rubric_mode" not in st.session_state:
    st.session_state["rubric_mode"] = edit_options[0]

def update_mode():
    st.session_state["rubric_mode"] = st.session_state.rubric_selector

selected_edit = st.selectbox(
    "Select Rubric to Edit or Create New", 
    edit_options, 
    index=edit_options.index(st.session_state["rubric_mode"]) if st.session_state["rubric_mode"] in edit_options else 0,
    key="rubric_selector",
    on_change=update_mode
)

def_q_order = len(rubrics) + 1
def_q_no = f"Q{def_q_order}"
def_max_marks = 10.0
def_q_text = ""
def_key_points_text = ""
def_notes = ""

if selected_edit != "-- New Rubric --":
    r_id = int(selected_edit.split("|")[0].strip())
    r_target = next((x for x in rubrics if x.id == r_id), None)
    if r_target:
        def_q_order = int(r_target.question_order)
        def_q_no = r_target.question_no
        def_max_marks = float(r_target.max_marks)
        def_q_text = r_target.question_text
        try:
            kp_dicts = json.loads(r_target.key_points_json or "[]")
            def_key_points_text = stringify_key_points(kp_dicts)
        except:
            def_key_points_text = ""
        def_notes = r_target.grading_notes or ""

with st.form("add_edit_rubric", clear_on_submit=False):
    c1, c2, c3 = st.columns([1, 1, 1])
    question_order = c1.number_input("Question order", min_value=1, value=def_q_order, step=1)
    question_no = c2.text_input("Question label", value=def_q_no)
    max_marks = c3.number_input("Max marks", min_value=0.5, value=float(def_max_marks), step=0.5)
    question_text = st.text_area("Question text", value=def_q_text, height=100)
    key_points_text = st.text_area(
        "Main Notes / Key points (one per line, format: point | marks)",
        value=def_key_points_text,
        height=140,
    )
    grading_notes = st.text_area("Additional Notes", value=def_notes, height=80)
    save_question_clicked = st.form_submit_button("Save question", type="primary")

if save_question_clicked:
    q_no = question_no.strip()
    q_text = question_text.strip()
    if not q_no or not q_text:
        st.error("Question label and text are required.")
    else:
        try:
            key_points = parse_key_points(key_points_text)
        except ValueError:
            st.error("Key points format is invalid. Use: point | marks")        
        else:
            with session_scope() as db:
                if selected_edit != "-- New Rubric --":
                    r_id = int(selected_edit.split("|")[0].strip())
                    existing = db.get(Rubric, r_id)
                    if existing:
                        existing.question_order = int(question_order)
                        existing.question_text = q_text
                        existing.max_marks = float(max_marks)
                        existing.key_points_json = json.dumps(key_points)
                        existing.grading_notes = grading_notes.strip() or None
                        st.success("Question updated.")
                else:
                    existing = db.query(Rubric).filter(Rubric.exam_id == selected_exam_id, Rubric.question_no == q_no).one_or_none()
                    if existing:
                        existing.question_order = int(question_order)
                        existing.question_text = q_text
                        existing.max_marks = float(max_marks)
                        existing.key_points_json = json.dumps(key_points)
                        existing.grading_notes = grading_notes.strip() or None
                        st.success("Question updated (by label matching).")
                    else:
                        db.add(Rubric(
                            exam_id=selected_exam_id,
                            question_no=q_no,
                            question_order=int(question_order),
                            question_text=q_text,
                            max_marks=float(max_marks),
                            key_points_json=json.dumps(key_points),
                            grading_notes=grading_notes.strip() or None,        
                        ))
                        st.success("Question added.")
            st.session_state["rubric_mode"] = "-- New Rubric --"
            st.rerun()

st.markdown("### Current Rubric Details")
if rubrics:
    records = []
    total_marks = 0.0
    for rubric in rubrics:
        total_marks += rubric.max_marks
        try:
            kp = json.loads(rubric.key_points_json or "[]")
            kp_str = " ; ".join([f"{p.get('point')} ({p.get('marks')}m)" for p in kp])
        except:
            kp_str = ""
        records.append(
            {
                "ID": rubric.id,
                "Q No": rubric.question_no,
                "Marks": rubric.max_marks,
                "Text": rubric.question_text,
                "Main Notes (Key Pts)": kp_str,
                "Additional Notes": rubric.grading_notes or ""
            }
        )

    st.metric("Total rubric marks", round(total_marks, 2))
    st.dataframe(pd.DataFrame(records), use_container_width=True, hide_index=True)

    delete_labels = [f"{rubric.id} | {rubric.question_no}" for rubric in rubrics]
    selected_delete = st.selectbox("Delete rubric question", [""] + delete_labels, index=0)
    if st.button("Delete selected question", disabled=not selected_delete):     
        rubric_id = int(selected_delete.split("|", 1)[0].strip())
        with session_scope() as db:
            target = db.get(Rubric, rubric_id)
            if target:
                db.delete(target)
                st.success("Rubric question deleted.")
                st.rerun()
else:
    st.info("No rubric questions yet.")