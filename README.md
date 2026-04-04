# Grader Prototype

Functional prototype for exam grading.
No login.
No extras.

## Core Loop (Exact)

Create Course -> Create Exam -> Upload Roster (Excel) -> Define Rubric question-by-question -> Upload student PDFs -> OCR + LLM grades each answer -> Download Excel

## Fixed Decisions

1. No FastAPI in prototype. Everything runs directly in Streamlit.
2. SQLite with 6 tables, file-based, zero-config.
3. Full service code is implemented in source files, not pseudocode.
4. Smart fallback in grading: if question page auto-detection finds nothing, grading falls back to all pages for that question.
5. Edge cases are handled explicitly: rate limits, bad LLM JSON, duplicate students, marks clamping.
6. Build order is enforced: services first, pages after, test one full student loop before scaling.

## Project Layout

```
.
|-- app.py
|-- pages/
|   |-- 01_Courses.py
|   |-- 02_Exams.py
|   |-- 03_Roster.py
|   |-- 04_Rubric.py
|   |-- 05_Submissions.py
|   |-- 06_Grade.py
|   |-- 07_Export.py
|-- db/
|   |-- database.py
|   |-- models.py
|-- services/
|   |-- ocr_service.py
|   |-- llm_service.py
|   |-- grading_service.py
|   |-- roster_service.py
|   |-- export_service.py
|-- utils/
|   |-- helpers.py
|   |-- prompts.py
|-- ui/
|   |-- theme.py
|-- smoke_test.py
|-- requirements.txt
|-- .env.example
|-- .streamlit/config.toml
```

## Database Schema (6 Tables)

1. courses
2. exams
3. students
4. rubrics
5. submissions
6. grades

Notes:
- students has uniqueness by course + roll_number.
- rubrics has uniqueness by exam + question_no.
- submissions has uniqueness by exam + student.
- grades has uniqueness by submission + rubric.

## Setup

### Windows (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set values in .env:

```env
# Reasoning / grading model
HF_TOKEN=
HF_PROVIDER=auto
LLM_API_KEY=
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
LLM_FALLBACK_MODELS=meta-llama/Llama-3.1-8B-Instruct

# OCR extraction model (vision)
OCR_MODE=auto
OCR_MIN_TEXT_CHARS=20
OCR_HF_TOKEN=
OCR_HF_PROVIDER=auto
OCR_LLM_API_KEY=
OCR_LLM_MODEL=Qwen/Qwen3-VL-8B-Instruct
OCR_LLM_FALLBACK_MODELS=

DATABASE_URL=sqlite:///./grader.db
UPLOAD_DIR=./data/uploads
EXPORT_DIR=./data/exports
```

Key setup notes:
1. Set HF_TOKEN with your Hugging Face access token (starts with hf_).
2. Keep HF_PROVIDER=auto unless you need to pin a specific provider.
3. LLM_API_KEY is kept only for backward compatibility and can be the same token as HF_TOKEN.
4. If OCR_HF_TOKEN and OCR_LLM_API_KEY are empty, OCR automatically reuses HF_TOKEN.
5. OCR flow is now: PyMuPDF text -> vision model fallback -> Tesseract fallback.
6. For handwriting-heavy scans, keep OCR_MODE=auto.
7. Current HF provider routing may not expose all model IDs all the time.
8. If Mistral-7B-Instruct-v0.3 or Qwen2.5-VL is unavailable on your enabled providers, use the defaults above.

How to get the API key (Hugging Face):
1. Sign in at https://huggingface.co/
2. Open Settings -> Access Tokens.
3. Create a token with read/inference access.
4. Paste token into HF_TOKEN in .env.
5. Keep OCR_HF_TOKEN empty unless you want a separate token for OCR usage.

## Run

```powershell
streamlit run app.py
```

Open browser: http://localhost:8501

## Build Order (Strict)

1. db/models.py
2. db/database.py
3. utils/helpers.py
4. utils/prompts.py
5. services/ocr_service.py
6. services/llm_service.py
7. services/grading_service.py
8. services/roster_service.py
9. services/export_service.py
10. app.py
11. pages/01_Courses.py to pages/07_Export.py

## Verification Order (Strict)

1. Run smoke_test.py
2. Start Streamlit
3. Test one student complete loop
4. Then run full class batch

## Edge-Case Handling Included

1. Rate limits: llm_service.py retries with exponential backoff and wait.
2. Bad JSON from LLM: parsed safely; heuristic fallback grading is used if parsing fails.
3. Duplicate students in roster: import logic updates existing roll records and skips duplicate file rows.
4. Marks clamping: scores are clamped to [0, max_marks].
5. Question detector miss: grading_service.py falls back to all pages for that question.
6. Missing rubric/submission prerequisites: each page blocks progression with clear warnings.
7. Submission-level failures: status moves to error with captured error_message.

## UI Requirements

1. Dark mode is default via .streamlit/config.toml.
2. Theme CSS in ui/theme.py applies custom dark gradients, typography, cards, and responsive behavior.

## One-Command Smoke Check

```powershell
python smoke_test.py
```

Expected output includes:

1. graded_questions=...
2. fallback_questions=...
3. grade_rows=...
4. export_file=...