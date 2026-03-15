# 🛡️ The Autonomous SIGINT Sentinel

> **AI-powered edge threat detection for coordinated retail theft — built on Nebius AI**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)](https://python.org)
[![Nebius AI](https://img.shields.io/badge/LLM-Nebius%20AI-purple)](https://nebius.com)
[![Model](https://img.shields.io/badge/Model-Llama%203.1%2070B-orange)](https://nebius.com)
[![Track](https://img.shields.io/badge/Track-1%20Edge%20Inference-green)]()

---

## 🔍 What Is This?

Retail theft costs the industry **over $100 billion per year**. A growing tactic is the *coordinated booster ring* — groups of 3–5 people who move through a store in tight synchronization to overwhelm floor staff and cameras.

**The SIGINT Sentinel** detects these groups in real time by passively monitoring **Wi-Fi and Bluetooth probe requests** emitted by the personal devices every person already carries. When multiple devices move in synchronized patterns across sensor nodes, the system triggers an AI-powered threat analysis.

No cameras. No biometrics. **Just signals, math, and reasoning.**

---

## 🧠 How It Works

```mermaid
flowchart TD
    subgraph SENSORS["📡 Store Sensor Network"]
        A([Node_A]) & B([Node_B]) & C([Node_C]) & D([Node_D]) & E([Node_E])
    end

    subgraph FEED["📄 scan_feed.jsonl"]
        F["{ timestamp, mac, node_id, rssi }\n— one line per detection —"]
    end

    subgraph AGENT["🤖 agent.py — Agentic Loop (every 10s)"]
        G["Read last 60 detections"]
        H["Build correlation prompt"]
        I["🧠 Nebius LLM\nLlama 3.1 70B\n— reasons about movement patterns —"]
        G --> H --> I
    end

    subgraph ALERTS["🚨 alerts.json"]
        J["{ threat_level, suspect_macs,\n  nodes_involved, reasoning }"]
    end

    subgraph DASHBOARD["🖥️ dashboard.py — Rich Terminal UI"]
        K["Live Detection Table\n(last 20 events)"]
        L["🔴 CRITICAL ALERT\nRed flashing panel + LLM reasoning"]
    end

    SENSORS -->|"passive MAC probe capture"| FEED
    FEED --> AGENT
    AGENT -->|"structured JSON alert"| ALERTS
    ALERTS --> DASHBOARD
    K -.->|"CRITICAL threshold"| L

    style SENSORS fill:#1e3a5f,stroke:#4a9eff,color:#fff
    style AGENT fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style ALERTS fill:#4a1f1f,stroke:#e74c3c,color:#fff
    style DASHBOARD fill:#1a3a2a,stroke:#2ecc71,color:#fff
    style FEED fill:#2a2a2a,stroke:#888,color:#ccc
    style L fill:#c0392b,stroke:#e74c3c,color:#fff
```

The system runs an **agentic loop**: detections stream in → the LLM reasons about movement correlation → structured alerts are written → the terminal dashboard responds in real time.

---

## ✨ Key Features

- **🤖 LLM-Native Reasoning** — Llama 3.1 70B doesn't just match rules; it *reasons* about novel movement patterns and explains its logic in plain English.
- **🔒 Privacy-Preserving** — Only ephemeral MAC addresses are processed. No video, no faces, no PII.
- **⚡ Edge-Ready** — Designed to run on low-power hardware (e.g., Raspberry Pi 5) with a local quantized model. No cloud dependency for alerts.
- **🖥️ Rich Terminal UI** — Beautiful live dashboard with real-time detection tables and flashing CRITICAL alerts.
- **📡 Passive Detection** — Listens to existing probe traffic. No app installs, no infrastructure changes needed.

---

## 🏗️ Architecture

### File Structure
```
nebius/
├── simulator.py        # Generates simulated MAC detection feed
├── dashboard.py        # Rich terminal UI — reads alerts, displays live table
├── agent.py            # Agentic loop — reads feed, queries Nebius LLM, writes alerts
├── nebius_client.py    # Nebius API helper / connection test
├── scan_feed.jsonl     # Shared: written by simulator, read by agent
├── alerts.json         # Shared: written by agent, read by dashboard
├── .env                # API key (not committed)
├── requirements.txt    # Dependencies
├── README_DEV1.md      # Dev 1 sprint guide (Engine & UI)
└── README_DEV2.md      # Dev 2 sprint guide (AI Agent)
```

### Data Contracts

**`scan_feed.jsonl`** — one detection per line:
```json
{"timestamp": "2026-03-15T13:10:05Z", "mac": "AA:BB:CC:DD:EE:01", "node_id": "Node_C", "rssi": -68}
```

**`alerts.json`** — LLM threat output:
```json
[
  {
    "threat_level": "CRITICAL",
    "suspect_macs": ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"],
    "nodes_involved": ["Node_A", "Node_C", "Node_E"],
    "reasoning": "5 devices transited 3 nodes within a 12-second window. Probability of coincidence: <0.1%.",
    "timestamp": "2026-03-15T13:10:15Z"
  }
]
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- A [Nebius AI](https://nebius.com) API key

### Installation

```bash
git clone https://github.com/your-org/nebius-sigint-sentinel
cd nebius-sigint-sentinel
pip install -r requirements.txt
```

Create a `.env` file:
```
NEBIUS_API_KEY=your_key_here
```

### Run It

Open three terminals:

```bash
# Terminal 1 — Start the sensor simulator
python simulator.py

# Terminal 2 — Start the AI agent
python agent.py

# Terminal 3 — Launch the dashboard
python dashboard.py
```

Watch the dashboard. Within ~30 seconds, the coordinated group is detected and a **🔴 CRITICAL** alert fires.

---

## 🧪 Threat Detection Logic

The Nebius LLM is prompted to identify groups of **3+ devices** that visit **2+ sensor nodes** within a **30-second window**. Alerts are categorized as:

| Level | Meaning |
|-------|---------|
| `CRITICAL` | 4+ devices in lockstep across 3+ nodes |
| `HIGH` | 3 devices in sync across 2+ nodes |
| `LOW` | Partial correlation — worth monitoring |

---

## 🔧 Requirements

```
openai
rich
python-dotenv
```

---

## 🤝 Contributing

This project was built during the **Nebius AI Hackathon** (Track 1: Edge Inference). Pull requests welcome.

---

## 📄 License

MIT License — use freely, build upon it, catch thieves.