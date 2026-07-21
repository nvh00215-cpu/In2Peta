import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import auth, chat, courses, dashboard, documents, lessons, quizzes, search

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("in2peta.boot")

# Explicit boot banner so operators can verify mock mode is really off.
_groq_set = bool(settings.groq_api_key and settings.groq_api_key.strip())
_or_set = bool(settings.openrouter_api_key and settings.openrouter_api_key.strip())
_gemini_set = bool(settings.gemini_api_key and settings.gemini_api_key.strip())
logger.info(
    "BOOT CONFIG | MOCK_LLM=%s | LLM_PROVIDER=%s | effective_llm=%s | "
    "GROQ_API_KEY_set=%s | OPENROUTER_API_KEY_set=%s | GEMINI_API_KEY_set=%s | "
    "MOCK_EMBEDDINGS=%s | EMBEDDING_MODEL=%s | DATABASE=%s",
    settings.mock_llm,
    settings.llm_provider,
    settings.effective_llm_provider,
    _groq_set,
    _or_set,
    _gemini_set,
    settings.mock_embeddings,
    settings.embedding_model,
    "postgres" if settings.is_postgres else "sqlite",
)

app = FastAPI(
    title="In2Peta API",
    description=(
        "In2Peta turns any PDF into an interactive e-course: AI-generated chapters, "
        "lessons, quizzes, a RAG tutor chat, progress tracking and semantic search."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Session cookies are only used for the Google OAuth handshake (authlib state).
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(courses.router)
app.include_router(lessons.router)
app.include_router(quizzes.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["misc"])
async def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "mock_llm": settings.mock_llm,
        "llm_provider": settings.llm_provider,
        "effective_llm": settings.effective_llm_provider,
        "groq_api_key_set": bool(settings.groq_api_key and settings.groq_api_key.strip()),
        "gemini_api_key_set": bool(settings.gemini_api_key and settings.gemini_api_key.strip()),
        "gemini_model": settings.gemini_model if settings.effective_llm_provider == "gemini" else None,
        "mock_embeddings": settings.mock_embeddings,
        "embedding_model": settings.embedding_model,
    }


@app.get("/", include_in_schema=False)
async def root():
    return {"app": settings.app_name, "docs": "/docs", "health": "/health"}
