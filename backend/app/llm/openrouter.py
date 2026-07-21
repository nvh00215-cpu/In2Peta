from app.llm.base import OpenAICompatProvider


class OpenRouterProvider(OpenAICompatProvider):
    name = "openrouter"
    base_url = "https://openrouter.ai/api/v1"
    extra_headers = {
        "HTTP-Referer": "https://in2peta.app",
        "X-Title": "In2Peta",
    }
