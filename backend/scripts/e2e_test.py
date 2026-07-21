"""End-to-end API test against a running backend (designed for MOCK_LLM=true).

Usage:  python scripts/e2e_test.py [base_url]
Exercises: register -> login -> upload PDF -> poll generation -> course tree ->
lesson -> complete -> progress -> quiz -> attempt -> chat (SSE) -> dashboard -> search.
"""
import json
import os
import sys
import tempfile
import time
import uuid

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from scripts.make_test_pdf import make_pdf  # noqa: E402

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"

passed: list[str] = []
failed: list[tuple[str, str]] = []


def check(name: str, condition: bool, detail: str = ""):
    if condition:
        passed.append(name)
        print(f"  PASS  {name}")
    else:
        failed.append((name, detail))
        print(f"  FAIL  {name}  {detail}")


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=60)

    # --- health ---
    r = client.get("/health")
    check("health endpoint", r.status_code == 200 and r.json()["status"] == "ok", r.text[:200])

    # --- register / login / me ---
    email = f"e2e-{uuid.uuid4().hex[:8]}@in2peta-demo.com"
    r = client.post("/auth/register", json={"email": email, "password": "supersecret1", "name": "E2E Tester"})
    check("register", r.status_code == 201 and r.json().get("access_token"), r.text[:200])

    r = client.post("/auth/login", json={"email": email, "password": "supersecret1"})
    check("login", r.status_code == 200, r.text[:200])
    token = r.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    r = client.post("/auth/login", json={"email": email, "password": "wrongpassword"})
    check("login rejects bad password", r.status_code == 401, f"got {r.status_code}")

    r = client.get("/auth/me")
    check("auth/me", r.status_code == 200 and r.json()["email"] == email, r.text[:200])

    # --- upload ---
    pdf_path = os.path.join(tempfile.gettempdir(), "in2peta_e2e.pdf")
    make_pdf(pdf_path)
    with open(pdf_path, "rb") as f:
        r = client.post("/documents/upload", files={"file": ("spaced_repetition.pdf", f, "application/pdf")})
    check("upload PDF", r.status_code == 201 and "course_id" in r.json(), r.text[:300])
    course_id = r.json()["course_id"]

    r = client.post("/documents/upload", files={"file": ("notes.txt", b"not a pdf", "text/plain")})
    check("upload rejects non-PDF", r.status_code == 400, f"got {r.status_code}")

    # --- poll generation ---
    stages_seen: list[str] = []
    status = "generating"
    deadline = time.time() + 300
    while time.time() < deadline:
        r = client.get(f"/courses/{course_id}/status")
        body = r.json()
        status = body["status"]
        if body.get("generation_stage") and (not stages_seen or stages_seen[-1] != body["generation_stage"]):
            stages_seen.append(body["generation_stage"])
            print(f"    stage: {body['generation_stage']}")
        if status in ("ready", "failed"):
            break
        time.sleep(1)
    check("generation reaches ready", status == "ready", f"status={status} error={body.get('error')}")
    check("generation stages reported", len(stages_seen) >= 3, f"stages={stages_seen}")

    # --- course tree ---
    r = client.get(f"/courses/{course_id}")
    course = r.json()
    check("course detail", r.status_code == 200 and course["status"] == "ready", r.text[:300])
    check("course has chapters/topics/lessons",
          len(course["chapters"]) >= 1
          and len(course["chapters"][0]["topics"]) >= 1
          and len(course["chapters"][0]["topics"][0]["lessons"]) >= 1,
          json.dumps(course)[:300])
    check("course has objectives", len(course["objectives"]) >= 1, "")

    r = client.get("/courses")
    check("course list", r.status_code == 200 and any(c["id"] == course_id for c in r.json()), r.text[:200])

    # --- lesson ---
    first_lesson_id = course["chapters"][0]["topics"][0]["lessons"][0]["id"]
    r = client.get(f"/lessons/{first_lesson_id}")
    lesson = r.json()
    check("lesson detail", r.status_code == 200 and lesson["content"] is not None, r.text[:300])
    check("lesson content structure",
          len(lesson["content"]["sections"]) >= 1 and len(lesson["content"]["key_takeaways"]) >= 1
          and bool(lesson["content"]["summary"]),
          json.dumps(lesson.get("content", {}))[:200])
    check("lesson navigation ids", lesson["prev_lesson_id"] is None and lesson["next_lesson_id"] is not None, "")

    # --- complete lesson / progress ---
    r = client.post(f"/lessons/{first_lesson_id}/complete", json={"seconds_spent": 95})
    check("complete lesson", r.status_code == 200 and r.json()["completed"] is True, r.text[:200])

    r = client.get(f"/courses/{course_id}/progress")
    prog = r.json()
    check("course progress", r.status_code == 200 and prog["completed_lessons"] == 1
          and prog["total_seconds_spent"] == 95, r.text[:300])

    # --- quiz ---
    chapter_id = course["chapters"][0]["id"]
    r = client.get(f"/chapters/{chapter_id}/quiz")
    quiz = r.json()
    check("quiz generated", r.status_code == 200 and len(quiz["questions"]) >= 3, r.text[:300])
    check("quiz hides answers", all("correct_answer" not in q for q in quiz["questions"]), "")

    r2 = client.get(f"/chapters/{chapter_id}/quiz")
    check("quiz is persisted (same id)", r2.json()["id"] == quiz["id"], "")

    answers = {}
    for q in quiz["questions"]:
        if q["type"] in ("mcq", "tf"):
            answers[str(q["id"])] = q["options"][0]
        else:
            answers[str(q["id"])] = "analyze, synthesize and apply"
    r = client.post(f"/quizzes/{quiz['id']}/attempts", json={"answers": answers})
    attempt = r.json()
    check("quiz attempt graded", r.status_code == 201 and 0 <= attempt["score"] <= 100, r.text[:300])
    check("attempt returns explanations",
          all(res["correct_answer"] and res["explanation"] is not None for res in attempt["results"]),
          json.dumps(attempt)[:300])

    r = client.get(f"/quizzes/{quiz['id']}/attempts")
    check("attempts list", r.status_code == 200 and len(r.json()) == 1, r.text[:200])

    # --- chat (SSE) ---
    r = client.post("/chat/sessions", json={"course_id": course_id})
    check("create chat session", r.status_code == 201, r.text[:200])
    session_id = r.json()["id"]

    deltas, got_done = [], False
    with client.stream(
        "POST", f"/chat/sessions/{session_id}/messages",
        json={"content": "What should I learn next?"},
    ) as resp:
        check("chat SSE content-type", resp.headers.get("content-type", "").startswith("text/event-stream"),
              str(resp.headers))
        for line in resp.iter_lines():
            if not line.startswith("data:"):
                continue
            event = json.loads(line[5:].strip())
            if "delta" in event:
                deltas.append(event["delta"])
            if event.get("done"):
                got_done = True
    check("chat streams deltas", len(deltas) > 5, f"got {len(deltas)} deltas")
    check("chat sends done event", got_done, "")

    r = client.get(f"/chat/sessions/{session_id}/messages")
    msgs = r.json()
    check("chat messages persisted", len(msgs) == 2 and msgs[0]["role"] == "user" and msgs[1]["role"] == "assistant",
          json.dumps(msgs)[:200])
    r = client.get(f"/chat/sessions?course_id={course_id}")
    check("chat sessions list", r.status_code == 200 and len(r.json()) == 1, r.text[:200])

    # --- dashboard ---
    r = client.get("/dashboard")
    dash = r.json()
    check("dashboard", r.status_code == 200, r.text[:300])
    check("dashboard stats",
          dash["stats"]["courses_count"] >= 1 and dash["stats"]["lessons_completed"] == 1
          and dash["stats"]["total_seconds_spent"] == 95 and dash["stats"]["streak_days"] >= 1
          and dash["stats"]["avg_quiz_score"] is not None,
          json.dumps(dash["stats"]))
    check("dashboard continue_learning", dash["continue_learning"] is not None
          and dash["continue_learning"]["course_id"] == course_id, json.dumps(dash.get("continue_learning")))

    # --- search ---
    query = course["chapters"][0]["topics"][0]["lessons"][0]["title"].split()[0]
    r = client.get("/search", params={"q": query})
    check("keyword search finds results", r.status_code == 200 and len(r.json()["results"]) >= 1,
          f"q={query} -> {r.text[:200]}")
    r = client.get("/search", params={"q": "how does memory retention work", "mode": "semantic"})
    check("semantic search returns passages",
          r.status_code == 200 and any(res["type"] == "passage" for res in r.json()["results"]), r.text[:300])

    # --- auth guard ---
    r = httpx.get(f"{BASE}/courses")
    check("unauthenticated request rejected", r.status_code == 401, f"got {r.status_code}")

    # --- uncomplete lesson (cleanup check) ---
    r = client.delete(f"/lessons/{first_lesson_id}/complete")
    check("uncomplete lesson", r.status_code == 204, f"got {r.status_code}")

    print(f"\n===== E2E RESULT: {len(passed)} passed, {len(failed)} failed =====")
    for name, detail in failed:
        print(f"  FAILED: {name} — {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
