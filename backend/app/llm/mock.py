"""Mock LLM provider.

Returns realistic, schema-valid canned JSON for every pipeline task so the
whole platform can be run and demoed end-to-end without any API key
(MOCK_LLM=true). The chat stream yields word-by-word with small delays to
exercise the real SSE path.
"""
import asyncio
import json
import re
from typing import AsyncIterator

from app.llm.base import LLMProvider

_CHAPTER_THEMES = [
    ("Foundations", "Core concepts and terminology introduced by the source material."),
    ("Key Techniques", "The main methods and mechanisms explained in depth."),
    ("Applied Practice", "Putting the ideas to work with practical patterns and examples."),
]

_TOPIC_TITLES = [
    ["Getting Oriented", "Essential Vocabulary"],
    ["How It Works", "Common Patterns"],
    ["Real-World Usage", "Pitfalls and Best Practices"],
]

_LESSON_TITLES = [
    [["Why This Subject Matters", "The Big Picture"], ["Terms You Need to Know"]],
    [["The Core Mechanism"], ["Recognizing the Patterns", "Variations in Practice"]],
    [["Case Studies"], ["Avoiding Common Mistakes"]],
]


def _total_pages_from_prompt(messages: list[dict]) -> int:
    text = " ".join(m.get("content", "") for m in messages)
    m = re.search(r"TOTAL PAGES:\s*(\d+)", text)
    return max(1, int(m.group(1))) if m else 6


