FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY services/ndvi_scoring/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt web3 pillow

# Copy application source
COPY services/ndvi_scoring/app/ ./services/ndvi_scoring/app/

# Create data and storage directories
RUN mkdir -p /app/data /app/storage/evidence /app/storage/photos

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "services.ndvi_scoring.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
