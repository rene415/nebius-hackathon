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
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
FEED_FILE = BASE_DIR / "scan_feed.jsonl"
ALERTS_FILE = BASE_DIR / "alerts.json"
CONFIG_FILE = BASE_DIR / "event_config.json"
STAFF_ALERTS_FILE = BASE_DIR / "staff_alerts.json"

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
#  SEED DATA — Pre-built event map + 25 attendees
# ══════════════════════════════════════════════════════════════════════════════

FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
    "Avery", "Blake", "Drew", "Emery", "Sage", "River", "Sky", "Kai",
    "Harley", "Dakota", "Logan", "Parker", "Rowan", "Reese", "Finley",
    "Hayden", "Peyton", "Cameron",
]

LAST_NAMES = [
    "Chen", "Reyes", "Okonkwo", "Petrov", "Nakamura", "Santos",
    "Mueller", "Singh", "O'Brien", "Kim", "Johansson", "Al-Farsi",
    "Costa", "Patel", "Nguyen", "Ivanova", "Tanaka", "Diaz",
    "Larsson", "Okafor", "Rios", "Shah", "Kowalski", "Park", "Andersen",
]

SEED_MAP_ITEMS = [
    # Stage at the top center
    {"type": "stage",    "x": 450, "y": 60,  "label": "Main Stage",   "id": 1},
    # Food area middle-right
    {"type": "food",     "x": 750, "y": 300, "label": "Food Court A", "id": 2},
    {"type": "food",     "x": 810, "y": 360, "label": "Food Court B", "id": 3},
    {"type": "drink",    "x": 750, "y": 420, "label": "Bar",          "id": 4},
    # WiFi nodes spread around
    {"type": "node",     "x": 150, "y": 150, "label": "Node_A",       "id": 5},
    {"type": "node",     "x": 450, "y": 150, "label": "Node_B",       "id": 6},
    {"type": "node",     "x": 750, "y": 150, "label": "Node_C",       "id": 7},
    {"type": "node",     "x": 150, "y": 450, "label": "Node_D",       "id": 8},
    {"type": "node",     "x": 450, "y": 450, "label": "Node_E",       "id": 9},
    {"type": "node",     "x": 750, "y": 540, "label": "Node_F",       "id": 10},
    # Venue items
    {"type": "bathroom", "x": 90,  "y": 300, "label": "Restroom W",   "id": 11},
    {"type": "bathroom", "x": 90,  "y": 360, "label": "Restroom M",   "id": 12},
    {"type": "medical",  "x": 150, "y": 540, "label": "First Aid",    "id": 13},
    {"type": "exit",     "x": 30,  "y": 570, "label": "Exit A",       "id": 14},
    {"type": "exit",     "x": 870, "y": 570, "label": "Exit B",       "id": 15},
    {"type": "entrance", "x": 450, "y": 570, "label": "Main Gate",    "id": 16},
    {"type": "info",     "x": 330, "y": 540, "label": "Info Booth",   "id": 17},
    {"type": "vip",      "x": 270, "y": 90,  "label": "VIP Section",  "id": 18},
    {"type": "parking",  "x": 870, "y": 60,  "label": "Parking",      "id": 19},
    # Main zone covering the crowd area
    {"type": "zone", "x": 180, "y": 180, "w": 540, "h": 240,
     "label": "General Admission", "id": 20},
]


def seed_data():
    """Generate seed event_config.json if it doesn't exist or is empty."""
    config = load_config()
    if config.get("devices") and len(config["devices"]) >= 20:
        return  # already seeded

    random.seed(42)  # deterministic for demos
    devices = []
    device_types = ["phone"] * 15 + ["wearable"] * 5 + ["laptop"] * 3 + ["other"] * 2
    for i in range(25):
        devices.append({
            "name": f"{FIRST_NAMES[i]} {LAST_NAMES[i]}",
            "ticket": f"TKT-{1001 + i}",
            "device_type": device_types[i],
            "mac": random_mac(),
            "registered_at": datetime.now(timezone.utc).isoformat(),
        })

    config["devices"] = devices
    config["event_map"] = {"items": SEED_MAP_ITEMS}
    save_config(config)
    print(f"[SEED] Created {len(devices)} attendees and {len(SEED_MAP_ITEMS)} map items")


# ══════════════════════════════════════════════════════════════════════════════
#  STATIC FILE SERVING + ROLE-BASED PORTALS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def portal():
    """Landing page — role selection."""
    return send_from_directory(WEB_DIR, "portal.html")


@app.route("/guest")
@app.route("/vendor")
@app.route("/staff")
@app.route("/admin")
def role_view():
    """Serve the main SPA — JS reads the role from the URL path."""
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
#  API: Ticket Lookup (for guests — read only)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/ticket/<ticket_id>")
def lookup_ticket(ticket_id):
    """Look up a pre-loaded ticket by ID."""
    config = load_config()
    for device in config.get("devices", []):
        if device["ticket"].upper() == ticket_id.upper():
            return jsonify(device)
    return jsonify({"error": "Ticket not found."}), 404


# ══════════════════════════════════════════════════════════════════════════════
#  API: Device Registration (admin only — pre-loaded for demo)
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
#  API: Staff Alerts (broadcast between staff)
# ══════════════════════════════════════════════════════════════════════════════

def load_staff_alerts():
    if STAFF_ALERTS_FILE.exists():
        try:
            with open(STAFF_ALERTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return []


def save_staff_alerts(alerts):
    with open(STAFF_ALERTS_FILE, "w", encoding="utf-8") as f:
        json.dump(alerts[-50:], f, indent=2)  # keep last 50


@app.route("/api/staff-alerts", methods=["GET"])
def get_staff_alerts():
    """Return staff-to-staff alerts."""
    return jsonify(load_staff_alerts())


@app.route("/api/staff-alerts", methods=["POST"])
def send_staff_alert():
    """Broadcast an alert to all staff."""
    data = request.get_json(force=True)
    message = data.get("message", "").strip()
    sender = data.get("sender", "Staff").strip()
    priority = data.get("priority", "normal")

    if not message:
        return jsonify({"error": "Message is required."}), 400

    alert = {
        "id": int(datetime.now(timezone.utc).timestamp() * 1000),
        "sender": sender,
        "message": message,
        "priority": priority,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "acknowledged": False,
    }

    alerts = load_staff_alerts()
    alerts.append(alert)
    save_staff_alerts(alerts)

    return jsonify(alert), 201


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
    seed_data()  # Pre-populate demo data on first run
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("[WEB] SIGINT Sentinel — Event Control Panel")
    print(f"      http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=True)
