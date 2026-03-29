"""
frontend/streamlit_app.py
──────────────────────────
Modern Streamlit dashboard for the AI Document Intelligence System.

Features:
  • Premium dark glassmorphism theme with gradient accents
  • Drag-and-drop document upload with processing timeline
  • Type-aware field extraction display (Invoice / Receipt / Contract)
  • Colour-coded confidence meters (classification + extraction)
  • RAG-powered document Q&A chat with source chunk viewer
  • Full OCR text viewer with copy support
  • JSON download button for extracted fields
  • API health indicator in sidebar
  • Dynamic quick-question suggestions by document type

Run:
    streamlit run frontend/streamlit_app.py
"""
import json
import time

import requests
import streamlit as st

# ─── Configuration ────────────────────────────────────────────────────────────

API_BASE    = "http://localhost:8000/api/v1"
UPLOAD_URL  = f"{API_BASE}/upload-document"
EXTRACT_URL = f"{API_BASE}/extract-fields"
ASK_URL     = f"{API_BASE}/ask-question"
HEALTH_URL  = f"{API_BASE}/health"

ACCEPTED_TYPES = ["pdf", "jpg", "jpeg", "png", "tiff", "tif", "bmp", "webp"]

# ─── Document-type metadata ───────────────────────────────────────────────────

DOC_META = {
    "invoice": {
        "emoji": "📋",
        "color": "#6366f1",       # indigo
        "label": "Invoice",
    },
    "receipt": {
        "emoji": "🧾",
        "color": "#10b981",       # emerald
        "label": "Receipt",
    },
    "contract": {
        "emoji": "📑",
        "color": "#f59e0b",       # amber
        "label": "Contract",
    },
    "unknown": {
        "emoji": "❓",
        "color": "#6b7280",       # gray
        "label": "Unknown",
    },
}

# Per-type field definitions (label, emoji, key in ExtractedFields JSON)
FIELD_DEFS = {
    "invoice": [
        ("🏢", "Vendor Name",      "vendor_name"),
        ("🔢", "Invoice Number",   "invoice_number"),
        ("📅", "Invoice Date",     "invoice_date"),
        ("⏳", "Due Date",         "due_date"),
        ("👤", "Buyer Name",       "buyer_name"),
        ("💰", "Total Amount",     "total_amount"),
        ("🧾", "Tax Amount",       "tax_amount"),
        ("💱", "Currency",         "currency"),
        ("📦", "Line Items",       "line_items"),
    ],
    "receipt": [
        ("🏪", "Store Name",       "store_name"),
        ("🔢", "Receipt Number",   "receipt_number"),
        ("📅", "Date",             "date"),
        ("🛍️", "Items",            "items"),
        ("💵", "Subtotal",         "subtotal"),
        ("🧾", "Tax",              "tax"),
        ("💰", "Total Amount",     "total_amount"),
        ("💳", "Payment Method",   "payment_method"),
    ],
    "contract": [
        ("📝", "Contract Title",   "contract_title"),
        ("🏢", "Company Name",     "company_name"),
        ("👤", "Client Name",      "client_name"),
        ("🗓️", "Start Date",       "start_date"),
        ("🗓️", "End Date",         "end_date"),
        ("💰", "Contract Value",   "contract_value"),
        ("📋", "Scope of Work",    "scope_of_work"),
        ("✍️", "Signatories",      "signatories"),
    ],
    "unknown": [
        ("🏢", "Vendor Name",      "vendor_name"),
        ("🔢", "Reference Number", "invoice_number"),
        ("📅", "Date",             "invoice_date"),
        ("💰", "Amount",           "total_amount"),
    ],
}

# Per-type quick questions for the sidebar
QUICK_QUESTIONS = {
    "invoice": [
        "What is the total invoice amount?",
        "Who is the vendor?",
        "What is the invoice number?",
        "When is payment due?",
        "What items are listed on the invoice?",
    ],
    "receipt": [
        "What is the total amount paid?",
        "What store is this receipt from?",
        "What payment method was used?",
        "What is the tax amount?",
        "What items were purchased?",
    ],
    "contract": [
        "Who are the parties in this contract?",
        "When does the contract start and end?",
        "What is the contract value?",
        "Who are the signatories?",
        "What is the scope of work?",
    ],
    "unknown": [
        "What is this document about?",
        "What are the key dates mentioned?",
        "What monetary amounts are mentioned?",
        "Who are the parties involved?",
    ],
}

