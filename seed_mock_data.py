import json
import random
from datetime import datetime

from db.database import init_db, session_scope
from db.models import Course, Exam, Grade, Rubric, Student, Submission

import fitz
import os

def create_mock_pdf(file_path, student_name, roll_number):
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 50), f"Name: {student_name}\nRoll: {roll_number}\n\nQ1. Missing text mock.\nQ2. More mock text.\nQ3. Another mock text.\nQ4. Mock explanation.")
    doc.save(file_path)
    doc.close()

def seed_db():
    init_db()
    with session_scope() as db:
        # Clear existing data to give a clean slate
        db.query(Grade).delete()
        db.query(Submission).delete()
        db.query(Student).delete()
        db.query(Rubric).delete()
        db.query(Exam).delete()
        db.query(Course).delete()

        # 1. Create Course
        course = Course(
            code="AI2026",
            name="Introduction to Artificial Intelligence",
            semester="Spring 2026"
        )
        db.add(course)
        db.flush()

        # 2. Create Exam
        exam = Exam(
            course_id=course.id,
            name="Midterm Examination"
        )
        db.add(exam)
        db.flush()

        # 3. Create Students (30 distinct students)
        first_names = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Isabella", "Elijah", "Sophia", "Lucas", 
                       "Mia", "Mason", "Amelia", "Logan", "Harper", "Alexander", "Evelyn", "Ethan", "Abigail", "Jacob",
                       "Emily", "Michael", "Ella", "Daniel", "Madison", "Henry", "Scarlett", "Jackson", "Aria", "Sebastian"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                      "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
                      "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"]

        students = []
        for i in range(1, 31):
            name = f"{first_names[i-1]} {last_names[i-1]}"
            roll = f"26AI{str(i).zfill(3)}"
            student = Student(course_id=course.id, name=name, roll_number=roll, email=f"{first_names[i-1].lower()}@university.edu")
            db.add(student)
            students.append(student)
        db.flush()

        # 4. Create Rubrics
        rubric_data = [
            {
                "no": "Q1",
                "text": "Define Machine Learning and outline its primary objective.",
                "marks": 5.0,
                "notes": "Look for a clear definition involving learning from data.",
                "points": [{"point": "Mentions algorithms learning from data", "marks": 3.0}, {"point": "Mentions primary objective of prediction/generalization", "marks": 2.0}]
            },
            {
                "no": "Q2",
                "text": "Differentiate between Supervised and Unsupervised Learning.",
                "marks": 8.0,
                "notes": "Give partial credit if only one is fully explained.",
                "points": [{"point": "Supervised uses labeled data", "marks": 4.0}, {"point": "Unsupervised finds hidden structures/patterns", "marks": 4.0}]
            },
            {
                "no": "Q3",
                "text": "Explain the concept of Overfitting in training models. How can it be prevented?",
                "marks": 10.0,
                "notes": "Very tough concept for students typically. Need to see prevention strategies.",
                "points": [
                    {"point": "Model memorizes training data including noise", "marks": 4.0},
                    {"point": "Performs poorly on unseen test data", "marks": 2.0},
                    {"point": "Mentions prevention: Regularization (L1/L2)", "marks": 2.0},
                    {"point": "Mentions prevention: Cross-validation or dropout", "marks": 2.0}
                ]
            },
            {
                "no": "Q4",
                "text": "What is the purpose of an Activation Function in a neural network?",
                "marks": 7.0,
                "notes": "They must mention non-linearity.",
                "points": [{"point": "Introduces non-linearity to the network", "marks": 4.0}, {"point": "Allows network to learn complex patterns", "marks": 3.0}]
            }
        ]

        rubrics = []
        for i, r_data in enumerate(rubric_data, start=1):
            r = Rubric(
                exam_id=exam.id,
                question_no=r_data["no"],
                question_order=i,
                question_text=r_data["text"],
                max_marks=r_data["marks"],
                grading_notes=r_data["notes"],
                key_points_json=json.dumps(r_data["points"])
            )
            db.add(r)
            rubrics.append(r)
        db.flush()

        # 5. Create Submissions and Grades
        # Let's make Q3 the toughest question deliberately (everyone performs bad to average)
        for s in students:
            file_path = f"data/uploads/exam_{exam.id}/student_{s.id}.pdf"
            
            # Generate actual physical PDF to prevent FileNotFoundError
            create_mock_pdf(file_path, s.name, s.roll_number)
            
            sub = Submission(
                exam_id=exam.id,
                student_id=s.id,
                file_name=f"{s.roll_number}_Midterm.pdf",
                file_path=file_path,    
                status="done",
                error_message=None
            )
            db.add(sub)
            db.flush()

            # Now add Grades for this submission
            for r in rubrics:
                # generate variable quality responses
                # Mock grading logic
                points = json.loads(r.key_points_json)
                awarded = 0.0
                matched = []
                missing = []
                
                # Biases
                if r.question_no == "Q3":
                    # Students struggle: 80% miss Regularization and Dropout
                    success_rate = random.random()
                    if success_rate < 0.2:
                        matched_flags = [True, True, True, True]
                    elif success_rate < 0.6:
                        matched_flags = [True, True, False, False]
                    else:
                        matched_flags = [True, False, False, False]
                else:
                    # Random chance to hit each point (typically good)
                    matched_flags = [random.random() > 0.15 for _ in points]

                for p, is_matched in zip(points, matched_flags):
                    if is_matched:
                        awarded += p["marks"]
                        matched.append(p["point"])
                    else:
                        missing.append(p["point"])

                # Some mock OCR text based on whether it was a good answer
                ocr_pool_good = [
                    "The student accurately detailed the concepts in scope.",
                    "This is a well-written response covering all the main algorithms.",
                    "An excellent theoretical breakdown."
                ]
                ocr_pool_bad = [
                    "I am not entirely sure, but I think it has something to do with the computer.",
                    "This concept is about datasets.",
                    "The model learns things."
                ]
                text_ans = random.choice(ocr_pool_good) if len(missing) == 0 else (random.choice(ocr_pool_bad) if len(matched) == 0 else "Partially correct explanation provided by student.")

                g = Grade(
                    submission_id=sub.id,
                    rubric_id=r.id,
                    question_no=r.question_no,
                    detected_pages="1",
                    ocr_text=text_ans,
                    awarded_marks=awarded,
                    feedback=f"AI Summary: {len(matched)} key points successfully identified. Student struggled with {len(missing)} concepts.",
                    matched_points_json=json.dumps(matched),
                    missing_points_json=json.dumps(missing),
                    confidence=0.92,
                    raw_response='{"mock": "true"}',
                    graded_at=datetime.utcnow()
                )
                db.add(g)

    print("Mock Data Seeded Successfully!")

if __name__ == "__main__":
    seed_db()