"""PDF validation and text extraction (PyMuPDF)."""
import os

import fitz  # PyMuPDF

from app.config import settings


class PDFValidationError(Exception):
    pass


def validate_pdf(data: bytes, filename: str) -> int:
    """Validate size/page-count/parseability. Returns the page count."""
    max_bytes = settings.max_pdf_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise PDFValidationError(
            f"File is {len(data) / 1024 / 1024:.1f} MB — the maximum allowed is {settings.max_pdf_mb} MB."
        )
    if not filename.lower().endswith(".pdf"):
        raise PDFValidationError("Only PDF files are supported.")
    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            if doc.needs_pass:
                raise PDFValidationError("This PDF is password-protected. Please upload an unlocked copy.")
            page_count = doc.page_count
    except PDFValidationError:
        raise
    except Exception:
        raise PDFValidationError("This file could not be parsed as a PDF. It may be corrupted.")
    if page_count == 0:
        raise PDFValidationError("This PDF has no pages.")
    if page_count > settings.max_pdf_pages:
        raise PDFValidationError(
            f"This PDF has {page_count} pages — the maximum allowed is {settings.max_pdf_pages} pages."
        )
    return page_count


def save_upload(data: bytes, document_id: int) -> str:
    os.makedirs(settings.upload_dir, exist_ok=True)
    path = os.path.join(settings.upload_dir, f"{document_id}.pdf")
    with open(path, "wb") as f:
        f.write(data)
    return path


def upload_path(document_id: int) -> str:
    return os.path.join(settings.upload_dir, f"{document_id}.pdf")


def extract_pages(path: str) -> list[str]:
    """Extract plain text per page (index 0 == page 1)."""
    with fitz.open(path) as doc:
        return [page.get_text("text") for page in doc]
