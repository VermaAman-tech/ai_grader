import streamlit as st


THEME_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;600&display=swap');

html, body, [class*="css"]  {
    font-family: 'Space Grotesk', sans-serif;
}

.stApp {
    background:
        radial-gradient(circle at 10% 10%, rgba(60, 230, 198, 0.18), transparent 30%),
        radial-gradient(circle at 88% 15%, rgba(99, 178, 255, 0.18), transparent 28%),
        linear-gradient(145deg, #070D14 0%, #0A1320 46%, #111E2D 100%);
}

[data-testid="stSidebar"] {
    background: linear-gradient(165deg, #0E1726 0%, #132136 100%);
    border-right: 1px solid rgba(110, 160, 220, 0.25);
}

.gw-hero {
    border: 1px solid rgba(80, 168, 214, 0.35);
    background: linear-gradient(150deg, rgba(22, 39, 56, 0.92), rgba(14, 27, 39, 0.88));
    border-radius: 16px;
    padding: 1.2rem 1.4rem;
    margin-bottom: 1rem;
    box-shadow: 0 16px 35px rgba(5, 13, 24, 0.35);
}

.gw-hero h1 {
    margin: 0 0 0.35rem 0;
    font-size: 1.8rem;
    letter-spacing: 0.2px;
}

.gw-hero p {
    margin: 0;
    color: #BFD4EE;
}

.gw-chip {
    display: inline-block;
    margin: 0.2rem 0.5rem 0.2rem 0;
    padding: 0.38rem 0.65rem;
    border-radius: 999px;
    border: 1px solid rgba(91, 195, 255, 0.45);
    background: rgba(13, 30, 44, 0.8);
    color: #D7EDFF;
    font-size: 0.85rem;
}

.gw-kpi {
    border: 1px solid rgba(76, 138, 194, 0.35);
    background: rgba(12, 24, 36, 0.82);
    border-radius: 14px;
    padding: 0.75rem 0.95rem;
}

.gw-kpi-title {
    color: #9EB5D3;
    font-size: 0.82rem;
}

.gw-kpi-value {
    color: #F0F8FF;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.2;
}

@media (max-width: 768px) {
    .gw-hero h1 {
        font-size: 1.35rem;
    }
    .gw-hero {
        padding: 1rem;
    }
}
</style>
"""


def inject_theme_css() -> None:
    st.markdown(THEME_CSS, unsafe_allow_html=True)


def render_header(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <div class="gw-hero">
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_kpi(title: str, value: str) -> None:
    st.markdown(
        f"""
        <div class="gw-kpi">
            <div class="gw-kpi-title">{title}</div>
            <div class="gw-kpi-value">{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
