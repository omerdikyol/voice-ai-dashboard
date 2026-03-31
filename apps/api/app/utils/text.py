from __future__ import annotations

import hashlib
from pathlib import Path

import docx2txt
from pypdf import PdfReader


def approximate_token_count(text: str) -> int:
    return len(text.split())


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[dict]:
    words = text.split()
    if not words:
        return []

    chunks: list[dict] = []
    start = 0
    index = 0
    stride = max(chunk_size - overlap, 1)

    while start < len(words):
        window = words[start : start + chunk_size]
        content = " ".join(window).strip()
        if content:
            chunks.append(
                {
                    "index": index,
                    "text": content,
                    "token_count": len(window),
                    "fingerprint": hashlib.sha1(content.encode("utf-8")).hexdigest()[:12],
                }
            )
            index += 1
        start += stride

    return chunks


def extract_text_from_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if suffix == ".docx":
        return docx2txt.process(str(path)).strip()
    raise ValueError("Only .pdf and .docx files are supported.")
