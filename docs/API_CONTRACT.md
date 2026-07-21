# In2Peta — API Contract (v1)

Source of truth for the REST API between the Next.js frontend and the FastAPI backend.
Backend base URL (local dev): `http://localhost:8000`. All routes below are relative to that.
All request/response bodies are JSON with `snake_case` keys unless noted. All ID fields are integers.
Authenticated routes require header `Authorization: Bearer <access_token>`.

Errors: FastAPI-style `{ "detail": "human readable message" }` with proper status codes
(400 validation/domain, 401 unauthenticated, 403 forbidden, 404 not found, 413 file too large, 422 pydantic).

## Auth

### POST /auth/register
Body: `{ "email": string, "password": string (min 8), "name": string }`
201 → `{ "access_token": string, "token_type": "bearer", "user": User }`
409 if email already registered.

### POST /auth/login
Body: `{ "email": string, "password": string }`
200 → `{ "access_token": string, "token_type": "bearer", "user": User }`
401 on bad credentials.

### GET /auth/me
200 → `User`

`User = { "id": int, "email": string, "name": string, "avatar_url": string|null, "auth_provider": "email"|"google", "created_at": iso8601 }`

### GET /auth/google
302 redirect to Google consent screen. 501 `{detail}` if Google OAuth env vars are not configured.

### GET /auth/google/callback
Backend handles code exchange, upserts user, then 302-redirects to
`{FRONTEND_URL}/auth/callback?token=<access_token>`.
Frontend page `/auth/callback` reads `?token=`, stores it, fetches `/auth/me`, redirects to `/dashboard`.

## Documents / upload

### POST /documents/upload  (multipart/form-data, field name `file`)
PDF only. Max 15 MB (413) and max 300 pages (400). Encrypted/unparseable PDFs → 400.
201 → `{ "course_id": int, "document_id": int }`
Course generation runs in the background; poll `/courses/{id}/status`.

## Courses

`CourseSummary = { "id": int, "title": string, "description": string, "difficulty": "beginner"|"intermediate"|"advanced", "estimated_minutes": int, "status": "generating"|"ready"|"failed", "created_at": iso8601, "document_filename": string, "total_lessons": int, "completed_lessons": int, "completion_percent": float (0-100), "last_accessed_at": iso8601|null }`

### GET /courses
200 → `CourseSummary[]` (newest first)

### GET /courses/{id}
200 →
```json
{
  "id": 1, "title": "...", "description": "...",
  "difficulty": "beginner", "estimated_minutes": 90,
  "objectives": ["..."], "prerequisites": ["..."],
  "status": "ready", "generation_stage": "Done", "error": null,
  "created_at": "...",
  "document": { "id": 1, "filename": "intro.pdf", "page_count": 12 },
  "total_lessons": 9, "completed_lessons": 2, "completion_percent": 22.2,
  "chapters": [
    {
      "id": 1, "position": 1, "title": "...", "summary": "...",
      "progress_percent": 33.3,
      "topics": [
        {
          "id": 1, "position": 1, "title": "...",
          "lessons": [ { "id": 1, "position": 1, "title": "...", "completed": true } ]
        }
      ]
    }
  ]
}
```
While `status == "generating"` the `chapters` array may be empty/partial.

### GET /courses/{id}/status
200 → `{ "id": int, "status": "generating"|"ready"|"failed", "generation_stage": string|null, "error": string|null }`

### DELETE /courses/{id}
204, cascades.

### GET /courses/{id}/progress
200 → `{ "course_id": int, "total_lessons": int, "completed_lessons": int, "completion_percent": float, "total_seconds_spent": int, "chapters": [ { "chapter_id": int, "title": string, "total_lessons": int, "completed_lessons": int, "progress_percent": float } ] }`

## Lessons

### GET /lessons/{id}
200 →
```json
{
  "id": 5, "title": "...", "position": 1,
  "topic_id": 2, "topic_title": "...",
  "chapter_id": 1, "chapter_title": "...",
  "course_id": 1, "course_title": "...",
  "completed": false,
  "prev_lesson_id": 4, "next_lesson_id": 6,
  "content": {
    "sections": [ { "heading": "...", "body": "markdown string" } ],
    "key_takeaways": ["..."],
    "important_notes": ["..."],
    "real_world_examples": ["..."],
    "summary": "markdown string"
  }
}
```
`prev_lesson_id`/`next_lesson_id` are null at the ends (global reading order across the whole course).

