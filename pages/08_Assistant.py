import os
import uuid
from pathlib import Path

import streamlit as st

from db.database import session_scope
from db.models import Course, Exam
from services.chat_agent_service import AgentContext, AgentFile, handle_agent_message
from ui.theme import inject_theme_css, render_header


st.set_page_config(page_title="Assistant", page_icon="G", layout="wide")
inject_theme_css()
render_header(
    "08. Workflow Assistant",
    "Chat with the assistant to run actions: roster, rubric, submission mapping, grading, and export.",
)


def _save_staged_uploads(uploaded_files) -> list[AgentFile]:
    inbox_root = Path(os.getenv("UPLOAD_DIR", "data/uploads")) / "assistant_inbox"
    inbox_root.mkdir(parents=True, exist_ok=True)

    batch_dir = inbox_root / uuid.uuid4().hex
    batch_dir.mkdir(parents=True, exist_ok=True)

    staged: list[AgentFile] = []
    for uploaded in uploaded_files:
        safe_name = Path(uploaded.name).name
        path = batch_dir / safe_name
        path.write_bytes(uploaded.getvalue())
        staged.append(AgentFile(name=safe_name, path=str(path)))
    return staged


if "assistant_history" not in st.session_state:
    st.session_state.assistant_history = [
        {
            "role": "assistant",
            "content": (
                "Assistant is ready. Select course/exam context, stage files, and send commands. "
                "Try 'help' for examples."
            ),
            "export_path": None,
        }
    ]

if "assistant_files" not in st.session_state:
    st.session_state.assistant_files = []

if "assistant_context_course_id" not in st.session_state:
    st.session_state.assistant_context_course_id = None

if "assistant_context_exam_id" not in st.session_state:
    st.session_state.assistant_context_exam_id = None

with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

left, right = st.columns([2, 1])

with left:
    course_items = [("None", None)] + [(f"{course.id} | {course.code} | {course.name}", course.id) for course in courses]
    course_labels = [item[0] for item in course_items]
    course_label_to_id = {item[0]: item[1] for item in course_items}
    default_course_id = st.session_state.assistant_context_course_id
    default_course_index = 0
    for idx, item in enumerate(course_items):
        if item[1] == default_course_id:
            default_course_index = idx
            break

    selected_course_label = st.selectbox(
        "Context course",
        course_labels,
        index=default_course_index,
        key="assistant_course_selector",
    )
    selected_course_id = course_label_to_id.get(selected_course_label)
    st.session_state.assistant_context_course_id = selected_course_id

    exam_options = ["None"]
    exam_id_lookup = {"None": None}
    if selected_course_id:
        with session_scope() as db:
            exams = (
                db.query(Exam)
                .filter(Exam.course_id == selected_course_id)
                .order_by(Exam.created_at.desc())
                .all()
            )
        for exam in exams:
            label = f"{exam.id} | {exam.name}"
            exam_options.append(label)
            exam_id_lookup[label] = exam.id

    default_exam_id = st.session_state.assistant_context_exam_id
    default_exam_index = 0
    for idx, label in enumerate(exam_options):
        if exam_id_lookup.get(label) == default_exam_id:
            default_exam_index = idx
            break

    selected_exam_label = st.selectbox(
        "Context exam",
        exam_options,
        index=default_exam_index,
        key="assistant_exam_selector",
    )
    selected_exam_id = exam_id_lookup.get(selected_exam_label)
    st.session_state.assistant_context_exam_id = selected_exam_id

with right:
    st.markdown("### Quick Actions")
    st.caption("Use command text or one-click prompts below.")
    q1 = st.button("Status")
    q2 = st.button("Grade Pending")
    q3 = st.button("Export")
    q4 = st.button("Help")

quick_prompt = None
if q1:
    quick_prompt = "status"
elif q2:
    quick_prompt = "grade pending"
elif q3:
    quick_prompt = "export"
elif q4:
    quick_prompt = "help"

st.markdown("### Stage Files")
uploads = st.file_uploader(
    "Upload files for assistant actions",
    type=["csv", "xlsx", "xls", "json", "pdf", "txt"],
    accept_multiple_files=True,
    help="Examples: roster.xlsx, rubric.csv, submissions PDFs, mapping.csv (file_name, roll_number).",
)

stage_col, clear_col = st.columns(2)
with stage_col:
    if st.button("Stage uploaded files", type="primary", use_container_width=True):
        if uploads:
            staged = _save_staged_uploads(uploads)
            existing = st.session_state.assistant_files
            existing_names = {item["name"] for item in existing}
            for item in staged:
                if item.name not in existing_names:
                    existing.append({"name": item.name, "path": item.path})
            st.success(f"Staged {len(staged)} file(s).")
        else:
            st.warning("No files selected.")

with clear_col:
    if st.button("Clear staged files", use_container_width=True):
        st.session_state.assistant_files = []
        st.success("Staged file list cleared.")

if st.session_state.assistant_files:
    st.caption("Currently staged files:")
    st.write([item["name"] for item in st.session_state.assistant_files])
else:
    st.caption("No staged files yet.")

st.markdown("### Chat")
for item in st.session_state.assistant_history:
    with st.chat_message(item["role"]):
        st.markdown(item["content"])
        export_path = item.get("export_path")
        if export_path and Path(export_path).exists():
            with open(export_path, "rb") as handle:
                st.download_button(
                    label=f"Download {Path(export_path).name}",
                    data=handle,
                    file_name=Path(export_path).name,
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    key=f"dl_{Path(export_path).name}_{hash(export_path)}",
                )

prompt = st.chat_input("Chat normally or ask assistant actions...")
user_prompt = quick_prompt or prompt

if user_prompt:
    context = AgentContext(course_id=selected_course_id, exam_id=selected_exam_id)
    staged_files = [AgentFile(name=item["name"], path=item["path"]) for item in st.session_state.assistant_files]

    st.session_state.assistant_history.append(
        {
            "role": "user",
            "content": user_prompt,
            "export_path": None,
        }
    )

    try:
        result = handle_agent_message(
            user_prompt,
            staged_files,
            context,
            history=st.session_state.assistant_history,
        )
        context_update = result.get("context", {})
        if isinstance(context_update, dict):
            st.session_state.assistant_context_course_id = context_update.get("course_id")
            st.session_state.assistant_context_exam_id = context_update.get("exam_id")

        st.session_state.assistant_history.append(
            {
                "role": "assistant",
                "content": result["reply"],
                "export_path": result.get("export_path"),
            }
        )
    except Exception as exc:  # noqa: BLE001
        st.session_state.assistant_history.append(
            {
                "role": "assistant",
                "content": f"Action failed: {exc}",
                "export_path": None,
            }
        )

    st.rerun()
