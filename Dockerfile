# ─── SIGINT Sentinel — Docker Image ───────────────────────────
# Placeholder Dockerfile for running the full stack in a container.
#
# Build:   docker build -t sigint-sentinel .
# Run:     docker run -p 5000:5000 -p 8080:8080 sigint-sentinel
# ──────────────────────────────────────────────────────────────

FROM python:3.12-slim

LABEL maintainer="SIGINT Sentinel Team"
LABEL description="AI-powered event security — device tracking and threat detection"

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose ports
#   5000 = Web UI + API
EXPOSE 5000

# Default env vars (override at runtime)
ENV PORT=5000
ENV NEBIUS_API_KEY=your_key_here

# Start all services via run_local.sh
# For production, consider using supervisord or a process manager
CMD ["bash", "run_local.sh", "all"]
