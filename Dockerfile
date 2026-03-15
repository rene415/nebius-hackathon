# ─── SIGINT Sentinel — Production Docker Image ──────────────
# Single container: simulator + agent + web UI on port 5000
#
# Build:   docker build -t sigint-sentinel .
# Run:     docker run -d -p 5000:5000 sigint-sentinel
# With AI: docker run -d -p 5000:5000 -e NEBIUS_API_KEY=your_key sigint-sentinel
# ─────────────────────────────────────────────────────────────

FROM python:3.12-slim

LABEL maintainer="SIGINT Sentinel Team"
LABEL description="AI-powered event security — device tracking and threat detection"

# Avoid Python buffering (so logs stream in real time to docker logs)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Expose web UI port
EXPOSE 5000

# Default: stub mode (no Nebius credits used)
# Override at runtime: -e NEBIUS_API_KEY=your_real_key
ENV NEBIUS_API_KEY=""
ENV PORT=5000

# Health check — Portainer will show green when Flask is up
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')" || exit 1

CMD ["bash", "entrypoint.sh"]
