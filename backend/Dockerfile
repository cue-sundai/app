# Use an official Python 3.12 slim image
FROM python:3.12-slim

# Install system dependencies
# These are required by opencv-python, pydub (ffmpeg), and pyaudio
RUN set -ex && apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy uv dependency manager from Astral
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

# Set the working directory to /app
WORKDIR /app

# Copy the definition files for uv
COPY pyproject.toml uv.lock ./

# Sync dependencies using uv, which creates the .venv
RUN uv sync --frozen

# Copy the rest of the application
COPY . /app

# Start the uvicorn server via uv on the correct Cloud Run Port
CMD uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