class MockProvider(LLMProvider):
    name = "mock"

    async def complete(
        self,
        messages,
        *,
        task="generic",
        temperature=0.3,
        max_tokens=4096,
        json_mode=False,
        model: str | None = None,
    ) -> str:
        await asyncio.sleep(0.15)  # simulate latency so generation stages are visible in the UI
        if task == "summarize":
            return self._summary(messages)
        if task == "outline":
            return json.dumps(self._outline(messages))
        if task == "lesson":
            return json.dumps(self._lesson(messages))
        if task == "quiz":
            return json.dumps(self._quiz())
        return "This is a mock LLM response generated without any API key."

    async def stream(self, messages, *, task="chat", temperature=0.5, max_tokens=2048) -> AsyncIterator[str]:
        reply = self._chat_reply(messages)
        for word in re.split(r"(\s+)", reply):
            if word:
                yield word
                await asyncio.sleep(0.008)

    # ------------------------------------------------------------------ tasks

    def _summary(self, messages) -> str:
        source = messages[-1].get("content", "") if messages else ""
        excerpt = re.sub(r"\s+", " ", source)[:280]
        return (
            "Dense notes: the passage covers foundational definitions, explains the primary "
            "mechanism step by step, contrasts alternative approaches, and closes with applied "
            f"examples and caveats. Representative excerpt: \"{excerpt}...\""
        )

    def _outline(self, messages) -> dict:
        total_pages = _total_pages_from_prompt(messages)
        chapters = []
        n_chapters = len(_CHAPTER_THEMES)
        pages_per_chapter = max(1, total_pages // n_chapters)
        for ci, (theme, summary) in enumerate(_CHAPTER_THEMES):
            c_start = min(total_pages, ci * pages_per_chapter + 1)
            c_end = total_pages if ci == n_chapters - 1 else min(total_pages, (ci + 1) * pages_per_chapter)
            topics = []
            for ti, topic_title in enumerate(_TOPIC_TITLES[ci]):
                lessons = [
                    {"title": lt, "page_start": c_start, "page_end": c_end}
                    for lt in _LESSON_TITLES[ci][ti]
                ]
                topics.append({"title": topic_title, "lessons": lessons})
            chapters.append({"title": theme, "summary": summary, "topics": topics})
        return {
            "title": "A Practical Guide to the Uploaded Material",
            "description": (
                "An interactive course generated from your PDF. It walks from first principles "
                "through the core techniques to hands-on application, with quizzes after every "
                "chapter and an AI tutor available throughout."
            ),
            "difficulty": "beginner",
            "estimated_minutes": 90,
            "objectives": [
                "Explain the core concepts introduced in the source document",
                "Describe how the main mechanism works end to end",
                "Apply the techniques to realistic scenarios",
                "Recognize common pitfalls and how to avoid them",
            ],
            "prerequisites": ["Basic reading comprehension of technical material"],
            "chapters": chapters,
        }

    def _lesson(self, messages) -> dict:
        prompt = messages[-1].get("content", "") if messages else ""
        m = re.search(r"LESSON TITLE:\s*(.+)", prompt)
        title = m.group(1).strip() if m else "This Lesson"
        return {
            "sections": [
                {
                    "heading": f"Introduction to {title}",
                    "body": (
                        f"Welcome to **{title}**. In this lesson we unpack the ideas the source "
                        "document develops in this section and connect them to what you have "
                        "already learned.\n\n"
                        "The key insight is that complex systems become manageable when broken "
                        "into small, well-defined parts. The document approaches this in three "
                        "moves:\n\n"
                        "1. **Define** the problem space precisely\n"
                        "2. **Decompose** it into independent pieces\n"
                        "3. **Verify** each piece before recombining\n"
                    ),
                },
                {
                    "heading": "Going Deeper",
                    "body": (
                        "Consider how the source material frames the central mechanism. Rather "
                        "than treating it as a black box, it exposes the intermediate steps so "
                        "each can be inspected and reasoned about.\n\n"
                        "> The best mental model is the one you can simulate in your head.\n\n"
                        "A compact way to remember the flow:\n\n"
                        "| Step | Input | Output |\n"
                        "| --- | --- | --- |\n"
                        "| Analyze | Raw material | Structured notes |\n"
                        "| Synthesize | Notes | Organized knowledge |\n"
                        "| Apply | Knowledge | Working results |\n"
                    ),
                },
                {
                    "heading": "Putting It Into Practice",
                    "body": (
                        "Try restating the main idea of this lesson in one sentence, then "
                        "check it against the summary below. Active recall like this is the "
                        "single highest-leverage study technique, and it is exactly what the "
                        "chapter quiz will exercise.\n\n"
                        "```text\nread -> recall -> quiz -> review\n```\n"
                        "When you can complete that loop without looking back at the text, "
                        "you are ready to move on."
                    ),
                },
            ],
            "key_takeaways": [
                f"{title} builds directly on the chapter's core mechanism",
                "Break complex material into small verifiable parts",
                "Active recall beats passive re-reading",
            ],
            "important_notes": [
                "Terminology in this section is reused throughout the rest of the course — make sure it sticks.",
            ],
            "real_world_examples": [
                "Engineering teams apply the same decompose-and-verify loop in code review.",
                "Students preparing for exams use spaced active recall to retain 2-3x more material.",
            ],
            "summary": (
                f"**{title}** showed how the source document's ideas fit into a simple "
                "analyze → synthesize → apply loop. You should now be able to explain the "
                "mechanism in your own words and apply it to a new example."
            ),
        }

    def _quiz(self) -> dict:
        return {
            "questions": [
                {
                    "type": "mcq",
                    "question": "What is the recommended first step when approaching complex material?",
                    "options": [
                        "Define the problem space precisely",
                        "Memorize every detail immediately",
                        "Skip ahead to the examples",
                        "Rewrite the source document",
                    ],
                    "correct_answer": "Define the problem space precisely",
                    "explanation": "The lesson's three-move approach starts with a precise definition before decomposing and verifying.",
                },
                {
                    "type": "mcq",
                    "question": "In the analyze → synthesize → apply loop, what is the output of the synthesize step?",
                    "options": [
                        "Organized knowledge",
                        "Raw material",
                        "Working results",
                        "A finished quiz",
                    ],
                    "correct_answer": "Organized knowledge",
                    "explanation": "Synthesis turns structured notes into organized knowledge; application then produces working results.",
                },
                {
                    "type": "mcq",
                    "question": "Which study technique does the course identify as highest-leverage?",
                    "options": ["Active recall", "Passive re-reading", "Highlighting", "Speed reading"],
                    "correct_answer": "Active recall",
                    "explanation": "Actively retrieving information strengthens memory far more than re-reading it.",
                },
                {
                    "type": "tf",
                    "question": "Complex systems become easier to manage when broken into small, well-defined parts.",
                    "options": ["True", "False"],
                    "correct_answer": "True",
                    "explanation": "Decomposition is the central technique advocated throughout the chapter.",
                },
                {
                    "type": "tf",
                    "question": "You should move to the next lesson before you can recall the material without looking.",
                    "options": ["True", "False"],
                    "correct_answer": "False",
                    "explanation": "The lesson advises completing the read → recall → quiz → review loop before moving on.",
                },
                {
                    "type": "short",
                    "question": "Name the three steps of the core loop presented in this chapter (in order).",
                    "options": None,
                    "correct_answer": "analyze|synthesize|apply",
                    "explanation": "The loop is analyze → synthesize → apply: structure the material, organize it, then use it.",
                },
            ]
        }

    def _chat_reply(self, messages) -> str:
        question = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                question = m.get("content", "")
                break
        q = question.lower()
        if "summar" in q:
            return (
                "Here's a quick summary of this chapter:\n\n"
                "- **Foundations** — the key terms and the problem the material solves\n"
                "- **Mechanism** — the analyze → synthesize → apply loop at the heart of the content\n"
                "- **Practice** — worked examples and the pitfalls to avoid\n\n"
                "If any of those bullets feels fuzzy, revisit that lesson and then take the chapter quiz to lock it in."
            )
        if "quiz" in q:
            return (
                "Great idea — testing yourself is the fastest way to learn. Try this one:\n\n"
                "**Q: What are the three steps of the core loop, in order?**\n\n"
                "Think about it, then check: *analyze → synthesize → apply*. "
                "For a full graded quiz with explanations, open the **chapter quiz** from the course page."
            )
        if "next" in q or "learn next" in q:
            return (
                "Based on your progress, I'd suggest finishing the remaining lessons in your current "
                "chapter first — the concepts build on each other. After that, take the chapter quiz; "
                "a score above 80% is a good signal you're ready for the next chapter."
            )
        return (
            "Good question! Based on the course material, the key point is that the document "
            "breaks the subject into small, verifiable pieces and builds them back up step by step.\n\n"
            "1. Start from the precise definitions in the Foundations chapter\n"
            "2. Trace the core mechanism one step at a time\n"
            "3. Apply it to one of the real-world examples\n\n"
            "Want me to summarize the current chapter, quiz you on it, or suggest what to learn next?"
        )