# ─── Page Config ──────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="AI Document Intelligence",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Global CSS (dark glassmorphism theme) ────────────────────────────────────

st.markdown("""
<style>
/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* ── Base overrides ── */
html, body, [class*="st-"], .stApp {
    font-family: 'Inter', sans-serif;
    background: #0f0f1a;
    color: #e2e8f0;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: rgba(15, 15, 30, 0.95);
    border-right: 1px solid rgba(255,255,255,0.07);
}

/* ── Hero gradient header ── */
.hero {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 70%, #6366f1 100%);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 20px;
    padding: 2.5rem 3rem;
    margin-bottom: 2rem;
    position: relative;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(99, 102, 241, 0.2);
}
.hero::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 60%);
    border-radius: 50%;
}
.hero h1 {
    margin: 0 0 0.5rem;
    font-size: 2.2rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #fff;
}
.hero p {
    margin: 0;
    opacity: 0.8;
    font-size: 1rem;
    color: #c7d2fe;
}

/* ── Glass card ── */
.glass-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: border-color 0.2s, box-shadow 0.2s;
}
.glass-card:hover {
    border-color: rgba(99,102,241,0.3);
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.1);
}

/* ── Stat card ── */
.stat-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    text-align: center;
    transition: transform 0.2s;
}
.stat-card:hover { transform: translateY(-2px); }
.stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
    margin-bottom: 0.4rem;
}
.stat-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: #f8fafc;
}

/* ── Document type badge ── */
.doc-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 1rem;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 1rem;
}

/* ── Confidence bar ── */
.conf-wrap {
    margin-bottom: 1.2rem;
}
.conf-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #94a3b8;
    margin-bottom: 0.4rem;
}
.conf-bar {
    height: 8px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    overflow: hidden;
}
.conf-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.6s ease;
}

/* ── Field row ── */
.field-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.15s;
    gap: 1rem;
}
.field-row:last-child { border-bottom: none; }
.field-row:hover { background: rgba(255,255,255,0.03); border-radius: 8px; }
.field-label {
    font-size: 0.85rem;
    color: #94a3b8;
    white-space: nowrap;
    min-width: 160px;
}
.field-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: #e2e8f0;
    text-align: right;
    word-break: break-word;
}
.field-value-null { color: #475569; font-style: italic; font-weight: 400; }

/* ── Chat bubbles ── */
.chat-q {
    background: linear-gradient(135deg, #4338ca, #6366f1);
    color: white;
    padding: 0.9rem 1.2rem;
    border-radius: 18px 18px 4px 18px;
    margin: 0.5rem 0 0.25rem auto;
    max-width: 78%;
    box-shadow: 0 4px 15px rgba(99,102,241,0.25);
    font-size: 0.9rem;
}
.chat-a {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e2e8f0;
    padding: 0.9rem 1.2rem;
    border-radius: 4px 18px 18px 18px;
    margin: 0.25rem auto 0.5rem 0;
    max-width: 78%;
    font-size: 0.9rem;
    line-height: 1.5;
}
.chat-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 1rem;
}

/* ── Section heading ── */
.section-heading {
    font-size: 1rem;
    font-weight: 700;
    color: #c7d2fe;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 1.5rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(99,102,241,0.3);
}

/* ── Sidebar status ── */
.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.8rem;
    border-radius: 100px;
    font-size: 0.8rem;
    font-weight: 600;
}
.status-online  { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
.status-offline { background: rgba(239,68,68,0.15);  color: #f87171; border: 1px solid rgba(239,68,68,0.3); }

/* ── Step timeline ── */
.step { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; }
.step-dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
}
.step-done  { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.4); }
.step-doing { background: rgba(99,102,241,0.2); color: #818cf8; border: 1px solid rgba(99,102,241,0.4); }
.step-todo  { background: rgba(255,255,255,0.05); color: #475569; border: 1px solid rgba(255,255,255,0.1); }
.step-text  { font-size: 0.85rem; }

/* ── File drop area override fix ── */
[data-testid="stFileUploadDropzone"] {
    background: rgba(99,102,241,0.05);
    border: 2px dashed rgba(99,102,241,0.35);
    border-radius: 14px;
}
[data-testid="stFileUploadDropzone"]:hover {
    border-color: rgba(99,102,241,0.6);
    background: rgba(99,102,241,0.08);
}

/* ── buttons ── */
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #4338ca, #6366f1);
    border: none;
    color: white;
    font-weight: 600;
    border-radius: 10px;
    padding: 0.6rem 1.5rem;
    transition: box-shadow 0.2s, transform 0.1s;
}
.stButton > button[kind="primary"]:hover {
    box-shadow: 0 6px 20px rgba(99,102,241,0.4);
    transform: translateY(-1px);
}

/* Tabs */
[data-testid="stTabs"] [data-baseweb="tab-list"] {
    gap: 0.5rem;
    background: transparent;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
[data-testid="stTabs"] [data-baseweb="tab"] {
    background: transparent;
    color: #94a3b8;
    border-radius: 8px 8px 0 0;
    font-weight: 500;
}
[data-testid="stTabs"] [aria-selected="true"][data-baseweb="tab"] {
    background: rgba(99,102,241,0.15);
    color: #818cf8;
    border-bottom: 2px solid #6366f1;
}
</style>
""", unsafe_allow_html=True)


