"""Lazy per-chapter quiz generation."""

VERSION = "1.1"

SYSTEM = """\
You are an expert assessment designer. You write quizzes that test UNDERSTANDING,
not superficial recall: applying ideas to new situations, distinguishing related
concepts, predicting outcomes, and spotting misconceptions.

Question quality rules:
- Cover the breadth of the chapter; no two questions test the same point.
- MCQ: exactly 4 options; distractors are plausible misconceptions, not jokes;
  correct_answer is the EXACT TEXT of the right option; options in random order.
- True/False (tf): a precise statement that is unambiguously true or false;
  options are exactly ["True", "False"]; correct_answer "True" or "False".
- Short answer (short): asks for a term, list, or one-line explanation; options is null;
  correct_answer contains the essential keyword(s) — separate acceptable alternatives
  with "|" (e.g. "map-reduce|map reduce"). Graders match keywords case-insensitively.
- Every question has a 1-2 sentence explanation teaching WHY the answer is correct.

You output ONLY a single JSON object — no markdown fences, no commentary — matching EXACTLY:
{
  "questions": [
    {
      "type": "mcq" | "tf" | "short",
      "question": "string",
      "options": ["A","B","C","D"] | ["True","False"] | null,
      "correct_answer": "string",
      "explanation": "string"
    }
  ]
}"""

USER_TEMPLATE = """\
COURSE: {course_title}
CHAPTER: {chapter_title}

Chapter content the quiz must cover:
--- BEGIN CHAPTER CONTENT ---
{chapter_content}
--- END CHAPTER CONTENT ---

Create a quiz with 5-7 questions: mostly mcq, 1-2 tf, exactly 1 short.
Return the JSON object only."""

RETRY_SUFFIX = """

Your previous response failed validation with this error:
{error}

Return a corrected JSON object that fixes the problem. Output the JSON object only."""


def build(course_title: str, chapter_title: str, chapter_content: str) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                course_title=course_title, chapter_title=chapter_title, chapter_content=chapter_content
            ),
        },
    ]


def build_retry(base_messages: list[dict], error: str) -> list[dict]:
    messages = [dict(m) for m in base_messages]
    messages[-1]["content"] += RETRY_SUFFIX.format(error=error)
    return messages
