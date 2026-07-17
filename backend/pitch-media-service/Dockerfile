FROM python:3.11-slim

# ffmpeg (+ ffprobe) for audio extraction and frame sampling.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Whisper models are cached here (mount a volume to persist across restarts).
RUN mkdir -p /models
ENV WHISPER_MODEL=base

EXPOSE 8087
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8087"]
