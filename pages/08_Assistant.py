import os
import uuid
from pathlib import Path

import streamlit as st

from db.database import session_scope
from db.models import Course, Exam
from services.chat_agent_service import AgentContext, AgentFile, handle_agent_message
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="Assistant — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header(
    "Workflow Assistant",
    "Chat to run bulk actions — import roster, define rubrics, grade submissions, and export results.",
    "🤖",
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


# ── Session state init ──
if "assistant_history" not in st.session_state:
    st.session_state.assistant_history = [
        {
            "role": "assistant",
            "content": (
                "👋 Hi! I'm your Workflow Assistant.\n\n"
                "Select a **course** and **exam** context on the right, then send me commands.\n\n"
                "**Try these:**\n"
                "- `status` — show current grading status\n"
                "- `grade pending` — grade all pending submissions\n"
                "- `export` — generate gradebook\n"
                "- `help` — see all available commands"
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

# ── Layout: Chat | Context ──
with session_scope() as db:
    courses = db.query(Course).order_by(Course.code.asc()).all()

chat_col, ctx_col = st.columns([3, 1])

with ctx_col:
    render_section_title("Context")

    # Course selector
    course_items = [("— None —", None)] + [
        (f"{c.id} | {c.code} — {c.name}", c.id) for c in courses
    ]
    course_labels = [item[0] for item in course_items]
    course_label_to_id = {item[0]: item[1] for item in course_items}

    default_course_id = st.session_state.assistant_context_course_id
    default_course_index = 0
    for idx, item in enumerate(course_items):
        if item[1] == default_course_id:
            default_course_index = idx
            break

    selected_course_label = st.selectbox(
        "Course",
        course_labels,
        index=default_course_index,
        key="assistant_course_selector",
    )
    selected_course_id = course_label_to_id.get(selected_course_label)
    st.session_state.assistant_context_course_id = selected_course_id

    # Exam selector
    exam_options = ["— None —"]
    exam_id_lookup: dict[str, int | None] = {"— None —": None}
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
        "Exam",
        exam_options,
        index=default_exam_index,
        key="assistant_exam_selector",
    )
    selected_exam_id = exam_id_lookup.get(selected_exam_label)
    st.session_state.assistant_context_exam_id = selected_exam_id

    # Context status indicator
    if selected_course_id and selected_exam_id:
        st.markdown(
            '<div class="gw-success-card" style="padding:0.5rem 0.75rem; margin-top:0.5rem;">'
            '<span style="color:#2dd4bf; font-size:0.78rem;">✅ Context set</span></div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div class="gw-warning-card" style="padding:0.5rem 0.75rem; margin-top:0.5rem;">'
            '<span style="color:#fbbf24; font-size:0.78rem;">⚠️ Set course & exam</span></div>',
            unsafe_allow_html=True,
        )

    render_divider()
    render_section_title("Quick Actions")

    q1 = st.button("📊 Status", use_container_width=True)
    q2 = st.button("▶ Grade Pending", use_container_width=True, type="primary")
    q3 = st.button("📥 Export", use_container_width=True)
    q4 = st.button("❓ Help", use_container_width=True)

    render_divider()
    render_section_title("Stage Files")
    uploads = st.file_uploader(
        "Upload files",
        type=["csv", "xlsx", "xls", "json", "pdf", "txt"],
        accept_multiple_files=True,
        help="Roster Excel, rubric CSV, submission PDFs, or mapping files.",
        label_visibility="collapsed",
    )

    sc1, sc2 = st.columns(2)
    with sc1:
        if st.button("📎 Stage", type="primary", use_container_width=True):
            if uploads:
                staged = _save_staged_uploads(uploads)
                existing = st.session_state.assistant_files
                existing_names = {item["name"] for item in existing}
                for item in staged:
                    if item.name not in existing_names:
                        existing.append({"name": item.name, "path": item.path})
                st.success(f"Staged {len(staged)} file(s)")
            else:
                st.warning("No files selected")
    with sc2:
        if st.button("🗑️ Clear", use_container_width=True):
            st.session_state.assistant_files = []
            st.rerun()

    if st.session_state.assistant_files:
        st.markdown(
            '<div style="color:#475569; font-size:0.75rem; margin-top:0.3rem;">Staged:</div>',
            unsafe_allow_html=True,
        )
        for item in st.session_state.assistant_files:
            st.markdown(
                f'<div style="color:#7dd3fc; font-size:0.76rem;">📄 {item["name"]}</div>',
                unsafe_allow_html=True,
            )
    else:
        st.markdown(
            '<div style="color:#475569; font-size:0.76rem; margin-top:0.3rem;">No staged files.</div>',
            unsafe_allow_html=True,
        )

# ── Chat Panel ──
with chat_col:
    # Determine quick prompt
    quick_prompt = None
    if q1:
        quick_prompt = "status"
    elif q2:
        quick_prompt = "grade pending"
    elif q3:
        quick_prompt = "export"
    elif q4:
        quick_prompt = "help"

    # Chat history
    for item in st.session_state.assistant_history:
        with st.chat_message(item["role"]):
            st.markdown(item["content"])
            export_path = item.get("export_path")
            if export_path and Path(export_path).exists():
                with open(export_path, "rb") as handle:
                    st.download_button(
                        label=f"⬇️ Download {Path(export_path).name}",
                        data=handle,
                        file_name=Path(export_path).name,
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key=f"dl_{Path(export_path).name}_{hash(export_path)}",
                    )

    # Chat input
    prompt = st.chat_input("Type a command or ask anything... (try 'help')")
    user_prompt = quick_prompt or prompt

    if user_prompt:
        context = AgentContext(course_id=selected_course_id, exam_id=selected_exam_id)
        staged_files = [
            AgentFile(name=item["name"], path=item["path"])
            for item in st.session_state.assistant_files
        ]

        st.session_state.assistant_history.append(
            {"role": "user", "content": user_prompt, "export_path": None}
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
        except Exception as exc:
            st.session_state.assistant_history.append(
                {
                    "role": "assistant",
                    "content": f"⚠️ Action failed: {exc}",
                    "export_path": None,
                }
            )

        st.rerun()
