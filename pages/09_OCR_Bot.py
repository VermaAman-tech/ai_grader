import json
import re
from pathlib import Path

import streamlit as st

from services.llm_service import LLMService
from services.ocr_service import OCRService
from ui.theme import inject_theme_css, render_header, render_divider, render_section_title


st.set_page_config(page_title="OCR Bot — Grader", page_icon="🎓", layout="wide")
inject_theme_css()
render_header(
    "OCR Bot & Tester",
    "Test Vision OCR quality on any PDF — extract text, parse questions, and verify AI accuracy.",
    "🔍",
)

st.markdown(
    """
    <div class="gw-info-card">
        <strong style="color:#7dd3fc; font-size:0.85rem;">🤖 What this does</strong>
        <div style="color:#64748b; font-size:0.82rem; margin-top:0.3rem; line-height:1.7;">
            1. Extracts text from each PDF page using PyMuPDF<br>
            2. Falls back to Vision LLM (Qwen-VL) for handwritten/image-heavy pages<br>
            3. Optionally parses the OCR output into structured Q&amp;A JSON via LLM
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

render_divider()

render_section_title("Upload PDF for OCR Testing")
uploaded_file = st.file_uploader(
    "Drop a PDF here to test OCR",
    type=["pdf"],
    help="Upload any exam, answer sheet, or document PDF to test OCR quality",
)

if uploaded_file is not None:
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    temp_path = upload_dir / uploaded_file.name
    with open(temp_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    ocr = OCRService()
    llm = LLMService()

    with st.spinner("Running OCR extraction..."):
        try:
            pages = ocr.extract_pages(str(temp_path))
        except Exception as e:
            st.error(f"OCR failed: {e}")
            st.stop()

    # Stats
    total_chars = sum(len(p.text) for p in pages)
    st.markdown("<br>", unsafe_allow_html=True)
    sc1, sc2, sc3 = st.columns(3)
    sc1.metric("Pages processed", len(pages))
    sc2.metric("Total characters", f"{total_chars:,}")
    sc3.metric("Avg chars/page", f"{total_chars // max(len(pages), 1):,}")

    render_divider()

    full_text = "\n\n".join([f"### Page {p.page_number}\n{p.text}" for p in pages])

    tab1, tab2, tab3 = st.tabs(["📄 Raw OCR Text", "🧩 Parsed Q&A JSON", "📑 Per-Page View"])

    with tab1:
        render_section_title("Extracted Text")
        st.markdown(
            f'<div style="color:#475569; font-size:0.78rem; margin-bottom:0.5rem;">'
            f'{len(pages)} pages • {total_chars:,} characters extracted'
            f'</div>',
            unsafe_allow_html=True,
        )
        # Scrollable text box
        st.text_area(
            "Full OCR output",
            value=full_text,
            height=500,
            disabled=True,
            label_visibility="collapsed",
        )

    with tab2:
        render_section_title("AI-Parsed Question & Answer Structure")
        st.markdown(
            '<div style="color:#64748b; font-size:0.82rem; margin-bottom:0.75rem;">'
            'The LLM will analyze the OCR text and extract individual questions and student answers.'
            '</div>',
            unsafe_allow_html=True,
        )

        if st.button("🤖 Parse into Q&A JSON", type="primary"):
            with st.spinner("Analyzing structure via LLM..."):
                prompt = (
                    "You are an intelligent document formatter evaluating a student's answer sheet. "
                    "Given the OCR text below, accurately identify each distinct Question (e.g. Q1, Q2) and the corresponding student's Answer text. "
                    "Output ONLY a raw JSON array format matching this schema closely:\n"
                    '[\n  {\n    "question_number": "1",\n    "answer_text": "The student wrote..."\n  }\n]\n\n'
                    "Return valid JSON only. Do not wrap in markdown code blocks. NO markdown wrappers.\n\n"
                    f"OCR Text:\n\n{full_text}"
                )
                try:
                    response = llm.chat(
                        messages=[{"role": "user", "content": prompt}],
                        system_prompt="You are a helpful document parsing assistant. You only output valid JSON arrays.",
                        temperature=0.0,
                    )

                    match = re.search(r"\[.*\]", response, re.DOTALL)
                    if match:
                        try:
                            parsed = json.loads(match.group(0))
                            st.success(f"✅ Extracted **{len(parsed)} question(s)**")

                            for item in parsed:
                                q_num = item.get("question_number", "?")
                                answer = item.get("answer_text", "")
                                with st.expander(f"Question {q_num}", expanded=True):
                                    st.markdown(
                                        f'<div style="color:#94a3b8; font-size:0.85rem; line-height:1.6;">'
                                        f'{answer}'
                                        f'</div>',
                                        unsafe_allow_html=True,
                                    )

                            render_divider()
                            st.markdown("**Raw JSON output:**")
                            st.json(parsed)

                        except json.JSONDecodeError:
                            st.warning("Could not parse as JSON. Raw response:")
                            st.code(response, language="text")
                    else:
                        st.warning("No JSON array found in response.")
                        st.code(response, language="text")

                except Exception as e:
                    st.error(f"LLM parsing failed: {e}")

    with tab3:
        render_section_title("Per-Page OCR Output")
        for page in pages:
            char_count = len(page.text)
            quality = "✅ Good" if char_count > 200 else ("⚠️ Sparse" if char_count > 50 else "❌ Empty")
            quality_color = "#2dd4bf" if char_count > 200 else ("#fbbf24" if char_count > 50 else "#f87171")

            with st.expander(
                f"Page {page.page_number}  —  {char_count:,} chars  —  {quality}",
                expanded=(char_count < 50),
            ):
                if page.text.strip():
                    st.text_area(
                        f"Page {page.page_number} text",
                        value=page.text,
                        height=200,
                        disabled=True,
                        key=f"page_text_{page.page_number}",
                        label_visibility="collapsed",
                    )
                else:
                    st.markdown(
                        '<div style="color:#475569; font-size:0.85rem; padding:0.5rem 0;">No text extracted from this page.</div>',
                        unsafe_allow_html=True,
                    )
