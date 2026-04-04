import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from db.database import session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission
from services.export_service import export_exam_gradebook
from services.grading_service import grade_submission
from services.llm_service import LLMService
from services.roster_service import import_roster
from utils.helpers import normalize_question_no, normalize_roll, safe_parse_json, to_float


PLANNER_SYSTEM_PROMPT = """
You are an action planner for a grading assistant app.

Return JSON only with this schema:
{
  "assistant_reply": "short acknowledgement",
  "actions": [
    {"name": "action_name", "params": {"key": "value"}}
  ]
}

Allowed actions:
- set_context_course
- set_context_exam
- create_course
- create_exam
- import_roster
- import_rubric
- add_rubric
- map_submissions
- grade_pending
- override_grade
- export
- status
- help

Rules:
- If user asks multiple steps, include all actions in order.
- For file actions, include filename_hint when helpful.
- If no action is requested, return actions as [].
- Do not include markdown or extra prose outside JSON.
""".strip()


CHAT_SYSTEM_PROMPT = """
You are a practical assistant inside an exam-grading app.
Answer naturally and concisely.
If user asks for actions, suggest exact actionable instructions.
Do not claim actions were completed unless they were executed.
""".strip()


@dataclass
class AgentFile:
    name: str
    path: str


@dataclass
class AgentContext:
    course_id: int | None = None
    exam_id: int | None = None


def handle_agent_message(
    message: str,
    files: list[AgentFile],
    context: AgentContext,
    history: list[dict] | None = None,
) -> dict:
    text = (message or "").strip()
    if not text:
        return _result("Please enter a message.", context)

    working_context = AgentContext(course_id=context.course_id, exam_id=context.exam_id)

    compound_rule = _run_compound_rule_actions(text, files, working_context)
    if compound_rule["handled"]:
        return _result(
            reply=compound_rule["reply"],
            context=working_context,
            export_path=compound_rule.get("export_path"),
        )

    direct_rule = _run_rule_action(text, files, working_context)
    if direct_rule["handled"]:
        return _result(
            reply=direct_rule["reply"],
            context=working_context,
            export_path=direct_rule.get("export_path"),
        )

    plan = _plan_actions_with_llm(text, files, working_context, history or [])
    if plan and plan.get("actions"):
        execution_reply, export_path = _execute_action_plan(plan["actions"], files, working_context, text)
        ack = str(plan.get("assistant_reply", "")).strip()
        combined = f"{ack}\n\n{execution_reply}".strip() if ack else execution_reply
        return _result(reply=combined, context=working_context, export_path=export_path)

    chat_reply = _general_chat_reply(text, files, working_context, history or [])
    return _result(reply=chat_reply, context=working_context)


def _result(reply: str, context: AgentContext, export_path: str | None = None) -> dict:
    return {
        "reply": reply,
        "export_path": export_path,
        "context": {
            "course_id": context.course_id,
            "exam_id": context.exam_id,
        },
    }


def _run_compound_rule_actions(message: str, files: list[AgentFile], context: AgentContext) -> dict:
    segments = _split_compound_message(message)
    if len(segments) <= 1:
        return {"handled": False, "reply": "", "export_path": None}

    action_segments = [segment for segment in segments if _looks_like_action(segment)]
    if not action_segments:
        return {"handled": False, "reply": "", "export_path": None}

    lines: list[str] = []
    handled_any = False
    export_path = None

    for index, segment in enumerate(action_segments, start=1):
        result = _run_rule_action(segment, files, context)
        if result["handled"]:
            handled_any = True
            lines.append(f"{index}. {result['reply']}")
            if result.get("export_path"):
                export_path = result["export_path"]
        else:
            lines.append(f"{index}. Could not execute: {segment}")

    if handled_any:
        return {
            "handled": True,
            "reply": "Executed requested actions:\n" + "\n".join(lines),
            "export_path": export_path,
        }
    return {"handled": False, "reply": "", "export_path": None}


