"""
utils/text_processor.py
───────────────────────
Functions to clean and normalise raw OCR text before feeding it to
the LLM or the embedding pipeline.
"""
import re
import unicodedata

from utils.logger import logger


# ─── Currency symbols → readable labels ───────────────────────────────────────
_CURRENCY_MAP = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "﷼": "SAR",   # Saudi Riyal (Arabic support)
    "د.إ": "AED",  # UAE Dirham
}


def remove_noise(text: str) -> str:
    """
    Remove common OCR artifacts:
    - Multiple consecutive whitespace / newlines
    - Stray control characters
    - Isolated special characters that carry no meaning
    """
    # Normalise unicode (composed form)
    text = unicodedata.normalize("NFC", text)

    # Remove null bytes and other control characters except newline/tab
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Collapse 3+ consecutive blank lines into two
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Collapse multiple spaces/tabs into a single space
    text = re.sub(r"[ \t]+", " ", text)

    # Strip leading/trailing whitespace from each line
    text = "\n".join(line.strip() for line in text.splitlines())

    return text.strip()


def normalise_currency(text: str) -> str:
    """Replace currency symbols with their ISO-4217 codes for model clarity."""
    for symbol, code in _CURRENCY_MAP.items():
        text = text.replace(symbol, f"{code} ")
    # Normalise amounts like "1.00" -> "1", "1.50" -> "1.5"
    text = re.sub(r"(\.\d+?)0+\b", r"\1", text)
    text = re.sub(r"\.0+\b", "", text)
    return text


def normalise_numbers(text: str) -> str:
    """
    Attempt to standardise numeric representations:
    - Remove thousands separators (e.g. "1.234,56" → "1234.56" European style)
    - Normalise Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Western digits
    """
    # Arabic-Indic digits
    arabic_indic = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    text = text.translate(arabic_indic)

    return text


def clean_text(raw_text: str) -> str:
    """
    Full text cleaning pipeline:
    1. Noise removal
    2. Currency normalisation
    3. Number normalisation
    Returns cleaned text ready for LLM/embedding processing.
    """
    logger.debug("Cleaning raw text (%d chars)…", len(raw_text))
    text = remove_noise(raw_text)
    
    # Filter out very short, fragmented noise lines (less than 2 chars and non-alphanumeric)
    lines = []
    for line in text.splitlines():
        line_strip = str(line.strip())
        if len(line_strip) < 2 and not line_strip.isalnum():
            continue
        lines.append(line_strip)
    text = "\n".join(lines)

    text = normalise_currency(text)
    text = normalise_numbers(text)
    logger.debug("Cleaned text length: %d chars", len(text))
    return text


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks, attempting to break on newlines."""
    if not text:
        return []

    chunks: list[str] = []
    text_len = len(text)
    start = 0
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        
        # Try to find a better endpoint (a newline character)
        if end < text_len:
            last_newline = text.rfind("\n", start, end)
            if last_newline != -1 and last_newline > start + (chunk_size // 2):
                end = last_newline

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
            
        start = end - overlap
        if start < 0: start = 0
        if end >= text_len:
            break

    logger.debug("Split text into %d chunks (size=%d, overlap=%d)",
                 len(chunks), chunk_size, overlap)
    return chunks
