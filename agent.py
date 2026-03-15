import os
import re
import json
import time
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize Nebius client with timeout
client = OpenAI(
    base_url="https://api.studio.nebius.ai/v1/",
    api_key=os.environ.get("NEBIUS_API_KEY"),
    timeout=httpx.Timeout(30.0, connect=10.0)
)

MODEL = "meta-llama/Llama-3.3-70B-Instruct"

SYSTEM_PROMPT = """You are a cybersecurity threat detection system. Analyze the MAC address scan data and identify any group of 3 or more devices that visited 2 or more sensor nodes within 30 seconds of each other. This indicates coordinated movement consistent with an organized theft ring.

You MUST respond with ONLY a raw JSON array — no explanation, no markdown, no code fences.

Each item in the array must have this schema:
{"threat_level": "CRITICAL|HIGH|LOW", "suspect_macs": [...], "nodes_involved": [...], "reasoning": "string", "timestamp": "ISO-8601"}

If no threat is detected, respond with exactly: []"""


def parse_llm_response(raw: str) -> list:
    """Strip markdown fences and parse JSON from LLM response."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        result = json.loads(cleaned)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        print(f"[WARN] Invalid JSON from LLM: {raw[:120]}")
        return []


def read_scan_feed(filepath="scan_feed.jsonl", num_lines=60):
    """Read the last N lines from the scan feed."""
    if not os.path.exists(filepath):
        print("[AGENT] scan_feed.jsonl not found yet, waiting...")
        return []

    try:
        with open(filepath, "r") as f:
            lines = f.readlines()
        tail = lines[-num_lines:] if len(lines) >= num_lines else lines
        scans = []
        for line in tail:
            line = line.strip()
            if line:
                try:
                    scans.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return scans
    except Exception as e:
        print(f"[AGENT] Error reading scan feed: {e}")
        return []


def write_alerts(alerts, filepath="alerts.json"):
    """Write alerts to alerts.json, overwriting completely."""
    try:
        with open(filepath, "w") as f:
            json.dump(alerts, f, indent=2)
    except Exception as e:
        print(f"[AGENT] Error writing alerts: {e}")


def run_cycle():
    """Run one analysis cycle."""
    scans = read_scan_feed()
    if not scans:
        print("[AGENT] No scan data available, skipping cycle.")
        return 0

    scan_text = json.dumps(scans, indent=2)

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze these scan detections:\n{scan_text}"}
            ],
            temperature=0.1
        )
        raw = response.choices[0].message.content
        alerts = parse_llm_response(raw)

        # Add timestamp if not present
        now = datetime.now(timezone.utc).isoformat()
        for alert in alerts:
            if "timestamp" not in alert:
                alert["timestamp"] = now

        write_alerts(alerts)
        return len(alerts)

    except Exception as e:
        print(f"[AGENT] API Error: {e}")
        return 0


def main():
    print("=" * 60)
    print("[AGENT] SIGINT Sentinel Agent -- Starting")
    print(f"   Model: {MODEL}")
    print(f"   Cycle interval: 10 seconds")
    print("=" * 60)

    cycle = 0
    while True:
        cycle += 1
        print(f"\n--- Cycle {cycle} [{datetime.now().strftime('%H:%M:%S')}] ---")
        num_alerts = run_cycle()
        print(f"Cycle complete. {num_alerts} alerts written.")
        time.sleep(10)


if __name__ == "__main__":
    main()