### POST /lessons/{id}/complete
Body: `{ "seconds_spent": int (>=0) }`
200 → `{ "lesson_id": int, "completed": true, "completed_at": iso8601 }` (idempotent; seconds accumulate)

### DELETE /lessons/{id}/complete
204 (un-mark)

## Quizzes

### GET /chapters/{chapter_id}/quiz
Lazily generates the quiz on first call (may take a few seconds), then returns the persisted quiz.
Correct answers are never included.
200 → `{ "id": int, "chapter_id": int, "chapter_title": string, "generated_at": iso8601, "questions": [ { "id": int, "type": "mcq"|"tf"|"short", "question": string, "options": string[]|null } ] }`
- `mcq`: `options` = 4 strings; the answer submitted must be the option text.
- `tf`: `options` = `["True","False"]`; submit `"True"` or `"False"`.
- `short`: `options` = null; submit free text.
409 if chapter's course still generating; 502 if generation failed (retryable).

### POST /quizzes/{quiz_id}/attempts
Body: `{ "answers": { "<question_id>": "answer string", ... } }` (missing answers = wrong)
201 →
```json
{
  "id": 1, "quiz_id": 3, "score": 66.7, "taken_at": "...",
  "results": [
    { "question_id": 10, "question": "...", "type": "mcq",
      "your_answer": "...", "correct_answer": "...",
      "is_correct": true, "explanation": "..." }
  ]
}
```
`score` is percent 0–100. Grading: mcq/tf exact (case-insensitive); short = case-insensitive keyword match.

### GET /quizzes/{quiz_id}/attempts
200 → `[ { "id": int, "score": float, "taken_at": iso8601 } ]` (newest first)

## Chat (RAG tutor)

### POST /chat/sessions
Body: `{ "course_id": int }`
201 → `{ "id": int, "course_id": int, "created_at": iso8601 }`

### GET /chat/sessions?course_id={id}
200 → `[ { "id": int, "course_id": int, "created_at": iso8601, "message_count": int, "last_message_preview": string|null } ]`

### GET /chat/sessions/{id}/messages
200 → `[ { "id": int, "role": "user"|"assistant", "content": string, "created_at": iso8601 } ]` (chronological)

### POST /chat/sessions/{id}/messages   ← SSE STREAMING
Body: `{ "content": string }`
Response: `text/event-stream`. Events (each `data: <json>\n\n`):
- token chunks: `{ "delta": "text fragment" }`
- final event: `{ "done": true, "message_id": int }`
- error event: `{ "error": "message" }`
Both user and assistant messages are persisted server-side.
NOTE for frontend: use `fetch` + `ReadableStream` reader (EventSource can't POST or send headers). Parse `data:` lines separated by blank lines.

## Search

### GET /search?q=...&course_id=...&mode=keyword|semantic
`q` required (min 2 chars); `course_id` optional; `mode` default `keyword`.
200 → `{ "query": string, "mode": string, "results": [ SearchResult ] }`
`SearchResult = { "type": "course"|"chapter"|"topic"|"lesson"|"passage", "id": int, "title": string, "snippet": string, "course_id": int, "course_title": string, "lesson_id": int|null, "chapter_id": int|null, "score": float|null }`
- For `lesson` results, deep-link to `/courses/{course_id}/lessons/{id}`.
- For `chapter` results, link to `/courses/{course_id}` (or its quiz page).
- For `topic` results, link to first lesson if `lesson_id` set, else course page.
- `passage` results appear in semantic mode (document chunks); link via `course_id` page.

## Dashboard

### GET /dashboard
200 →
```json
{
  "stats": {
    "courses_count": 3,
    "lessons_completed": 12,
    "total_seconds_spent": 5400,
    "streak_days": 4,
    "avg_quiz_score": 78.5
  },
  "continue_learning": {
    "course_id": 1, "course_title": "...",
    "lesson_id": 7, "lesson_title": "...",
    "chapter_title": "...", "completion_percent": 40.0
  },
  "courses": [ CourseSummary ]
}
```
`avg_quiz_score` null if no attempts; `continue_learning` null if nothing to resume.

## Misc

### GET /health
200 → `{ "status": "ok", "app": "In2Peta API", "mock_llm": bool }`
