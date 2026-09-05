FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# gcc needed to build any wheels that don't ship a prebuilt binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic

# Run as a non-root user so the container can't operate as root.
RUN mkdir -p /app/data \
    && useradd --uid 10001 --create-home appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8001

# Single worker: SQLite + the in-process scheduler daemon must stay in one
# process (--workers 1). Same constraint as ReplyPilot.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips=*"]