def _run_rule_action(message: str, files: list[AgentFile], context: AgentContext) -> dict:
    text = (message or "").strip()
    lowered = text.lower()

    if not text:
        return {"handled": False, "reply": "", "export_path": None}

    if lowered in {"help", "/help"} or "what can you do" in lowered:
        return {"handled": True, "reply": _help_text(), "export_path": None}

    if any(token in lowered for token in ["set course", "select course", "use course"]):
        return {"handled": True, "reply": _set_context_course_from_text(text, context), "export_path": None}

    if any(token in lowered for token in ["set exam", "select exam", "use exam"]):
        return {"handled": True, "reply": _set_context_exam_from_text(text, context), "export_path": None}

    if "create course" in lowered:
        code = _extract_named_value(text, "code")
        name = _extract_named_value(text, "name")
        semester = _extract_named_value(text, "semester")
        if not code or not name:
            return {
                "handled": True,
                "reply": "Course creation needs code and name. Example: create course code=CS601 name=Machine Learning",
                "export_path": None,
            }
        reply, course_id = _create_course_from_params(code=code, name=name, semester=semester)
        context.course_id = course_id
        context.exam_id = None
        return {"handled": True, "reply": reply, "export_path": None}

    if "create exam" in lowered:
        if not context.course_id:
            return {
                "handled": True,
                "reply": "Select a course in Assistant context before creating an exam.",
                "export_path": None,
            }
        name = _extract_named_value(text, "name")
        exam_type = (_extract_named_value(text, "type") or "exam").lower()
        total_marks = to_float(_extract_named_value(text, "total"), 100.0)
        if not name:
            return {
                "handled": True,
                "reply": "Exam creation needs name. Example: create exam name=Midterm1 type=exam total=100",
                "export_path": None,
            }
        reply, exam_id = _create_exam_from_params(
            course_id=context.course_id,
            name=name,
            exam_type=exam_type,
            total_marks=total_marks,
        )
        context.exam_id = exam_id
        return {"handled": True, "reply": reply, "export_path": None}

    if "import roster" in lowered or "upload roster" in lowered:
        return {"handled": True, "reply": _import_roster(files, context), "export_path": None}

    if "import rubric" in lowered or "upload rubric" in lowered:
        return {"handled": True, "reply": _import_rubric(files, context), "export_path": None}

    if "add rubric" in lowered or "add question" in lowered:
        return {"handled": True, "reply": _add_rubric_from_text(text, context), "export_path": None}

    if "upload submissions" in lowered or "map submissions" in lowered or "upload pdf" in lowered:
        return {"handled": True, "reply": _map_submissions(files, context), "export_path": None}

    if "grade all" in lowered or "grade pending" in lowered or "run grading" in lowered:
        return {"handled": True, "reply": _grade_pending(context), "export_path": None}

    if "override" in lowered or "update grade" in lowered or "set grade" in lowered:
        return {"handled": True, "reply": _override_grade(text, context), "export_path": None}

    if "export" in lowered or "download excel" in lowered or "generate report" in lowered:
        export_path = _export_exam(context)
        return {
            "handled": True,
            "reply": f"Export generated at: {export_path}",
            "export_path": export_path,
        }

    if "status" in lowered or "progress" in lowered or "summary" in lowered:
        return {"handled": True, "reply": _status_summary(context), "export_path": None}

    return {"handled": False, "reply": "", "export_path": None}


def _plan_actions_with_llm(
    message: str,
    files: list[AgentFile],
    context: AgentContext,
    history: list[dict],
) -> dict | None:
    llm = LLMService()
    if not llm.api_key:
        return None

    history_tail = []
    for item in history[-8:]:
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            history_tail.append({"role": role, "content": content[:700]})

    planner_payload = {
        "message": message,
        "context": {
            "course_id": context.course_id,
            "exam_id": context.exam_id,
        },
        "staged_files": [item.name for item in files],
        "history": history_tail,
    }

    try:
        raw = llm.chat(
            messages=[{"role": "user", "content": json.dumps(planner_payload)}],
            system_prompt=PLANNER_SYSTEM_PROMPT,
            temperature=0.0,
            max_tokens=1400,
        )
        parsed = safe_parse_json(raw)
        if not isinstance(parsed, dict):
            return None
        if not isinstance(parsed.get("actions"), list):
            return None
        return parsed
    except Exception:
        return None


def _execute_action_plan(
    actions: list[dict],
    files: list[AgentFile],
    context: AgentContext,
    original_message: str,
) -> tuple[str, str | None]:
    lines: list[str] = []
    export_path = None

    for index, action in enumerate(actions, start=1):
        if not isinstance(action, dict):
            lines.append(f"{index}. Skipped invalid action payload.")
            continue

        action_name = str(action.get("name", "")).strip().lower()
        params = action.get("params", {})
        if not isinstance(params, dict):
            params = {}

        try:
            reply, maybe_export = _execute_action(action_name, params, files, context, original_message)
            lines.append(f"{index}. {reply}")
            if maybe_export:
                export_path = maybe_export
        except Exception as exc:  # noqa: BLE001
            lines.append(f"{index}. Action '{action_name}' failed: {exc}")

    if not lines:
        return "No executable actions were returned.", export_path
    return "Action results:\n" + "\n".join(lines), export_path


