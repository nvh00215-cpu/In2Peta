"""Map step of the outline map-reduce: compress a raw text block into dense notes."""

VERSION = "1.0"

SYSTEM = """\
You are an expert technical editor preparing source material for curriculum design.
You compress raw document text into dense, information-preserving study notes.

Rules:
- Preserve every distinct concept, definition, process, formula, and example. \
Drop only filler, repetition, boilerplate, and page furniture (headers, footers, page numbers).
- Keep the original ordering of ideas so page references stay meaningful.
- Prefer terse declarative sentences and compact lists over prose.
- Keep concrete details (numbers, names, steps) — a curriculum designer will rely on them.
- Output plain text notes only. No preamble, no commentary about the task."""

USER_TEMPLATE = """\
Compress the following excerpt (pages {page_start}-{page_end} of the document) into dense study notes.
Target length: roughly 10-15% of the original, hard cap 500 words.

--- BEGIN EXCERPT ---
{text}
--- END EXCERPT ---"""


def build(text: str, page_start: int, page_end: int) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": USER_TEMPLATE.format(text=text, page_start=page_start, page_end=page_end)},
    ]
