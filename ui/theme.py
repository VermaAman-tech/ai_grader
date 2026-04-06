import streamlit as st


THEME_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* ── Base Reset ── */
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* ── App Background ── */
.stApp {
    background:
        radial-gradient(ellipse at 0% 0%, rgba(56, 189, 248, 0.07) 0%, transparent 50%),
        radial-gradient(ellipse at 100% 0%, rgba(99, 102, 241, 0.07) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(20, 184, 166, 0.05) 0%, transparent 50%),
        linear-gradient(180deg, #050c18 0%, #080f1e 50%, #060c17 100%);
    min-height: 100vh;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #060d1f 0%, #09142a 100%) !important;
    border-right: 1px solid rgba(56, 189, 248, 0.12) !important;
}

[data-testid="stSidebar"] .stMarkdown p,
[data-testid="stSidebar"] label {
    color: #94a3b8 !important;
}

[data-testid="stSidebarNav"] a {
    border-radius: 10px !important;
    transition: all 0.2s ease !important;
}

[data-testid="stSidebarNav"] a:hover {
    background: rgba(56, 189, 248, 0.08) !important;
    padding-left: 1rem !important;
}

[data-testid="stSidebarNav"] a[aria-selected="true"] {
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.12)) !important;
    border-left: 3px solid #38bdf8 !important;
}

/* ── Main Content Area ── */
.main .block-container {
    padding-top: 1.5rem !important;
    padding-bottom: 3rem !important;
    max-width: 1400px !important;
}

/* ── Hero Header ── */
.gw-hero {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(56, 189, 248, 0.2);
    background: linear-gradient(135deg,
        rgba(14, 26, 46, 0.95) 0%,
        rgba(10, 18, 36, 0.95) 60%,
        rgba(14, 22, 42, 0.95) 100%);
    border-radius: 20px;
    padding: 1.8rem 2rem;
    margin-bottom: 1.5rem;
    box-shadow:
        0 0 0 1px rgba(56, 189, 248, 0.05),
        0 20px 60px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.gw-hero::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.06) 0%, transparent 70%);
    pointer-events: none;
}

.gw-hero::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: 5%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
    pointer-events: none;
}

.gw-hero-icon {
    font-size: 2rem;
    margin-bottom: 0.4rem;
    display: block;
}

.gw-hero h1 {
    margin: 0 0 0.4rem 0;
    font-size: 1.9rem;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #f0f9ff 0%, #bae6fd 50%, #7dd3fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
}

.gw-hero p {
    margin: 0;
    color: #64748b;
    font-size: 0.95rem;
    font-weight: 400;
    letter-spacing: 0.01em;
}

/* ── Chip Badges ── */
.gw-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0.25rem 0.4rem 0.25rem 0;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    border: 1px solid rgba(56, 189, 248, 0.25);
    background: rgba(56, 189, 248, 0.06);
    color: #7dd3fc;
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    transition: all 0.2s ease;
}

.gw-chip:hover {
    border-color: rgba(56, 189, 248, 0.45);
    background: rgba(56, 189, 248, 0.1);
}

.gw-chip-success {
    border-color: rgba(20, 184, 166, 0.3);
    background: rgba(20, 184, 166, 0.08);
    color: #2dd4bf;
}

.gw-chip-warning {
    border-color: rgba(251, 191, 36, 0.3);
    background: rgba(251, 191, 36, 0.08);
    color: #fbbf24;
}

.gw-chip-error {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
    color: #f87171;
}

/* ── KPI Cards ── */
.gw-kpi {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(56, 189, 248, 0.15);
    background: linear-gradient(135deg, rgba(12, 22, 40, 0.9), rgba(8, 16, 32, 0.9));
    border-radius: 16px;
    padding: 1.1rem 1.2rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.gw-kpi:hover {
    border-color: rgba(56, 189, 248, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.gw-kpi::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.4), transparent);
}

.gw-kpi-title {
    color: #475569;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.4rem;
}

.gw-kpi-value {
    color: #e2e8f0;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}

.gw-kpi-sub {
    color: #38bdf8;
    font-size: 0.78rem;
    font-weight: 500;
    margin-top: 0.3rem;
}

/* ── Status Badges ── */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.03em;
}

.status-pending {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    color: #fbbf24;
}

.status-grading {
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
}

.status-done {
    background: rgba(20, 184, 166, 0.1);
    border: 1px solid rgba(20, 184, 166, 0.3);
    color: #2dd4bf;
}

.status-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
}

/* ── Section Headers ── */
.gw-section-title {
    font-size: 1rem;
    font-weight: 700;
    color: #cbd5e1;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(56, 189, 248, 0.1);
}

/* ── Divider ── */
.gw-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.15), transparent);
    margin: 1.5rem 0;
}

