"""PDF text extraction using PyMuPDF."""
import fitz  # PyMuPDF


def extract_text(file_path: str) -> str:
    """Extract all text from a PDF file."""
    doc = fitz.open(file_path)
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts)


def extract_text_by_page(file_path: str) -> list[dict]:
    """Extract text from each page with page numbers."""
    doc = fitz.open(file_path)
    pages = []
    for i, page in enumerate(doc):
        pages.append({"page": i + 1, "text": page.get_text()})
    doc.close()
    return pages
