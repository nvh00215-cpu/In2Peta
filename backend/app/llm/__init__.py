from functools import lru_cache

from app.config import settings
from app.llm.base import LLMError, LLMProvider
from app.llm.gemini import GeminiProvider
from app.llm.groq import GroqProvider
from app.llm.mock import MockProvider
from app.llm.openrouter import OpenRouterProvider


@lru_cache
def get_llm() -> LLMProvider:
    provider = settings.effective_llm_provider
    if provider == "mock":
        return MockProvider()
    if provider == "groq":
        return GroqProvider(settings.groq_api_key, settings.groq_model)
    if provider == "gemini":
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
    if provider == "openrouter":
        return OpenRouterProvider(settings.openrouter_api_key, settings.openrouter_model)
    raise LLMError(
        f"Unknown LLM_PROVIDER '{provider}' (expected groq, gemini, openrouter or mock)"
    )


__all__ = ["get_llm", "LLMProvider", "LLMError"]
