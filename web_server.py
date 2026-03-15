"""
web_server.py — SIGINT Sentinel Event Control Panel
Flask backend serving the web UI and REST API.

Integrates with the existing pipeline:
  - Reads scan_feed.jsonl (written by simulator.py)
  - Reads alerts.json (written by agent.py)
  - Manages device registration and event map config.
"""

import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
FEED_FILE = BASE_DIR / "scan_feed.jsonl"
ALERTS_FILE = BASE_DIR / "alerts.json"
CONFIG_FILE = BASE_DIR / "event_config.json"

# ── Flask App ──────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=None)


# ── Config Persistence ─────────────────────────────────────────────────────────
def load_config():
    """Load event_config.json or return defaults."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"devices": [], "event_map": {"items": []}}


def save_config(config):
    """Persist config to disk."""
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


# ── MAC Generator ──────────────────────────────────────────────────────────────
def random_mac():
    return ":".join(f"{random.randint(0, 255):02X}" for _ in range(6))


# ══════════════════════════════════════════════════════════════════════════════
#  STATIC FILE SERVING
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory(WEB_DIR, "index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(WEB_DIR, filename)


# ══════════════════════════════════════════════════════════════════════════════
#  API: Health
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "feed_exists": FEED_FILE.exists(),
        "alerts_exists": ALERTS_FILE.exists(),
    })


# ══════════════════════════════════════════════════════════════════════════════
#  API: Device Registration
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/checkin", methods=["POST"])
def checkin():
    """Register a device — assigns a simulated MAC address."""
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    ticket = data.get("ticket", "").strip()
    device_type = data.get("device_type", "phone")

    if not name or not ticket:
        return jsonify({"error": "Name and ticket are required."}), 400

    config = load_config()

    # Check for duplicate ticket
    for d in config["devices"]:
        if d["ticket"] == ticket:
            return jsonify({"error": f"Ticket {ticket} already registered."}), 409

    mac = random_mac()
    device = {
        "name": name,
        "ticket": ticket,
        "device_type": device_type,
        "mac": mac,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }

    config["devices"].append(device)
    save_config(config)

    return jsonify(device), 201


@app.route("/api/devices")
def list_devices():
    """Return all registered devices."""
    config = load_config()
    return jsonify(config.get("devices", []))


# ══════════════════════════════════════════════════════════════════════════════
#  API: Alerts (reads agent.py output)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/alerts")
def get_alerts():
    """Return current alerts.json content."""
    if not ALERTS_FILE.exists():
        return jsonify([])
    try:
        with open(ALERTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return jsonify(data if isinstance(data, list) else [])
    except (json.JSONDecodeError, OSError):
        return jsonify([])


# ══════════════════════════════════════════════════════════════════════════════
#  API: Scan Feed (reads simulator.py output)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/feed")
def get_feed():
    """Return the last 30 lines from scan_feed.jsonl."""
    if not FEED_FILE.exists():
        return jsonify([])
    try:
        with open(FEED_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
        tail = lines[-30:] if len(lines) >= 30 else lines
        scans = []
        for line in reversed(tail):  # newest first
            line = line.strip()
            if line:
                try:
                    scans.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return jsonify(scans)
    except OSError:
        return jsonify([])


# ══════════════════════════════════════════════════════════════════════════════
#  API: Event Map
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/event-map", methods=["GET"])
def get_event_map():
    """Return saved event map layout."""
    config = load_config()
    return jsonify(config.get("event_map", {"items": []}))


@app.route("/api/event-map", methods=["POST"])
def save_event_map():
    """Save event map layout (node positions, stages, zones)."""
    data = request.get_json(force=True)
    config = load_config()
    config["event_map"] = data
    save_config(config)
    return jsonify({"status": "saved", "item_count": len(data.get("items", []))})


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("[WEB] SIGINT Sentinel — Event Control Panel")
    print(f"      http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=True)
