# 🛡️ SIGINT Sentinel — Dev 1 Guide: The Engine & UI

> **Your role:** You own the data simulator and the terminal dashboard. You do NOT touch `agent.py`.  
> **Your shared files:** You **write** `scan_feed.jsonl` and **read** `alerts.json`.

---

## ⚡ Step 0 — Setup (Do this first, ~5 min)

```bash
pip install rich openai python-dotenv
```

Create the stub file Dev 2 needs to validate their code immediately:

```bash
# Create scan_feed.jsonl with a few fake lines so Dev 2 isn't blocked
echo '{"timestamp":"2026-03-15T13:00:00Z","mac":"AA:BB:CC:DD:EE:01","node_id":"Node_A","rssi":-68}' >> scan_feed.jsonl
echo '{"timestamp":"2026-03-15T13:00:01Z","mac":"AA:BB:CC:DD:EE:02","node_id":"Node_A","rssi":-71}' >> scan_feed.jsonl
```

Create the stub `alerts.json` so **you** can build the dashboard without waiting for Dev 2:

```json
[
  {
    "threat_level": "CRITICAL",
    "suspect_macs": ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"],
    "nodes_involved": ["Node_A", "Node_C"],
    "reasoning": "STUB: 2 devices moved in sync. Replace once Agent is live.",
    "timestamp": "2026-03-15T13:00:00Z"
  }
]
```

---

## 🤖 Step 1 — Generate `simulator.py` (Hour 1)

Paste this prompt into an AI assistant (ChatGPT, Claude, etc.):

```
Write a Python script called simulator.py. It should simulate 15 Bluetooth/Wi-Fi
devices moving through 6 sensor nodes (Node_A through Node_F) in a retail store.
Each device has a random MAC address. One group of exactly 5 devices should move
in near-perfect unison (within ±2 seconds of each other), simulating a coordinated
theft ring. Output a continuous stream of detections to a file called scan_feed.jsonl
(one JSON object per line, appended) in this exact format:
{"timestamp": "ISO-8601 UTC", "mac": "XX:XX:XX:XX:XX:XX", "node_id": "Node_A", "rssi": -72}
Run in a loop, sleeping 1 second between rounds.
```

**Test it:**
```bash
python simulator.py
# In another terminal:
Get-Content scan_feed.jsonl -Wait   # PowerShell tail equivalent
```
You should see lines streaming in. ✅

---

## 🖥️ Step 2 — Generate `dashboard.py` (Hours 2–3)

Paste this prompt into an AI assistant:

```
Write a Python terminal dashboard using the `rich` library. It should:
1. Read scan_feed.jsonl (tail new lines every 2 seconds).
2. Display a live Rich table of the last 20 scan events (columns: Time, MAC, Node, RSSI).
3. Read alerts.json every 2 seconds (if the file exists) and display a Rich Panel for each alert.
4. If any alert has threat_level == "CRITICAL", make the panel border red and bold.
5. Show a static header: "SIGINT Sentinel v1.0 | Nebius-Powered Threat Detection".
Use rich.live.Live with a Layout to compose the header, table, and alerts panel together.
```

**Test it against your stub `alerts.json`:**
```bash
python dashboard.py
```
You should see the table filling and the red CRITICAL alert panel. ✅

---

## 📐 Your Data Contracts

### You WRITE → `scan_feed.jsonl`
```json
{"timestamp": "2026-03-15T13:10:05Z", "mac": "AA:BB:CC:DD:EE:01", "node_id": "Node_C", "rssi": -68}
```
One line per detection, appended continuously.

### You READ → `alerts.json`
```json
[
  {
    "threat_level": "CRITICAL",
    "suspect_macs": ["AA:BB:CC:DD:EE:01"],
    "nodes_involved": ["Node_A", "Node_C"],
    "reasoning": "LLM explanation here.",
    "timestamp": "2026-03-15T13:10:15Z"
  }
]
```
Poll this file every 2 seconds. It is fully overwritten by Dev 2 each cycle.

---

## ⏱️ Your Hour-by-Hour Schedule

| Hour | Goal | Done When... |
|------|------|--------------|
| **1** | Get `simulator.py` running, stub files created | `scan_feed.jsonl` is streaming |
| **2** | Build `dashboard.py` shell with Rich layout | Header + table renders in terminal |
| **3** | Wire in alert panel + red CRITICAL flash | Stub `alerts.json` triggers red alarm |
| **4** | Integration with Dev 2's live agent | Real alerts appear from real LLM output |
| **5** | Demo recording + pitch prep | Screencast saved, slides ready |

---

## ✅ Hour 4 Integration Checklist

Run these three terminals simultaneously:

```bash
# Terminal 1
python simulator.py

# Terminal 2
python agent.py   # Dev 2's script — just run it, don't touch it

# Terminal 3
python dashboard.py
```

Watch for the red CRITICAL alarm to fire. If it does — **you're done**. 🎉

---

## 🚨 Common Issues

| Problem | Fix |
|---------|-----|
| Dashboard crashes reading `alerts.json` | Wrap file read in `try/except` — file may be mid-write |
| `scan_feed.jsonl` not found | Make sure `simulator.py` is running first |
| Rich display flickering | Use `Live(refresh_per_second=2)` not higher |
