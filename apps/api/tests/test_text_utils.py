from app.utils.text import chunk_text


def test_chunk_text_respects_overlap() -> None:
    content = " ".join(f"token-{index}" for index in range(700))
    chunks = chunk_text(content, chunk_size=100, overlap=10)

    assert len(chunks) > 1
    assert chunks[0]["token_count"] == 100
    assert "token-90" in chunks[1]["text"]