def _execute_action(
    action_name: str,
    params: dict[str, Any],
    files: list[AgentFile],
    context: AgentContext,
    original_message: str,
) -> tuple[str, str | None]:
    if action_name in {"help", "assist"}:
        return _help_text(), None

    if action_name == "set_context_course":
        return _set_context_course_from_params(params, context), None

    if action_name == "set_context_exam":
        return _set_context_exam_from_params(params, context), None

    if action_name == "create_course":
        code = str(params.get("code") or params.get("course_code") or "").strip()
        name = str(params.get("name") or params.get("course_name") or "").strip()
        semester = _optional_str(params.get("semester"))

        if not code:
            code = _extract_named_value(original_message, "code") or ""
        if not name:
            name = _extract_named_value(original_message, "name") or ""

        reply, course_id = _create_course_from_params(code=code, name=name, semester=semester)
        if bool(params.get("set_context", True)):
            context.course_id = course_id
            context.exam_id = None
        return reply, None

    if action_name == "create_exam":
        course_id = int(to_float(params.get("course_id"), 0)) or (context.course_id or 0)
        if course_id <= 0:
            return "Select or set a course before creating an exam.", None

        name = str(params.get("name") or params.get("exam_name") or "").strip()
        exam_type = str(params.get("type") or params.get("exam_type") or "exam").strip().lower()
        total_marks = to_float(params.get("total") or params.get("total_marks"), 100.0)
        reply, exam_id = _create_exam_from_params(
            course_id=course_id,
            name=name,
            exam_type=exam_type,
            total_marks=total_marks,
        )
        if bool(params.get("set_context", True)):
            context.course_id = course_id
            context.exam_id = exam_id
        return reply, None

    if action_name == "import_roster":
        filename_hint = _optional_str(params.get("filename_hint"))
        return _import_roster(files, context, filename_hint=filename_hint), None

    if action_name == "import_rubric":
        filename_hint = _optional_str(params.get("filename_hint"))
        return _import_rubric(files, context, filename_hint=filename_hint), None

    if action_name == "add_rubric":
        return _add_rubric_from_params(params, context), None

    if action_name == "map_submissions":
        mapping_hint = _optional_str(params.get("mapping_filename_hint"))
        return _map_submissions(files, context, mapping_filename_hint=mapping_hint), None

    if action_name == "grade_pending":
        return _grade_pending(context), None

    if action_name == "override_grade":
        return _override_grade_from_params(params, context), None

    if action_name == "export":
        export_path = _export_exam(context)
        return f"Export generated at: {export_path}", export_path

    if action_name == "status":
        return _status_summary(context), None

    return f"Unknown action '{action_name}'.", None


def _general_chat_reply(
    message: str,
    files: list[AgentFile],
    context: AgentContext,
    history: list[dict],
) -> str:
    llm = LLMService()
    if not llm.api_key:
        return (
            "I can execute app actions now, but conversational chat needs HF_TOKEN (or LLM_API_KEY) in .env. "
            "Try action requests like 'import roster', 'grade pending', or ask 'help' for examples."
        )

    history_tail = []
    for item in history[-8:]:
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            history_tail.append({"role": role, "content": content[:700]})

    context_block = {
        "course_id": context.course_id,
        "exam_id": context.exam_id,
        "staged_files": [item.name for item in files],
    }

    messages = history_tail + [
        {
            "role": "user",
            "content": (
                "Context:\n"
                f"{json.dumps(context_block)}\n\n"
                "User message:\n"
                f"{message}"
            ),
        }
    ]

    try:
        return llm.chat(
            messages=messages,
            system_prompt=CHAT_SYSTEM_PROMPT,
            temperature=0.2,
            max_tokens=900,
        )
    except Exception:
        return (
            "I could not reach the LLM right now, but action execution still works. "
            "Try 'help' for command examples."
        )


def _help_text() -> str:
    return (
        "You can chat normally or ask me to execute actions.\n"
        "\n"
        "Examples:\n"
        "1) create course code=CS601 name=Machine Learning semester=Spring2026\n"
        "2) create exam name=Midterm1 type=exam total=100\n"
        "3) import roster\n"
        "4) import rubric\n"
        "5) upload submissions\n"
        "6) grade pending\n"
        "7) set grade submission=12 question=Q1 marks=8.5 note=manual review\n"
        "8) export\n"
        "9) status\n"
        "\n"
        "Natural language multi-step requests are supported when HF_TOKEN (or LLM_API_KEY) is configured."
    )


