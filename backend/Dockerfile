# -------------------------
# STAGE 1: Build Dependencies
# -------------------------
FROM python:3.10-slim AS builder

WORKDIR /app

# Install build dependencies for compiling binary python packages (if needed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential gcc && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies in a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# -------------------------
# STAGE 2: Production Runtime
# -------------------------
FROM python:3.10-slim

# Set environment variables for production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV APP_ENV=production
ENV DEBUG=false
ENV PORT=8000

# Set working directory
WORKDIR /app

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy the application source code
COPY . .

# Expose the API port
EXPOSE $PORT

# Command to run the Uvicorn application server with production optimizations
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
