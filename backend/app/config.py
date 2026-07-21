"""Application configuration, loaded from environment / .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "In2Peta API"

    # Database
    database_url: str = "sqlite+aiosqlite:///./in2peta.db"

    # Auth
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7
    google_client_id: str = ""
    google_client_secret: str = ""

    # URLs
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # LLM
    llm_provider: str = "groq"  # groq | gemini | openrouter | mock
    mock_llm: bool = False
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct"
    gemini_model: str = "gemini-3.1-flash-lite"

    # Embeddings (Google Gemini API — same GEMINI_API_KEY as Gemini chat)
    mock_embeddings: bool = False
    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 384  # truncated via outputDimensionality; matches DB column

    # Uploads
    upload_dir: str = "./uploads"
    max_pdf_mb: int = 15
    max_pdf_pages: int = 300

    # Generation
    lesson_concurrency: int = 3

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def effective_llm_provider(self) -> str:
        if self.mock_llm:
            return "mock"
        return self.llm_provider.lower()

    @property
    def llm_map_spacing_seconds(self) -> float:
        """Pause between map-summary LLM calls (RPM safety)."""
        if self.effective_llm_provider == "gemini":
            return 4.5  # ~15 RPM ceiling
        return 8.0  # Groq free-tier RPM cushion

    @property
    def llm_lesson_spacing_seconds(self) -> float:
        """Pause after each sequential lesson write."""
        if self.effective_llm_provider == "gemini":
            return 4.5  # ~15 RPM ceiling
        return 3.0  # Groq: lighter spacing; map stage already padded harder


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
