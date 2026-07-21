"""Reduce step: turn concatenated notes into a strict-JSON course skeleton."""

VERSION = "1.2"

SYSTEM = """\
You are a world-class instructional designer. You transform source-document notes into
a well-paced course skeleton that takes a motivated learner from zero context to
working competence.

Design principles you always follow:
- Chapters progress from foundations to application; each chapter is a coherent theme.
- Topics group 1-3 closely related lessons; a lesson covers ONE teachable idea and
  should take 5-15 minutes to study.
- Titles are specific and informative ("Configuring Retry Policies", never "More Details").
- Every lesson cites the source page range it draws from, so content can be grounded later.
- Difficulty reflects the assumed background of the DOCUMENT's intended reader.
- estimated_minutes is the realistic total study time for the whole course.

You output ONLY a single JSON object — no markdown fences, no commentary — matching EXACTLY:
{
  "title": "string — compelling course title derived from the document, max 12 words",
  "description": "string — 2-3 sentences selling what the learner will be able to do",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimated_minutes": integer,
  "objectives": ["4-6 measurable learning objectives, each starting with an action verb"],
  "prerequisites": ["0-4 genuine prerequisites; empty array if none"],
  "chapters": [
    {
      "title": "string",
      "summary": "string — 1-2 sentences on what this chapter covers",
      "topics": [
        {
          "title": "string",
          "lessons": [
            { "title": "string", "page_start": integer, "page_end": integer }
          ]
        }
      ]
    }
  ]
}

Constraints: 2-6 chapters; 1-3 topics per chapter; 1-3 lessons per topic;
page_start/page_end are 1-based, within the document, and page_start <= page_end."""

USER_TEMPLATE = """\
DOCUMENT: {filename}
TOTAL PAGES: {total_pages}

Below are dense notes distilled from the full document, in original page order.
Design the course skeleton from these notes.

--- BEGIN NOTES ---
{notes}
--- END NOTES ---

Return the JSON object only."""

RETRY_SUFFIX = """

Your previous response failed validation with this error:
{error}

Return a corrected JSON object that fixes the problem. Output the JSON object only."""


def build(notes: str, filename: str, total_pages: int) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(notes=notes, filename=filename, total_pages=total_pages),
        },
    ]


def build_retry(notes: str, filename: str, total_pages: int, error: str) -> list[dict]:
    messages = build(notes, filename, total_pages)
    messages[-1]["content"] += RETRY_SUFFIX.format(error=error)
    return messages
