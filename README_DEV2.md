# 🛡️ SIGINT Sentinel — Dev 2 Guide: The AI Agent

> **Your role:** You own the Nebius API connection, the agentic loop, and the LLM prompt. You do NOT touch `simulator.py` or `dashboard.py`.  
> **Your shared files:** You **read** `scan_feed.jsonl` and **write** `alerts.json`.

---

## ⚡ Step 0 — Setup (Do this first, ~5 min)

```bash
pip install openai rich python-dotenv
```

Create a `.env` file in the repo root:
```
NEBIUS_API_KEY=your_key_here
```

Create a stub `alerts.json` so Dev 1's dashboard has something to render while you work:
```json
[
  {
    "threat_level": "CRITICAL",
    "suspect_macs": ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"],
    "nodes_involved": ["Node_A", "Node_C"],
    "reasoning": "STUB: Replace once agent is live.",
    "timestamp": "2026-03-15T13:00:00Z"
  }
]
```

Create a static `scan_feed.jsonl` test file so you can develop **without** needing Dev 1's simulator running:

```bash
# Paste this into PowerShell to create a 10-line test feed
@"
{"timestamp":"2026-03-15T13:00:00Z","mac":"AA:BB:CC:DD:EE:01","node_id":"Node_A","rssi":-68}
{"timestamp":"2026-03-15T13:00:01Z","mac":"AA:BB:CC:DD:EE:02","node_id":"Node_A","rssi":-70}
{"timestamp":"2026-03-15T13:00:02Z","mac":"AA:BB:CC:DD:EE:03","node_id":"Node_A","rssi":-65}
{"timestamp":"2026-03-15T13:00:03Z","mac":"AA:BB:CC:DD:EE:04","node_id":"Node_A","rssi":-72}
{"timestamp":"2026-03-15T13:00:04Z","mac":"AA:BB:CC:DD:EE:05","node_id":"Node_A","rssi":-69}
{"timestamp":"2026-03-15T13:00:12Z","mac":"AA:BB:CC:DD:EE:01","node_id":"Node_C","rssi":-74}
{"timestamp":"2026-03-15T13:00:13Z","mac":"AA:BB:CC:DD:EE:02","node_id":"Node_C","rssi":-71}
{"timestamp":"2026-03-15T13:00:13Z","mac":"AA:BB:CC:DD:EE:03","node_id":"Node_C","rssi":-68}
{"timestamp":"2026-03-15T13:00:14Z","mac":"AA:BB:CC:DD:EE:04","node_id":"Node_C","rssi":-77}
{"timestamp":"2026-03-15T13:00:15Z","mac":"AA:BB:CC:DD:EE:05","node_id":"Node_C","rssi":-66}
"@ | Out-File -FilePath scan_feed.jsonl -Encoding utf8
```

This test feed has 5 devices moving in sync — the LLM **should** flag it as CRITICAL. ✅

---

## 🤖 Step 1 — Generate & Validate `nebius_client.py` (Hour 1 — CRITICAL)

**This is your #1 priority. Do this before anything else.**

Paste this prompt into an AI assistant:

```
Write a Python script called nebius_client.py that connects to the Nebius AI API
using the openai Python SDK. Use:
  base_url = "https://api.studio.nebius.com/v1/"
  model = "meta-llama/Meta-Llama-3.1-70B-Instruct"
Load the API key from a .env file using python-dotenv (env var: NEBIUS_API_KEY).
Send a simple chat message "Hello, respond with just the word OK" and print the
full response content to stdout.
```

**Run it immediately:**
```bash
python nebius_client.py
```

Expected output: `OK` or similar. If this fails, **stop and fix it before writing any other code.** ✅

---

## 🧠 Step 2 — Generate `agent.py` (Hours 2–3)

Paste this prompt into an AI assistant:

```
Write a Python script called agent.py. It should run an infinite loop that:
1. Every 10 seconds, reads the last 60 lines from scan_feed.jsonl as JSON objects.
2. Sends the scan data to the Nebius API (meta-llama/Meta-Llama-3.1-70B-Instruct)
   with this system prompt:
   "You are a cybersecurity threat detection system. Analyze the MAC address scan
   data and identify any group of 3 or more devices that visited 2 or more sensor
   nodes within 30 seconds of each other. This indicates coordinated movement
   consistent with an organized theft ring. You MUST respond with ONLY a raw JSON
   array — no explanation, no markdown, no code fences. If no threat is detected,
   respond with exactly: []"
3. The JSON array items must match this schema:
   {"threat_level": "CRITICAL|HIGH|LOW", "suspect_macs": [...], "nodes_involved": [...], "reasoning": "string", "timestamp": "ISO-8601"}
4. Strip any markdown fences from the response before parsing.
5. Write the parsed array to alerts.json (overwrite each cycle).
6. Print "Cycle complete. N alerts written." to stdout.
Load the API key from a .env file.
```

---

## 🔑 Critical Prompt Engineering Rules

Your biggest risk is the LLM returning invalid JSON. Enforce these in code:

```python
import re, json

def parse_llm_response(raw: str) -> list:
    # Strip markdown fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        result = json.loads(cleaned)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        print(f"[WARN] Invalid JSON from LLM: {raw[:100]}")
        return []
```

---

## 📐 Your Data Contracts

### You READ → `scan_feed.jsonl`
```json
{"timestamp": "2026-03-15T13:10:05Z", "mac": "AA:BB:CC:DD:EE:01", "node_id": "Node_C", "rssi": -68}
```
Read the last 60 lines every 10 seconds.

### You WRITE → `alerts.json`
```json
[
  {
    "threat_level": "CRITICAL",
    "suspect_macs": ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"],
    "nodes_involved": ["Node_A", "Node_C"],
    "reasoning": "5 devices transited Node_A → Node_C within 12 seconds.",
    "timestamp": "2026-03-15T13:10:15Z"
  }
]
```
Overwrite this file completely each cycle. Dev 1's dashboard polls it every 2 seconds.

---

## ⏱️ Your Hour-by-Hour Schedule

| Hour | Goal | Done When... |
|------|------|--------------|
| **1** | Nebius API validated, stubs created | `nebius_client.py` prints a response |
| **2** | `agent.py` skeleton running | Loop runs, reads feed, calls API |
| **3** | LLM correctly returns valid JSON | Static test feed triggers CRITICAL alert |
| **4** | Integration with Dev 1's live simulator | `alerts.json` updates with real live data |
| **5** | Demo recording + pitch prep | Screencast saved, slides ready |

---

## ✅ Hour 4 Integration Checklist

Run these three terminals simultaneously:

```bash
# Terminal 1
python simulator.py   # Dev 1's script — just run it, don't touch it

# Terminal 2
python agent.py

# Terminal 3
python dashboard.py   # Dev 1's script — just run it, don't touch it
```

Watch `alerts.json` update every 10 seconds and trigger Dev 1's dashboard. 🎉

---

## 🚨 Common Issues

| Problem | Fix |
|---------|-----|
| API returns `401 Unauthorized` | Double-check `NEBIUS_API_KEY` in `.env`, no extra spaces |
| LLM returns markdown fences around JSON | Use the `parse_llm_response()` function above |
| LLM returns empty `[]` every time | Add more scan data to test feed; the pattern needs 3+ devices on 2+ nodes |
| `scan_feed.jsonl` not found | Create stub file from Step 0 above |
| Write conflict on `alerts.json` | Use `with open(..., 'w') as f:` — a single atomic write is fine |
