# In2Peta

**Turn any PDF into an interactive e-course with AI.**

In2Peta is a full-stack learning platform: upload a PDF, get a structured course (chapters → topics → lessons), chapter quizzes, progress tracking, semantic search, and a RAG AI tutor with streaming replies.

```mermaid
flowchart LR
  FE[Next.js frontend<br/>Vercel] -->|JWT Bearer| API[FastAPI backend<br/>Render]
  API --> DB[(PostgreSQL + pgvector<br/>Neon)]
  API --> LLM[Groq / OpenRouter / Mock]
  API --> EMB[Gemini embeddings API<br/>gemini-embedding-001]
  FE -->|multipart PDF| API
```

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui | Typed SPA + SSR shell, deploy-ready on Vercel |
| Backend | FastAPI, SQLAlchemy 2.0 async, Alembic | Clear OpenAPI docs, async I/O for LLM + embeddings |
| Database | SQLite (dev) / Neon Postgres + pgvector (prod) | Zero-setup local demo; vector search in production |
| LLM | Groq `llama-3.3-70b-versatile` (switchable to OpenRouter) | Fast structured generation; `MOCK_LLM=true` for demos |
| Embeddings | Google Gemini `gemini-embedding-001` (384-d) | API via `GEMINI_API_KEY` |
| PDF | PyMuPDF | Reliable text extraction with page ranges |
| Auth | JWT + bcrypt; Google OAuth via authlib | Backend-owned sessions |

## Monorepo layout

```
pdf-to-ecourse/
├── backend/          # FastAPI app, Alembic, prompts, LLM providers
├── frontend/         # Next.js App Router UI (In2Peta design system)
├── docs/API_CONTRACT.md
├── design-system.json
├── render.yaml
└── README.md
```

## Local setup (mock mode — no API keys)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Ensure MOCK_LLM=true (and optionally MOCK_EMBEDDINGS=true if no GEMINI_API_KEY)
alembic upgrade head
$env:MOCK_LLM="true"
# Optional offline embeddings without a Gemini key:
# $env:MOCK_EMBEDDINGS="true"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Interactive API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

End-to-end API smoke test (server must be running with `MOCK_LLM=true`):

```powershell
cd backend
$env:MOCK_EMBEDDINGS="true"   # optional if GEMINI_API_KEY is unset
.\.venv\Scripts\python.exe scripts\e2e_test.py
```

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build check:

```powershell
cd frontend
npm run build
```

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Default `sqlite+aiosqlite:///./in2peta.db`. Prod: `postgresql+asyncpg://…?ssl=require` |
| `SECRET_KEY` | JWT signing secret |
| `MOCK_LLM` | `true` → canned schema-valid LLM responses (full demo) |
| `LLM_PROVIDER` | `groq` \| `openrouter` \| `mock` |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` | Required when not mocking |
| `MOCK_EMBEDDINGS` | `true` → deterministic pseudo-vectors (no Gemini call) |
| `GEMINI_API_KEY` | Google AI Studio key for embeddings (same key for Gemini chat later) |
| `EMBEDDING_MODEL` | Default `gemini-embedding-001` |
| `FRONTEND_URL` / `BACKEND_URL` | CORS + OAuth redirects |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `UPLOAD_DIR`, `MAX_PDF_MB`, `MAX_PDF_PAGES` | Upload limits (15 MB / 300 pages) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend origin, e.g. `http://localhost:8000` |

## AI pipeline

1. **Ingest** — PyMuPDF page text → ~1000-token overlapping chunks → embeddings → store  
2. **Outline (map-reduce)** — summarize blocks → one JSON course skeleton (Pydantic validate + one retry)  
3. **Lessons (fan-out)** — retrieve chunks by page range + similarity → structured lesson JSON (3 concurrent, validate + retry)  
4. **Quizzes** — lazily generated per chapter on first request  

`course.generation_stage` updates live for the generating screen poller.

## Database schema (summary)

`users` · `documents` · `chunks` (embedding) · `courses` · `chapters` · `topics` · `lessons` · `lesson_progress` · `quizzes` · `quiz_questions` · `quiz_attempts` · `chat_sessions` · `chat_messages` · `activity_log`

Vector search: pgvector cosine on Postgres; JSON embeddings + numpy cosine on SQLite.

## Design system

UI follows `design-system.json` strictly: terracotta `#B8754A` as the only accent, Poppins type scale, spacing from `[4,8,12,16,20,24,32]`, fixed radii (card 24/16, button pill 28, icon 12). Dark immersive screens (landing, auth panel, generation); light functional screens (dashboard, reader, quiz). No user dark-mode toggle.

## Deployment (deploy-ready; accounts required)

### 1. Neon (Postgres + pgvector)

1. Create a Neon project; enable the `vector` extension.  
2. Connection string → `DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST/neondb?ssl=require`

### 2. Render (backend)

1. Blueprint from root `render.yaml`, or create a Web Service with `rootDir: backend`.  
2. Build: `pip install -r requirements.txt`  
3. Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
4. Set env vars from `.env.example` (`SECRET_KEY`, `DATABASE_URL`, `FRONTEND_URL`, `BACKEND_URL`, `GROQ_API_KEY`, …).  
5. Attach a disk for `UPLOAD_DIR` if you want durable PDF storage.

### 3. Vercel (frontend)

1. Import `frontend/`.  
2. Set `NEXT_PUBLIC_API_URL` to the Render URL.  
3. Deploy.

### 4. Google OAuth (optional)

1. Google Cloud Console → OAuth client (Web).  
2. Authorized redirect: `{BACKEND_URL}/auth/google/callback`  
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on the backend.

## Feature checklist

- [x] Email/password JWT auth + Google OAuth hooks  
- [x] PDF upload (15 MB / 300 pages) + background generation  
- [x] Live generation status polling  
- [x] Course tree with progress  
- [x] Lesson reader (markdown + callouts) + mark complete  
- [x] Lazy chapter quizzes + server-side grading  
- [x] RAG chat with SSE streaming  
- [x] Keyword + semantic search (Cmd/Ctrl+K)  
- [x] Dashboard (time, streak, avg quiz, continue learning)  
- [x] `MOCK_LLM` full local demo  
- [x] Deploy configs (`render.yaml`, env docs)  
- [x] In2Peta branding + design-system UI  

## Screenshots

_Add product screenshots here after a local demo (landing, dashboard, reader, quiz)._

## API documentation

With the backend running, open **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)** (Swagger) or see `docs/API_CONTRACT.md` for the frontend contract.
