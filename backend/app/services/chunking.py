"""Token-approximate overlapping chunking with page-range tracking.

We approximate 1 token ~= 4 characters, so the ~1000-token target becomes
~4000 characters with ~600 characters (~150 tokens) of overlap.
"""
from dataclasses import dataclass

CHUNK_CHARS = 4000
OVERLAP_CHARS = 600


@dataclass
class TextChunk:
    index: int
    page_start: int  # 1-based inclusive
    page_end: int
    text: str


def chunk_pages(pages: list[str]) -> list[TextChunk]:
    # Flatten pages into one string while remembering where each page starts.
    page_offsets: list[tuple[int, int]] = []  # (char_offset, page_number)
    parts: list[str] = []
    offset = 0
    for i, page_text in enumerate(pages):
        cleaned = page_text.strip()
        page_offsets.append((offset, i + 1))
        parts.append(cleaned)
        offset += len(cleaned) + 2  # account for the "\n\n" joiner
    full = "\n\n".join(parts)

    def page_at(char_pos: int) -> int:
        page = 1
        for off, num in page_offsets:
            if off <= char_pos:
                page = num
            else:
                break
        return page

    chunks: list[TextChunk] = []
    start = 0
    idx = 0
    while start < len(full):
        end = min(start + CHUNK_CHARS, len(full))
        if end < len(full):
            # Prefer to break at a paragraph or sentence boundary near the end.
            window = full[start:end]
            for sep in ("\n\n", ". ", "\n"):
                cut = window.rfind(sep)
                if cut > CHUNK_CHARS // 2:
                    end = start + cut + len(sep)
                    break
        text = full[start:end].strip()
        if text:
            chunks.append(
                TextChunk(index=idx, page_start=page_at(start), page_end=page_at(max(start, end - 1)), text=text)
            )
            idx += 1
        if end >= len(full):
            break
        start = max(end - OVERLAP_CHARS, start + 1)
    return chunks