def _create_course_from_params(code: str, name: str, semester: str | None) -> tuple[str, int]:
    code_clean = (code or "").strip().upper()
    name_clean = (name or "").strip()
    semester_clean = _optional_str(semester)
    if not code_clean or not name_clean:
        raise ValueError("Course creation requires code and name.")

    with session_scope() as db:
        duplicate = (
            db.query(Course)
            .filter(Course.code == code_clean, Course.semester == semester_clean)
            .one_or_none()
        )
        if duplicate:
            return f"Course already exists (id={duplicate.id}).", duplicate.id

        course = Course(name=name_clean, code=code_clean, semester=semester_clean)
        db.add(course)
        db.flush()
        return f"Course created: id={course.id}, code={course.code}, name={course.name}", course.id


def _create_exam_from_params(
    course_id: int,
    name: str,
    exam_type: str,
    total_marks: float,
) -> tuple[str, int]:
    name_clean = (name or "").strip()
    if not name_clean:
        raise ValueError("Exam creation requires name.")

    exam_type_clean = exam_type if exam_type in {"exam", "quiz", "assignment"} else "exam"
    total_clean = max(1.0, to_float(total_marks, 100.0))

    with session_scope() as db:
        duplicate = (
            db.query(Exam)
            .filter(Exam.course_id == course_id, Exam.name == name_clean)
            .one_or_none()
        )
        if duplicate:
            return f"Exam already exists (id={duplicate.id}).", duplicate.id

        exam = Exam(
            course_id=course_id,
            name=name_clean,
            exam_type=exam_type_clean,
            total_marks=total_clean,
        )
        db.add(exam)
        db.flush()
        return f"Exam created: id={exam.id}, name={exam.name}, total={exam.total_marks}", exam.id