# ─── Session state ────────────────────────────────────────────────────────────

defaults = {
    "document_id": None,
    "upload_result": None,
    "fields": None,
    "chat_history": [],
    "classification_confidence": 0.0,
    "extraction_confidence": 0.0,
    "doc_type": "unknown",
}
for key, val in defaults.items():
    if key not in st.session_state:
        st.session_state[key] = val


# ─── API helpers ──────────────────────────────────────────────────────────────

def check_api_health() -> bool:
    try:
        r = requests.get(HEALTH_URL, timeout=4)
        return r.status_code == 200
    except Exception:
        return False


def api_upload(file) -> dict | None:
    try:
        files = {"file": (file.name, file.getvalue(), file.type)}
        r = requests.post(UPLOAD_URL, files=files, timeout=180)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        st.error(f"❌ Upload failed: {e.response.text}")
    except requests.ConnectionError:
        st.error("❌ Cannot reach the API. Is the backend running?")
    except Exception as e:
        st.error(f"❌ Unexpected error: {e}")
    return None


def api_extract(document_id: str) -> dict | None:
    try:
        r = requests.post(EXTRACT_URL, json={"document_id": document_id}, timeout=90)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        st.error(f"❌ Extraction failed: {e.response.text}")
    except Exception as e:
        st.error(f"❌ Unexpected error: {e}")
    return None


def api_ask(document_id: str, question: str) -> dict | None:
    try:
        r = requests.post(ASK_URL, json={"document_id": document_id, "question": question}, timeout=90)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        st.error(f"❌ Q&A failed: {e.response.text}")
    except Exception as e:
        st.error(f"❌ Unexpected error: {e}")
    return None


# ─── UI helpers ───────────────────────────────────────────────────────────────

def conf_bar(label: str, value: float, color: str = "#6366f1") -> str:
    """Return HTML for a labelled confidence progress bar."""
    pct  = int(value * 100)
    fill_color = (
        "#10b981" if value >= 0.75 else
        "#f59e0b" if value >= 0.45 else
        "#ef4444"
    )
    return f"""
    <div class=\"conf-wrap\">
        <div class=\"conf-label\"><span>{label}</span><span style=\"color:{fill_color};font-weight:600\">{pct}%</span></div>
        <div class=\"conf-bar\"><div class=\"conf-fill\" style=\"width:{pct}%;background:{fill_color}\"></div></div>
    </div>
    """


def doc_badge(doc_type: str) -> str:
    meta = DOC_META.get(doc_type, DOC_META["unknown"])
    return (
        f'<span class="doc-badge" style="background:{meta["color"]}22;'
        f'color:{meta["color"]};border:1px solid {meta["color"]}44">'
        f'{meta["emoji"]} {meta["label"]}</span>'
    )


