"""
dashboard.py — SIGINT Sentinel (Dev 1)
Rich terminal UI: live detection table + LLM alert panels.
Reads scan_feed.jsonl (tail) and alerts.json every 2 seconds.
"""

import json
import os
import time
from datetime import datetime
from collections import deque

from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import box

# ── Configuration ──────────────────────────────────────────────────────────────
FEED_FILE = "scan_feed.jsonl"
ALERTS_FILE = "alerts.json"
MAX_ROWS = 20
REFRESH_RATE = 2   # seconds

console = Console()
recent_events: deque = deque(maxlen=MAX_ROWS)
feed_position = 0   # byte offset — tail new lines only

# ── File Readers ───────────────────────────────────────────────────────────────
def tail_feed():
    """Read any new lines appended to scan_feed.jsonl since last call."""
    global feed_position
    if not os.path.exists(FEED_FILE):
        return
    with open(FEED_FILE, "r", encoding="utf-8") as f:
        f.seek(feed_position)
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                recent_events.appendleft(json.loads(line))
            except json.JSONDecodeError:
                pass
        feed_position = f.tell()

def load_alerts() -> list:
    """Load current alerts.json. Returns empty list on any error."""
    if not os.path.exists(ALERTS_FILE):
        return []
    try:
        with open(ALERTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []

# ── UI Builders ────────────────────────────────────────────────────────────────
def build_header() -> Panel:
    header_text = Text(justify="center")
    header_text.append("🛡️  SIGINT SENTINEL v1.0", style="bold white")
    header_text.append("  |  ", style="dim")
    header_text.append("Nebius-Powered Threat Detection", style="bold cyan")
    header_text.append(f"  |  {datetime.now().strftime('%H:%M:%S')}", style="dim")
    return Panel(header_text, style="bold blue", box=box.DOUBLE)

def build_feed_table(events: list) -> Panel:
    table = Table(
        show_header=True,
        header_style="bold cyan",
        box=box.SIMPLE_HEAVY,
        expand=True,
        row_styles=["", "dim"],
    )
    table.add_column("Time (UTC)", style="green", width=26)
    table.add_column("MAC Address", style="yellow", width=20)
    table.add_column("Node", style="cyan", width=10)
    table.add_column("RSSI (dBm)", style="magenta", justify="right", width=12)

    for evt in list(events)[:MAX_ROWS]:
        ts = evt.get("timestamp", "—")[:19].replace("T", " ")
        table.add_row(ts, evt.get("mac", "—"), evt.get("node_id", "—"), str(evt.get("rssi", "—")))

    return Panel(table, title="📡 Live Detection Feed", border_style="blue")

def build_alerts_panel(alerts: list) -> Panel:
    if not alerts:
        return Panel(
            Text("  No threats detected. System nominal. ✅", style="dim green"),
            title="🚨 Threat Alerts",
            border_style="green",
        )

    content = Text()
    has_critical = any(a.get("threat_level") == "CRITICAL" for a in alerts)

    for alert in alerts:
        level = alert.get("threat_level", "UNKNOWN")
        level_style = {"CRITICAL": "bold red", "HIGH": "bold yellow", "LOW": "bold white"}.get(level, "white")

        content.append(f"\n  [{level}] ", style=level_style)
        content.append(f"Suspects: ", style="bold")
        content.append(", ".join(alert.get("suspect_macs", [])), style="yellow")
        content.append(f"\n  Nodes: ", style="bold")
        content.append(", ".join(alert.get("nodes_involved", [])), style="cyan")
        content.append(f"\n  Reasoning: ", style="bold")
        content.append(alert.get("reasoning", "—"), style="italic white")
        content.append(f"\n  Detected: {alert.get('timestamp', '—')[:19]}\n", style="dim")
        content.append("  " + "─" * 60 + "\n", style="dim")

    border = "bold red" if has_critical else "yellow"
    title = "🔴 CRITICAL THREAT DETECTED" if has_critical else "🚨 Threat Alerts"
    return Panel(content, title=title, border_style=border)

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="body"),
        Layout(name="alerts", size=14),
    )

    with Live(layout, refresh_per_second=2, screen=True):
        while True:
            tail_feed()
            alerts = load_alerts()

            layout["header"].update(build_header())
            layout["body"].update(build_feed_table(list(recent_events)))
            layout["alerts"].update(build_alerts_panel(alerts))

            time.sleep(REFRESH_RATE)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[bold yellow]Dashboard closed.[/bold yellow]")
