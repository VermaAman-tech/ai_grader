import io

import pandas as pd

from db.models import Student
from utils.helpers import normalize_roll

COLUMN_ALIASES = {
    "name": ["name", "student name", "full name"],
    "roll_number": ["roll", "roll number", "roll no", "roll_no", "roll_number", "student id", "id"],
    "email": ["email", "email address", "mail"],
}

def load_roster_dataframe(file_bytes: bytes, file_name: str) -> pd.DataFrame:   
    buffer = io.BytesIO(file_bytes)
    if file_name.lower().endswith(".csv"):
        return pd.read_csv(buffer)
    return pd.read_excel(buffer)

def import_roster(file_bytes: bytes, file_name: str, course_id: int, db_session) -> dict:
    df = load_roster_dataframe(file_bytes, file_name)
    if df.empty:
        return {
            "added": 0,
            "updated": 0,
            "duplicate_rows": 0,
            "invalid_rows": 0,
            "message": "Roster file is empty.",
        }

    normalized_columns = {str(col).strip().lower(): col for col in df.columns}  

    def find_column(alias_key: str):
        for alias in COLUMN_ALIASES[alias_key]:
            if alias in normalized_columns:
                return normalized_columns[alias]
        return None

    name_col = find_column("name")
    roll_col = find_column("roll_number")
    email_col = find_column("email")

    if not name_col:
        raise ValueError("Roster must include a Name column")

    existing_students = db_session.query(Student).filter(Student.course_id == course_id).all()
    by_roll = {normalize_roll(student.roll_number): student for student in existing_students if student.roll_number}

    seen_rolls_in_file: set[str] = set()
    added = 0
    updated = 0
    duplicate_rows = 0
    invalid_rows = 0

    for _, row in df.iterrows():
        name = str(row.get(name_col, "")).strip()
        if not name or name.lower() == "nan":
            invalid_rows += 1
            continue

        raw_roll = str(row.get(roll_col, "")).strip() if roll_col else ""       
        if raw_roll.lower() == "nan":
            raw_roll = ""
        elif raw_roll.endswith(".0"):
            raw_roll = raw_roll[:-2]

        roll = normalize_roll(raw_roll)

        email = str(row.get(email_col, "")).strip() if email_col else ""        
        if email.lower() == "nan":
            email = ""

        if roll:
            if roll in seen_rolls_in_file:
                duplicate_rows += 1
                continue
            seen_rolls_in_file.add(roll)

            existing = by_roll.get(roll)
            if existing:
                existing.name = name
                if email:
                    existing.email = email
                updated += 1
                continue

        else:
            duplicate = (
                db_session.query(Student)
                .filter(
                    Student.course_id == course_id,
                    Student.name == name,
                    Student.email == (email or None),
                )
                .one_or_none()
            )
            if duplicate:
                duplicate_rows += 1
                continue

        db_session.add(
            Student(
                course_id=course_id,
                name=name,
                roll_number=roll or None,
                email=email or None,
            )
        )
        added += 1

    return {
        "added": added,
        "updated": updated,
        "duplicate_rows": duplicate_rows,
        "invalid_rows": invalid_rows,
        "message": "Roster import completed.",
    }