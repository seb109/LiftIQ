# ── LiftIQ Backend Dockerfile ──────────────────────────────────────────────────
# FastAPI + MediaPipe + OpenCV on Python 3.12-slim.
# No secrets are baked into this image.
# All configuration is supplied at runtime via environment variables.

FROM python:3.12-slim

# Install system libraries required by OpenCV and MediaPipe.
# libGL1         – OpenCV rendering (cv2.imencode, imshow)
# libglib2.0-0   – GLib (MediaPipe internal)
# libsm6         – X11 Session Management (OpenCV)
# libxrender1    – X11 rendering extension (OpenCV)
# libxext6       – X11 miscellaneous extension (OpenCV)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxrender1 \
        libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer-cached unless requirements change).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source.
# .dockerignore excludes .venv, __pycache__, .git, vids/, *.db, *.log.
COPY . .

# Expose FastAPI port.
EXPOSE 8000

# Run with uvicorn.
# --host 0.0.0.0  makes the server reachable from outside the container.
# --port 8000     matches EXPOSE above.
# Production: remove --reload; add --workers N for multi-process.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
