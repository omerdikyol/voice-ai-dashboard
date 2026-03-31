FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/alembic.ini ./apps/api/
COPY apps/api/alembic ./apps/api/alembic
COPY apps/api/app ./apps/api/app
COPY apps/api/tests ./apps/api/tests

RUN pip install --no-cache-dir uv \
    && cd /app/apps/api \
    && uv sync --frozen --no-dev || uv sync --no-dev

RUN mkdir -p /app/apps/api/data/uploads

WORKDIR /app/apps/api

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
