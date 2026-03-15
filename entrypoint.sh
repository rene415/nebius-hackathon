#!/usr/bin/env bash
# ============================================================
# entrypoint.sh — Docker entrypoint for SIGINT Sentinel
# Runs simulator + agent + web server in a single container.
# ============================================================
set -e

cd /app

echo "=============================================="
echo " SIGINT Sentinel — Docker Container Starting"
echo "=============================================="

# Validate API key exists (warn but don't crash — allows stub mode)
if [ -z "$NEBIUS_API_KEY" ] || [ "$NEBIUS_API_KEY" = "your_key_here" ]; then
    echo "[WARN] NEBIUS_API_KEY not set or is placeholder."
    echo "       Agent will fail API calls. Set it via environment variable."
    echo "       Running in STUB mode — simulator + web only."
    STUB_MODE=true
else
    echo "[OK] NEBIUS_API_KEY detected."
    STUB_MODE=false
fi

# Create .env file from environment variable (agent.py uses python-dotenv)
echo "NEBIUS_API_KEY=${NEBIUS_API_KEY:-}" > /app/.env

# Cleanup function
cleanup() {
    echo ""
    echo "[ENTRYPOINT] Shutting down..."
    kill $SIM_PID $AGENT_PID 2>/dev/null || true
    wait $SIM_PID $AGENT_PID 2>/dev/null || true
    echo "[ENTRYPOINT] All processes stopped."
    exit 0
}
trap cleanup INT TERM

# Start simulator in background
echo "[ENTRYPOINT] Starting simulator..."
python3 simulator.py &
SIM_PID=$!
sleep 2

# Start agent in background (skip if stub mode)
if [ "$STUB_MODE" = "false" ]; then
    echo "[ENTRYPOINT] Starting agent..."
    python3 agent.py &
    AGENT_PID=$!
else
    echo "[ENTRYPOINT] Skipping agent (no API key). Creating stub alerts..."
    # Write a stub alerts.json so the UI has something to show
    cat > /app/alerts.json << 'STUB'
[
  {
    "threat_level": "CRITICAL",
    "suspect_macs": ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02", "AA:BB:CC:DD:EE:03"],
    "nodes_involved": ["Node_A", "Node_C", "Node_E"],
    "reasoning": "DEMO MODE: 3 devices moved in perfect sync across 3 nodes within 8 seconds. Coordinated movement detected.",
    "timestamp": "2026-03-15T13:10:15Z"
  }
]
STUB
    AGENT_PID=0
fi

# Start web server in FOREGROUND (keeps container alive)
echo "[ENTRYPOINT] Starting web server on port ${PORT:-5000}..."
echo "=============================================="
exec python3 web_server.py
