FROM python:3.12-slim
WORKDIR /app

# Build tools needed by numpy/scikit-learn if binary wheels are unavailable
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8085
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8085"]