def _set_context_course_from_text(message: str, context: AgentContext) -> str:
    params = {
        "course_id": _extract_named_value(message, "course_id") or _extract_named_value(message, "id"),
        "code": _extract_named_value(message, "code"),
        "name": _extract_named_value(message, "name"),
    }
    if not params["course_id"] and not params["code"] and not params["name"]:
        match = re.search(r"(?:set|select|use)\s+course\s+(.+)$", message, flags=re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            if candidate.isdigit():
                params["course_id"] = candidate
            elif re.fullmatch(r"[A-Za-z]{2,}\d+[A-Za-z0-9-]*", candidate):
                params["code"] = candidate
            else:
                params["name"] = candidate

    return _set_context_course_from_params(params, context)


def _set_context_course_from_params(params: dict[str, Any], context: AgentContext) -> str:
    course_id = int(to_float(params.get("course_id"), 0))
    code = _optional_str(params.get("code"))
    name = _optional_str(params.get("name"))

    with session_scope() as db:
        target = None
        if course_id > 0:
            target = db.get(Course, course_id)
        elif code:
            target = db.query(Course).filter(Course.code == code.upper()).order_by(Course.id.desc()).first()
        elif name:
            target = db.query(Course).filter(Course.name.ilike(f"%{name}%")).order_by(Course.id.desc()).first()

        if not target:
            return "Could not resolve course. Provide course_id, code, or name."

        context.course_id = target.id

        if context.exam_id:
            exam = db.get(Exam, context.exam_id)
            if not exam or exam.course_id != target.id:
                context.exam_id = None

        return f"Context updated: course={target.id} ({target.code} - {target.name})"


def _set_context_exam_from_text(message: str, context: AgentContext) -> str:
    params = {
        "exam_id": _extract_named_value(message, "exam_id") or _extract_named_value(message, "id"),
        "name": _extract_named_value(message, "name") or _extract_named_value(message, "exam"),
    }
    if not params["exam_id"] and not params["name"]:
        match = re.search(r"(?:set|select|use)\s+exam\s+(.+)$", message, flags=re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            if candidate.isdigit():
                params["exam_id"] = candidate
            else:
                params["name"] = candidate
    return _set_context_exam_from_params(params, context)


def _set_context_exam_from_params(params: dict[str, Any], context: AgentContext) -> str:
    exam_id = int(to_float(params.get("exam_id"), 0))
    name = _optional_str(params.get("name"))

    with session_scope() as db:
        target = None
        if exam_id > 0:
            target = db.get(Exam, exam_id)
        elif name and context.course_id:
            target = (
                db.query(Exam)
                .filter(Exam.course_id == context.course_id, Exam.name.ilike(f"%{name}%"))
                .order_by(Exam.id.desc())
                .first()
            )
        elif name:
            target = db.query(Exam).filter(Exam.name.ilike(f"%{name}%")).order_by(Exam.id.desc()).first()

        if not target:
            return "Could not resolve exam. Provide exam_id or exam name."

        context.exam_id = target.id
        context.course_id = target.course_id
        return f"Context updated: exam={target.id} ({target.name})"


def _import_roster(files: list[AgentFile], context: AgentContext, filename_hint: str | None = None) -> str:
    if not context.course_id:
        return "Select a course in Assistant context before importing roster."

    roster = _pick_first_file(files, {".xlsx", ".xls", ".csv"}, filename_hint=filename_hint)
    if not roster:
        return "Please upload a roster file (.xlsx/.xls/.csv) and send 'import roster'."

    content = Path(roster.path).read_bytes()
    with session_scope() as db:
        result = import_roster(
            file_bytes=content,
            file_name=roster.name,
            course_id=context.course_id,
            db_session=db,
        )
    return (
        f"Roster imported from {roster.name}. "
        f"Added={result['added']}, Updated={result['updated']}, "
        f"Duplicates={result['duplicate_rows']}, Invalid={result['invalid_rows']}"
    )


def _import_rubric(files: list[AgentFile], context: AgentContext, filename_hint: str | None = None) -> str:
    if not context.exam_id:
        return "Select an exam in Assistant context before importing rubric."

    rubric_file = _pick_first_file(files, {".xlsx", ".xls", ".csv", ".json"}, filename_hint=filename_hint)
    if not rubric_file:
        return "Please upload a rubric file (.csv/.xlsx/.json) and send 'import rubric'."

    path = Path(rubric_file.path)
    rows = _load_rubric_rows(path)
    if not rows:
        return f"No valid rubric rows found in {rubric_file.name}."

    added = 0
    updated = 0
    with session_scope() as db:
        for item in rows:
            existing = (
                db.query(Rubric)
                .filter(Rubric.exam_id == context.exam_id, Rubric.question_no == item["question_no"])
                .one_or_none()
            )
            if existing:
                existing.question_order = item["question_order"]
                existing.question_text = item["question_text"]
                existing.max_marks = item["max_marks"]
                existing.key_points_json = json.dumps(item["key_points"])
                existing.grading_notes = item["grading_notes"]
                updated += 1
            else:
                db.add(
                    Rubric(
                        exam_id=context.exam_id,
                        question_no=item["question_no"],
                        question_order=item["question_order"],
                        question_text=item["question_text"],
                        max_marks=item["max_marks"],
                        key_points_json=json.dumps(item["key_points"]),
                        grading_notes=item["grading_notes"],
                    )
                )
                added += 1

    return f"Rubric import completed from {rubric_file.name}. Added={added}, Updated={updated}."


def _add_rubric_from_text(message: str, context: AgentContext) -> str:
    if not context.exam_id:
        return "Select an exam in Assistant context before adding rubric question."

    q_no = _extract_named_value(message, "question_no") or _extract_named_value(message, "q")
    q_text = _extract_named_value(message, "text")
    max_marks = to_float(_extract_named_value(message, "max"), 0.0)
    question_order = int(to_float(_extract_named_value(message, "order"), 1))
    grading_notes = _extract_named_value(message, "notes")
    key_points_text = _extract_named_value(message, "key_points")
    key_points = _parse_key_points_cell(key_points_text or "")

    if not q_no or not q_text or max_marks <= 0:
        return (
            "Need question_no, text, and max. Example: "
            "add rubric question_no=Q1 max=10 text=Explain gradient descent key_points=[{\"point\":\"learning rate\",\"marks\":5}]"
        )

    return _upsert_rubric(
        exam_id=context.exam_id,
        question_no=q_no,
        question_text=q_text,
        max_marks=max_marks,
        question_order=question_order,
        grading_notes=grading_notes,
        key_points=key_points,
    )


def _add_rubric_from_params(params: dict[str, Any], context: AgentContext) -> str:
    if not context.exam_id:
        return "Select an exam in Assistant context before adding rubric question."

    q_no = _optional_str(params.get("question_no") or params.get("q"))
    q_text = _optional_str(params.get("question_text") or params.get("text"))
    max_marks = to_float(params.get("max_marks") or params.get("max"), 0.0)
    question_order = int(to_float(params.get("question_order") or params.get("order"), 1))
    grading_notes = _optional_str(params.get("grading_notes") or params.get("notes"))

    key_points_value = params.get("key_points")
    if isinstance(key_points_value, list):
        key_points = []
        for item in key_points_value:
            if isinstance(item, dict) and item.get("point"):
                key_points.append(
                    {
                        "point": str(item.get("point", "")).strip(),
                        "marks": to_float(item.get("marks"), 1.0),
                    }
                )
    else:
        key_points = _parse_key_points_cell(str(key_points_value or ""))

    if not q_no or not q_text or max_marks <= 0:
        return "add_rubric needs question_no, question_text, and max_marks."

    return _upsert_rubric(
        exam_id=context.exam_id,
        question_no=q_no,
        question_text=q_text,
        max_marks=max_marks,
        question_order=question_order,
        grading_notes=grading_notes,
        key_points=key_points,
    )


def _upsert_rubric(
    exam_id: int,
    question_no: str,
    question_text: str,
    max_marks: float,
    question_order: int,
    grading_notes: str | None,
    key_points: list[dict],
) -> str:
    with session_scope() as db:
        existing = (
            db.query(Rubric)
            .filter(Rubric.exam_id == exam_id, Rubric.question_no == question_no)
            .one_or_none()
        )
        if existing:
            existing.question_order = question_order
            existing.question_text = question_text
            existing.max_marks = max_marks
            existing.key_points_json = json.dumps(key_points)
            existing.grading_notes = grading_notes
            return f"Rubric question {question_no} updated."

        db.add(
            Rubric(
                exam_id=exam_id,
                question_no=question_no,
                question_order=question_order,
                question_text=question_text,
                max_marks=max_marks,
                key_points_json=json.dumps(key_points),
                grading_notes=grading_notes,
            )
        )
        return f"Rubric question {question_no} added."


def _map_submissions(
    files: list[AgentFile],
    context: AgentContext,
    mapping_filename_hint: str | None = None,
) -> str:
    if not context.course_id or not context.exam_id:
        return "Select both course and exam in Assistant context before mapping submissions."

    pdf_files = [item for item in files if Path(item.name).suffix.lower() == ".pdf"]
    if not pdf_files:
        return "Upload one or more PDF files, then send 'upload submissions'."

    mapping_file = _pick_mapping_file(files, filename_hint=mapping_filename_hint)
    explicit_map = _load_mapping_table(mapping_file.path) if mapping_file else {}

    with session_scope() as db:
        students = db.query(Student).filter(Student.course_id == context.course_id).all()
        by_roll = {normalize_roll(student.roll_number): student for student in students if student.roll_number}

        upload_dir = Path(os.getenv("UPLOAD_DIR", "data/uploads")) / f"exam_{context.exam_id}"
        upload_dir.mkdir(parents=True, exist_ok=True)

        matched = 0
        replaced = 0
        unmatched: list[str] = []

        for item in pdf_files:
            roll = explicit_map.get(item.name.lower()) if explicit_map else None
            if not roll:
                roll = _infer_roll_from_filename(item.name)

            student = by_roll.get(normalize_roll(roll)) if roll else None
            if not student:
                unmatched.append(item.name)
                continue

            save_path = upload_dir / f"student_{student.id}.pdf"
            save_path.write_bytes(Path(item.path).read_bytes())

            existing = (
                db.query(Submission)
                .filter(Submission.exam_id == context.exam_id, Submission.student_id == student.id)
                .one_or_none()
            )
            if existing:
                existing.file_name = item.name
                existing.file_path = str(save_path)
                existing.status = "pending"
                existing.error_message = None
                replaced += 1
            else:
                db.add(
                    Submission(
                        exam_id=context.exam_id,
                        student_id=student.id,
                        file_name=item.name,
                        file_path=str(save_path),
                        status="pending",
                    )
                )
            matched += 1

    summary = f"Submissions mapped. Matched={matched}, Replaced={replaced}, Unmatched={len(unmatched)}."
    if unmatched:
        summary += f" Unmatched files: {', '.join(unmatched[:8])}"
    return summary


def _grade_pending(context: AgentContext) -> str:
    if not context.exam_id:
        return "Select an exam in Assistant context before grading."

    with session_scope() as db:
        pending = (
            db.query(Submission)
            .filter(Submission.exam_id == context.exam_id, Submission.status == "pending")
            .order_by(Submission.id.asc())
            .all()
        )

    if not pending:
        return "No pending submissions for selected exam."

    fallback_hits = 0
    graded = 0
    errors: list[str] = []
    for row in pending:
        try:
            result = grade_submission(row.id)
            graded += 1
            fallback_hits += len(result.get("fallback_questions", []))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"submission {row.id}: {exc}")

    text = f"Grading run completed. Graded={graded}/{len(pending)}. Fallback triggers={fallback_hits}."
    if errors:
        text += f" Errors: {' | '.join(errors[:3])}"
    return text


def _override_grade(message: str, context: AgentContext) -> str:
    if not context.exam_id:
        return "Select an exam in Assistant context before overriding grades."

    submission_id = int(to_float(_extract_named_value(message, "submission"), 0))
    question = _extract_named_value(message, "question")
    marks = to_float(_extract_named_value(message, "marks"), -1.0)
    note = _extract_named_value(message, "note")

    if submission_id <= 0 or not question or marks < 0:
        return "Use: set grade submission=12 question=Q1 marks=8.5 note=manual review"

    return _override_grade_from_params(
        {
            "submission_id": submission_id,
            "question": question,
            "marks": marks,
            "note": note,
        },
        context,
    )


def _override_grade_from_params(params: dict[str, Any], context: AgentContext) -> str:
    if not context.exam_id:
        return "Select an exam in Assistant context before overriding grades."

    submission_id = int(to_float(params.get("submission_id") or params.get("submission"), 0))
    question = _optional_str(params.get("question") or params.get("question_no"))
    marks = to_float(params.get("marks"), -1.0)
    note = _optional_str(params.get("note"))

    if submission_id <= 0 or not question or marks < 0:
        return "override_grade needs submission_id, question, and marks."

    target_q = normalize_question_no(question)
    with session_scope() as db:
        grade_rows = (
            db.query(Grade)
            .join(Submission, Submission.id == Grade.submission_id)
            .filter(Submission.exam_id == context.exam_id, Grade.submission_id == submission_id)
            .all()
        )
        target = None
        for row in grade_rows:
            if normalize_question_no(row.question_no) == target_q:
                target = row
                break
        if not target:
            return f"No grade row found for submission={submission_id}, question={question}."

        rubric = db.get(Rubric, target.rubric_id)
        upper = rubric.max_marks if rubric else marks
        clamped = max(0.0, min(marks, upper))
        target.override_marks = clamped
        target.override_note = note
        return f"Override saved for submission={submission_id}, question={target.question_no}, marks={clamped}."


def _export_exam(context: AgentContext) -> str:
    if not context.exam_id:
        raise ValueError("Select an exam in Assistant context before exporting.")

    export_dir = Path(os.getenv("EXPORT_DIR", "data/exports"))
    export_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = export_dir / f"assistant_exam_{context.exam_id}_{stamp}.xlsx"
    return export_exam_gradebook(context.exam_id, str(output_path))


def _status_summary(context: AgentContext) -> str:
    with session_scope() as db:
        if context.exam_id:
            exam = db.get(Exam, context.exam_id)
            if not exam:
                return "Selected exam not found."

            total = db.query(Submission).filter(Submission.exam_id == context.exam_id).count()
            pending = db.query(Submission).filter(Submission.exam_id == context.exam_id, Submission.status == "pending").count()
            done = db.query(Submission).filter(Submission.exam_id == context.exam_id, Submission.status == "done").count()
            errors = db.query(Submission).filter(Submission.exam_id == context.exam_id, Submission.status == "error").count()
            rubric_count = db.query(Rubric).filter(Rubric.exam_id == context.exam_id).count()
            return (
                f"Exam status ({exam.name}): rubric_questions={rubric_count}, "
                f"submissions={total}, pending={pending}, done={done}, errors={errors}."
            )

        course_text = ""
        if context.course_id:
            course = db.get(Course, context.course_id)
            if course:
                exam_count = db.query(Exam).filter(Exam.course_id == context.course_id).count()
                student_count = db.query(Student).filter(Student.course_id == context.course_id).count()
                course_text = f"Course ({course.code}): exams={exam_count}, students={student_count}. "

        total_courses = db.query(Course).count()
        total_exams = db.query(Exam).count()
        return f"{course_text}Workspace totals: courses={total_courses}, exams={total_exams}."


def _extract_named_value(text: str, field: str) -> str | None:
    patterns = [
        rf"\b{re.escape(field)}\s*[:=]\s*\"([^\"]+)\"",
        rf"\b{re.escape(field)}\s*[:=]\s*'([^']+)'",
        rf"\b{re.escape(field)}\s*[:=]\s*(.+?)(?=\s+\w+\s*[:=]|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _pick_first_file(
    files: list[AgentFile],
    extensions: set[str],
    filename_hint: str | None = None,
) -> AgentFile | None:
    if filename_hint:
        hint = filename_hint.lower().strip()
        for item in files:
            if Path(item.name).suffix.lower() in extensions and hint in item.name.lower():
                return item

    for item in files:
        if Path(item.name).suffix.lower() in extensions:
            return item
    return None


def _load_rubric_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    suffix = path.suffix.lower()
    if suffix == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        iterable = payload if isinstance(payload, list) else payload.get("rubric", [])
    else:
        if suffix == ".csv":
            frame = pd.read_csv(path)
        else:
            frame = pd.read_excel(path)
        iterable = frame.to_dict(orient="records")

    for idx, item in enumerate(iterable, start=1):
        normalized = {str(k).strip().lower(): v for k, v in dict(item).items()}
        q_no = _first_present(normalized, ["question_no", "question", "q", "question_number"])
        q_text = _first_present(normalized, ["question_text", "text", "prompt"])
        max_marks = to_float(_first_present(normalized, ["max_marks", "max", "marks"]), 0.0)
        order = int(to_float(_first_present(normalized, ["question_order", "order"]), idx))
        notes = _first_present(normalized, ["grading_notes", "notes", "partial_credit"])
        key_points_cell = _first_present(normalized, ["key_points", "points", "rubric_points"])
        key_points = _parse_key_points_cell(str(key_points_cell or ""))

        if not q_no or not q_text or max_marks <= 0:
            continue

        rows.append(
            {
                "question_no": str(q_no).strip(),
                "question_text": str(q_text).strip(),
                "max_marks": max_marks,
                "question_order": order,
                "grading_notes": str(notes).strip() if notes else None,
                "key_points": key_points,
            }
        )
    return rows


def _first_present(mapping: dict, keys: list[str]):
    for key in keys:
        if key in mapping and mapping[key] not in (None, ""):
            return mapping[key]
    return None


def _parse_key_points_cell(value: str) -> list[dict]:
    text = (value or "").strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return []

    parsed = safe_parse_json(text)
    if isinstance(parsed, list):
        result = []
        for item in parsed:
            if isinstance(item, dict) and item.get("point"):
                result.append({"point": str(item["point"]).strip(), "marks": to_float(item.get("marks"), 1.0)})
        if result:
            return result

    points: list[dict] = []
    segments = [segment.strip() for segment in re.split(r";|\n", text) if segment.strip()]
    for segment in segments:
        if "|" in segment:
            point_text, marks_text = segment.rsplit("|", 1)
            points.append({"point": point_text.strip(), "marks": to_float(marks_text.strip(), 1.0)})
        else:
            points.append({"point": segment, "marks": 1.0})
    return points


def _pick_mapping_file(files: list[AgentFile], filename_hint: str | None = None) -> AgentFile | None:
    if filename_hint:
        hint = filename_hint.lower().strip()
        for item in files:
            suffix = Path(item.name).suffix.lower()
            if suffix in {".csv", ".xlsx", ".xls"} and hint in item.name.lower():
                return item

    for item in files:
        suffix = Path(item.name).suffix.lower()
        if suffix in {".csv", ".xlsx", ".xls"} and "map" in item.name.lower():
            return item
    return None


def _load_mapping_table(path: str) -> dict[str, str]:
    file_path = Path(path)
    if file_path.suffix.lower() == ".csv":
        frame = pd.read_csv(file_path)
    else:
        frame = pd.read_excel(file_path)
    normalized_columns = {str(col).strip().lower(): col for col in frame.columns}
    file_col = normalized_columns.get("file_name") or normalized_columns.get("filename")
    roll_col = normalized_columns.get("roll_number") or normalized_columns.get("roll")
    if not file_col or not roll_col:
        return {}

    mapping: dict[str, str] = {}
    for _, row in frame.iterrows():
        file_name = str(row.get(file_col, "")).strip().lower()
        roll = str(row.get(roll_col, "")).strip()
        if file_name and roll and file_name != "nan" and roll.lower() != "nan":
            mapping[file_name] = roll
    return mapping


def _infer_roll_from_filename(name: str) -> str:
    stem = Path(name).stem
    chunks = re.findall(r"[A-Za-z0-9]+", stem)
    with_digits = [chunk for chunk in chunks if any(ch.isdigit() for ch in chunk)]
    candidate = with_digits[0] if with_digits else (chunks[0] if chunks else stem)
    return normalize_roll(candidate)


def _split_compound_message(message: str) -> list[str]:
    raw_parts = re.split(r"\bthen\b|\bafter that\b|\bnext\b|\n+", message, flags=re.IGNORECASE)
    return [part.strip(" ,;\t") for part in raw_parts if part and part.strip(" ,;\t")]


def _looks_like_action(text: str) -> bool:
    lowered = text.lower()
    keywords = [
        "create course",
        "create exam",
        "import roster",
        "import rubric",
        "upload submissions",
        "map submissions",
        "grade",
        "export",
        "status",
        "set grade",
        "set course",
        "set exam",
        "select course",
        "select exam",
    ]
    return any(word in lowered for word in keywords)


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "nan"}:
        return None
    return text