/* ── Info Cards ── */
.gw-info-card {
    border: 1px solid rgba(99, 102, 241, 0.2);
    background: rgba(99, 102, 241, 0.05);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    margin: 0.75rem 0;
}

.gw-warning-card {
    border: 1px solid rgba(251, 191, 36, 0.2);
    background: rgba(251, 191, 36, 0.05);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    margin: 0.75rem 0;
}

.gw-success-card {
    border: 1px solid rgba(20, 184, 166, 0.2);
    background: rgba(20, 184, 166, 0.05);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    margin: 0.75rem 0;
}

/* ── Workflow Steps ── */
.gw-step {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    margin-bottom: 0.5rem;
    border: 1px solid transparent;
    transition: all 0.2s ease;
}

.gw-step-done {
    background: rgba(20, 184, 166, 0.06);
    border-color: rgba(20, 184, 166, 0.15);
}

.gw-step-active {
    background: rgba(56, 189, 248, 0.06);
    border-color: rgba(56, 189, 248, 0.2);
}

.gw-step-pending {
    background: rgba(15, 23, 42, 0.4);
    border-color: rgba(56, 189, 248, 0.06);
}

.gw-step-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
}

.gw-step-num-done {
    background: rgba(20, 184, 166, 0.2);
    color: #2dd4bf;
    border: 1px solid rgba(20, 184, 166, 0.4);
}

.gw-step-num-active {
    background: rgba(56, 189, 248, 0.2);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.4);
}

.gw-step-num-pending {
    background: rgba(30, 41, 59, 0.6);
    color: #475569;
    border: 1px solid rgba(56, 189, 248, 0.1);
}

.gw-step-label {
    font-size: 0.88rem;
    font-weight: 600;
    color: #94a3b8;
    line-height: 1.4;
}

.gw-step-done .gw-step-label { color: #2dd4bf; }
.gw-step-active .gw-step-label { color: #e2e8f0; }

.gw-step-desc {
    font-size: 0.76rem;
    color: #475569;
    margin-top: 0.1rem;
}

/* ── Score Badge ── */
.gw-score {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.6rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.gw-score-high {
    background: rgba(20, 184, 166, 0.12);
    color: #2dd4bf;
    border: 1px solid rgba(20, 184, 166, 0.25);
}

.gw-score-mid {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.25);
}

.gw-score-low {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
}

/* ── Streamlit Element Overrides ── */
/* Metric cards */
[data-testid="stMetricValue"] {
    font-size: 1.6rem !important;
    font-weight: 800 !important;
    color: #e2e8f0 !important;
    font-variant-numeric: tabular-nums;
}

[data-testid="stMetricLabel"] {
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569 !important;
}

[data-testid="stMetricDelta"] {
    font-size: 0.78rem !important;
}

/* Buttons */
.stButton > button {
    border-radius: 10px !important;
    font-weight: 600 !important;
    font-size: 0.875rem !important;
    letter-spacing: 0.01em !important;
    transition: all 0.2s ease !important;
    border: 1px solid transparent !important;
}

.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%) !important;
    border: none !important;
    box-shadow: 0 4px 15px rgba(14, 165, 233, 0.25) !important;
}

.stButton > button[kind="primary"]:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 6px 20px rgba(14, 165, 233, 0.35) !important;
}

.stButton > button[kind="secondary"] {
    background: rgba(30, 41, 59, 0.8) !important;
    border: 1px solid rgba(56, 189, 248, 0.2) !important;
    color: #94a3b8 !important;
}

.stButton > button[kind="secondary"]:hover {
    border-color: rgba(56, 189, 248, 0.4) !important;
    color: #e2e8f0 !important;
    background: rgba(56, 189, 248, 0.05) !important;
}

/* Inputs */
.stTextInput input,
.stNumberInput input,
.stTextArea textarea,
.stSelectbox select {
    background: rgba(10, 18, 34, 0.8) !important;
    border: 1px solid rgba(56, 189, 248, 0.15) !important;
    border-radius: 10px !important;
    color: #e2e8f0 !important;
    font-size: 0.9rem !important;
    transition: border-color 0.2s ease !important;
}

.stTextInput input:focus,
.stNumberInput input:focus,
.stTextArea textarea:focus {
    border-color: rgba(56, 189, 248, 0.45) !important;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.08) !important;
}

/* Selectbox */
[data-testid="stSelectbox"] > div > div {
    background: rgba(10, 18, 34, 0.8) !important;
    border: 1px solid rgba(56, 189, 248, 0.15) !important;
    border-radius: 10px !important;
}

/* File uploader */
[data-testid="stFileUploader"] {
    border: 1.5px dashed rgba(56, 189, 248, 0.2) !important;
    border-radius: 14px !important;
    background: rgba(10, 18, 34, 0.5) !important;
    padding: 0.5rem !important;
    transition: border-color 0.2s ease !important;
}

