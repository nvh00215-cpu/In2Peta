"""Generate a small multi-page test PDF with PyMuPDF (used by the e2e test)."""
import sys

import fitz

PAGES = [
    (
        "Introduction to Spaced Repetition",
        "Spaced repetition is a learning technique in which review sessions are spaced "
        "out over increasing intervals of time. Instead of cramming, the learner revisits "
        "material just as it is about to be forgotten. This timing exploits the spacing "
        "effect, one of the most replicated findings in cognitive psychology. Hermann "
        "Ebbinghaus first documented the forgetting curve in 1885, showing that memory "
        "decays exponentially without review. Each successful recall flattens the curve, "
        "so the next review can come later. Modern systems such as flashcard schedulers "
        "automate this process by tracking every item's review history.",
    ),
    (
        "The Forgetting Curve and Retrieval Practice",
        "The forgetting curve describes how retention drops rapidly in the first hours "
        "after learning and then levels off. Retrieval practice — actively recalling "
        "information rather than re-reading it — is the most effective way to interrupt "
        "this decay. Testing yourself strengthens the memory trace and reveals gaps. "
        "Combining retrieval practice with spacing multiplies the benefit: each recall "
        "at the edge of forgetting produces a larger boost in retention than an easy, "
        "immediate recall. This is called desirable difficulty.",
    ),
    (
        "Scheduling Algorithms",
        "Early systems like the Leitner box used fixed intervals: cards moved between "
        "boxes reviewed daily, weekly, and monthly. Algorithmic schedulers such as SM-2 "
        "compute a personalized interval per item from an ease factor and the quality of "
        "each recall. If you recall an item easily, its interval grows by the ease factor; "
        "if you fail, the interval resets. Newer approaches model memory with machine "
        "learning, predicting the probability of recall for every item at any moment and "
        "scheduling reviews when that probability falls to a target such as 90 percent.",
    ),
    (
        "Designing Effective Flashcards",
        "Good flashcards follow the minimum information principle: each card asks for one "
        "small fact. Complex ideas should be decomposed into many simple cards. Cloze "
        "deletion — hiding one word or phrase within a sentence — is a fast way to author "
        "cards. Images and mnemonics improve recall through dual coding. Avoid orphan "
        "cards that lack context, and rewrite cards you repeatedly fail, because a leech "
        "card wastes review time.",
    ),
    (
        "Applying Spaced Repetition in Practice",
        "Medical students use spaced repetition to retain tens of thousands of facts for "
        "licensing exams. Language learners use it for vocabulary, where studies show "
        "gains of two to three times compared with massed practice. To build a habit, "
        "keep daily review sessions short, add new cards gradually, and trust the "
        "scheduler: reviewing early wastes time while reviewing late causes forgetting. "
        "The technique works for any domain with discrete facts, from law to chemistry "
        "to music theory.",
    ),
]


def make_pdf(path: str) -> None:
    doc = fitz.open()
    for title, body in PAGES:
        page = doc.new_page()
        page.insert_text((72, 90), title, fontsize=18, fontname="helv")
        rect = fitz.Rect(72, 130, 523, 770)
        page.insert_textbox(rect, body, fontsize=12, fontname="helv")
    doc.save(path)
    doc.close()
    print(f"wrote {path} ({len(PAGES)} pages)")


if __name__ == "__main__":
    make_pdf(sys.argv[1] if len(sys.argv) > 1 else "test_document.pdf")
