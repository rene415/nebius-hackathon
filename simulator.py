"""
simulator.py — SIGINT Sentinel (Dev 1)
Simulates 15 BT/Wi-Fi devices moving through a retail store.
One planted group of 5 devices moves in near-perfect unison (theft ring).
Writes detections to scan_feed.jsonl, one JSON object per line.
"""

import json
import random
import time
from datetime import datetime, timezone

# ── Configuration ──────────────────────────────────────────────────────────────
NODES = ["Node_A", "Node_B", "Node_C", "Node_D", "Node_E", "Node_F"]
TOTAL_DEVICES = 15
RING_SIZE = 5          # devices in the coordinated theft ring
SLEEP_BETWEEN_ROUNDS = 1  # seconds
OUTPUT_FILE = "scan_feed.jsonl"

# ── Device Setup ───────────────────────────────────────────────────────────────
def random_mac():
    return ":".join(f"{random.randint(0, 255):02X}" for _ in range(6))

# Generate all MACs once at startup
all_macs = [random_mac() for _ in range(TOTAL_DEVICES)]
ring_macs = all_macs[:RING_SIZE]          # first 5 are the theft ring
normal_macs = all_macs[RING_SIZE:]        # remaining are normal shoppers

# Node traversal path for the theft ring (deterministic sweep)
RING_PATH = ["Node_A", "Node_C", "Node_E", "Node_B", "Node_D", "Node_F"]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def write_detection(mac: str, node: str, rssi: int):
    record = {
        "timestamp": now_iso(),
        "mac": mac,
        "node_id": node,
        "rssi": rssi,
    }
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

# ── Main Loop ──────────────────────────────────────────────────────────────────
def main():
    print(f"[SIMULATOR] Starting. Writing to {OUTPUT_FILE}")
    print(f"[SIMULATOR] Theft ring MACs: {ring_macs}")
    round_num = 0

    while True:
        round_num += 1
        ring_node = RING_PATH[round_num % len(RING_PATH)]

        # --- Theft ring: all move to the same node within ±2 seconds ---
        for mac in ring_macs:
            jitter = random.uniform(-2.0, 2.0)
            time.sleep(max(0, jitter / 10))   # spread writes slightly
            rssi = random.randint(-75, -60)
            write_detection(mac, ring_node, rssi)
            print(f"  [RING] {mac} -> {ring_node} (RSSI {rssi})")

        # --- Normal shoppers: random nodes, no coordination ---
        for mac in normal_macs:
            if random.random() < 0.6:         # not every device pings every round
                node = random.choice(NODES)
                rssi = random.randint(-90, -45)
                write_detection(mac, node, rssi)

        print(f"[SIMULATOR] Round {round_num} complete.")
        time.sleep(SLEEP_BETWEEN_ROUNDS)

if __name__ == "__main__":
    main()
