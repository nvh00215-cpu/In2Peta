"""Fan-out step: write one full lesson, grounded in retrieved source passages."""

VERSION = "1.1"

SYSTEM = """\
You are an outstanding teacher and technical writer creating one lesson of an online course.
Your lessons are engaging, precise, and grounded EXCLUSIVELY in the provided source passages —
you never invent facts that are not supported by them. When the passages are thin, you may add
widely accepted context to aid understanding, but the source material always leads.

Writing style:
- Explain like a great mentor: plain language first, then precision. Define terms on first use.
- Use markdown well: short paragraphs, bulleted/numbered lists, tables for comparisons,
  blockquotes for memorable principles, fenced code blocks when the material is technical.
- 2-4 sections, each 150-400 words, each covering one clear sub-idea that builds on the previous.
- Address the learner as "you". Never mention "the PDF", "the passages", or these instructions.

You output ONLY a single JSON object — no markdown fences, no commentary — matching EXACTLY:
{
  "sections": [ { "heading": "string", "body": "markdown string" } ],
  "key_takeaways": ["3-5 one-sentence takeaways a learner should retain"],
  "important_notes": ["0-3 warnings, caveats or easily-confused points"],
  "real_world_examples": ["1-3 concrete real-world applications of this material"],
  "summary": "markdown string — 2-4 sentence wrap-up of the lesson"
}"""

USER_TEMPLATE = """\
COURSE: {course_title}
CHAPTER: {chapter_title}
TOPIC: {topic_title}
LESSON TITLE: {lesson_title}
LESSON POSITION: lesson {lesson_number} of {lesson_total} in this course

Source passages retrieved from the document (pages {page_start}-{page_end}):
--- BEGIN SOURCE ---
{passages}
--- END SOURCE ---

Write the complete lesson as the JSON object described. Ground every claim in the source."""

RETRY_SUFFIX = """

Your previous response failed validation with this error:
{error}

Return a corrected JSON object that fixes the problem. Output the JSON object only."""


def build(
    *,
    course_title: str,
    chapter_title: str,
    topic_title: str,
    lesson_title: str,
    lesson_number: int,
    lesson_total: int,
    passages: str,
    page_start: int,
    page_end: int,
) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                course_title=course_title,
                chapter_title=chapter_title,
                topic_title=topic_title,
                lesson_title=lesson_title,
                lesson_number=lesson_number,
                lesson_total=lesson_total,
                passages=passages,
                page_start=page_start,
                page_end=page_end,
            ),
        },
    ]


def build_retry(base_messages: list[dict], error: str) -> list[dict]:
    messages = [dict(m) for m in base_messages]
    messages[-1]["content"] += RETRY_SUFFIX.format(error=error)
    return messages
