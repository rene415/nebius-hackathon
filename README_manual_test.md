# 🛡️ SIGINT Sentinel — Manual Test Guide: Event Control Panel

> **Purpose:** Web-based UI for manual testing of the SIGINT Sentinel pipeline.  
> **Stack:** Flask (Python) backend + vanilla HTML/CSS/JS frontend.  
> **Audience:** Hackathon teammates, demo reviewers, event ops staff.

---

## 🚀 Quick Start

```bash
# 1. Activate venv & install deps
source venv/bin/activate
pip install -r requirements.txt

# 2. Start just the web panel
./run_local.sh web

# 3. Or start everything (simulator + agent + dashboard + web)
./run_local.sh all
```

Open **http://localhost:5000** in your browser.

---

## 🧩 What's In the Web Panel

The control panel has **4 tabs**:

### 📱 Tab 1 — Device Registration
Register attendee devices on the SIGINT monitoring network.

| Field | Description |
|-------|-------------|
| **Name / Alias** | Attendee name or callsign |
| **Ticket / Badge ID** | Unique ticket identifier (e.g. `TKT-0042`) |
| **Device Type** | Phone, Wearable, Laptop, or Other |

On submit, the server assigns a **simulated MAC address** and stores the association. All registered devices appear in the sidebar list with their MAC, ticket, and status.

### 🗺️ Tab 2 — Event Map Builder
Interactive canvas for staff to design the event sensor layout.

**Tools:**
- **📡 Place Node** — Click to add a WiFi/BT sensor node
- **🎤 Place Stage** — Click to mark a stage or point of interest
- **🟩 Draw Zone** — Click to define a coverage zone
- **🖱️ Select / Move** — Drag placed items to reposition

Items snap to a 30px grid. Click **💾 Save Layout** to persist to the server, or **🗑️ Clear All** to reset.

### 🚨 Tab 3 — Live Alerts
Real-time display of threat alerts from `agent.py`. Auto-refreshes every 2 seconds.

- **CRITICAL** alerts show in red with a pulsing badge
- **HIGH** alerts show in amber
- **LOW** alerts show in blue
- Each card shows: threat level, suspect MACs, involved nodes, LLM reasoning, timestamp

> **Requires:** `simulator.py` + `agent.py` running to generate alerts.

### 📡 Tab 4 — Scan Feed
Live tail of the last 30 detections from `scan_feed.jsonl`. Auto-refreshes every 2 seconds.

Columns: Timestamp, MAC Address, Node, RSSI (color-coded: green > -65, amber > -80, red ≤ -80).

> **Requires:** `simulator.py` running to generate scan data.

---

## 🔌 API Reference

All endpoints return JSON. Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status + file existence checks |
| `POST` | `/api/checkin` | Register a device (`name`, `ticket`, `device_type`) |
| `GET` | `/api/devices` | List all registered devices |
| `GET` | `/api/alerts` | Current `alerts.json` contents |
| `GET` | `/api/feed` | Last 30 lines from `scan_feed.jsonl` |
| `GET` | `/api/event-map` | Saved event map layout |
| `POST` | `/api/event-map` | Save event map layout |

**Example — Register a device:**
```bash
curl -X POST http://localhost:5000/api/checkin \
  -H "Content-Type: application/json" \
  -d '{"name": "Agent Delta", "ticket": "TKT-0042", "device_type": "phone"}'
```

**Response:**
```json
{
  "name": "Agent Delta",
  "ticket": "TKT-0042",
  "device_type": "phone",
  "mac": "DA:43:8D:CB:60:22",
  "registered_at": "2026-03-15T22:24:58Z"
}
```

---

## 🐳 Docker (Placeholder)

A `Dockerfile` is included for containerized deployment:

```bash
docker build -t sigint-sentinel .
docker run -p 5000:5000 -e NEBIUS_API_KEY=your_key sigint-sentinel
```

The web UI also has a **Server Connection modal** — click to point the frontend at a remote Docker host (e.g. `http://192.168.1.50:5000`).

---

## 📁 File Structure

```
nebius-hackathon/
├── web/                    # Frontend (served by Flask)
│   ├── index.html          # SPA — 4-tab control panel
│   ├── styles.css          # Dark cyberpunk theme
│   └── app.js              # Client logic (forms, canvas, polling)
├── web_server.py           # Flask backend — REST API
├── Dockerfile              # Container placeholder
├── event_config.json       # Runtime: registered devices + map layout (gitignored)
├── simulator.py            # Generates scan_feed.jsonl
├── agent.py                # LLM analysis loop → alerts.json
├── dashboard.py            # Rich terminal UI
├── run_local.sh            # Start any/all components
├── requirements.txt        # Python deps (openai, rich, dotenv, httpx, flask)
└── .env                    # API key (not committed)
```

---

## ⚠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| `Address already in use` on port 5000 | `fuser -k 5000/tcp` then restart |
| No alerts showing | Start `simulator.py` first, wait 30s, then start `agent.py` |
| No scan feed data | Start `simulator.py` — it writes to `scan_feed.jsonl` |
| Web page won't connect to Docker server | Check the Server Connection modal URL matches host:port |
| Flask not found | `source venv/bin/activate && pip install flask` |
