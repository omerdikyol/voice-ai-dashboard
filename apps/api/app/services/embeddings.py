from __future__ import annotations

import hashlib

from openai import OpenAI

from app.core.config import settings


class EmbeddingService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def embed_text(self, text: str) -> list[float]:
        if self._client is None:
            return self._fallback_embedding(text)

        response = self._client.embeddings.create(
            model=settings.openai_embedding_model,
            input=text,
        )
        return list(response.data[0].embedding)

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        if self._client is None:
            return [self._fallback_embedding(text) for text in texts]

        response = self._client.embeddings.create(
            model=settings.openai_embedding_model,
            input=texts,
        )
        return [list(item.embedding) for item in response.data]

    @staticmethod
    def _fallback_embedding(text: str) -> list[float]:
        dimensions = settings.embedding_dimensions
        values = [0.0] * dimensions
        for token in text.lower().split():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            for index in range(0, len(digest), 2):
                slot = int.from_bytes(digest[index : index + 2], "big") % dimensions
                values[slot] += 1.0
        norm = sum(value * value for value in values) ** 0.5 or 1.0
        return [value / norm for value in values]
