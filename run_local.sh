#!/usr/bin/env bash
# ============================================================
# run_local.sh — Run the SIGINT Sentinel locally for testing
#
# Usage:
#   ./run_local.sh           # Run all components
#   ./run_local.sh client    # Just test the Nebius API connection
#   ./run_local.sh agent     # Just run the agent
#   ./run_local.sh sim       # Just run the simulator
#   ./run_local.sh dash      # Just run the dashboard
#   ./run_local.sh web       # Just run the web control panel
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

# Activate virtual environment
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
    echo "✅ Virtual environment activated"
else
    echo "❌ No venv found at $VENV_DIR"
    echo "   Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Check .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "❌ .env file not found! Create one with: NEBIUS_API_KEY=your_key_here"
    exit 1
fi

MODE="${1:-all}"

case "$MODE" in
    client)
        echo ""
        echo "🔌 Testing Nebius API connection..."
        python3 "$SCRIPT_DIR/nebius_client.py"
        ;;
    agent)
        echo ""
        echo "🤖 Starting agent only..."
        python3 "$SCRIPT_DIR/agent.py"
        ;;
    sim)
        echo ""
        echo "📡 Starting simulator only..."
        python3 "$SCRIPT_DIR/simulator.py"
        ;;
    dash)
        echo ""
        echo "🖥️  Starting dashboard only..."
        python3 "$SCRIPT_DIR/dashboard.py"
        ;;
    web)
        echo ""
        echo "🌐 Starting web control panel..."
        python3 "$SCRIPT_DIR/web_server.py"
        ;;
    all)
        echo ""
        echo "🚀 Starting all components..."
        echo "   Press Ctrl+C to stop everything."
        echo ""

        # Start simulator in background
        echo "📡 Starting simulator..."
        python3 "$SCRIPT_DIR/simulator.py" &
        SIM_PID=$!
        sleep 3

        # Start agent in background
        echo "🤖 Starting agent..."
        python3 "$SCRIPT_DIR/agent.py" &
        AGENT_PID=$!
        sleep 2

        # Start dashboard in background
        echo "🖥️  Starting dashboard..."
        python3 "$SCRIPT_DIR/dashboard.py" &
        DASH_PID=$!

        # Start web control panel in background
        echo "🌐 Starting web control panel on http://localhost:5000 ..."
        python3 "$SCRIPT_DIR/web_server.py" &
        WEB_PID=$!

        # Trap Ctrl+C to kill all
        trap "echo ''; echo 'Shutting down...'; kill $SIM_PID $AGENT_PID $DASH_PID $WEB_PID 2>/dev/null; exit 0" INT TERM

        # Wait for any to exit
        wait
        ;;
    *)
        echo "Usage: $0 {all|client|agent|sim|dash|web}"
        exit 1
        ;;
esac
