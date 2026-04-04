import json
import streamlit as st
import fitz
import os
import re
from pathlib import Path
from services.ocr_service import OCRService
from services.llm_service import LLMService

st.set_page_config(page_title="OCR Bot", page_icon="G", layout="wide")

st.markdown("# 🤖 OCR Bot & Question Extractor")
st.markdown("Upload a PDF to see the Vision OCR working in action. This extracts plain text, reads diagrams, and breaks it down into JSON questions to verify OCR quality.")

uploaded_file = st.file_uploader("Upload Student PDF", type=["pdf"])

if uploaded_file is not None:
    st.info("Parsing document...")
    
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    temp_path = upload_dir / uploaded_file.name
    with open(temp_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
        
    ocr = OCRService()
    llm = LLMService()

    try:
        pages = ocr.extract_pages(str(temp_path))
        st.success(f"Successfully processed {len(pages)} pages!")
        
        full_text = "\n\n".join([f"### Page {p.page_number}\n{p.text}" for p in pages])
        
        tab1, tab2 = st.tabs(["📄 Raw OCR Text", "🧩 Parsed Question JSON"])
        
        with tab1:
            st.markdown(full_text)
            
        with tab2:
            st.info("Parsing layout via LLM. Extracting each question, diagram texts, and answers...")
            prompt = (
                "You are an intelligent document formatter evaluating a student's answer sheet. "
                "Given the OCR text below, accurately identify each distinct Question (e.g. Q1, Q2) and the corresponding student's Answer text. "
                "Output ONLY a raw JSON array format matching this schema closely:\n"
                "[\n  {\n    \"question_number\": \"1\",\n    \"answer_text\": \"The student wrote...\"\n  }\n]\n\n"
                "Return valid JSON only. Do not wrap in markdown code blocks. NO markdown wrappers.\n\n"
                f"OCR Text:\n\n{full_text}"
            )
            response = llm.chat(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a helpful document parsing assistant. You only output valid JSON arrays.",
                temperature=0.0
            )
            
            # Simple extractor
            match = re.search(r"\[.*\]|\{.*\}", response, re.DOTALL)
            if match:
                try:
                    js = json.loads(match.group(0))
                    st.json(js)
                except:
                    st.code(response, language="json")
            else:
                st.code(response, language="text")

    except Exception as e:
        st.error(f"Error evaluating OCR: {e}")