def render_field_value(value) -> str:
    """Format a field value (handles lists and scalars)."""
    if value is None or value == "":
        return '<span class="field-value field-value-null">Not found</span>'
    if isinstance(value, list):
        items_html = "".join(
            f'<div style="color:#e2e8f0;font-size:0.85rem;padding:0.2rem 0">• {item}</div>'
            for item in value
        )
        return f'<div class="field-value">{items_html}</div>'
    return f'<span class="field-value">{value}</span>'


# ─── Sidebar ──────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("## 🔍 AI Doc Intelligence")
    st.markdown("")

    # API Status
    api_ok = check_api_health()
    if api_ok:
        st.markdown('<span class="status-pill status-online">● API Online</span>', unsafe_allow_html=True)
    else:
        st.markdown('<span class="status-pill status-offline">● API Offline</span>', unsafe_allow_html=True)
        st.warning("Start backend:\n```\nuvicorn app.main:app --reload\n```")

    st.divider()

    # How to Use
    st.markdown("**📋 How to use**")
    st.markdown("""
1. **Upload** a PDF or image
2. **Extract** structured fields
3. **Ask** questions about it
    """)

    st.caption("**Formats:** PDF, JPG, PNG, TIFF, BMP, WEBP")
    st.caption("**Max size:** 20 MB")
    st.caption("**Languages:** English, Arabic")

    # Current document info
    if st.session_state.document_id and st.session_state.upload_result:
        st.divider()
        result = st.session_state.upload_result
        doc_type = st.session_state.doc_type
        meta = DOC_META.get(doc_type, DOC_META["unknown"])

        st.markdown(f"**{meta['emoji']} Current Document**")
        st.markdown(
            f'<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:0.8rem;margin-top:0.5rem">'
            f'<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:0.3rem">File</div>'
            f'<div style="font-weight:600;font-size:0.85rem;word-break:break-all">{result.get("filename","—")}</div>'
            f'<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0.6rem 0">'
            f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;font-size:0.8rem">'
            f'<div><span style="color:#94a3b8">Type</span><br><b>{meta["label"]}</b></div>'
            f'<div><span style="color:#94a3b8">Pages</span><br><b>{result.get("page_count",1)}</b></div>'
            f'<div><span style="color:#94a3b8">Chars</span><br><b>{result.get("character_count",0):,}</b></div>'
            f'<div><span style="color:#94a3b8">Lang</span><br><b>{result.get("language","—").title()}</b></div>'
            f'</div></div>',
            unsafe_allow_html=True
        )

        # Classification confidence
        conf = st.session_state.classification_confidence
        st.markdown(conf_bar("Classification Confidence", conf), unsafe_allow_html=True)

        # Quick questions
        st.divider()
        st.markdown("**⚡ Quick Questions**")
        questions = QUICK_QUESTIONS.get(doc_type, QUICK_QUESTIONS["unknown"])
        for q in questions:
            if st.button(q, key=f"qq_{q}", use_container_width=True):
                st.session_state["_pending_question"] = q


# ─── Main Area ────────────────────────────────────────────────────────────────

# Hero Header
st.markdown("""
<div class="hero">
    <h1>🔍 AI Document Intelligence</h1>
    <p>Upload invoices, receipts &amp; contracts — extract structured data and query documents using RAG-powered AI</p>
</div>
""", unsafe_allow_html=True)


# Tabs
tab_upload, tab_fields, tab_qa, tab_text = st.tabs([
    "📤  Upload",
    "📊  Extracted Fields",
    "💬  Ask Questions",
    "📝  Raw Text",
])


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 1 — UPLOAD
# ═══════════════════════════════════════════════════════════════════════════════

