from __future__ import annotations

import os
from typing import Optional


class OpenAIUnavailable(RuntimeError):
    pass


def get_openai_client(api_key: Optional[str] = None):
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise OpenAIUnavailable("OPENAI_API_KEY is not set.")
    try:
        from openai import OpenAI
    except Exception as exc:
        raise OpenAIUnavailable("OpenAI client not available.") from exc
    return OpenAI(api_key=key)