[data-testid="stFileUploader"]:hover {
    border-color: rgba(56, 189, 248, 0.4) !important;
    background: rgba(56, 189, 248, 0.03) !important;
}

/* Expander */
[data-testid="stExpander"] {
    border: 1px solid rgba(56, 189, 248, 0.1) !important;
    border-radius: 12px !important;
    background: rgba(8, 16, 30, 0.6) !important;
    overflow: hidden;
}

[data-testid="stExpander"]:hover {
    border-color: rgba(56, 189, 248, 0.2) !important;
}

/* DataFrames */
[data-testid="stDataFrame"] {
    border: 1px solid rgba(56, 189, 248, 0.1) !important;
    border-radius: 12px !important;
    overflow: hidden;
}

/* Progress bar */
.stProgress > div > div {
    background: linear-gradient(90deg, #0ea5e9, #6366f1) !important;
    border-radius: 999px !important;
}

.stProgress > div {
    background: rgba(30, 41, 59, 0.5) !important;
    border-radius: 999px !important;
}

/* Tabs */
.stTabs [data-baseweb="tab-list"] {
    background: rgba(8, 16, 30, 0.5) !important;
    border-radius: 12px !important;
    padding: 0.25rem !important;
    gap: 0.25rem !important;
    border: 1px solid rgba(56, 189, 248, 0.1) !important;
}

.stTabs [data-baseweb="tab"] {
    border-radius: 8px !important;
    font-weight: 500 !important;
    font-size: 0.875rem !important;
    color: #64748b !important;
    transition: all 0.2s ease !important;
}

.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.15)) !important;
    color: #e2e8f0 !important;
    border: 1px solid rgba(56, 189, 248, 0.2) !important;
}

/* Alerts & messages */
[data-testid="stAlert"] {
    border-radius: 12px !important;
    border: 1px solid transparent !important;
}

/* Info */
[data-testid="stAlert"][data-baseweb="notification"] {
    background: rgba(56, 189, 248, 0.06) !important;
}

/* Code */
code {
    font-family: 'JetBrains Mono', monospace !important;
    background: rgba(15, 25, 45, 0.8) !important;
    border: 1px solid rgba(56, 189, 248, 0.1) !important;
    border-radius: 6px !important;
    padding: 0.15em 0.45em !important;
    font-size: 0.85em !important;
    color: #7dd3fc !important;
}

/* Forms */
[data-testid="stForm"] {
    border: 1px solid rgba(56, 189, 248, 0.1) !important;
    border-radius: 16px !important;
    background: rgba(8, 15, 28, 0.6) !important;
    padding: 1.2rem !important;
}

/* Spinner */
[data-testid="stSpinner"] {
    color: #38bdf8 !important;
}

/* Toggle */
[data-testid="stCheckbox"] label,
[data-testid="stToggle"] label {
    color: #94a3b8 !important;
    font-size: 0.875rem !important;
}

/* Scrollbar */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: rgba(8, 16, 30, 0.5);
}

::-webkit-scrollbar-thumb {
    background: rgba(56, 189, 248, 0.2);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(56, 189, 248, 0.4);
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .gw-hero h1 { font-size: 1.4rem; }
    .gw-hero { padding: 1.2rem; }
    .gw-kpi-value { font-size: 1.3rem; }
}
</style>
"""


def inject_theme_css() -> None:
    st.markdown(THEME_CSS, unsafe_allow_html=True)


def render_header(title: str, subtitle: str, icon: str = "") -> None:
    icon_html = f'<span class="gw-hero-icon">{icon}</span>' if icon else ""
    st.markdown(
        f"""
        <div class="gw-hero">
            {icon_html}
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_kpi(title: str, value: str, sub: str = "") -> None:
    sub_html = f'<div class="gw-kpi-sub">{sub}</div>' if sub else ""
    st.markdown(
        f"""
        <div class="gw-kpi">
            <div class="gw-kpi-title">{title}</div>
            <div class="gw-kpi-value">{value}</div>
            {sub_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_status_badge(status: str) -> str:
    icons = {"pending": "⏳", "grading": "⚙️", "done": "✅", "error": "❌"}
    icon = icons.get(status, "•")
    return f'<span class="status-badge status-{status}">{icon} {status.title()}</span>'


def render_score_badge(score: float, max_score: float) -> str:
    pct = (score / max_score * 100) if max_score > 0 else 0
    cls = "high" if pct >= 70 else ("mid" if pct >= 40 else "low")
    return f'<span class="gw-score gw-score-{cls}">{score:.1f} / {max_score:.1f}</span>'


def render_divider() -> None:
    st.markdown('<div class="gw-divider"></div>', unsafe_allow_html=True)


def render_section_title(title: str) -> None:
    st.markdown(f'<div class="gw-section-title">{title}</div>', unsafe_allow_html=True)