with tab_upload:
    col_upload, col_info = st.columns([3, 2], gap="large")

    with col_upload:
        st.markdown('<div class="section-heading">Document Upload</div>', unsafe_allow_html=True)

        uploaded_file = st.file_uploader(
            "Drag & drop or browse",
            type=ACCEPTED_TYPES,
            help="PDF, JPG, PNG, TIFF, BMP, WEBP — max 20 MB",
            label_visibility="collapsed",
        )

        if uploaded_file:
            st.markdown(
                f'<div class="glass-card" style="margin-top:0.75rem">'
                f'<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.3rem">Selected file</div>'
                f'<div style="font-weight:600">{uploaded_file.name}</div>'
                f'<div style="font-size:0.8rem;color:#64748b;margin-top:0.2rem">'
                f'{uploaded_file.size / 1024:.1f} KB — {uploaded_file.type}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

        if uploaded_file and st.button(
            "🚀  Process Document", type="primary", use_container_width=True
        ):
            # Animated processing timeline
            timeline_placeholder = st.empty()

            def show_steps(active: int):
                steps = [
                    ("Uploading file",              "🌐"),
                    ("Running OCR (Tesseract)",      "🔎"),
                    ("Classifying document",         "🤖"),
                    ("Building FAISS index",         "📐"),
                ]
                html = '<div style="margin:1rem 0">'
                for i, (txt, ico) in enumerate(steps):
                    if i < active:
                        cls = "step-done"; dot = "✓"
                    elif i == active:
                        cls = "step-doing"; dot = ico
                    else:
                        cls = "step-todo"; dot = str(i + 1)
                    html += (
                        f'<div class="step">'
                        f'<div class="step-dot {cls}">{dot}</div>'
                        f'<span class="step-text" style="color:{"#34d399" if i<active else "#818cf8" if i==active else "#475569"}">{txt}</span>'
                        f'</div>'
                    )
                html += "</div>"
                timeline_placeholder.markdown(html, unsafe_allow_html=True)

            show_steps(0)
            start = time.time()

            result = api_upload(uploaded_file)
            elapsed = time.time() - start
            show_steps(4)  # all done

            if result:
                st.session_state.document_id             = result["document_id"]
                st.session_state.upload_result           = result
                st.session_state.classification_confidence = result.get("confidence", 0.0)
                st.session_state.doc_type                = result.get("document_type", "unknown")
                st.session_state.extraction_confidence   = 0.0
                st.session_state.fields                  = None
                st.session_state.chat_history            = []

                st.success(f"✅ Processed in **{elapsed:.1f}s** — ready for extraction & Q&A")

                # Stat cards
                doc_type = result.get("document_type", "unknown")
                meta = DOC_META.get(doc_type, DOC_META["unknown"])
                c1, c2, c3, c4 = st.columns(4)
                cards = [
                    ("Document Type",  f'{meta["emoji"]} {meta["label"]}'),
                    ("Language",       result.get("language", "—").title()),
                    ("Pages",          str(result.get("page_count", 1))),
                    ("Characters",     f'{result.get("character_count", 0):,}'),
                ]
                for col, (lbl, val) in zip([c1, c2, c3, c4], cards):
                    with col:
                        st.markdown(
                            f'<div class="stat-card"><div class="stat-label">{lbl}</div>'
                            f'<div class="stat-value">{val}</div></div>',
                            unsafe_allow_html=True,
                        )

                # Confidence bar
                conf = result.get("confidence", 0.0)
                st.markdown(
                    conf_bar("Classification Confidence", conf, meta["color"]),
                    unsafe_allow_html=True,
                )
        elif not uploaded_file:
            st.markdown("""
            <div class="glass-card" style="text-align:center;padding:3rem;margin-top:1rem">
                <div style="font-size:3rem;margin-bottom:1rem">📄</div>
                <div style="font-size:1rem;color:#94a3b8">Upload a document to get started</div>
                <div style="font-size:0.8rem;color:#475569;margin-top:0.5rem">
                    Supported: PDF, JPG, PNG, TIFF, BMP, WEBP
                </div>
            </div>
            """, unsafe_allow_html=True)

    with col_info:
        st.markdown('<div class="section-heading">Capabilities</div>', unsafe_allow_html=True)
        capabilities = [
            ("📋", "Invoice Processing",   "Vendor, amounts, line items, dates"),
            ("🧾", "Receipt Analysis",     "Store, items, payment method, totals"),
            ("📑", "Contract Parsing",     "Parties, dates, value, signatories"),
            ("🔎", "Advanced OCR",         "Tesseract with OpenCV preprocessing"),
            ("🤖", "AI Classification",    "Groq LLM document type detection"),
            ("💬", "RAG Q&A",              "FAISS vector search + Groq answers"),
        ]
        for emoji, title, desc in capabilities:
            st.markdown(
                f'<div class="glass-card" style="padding:1rem">'
                f'<div style="display:flex;gap:0.75rem;align-items:center">'
                f'<span style="font-size:1.4rem">{emoji}</span>'
                f'<div><div style="font-weight:600;font-size:0.9rem">{title}</div>'
                f'<div style="font-size:0.78rem;color:#64748b;margin-top:0.1rem">{desc}</div>'
                f'</div></div></div>',
                unsafe_allow_html=True,
            )


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 2 — EXTRACTED FIELDS
# ═══════════════════════════════════════════════════════════════════════════════

with tab_fields:
    if not st.session_state.document_id:
        st.markdown("""
        <div class="glass-card" style="text-align:center;padding:2.5rem">
            <div style="font-size:2.5rem;margin-bottom:0.8rem">📊</div>
            <div style="color:#94a3b8">Upload a document first to extract structured fields.</div>
        </div>
        """, unsafe_allow_html=True)
    else:
        doc_type = st.session_state.doc_type
        meta = DOC_META.get(doc_type, DOC_META["unknown"])

        # Badge
        st.markdown(doc_badge(doc_type), unsafe_allow_html=True)

        if st.button("🔍  Extract Fields with AI", type="primary", use_container_width=True):
            with st.spinner("Analysing document with Groq LLM…"):
                result = api_extract(st.session_state.document_id)
            if result:
                st.session_state.fields               = result.get("fields", {})
                st.session_state.extraction_confidence = result.get("confidence", 0.0)

        if st.session_state.fields is not None:
            e_conf = st.session_state.extraction_confidence
            st.markdown(
                conf_bar("AI Extraction Confidence", e_conf, meta["color"]),
                unsafe_allow_html=True,
            )

            fields = st.session_state.fields
            field_defs = FIELD_DEFS.get(doc_type, FIELD_DEFS["unknown"])

            st.markdown(
                f'<div class="section-heading">Extracted Information — {meta["emoji"]} {meta["label"]}</div>',
                unsafe_allow_html=True,
            )

            # Field table inside a glass card
            rows_html = ""
            for emoji, label, key in field_defs:
                raw_val = fields.get(key) if isinstance(fields, dict) else getattr(fields, key, None)
                val_html = render_field_value(raw_val)
                rows_html += (
                    f'<div class="field-row">'
                    f'<span class="field-label">{emoji} {label}</span>'
                    f'{val_html}'
                    f'</div>'
                )

            st.markdown(
                f'<div class="glass-card" style="padding:0">{rows_html}</div>',
                unsafe_allow_html=True,
            )

            # JSON Download — only include type-relevant, non-null fields
            st.markdown("<br>", unsafe_allow_html=True)

            # Get the canonical key list for this doc type (same keys shown in the table above)
            type_keys = [key for _, _, key in FIELD_DEFS.get(doc_type, FIELD_DEFS["unknown"])]

            # Build a clean dict: type-relevant keys only, drop nulls/empty lists
            if isinstance(fields, dict):
                raw = fields
            elif hasattr(fields, "model_dump"):
                raw = fields.model_dump()
            else:
                raw = dict(fields)

            dl_data = {
                k: v for k, v in raw.items()
                if k in type_keys and v is not None and v != [] and v != ""
            }

            st.download_button(
                "⬇️  Download Extracted Fields as JSON",
                data=json.dumps(dl_data, indent=2, ensure_ascii=False),
                file_name=f"extracted_{doc_type}_fields.json",
                mime="application/json",
                use_container_width=True,
            )


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 3 — ASK QUESTIONS (RAG)
# ═══════════════════════════════════════════════════════════════════════════════

with tab_qa:
    if not st.session_state.document_id:
        st.markdown("""
        <div class="glass-card" style="text-align:center;padding:2.5rem">
            <div style="font-size:2.5rem;margin-bottom:0.8rem">💬</div>
            <div style="color:#94a3b8">Upload a document first to ask questions about it.</div>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown('<div class="section-heading">RAG-Powered Document Q&A</div>', unsafe_allow_html=True)

        # Render chat history
        for entry in st.session_state.chat_history:
            st.markdown(
                f'<div class="chat-container">'
                f'<div class="chat-q">{entry["question"]}</div>'
                f'<div class="chat-a">{entry["answer"]}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
            if entry.get("sources"):
                with st.expander(f"📑 View {len(entry['sources'])} source chunk(s)"):
                    for i, chunk in enumerate(entry["sources"], 1):
                        st.text_area(
                            f"Chunk {i}",
                            chunk,
                            height=100,
                            disabled=True,
                            key=f"src_{id(entry)}_{i}",
                        )

        # ── Input row ──────────────────────────────────────────────────────
        pending = st.session_state.pop("_pending_question", None)
        captured = st.session_state.pop("_captured_question", None)

        def on_send_click():
            if st.session_state.get("_qa_text_input"):
                st.session_state["_captured_question"] = st.session_state["_qa_text_input"]
                st.session_state["_qa_text_input"] = ""

        col_inp, col_btn = st.columns([8, 1], gap="small")
        with col_inp:
            st.text_input(
                "question_input",
                value="",
                placeholder="Ask a question about this document…",
                label_visibility="collapsed",
                key="_qa_text_input",
            )
        with col_btn:
            st.button("➤", type="primary", use_container_width=True, key="_qa_send", on_click=on_send_click)

        question = captured or pending

        if question:
            with st.spinner("Searching document & generating answer…"):
                result = api_ask(st.session_state.document_id, question)
            if result:
                st.session_state.chat_history.append({
                    "question": question,
                    "answer":   result.get("answer", ""),
                    "sources":  result.get("source_chunks", []),
                })
                st.rerun()

        if not st.session_state.chat_history:
            doc_type = st.session_state.doc_type
            suggestions = QUICK_QUESTIONS.get(doc_type, QUICK_QUESTIONS["unknown"])[:3]
            st.markdown(
                '<div style="color:#475569;font-size:0.85rem;margin-top:1.5rem;margin-bottom:0.5rem">'
                'Suggested questions:</div>',
                unsafe_allow_html=True,
            )
            for s in suggestions:
                if st.button(f"💡 {s}", key=f"sug_{s}", use_container_width=False):
                    st.session_state["_pending_question"] = s
                    st.rerun()


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 4 — RAW TEXT
# ═══════════════════════════════════════════════════════════════════════════════

with tab_text:
    if st.session_state.upload_result:
        result = st.session_state.upload_result
        preview = result.get("raw_text_preview", "")

        st.markdown('<div class="section-heading">OCR Extracted Text</div>', unsafe_allow_html=True)

        col_a, col_b, col_c = st.columns(3)
        with col_a:
            st.markdown(
                f'<div class="stat-card"><div class="stat-label">Characters</div>'
                f'<div class="stat-value">{result.get("character_count", 0):,}</div></div>',
                unsafe_allow_html=True,
            )
        with col_b:
            st.markdown(
                f'<div class="stat-card"><div class="stat-label">Pages</div>'
                f'<div class="stat-value">{result.get("page_count", 1)}</div></div>',
                unsafe_allow_html=True,
            )
        with col_c:
            st.markdown(
                f'<div class="stat-card"><div class="stat-label">Preview</div>'
                f'<div class="stat-value">500 chars</div></div>',
                unsafe_allow_html=True,
            )

        st.markdown("<br>", unsafe_allow_html=True)
        st.info(
            "ℹ️ Showing the first 500 characters of extracted text. "
            "The full text is used for field extraction and Q&A."
        )
        st.text_area(
            "Extracted OCR text (preview)",
            preview,
            height=420,
            disabled=True,
            label_visibility="collapsed",
        )

        # Copy / download
        st.download_button(
            "⬇️  Download Full OCR Text",
            data=preview,
            file_name=f"ocr_text_{result.get('document_id','doc')}.txt",
            mime="text/plain",
            use_container_width=True,
        )
    else:
        st.markdown("""
        <div class="glass-card" style="text-align:center;padding:2.5rem">
            <div style="font-size:2.5rem;margin-bottom:0.8rem">📝</div>
            <div style="color:#94a3b8">Upload a document to see the OCR extracted text.</div>
        </div>
        """, unsafe_allow_html=True)
