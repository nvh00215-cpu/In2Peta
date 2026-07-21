from app.llm.base import OpenAICompatProvider


class GeminiProvider(OpenAICompatProvider):
    """Google Gemini via the OpenAI-compatible chat completions endpoint."""

    name = "gemini"
    base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
