from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from db.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False)
    semester = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    exams = relationship("Exam", back_populates="course", cascade="all, delete-orphan")
    students = relationship("Student", back_populates="course", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("code", "semester", name="uq_courses_code_semester"),
    )


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    exam_type = Column(String(50), nullable=False, default="exam")
    total_marks = Column(Float, nullable=False, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    course = relationship("Course", back_populates="exams")
    rubrics = relationship("Rubric", back_populates="exam", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="exam", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("course_id", "name", name="uq_exams_course_name"),
    )


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    roll_number = Column(String(100), nullable=True)
    email = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    course = relationship("Course", back_populates="students")
    submissions = relationship("Submission", back_populates="student", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("course_id", "roll_number", name="uq_students_course_roll"),
    )


class Rubric(Base):
    __tablename__ = "rubrics"

    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    question_no = Column(String(50), nullable=False)
    question_order = Column(Integer, nullable=False, default=1)
    question_text = Column(Text, nullable=False)
    max_marks = Column(Float, nullable=False)
    key_points_json = Column(Text, nullable=False, default="[]")
    grading_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    exam = relationship("Exam", back_populates="rubrics")
    grades = relationship("Grade", back_populates="rubric", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("exam_id", "question_no", name="uq_rubric_exam_question"),
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    exam = relationship("Exam", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")
    grades = relationship("Grade", back_populates="submission", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_submission_exam_student"),
        CheckConstraint("status IN ('pending', 'grading', 'done', 'error')", name="ck_submission_status"),
    )


class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    rubric_id = Column(Integer, ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False, index=True)
    question_no = Column(String(50), nullable=False)
    detected_pages = Column(String(200), nullable=True)
    ocr_text = Column(Text, nullable=False, default="")
    awarded_marks = Column(Float, nullable=False, default=0.0)
    feedback = Column(Text, nullable=False, default="")
    matched_points_json = Column(Text, nullable=False, default="[]")
    missing_points_json = Column(Text, nullable=False, default="[]")
    confidence = Column(Float, nullable=False, default=0.0)
    raw_response = Column(Text, nullable=True)
    override_marks = Column(Float, nullable=True)
    override_note = Column(Text, nullable=True)
    graded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submission = relationship("Submission", back_populates="grades")
    rubric = relationship("Rubric", back_populates="grades")

    __table_args__ = (
        UniqueConstraint("submission_id", "rubric_id", name="uq_grade_submission_rubric"),
    )
