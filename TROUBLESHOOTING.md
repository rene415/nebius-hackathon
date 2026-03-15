# 🛠️ SIGINT Sentinel — Troubleshooting Log

> Live log of issues encountered and resolved during setup.  
> **Affects:** Both devs unless labeled `[Dev 1 only]` or `[Dev 2 only]`.  
> **OS Coverage:** Windows (PowerShell), Linux, ChromeOS (Linux shell).  
> Last updated: 2026-03-15

---

## Issue #001 — Python Not Installed `[Both Devs]`

**Encountered:** 2026-03-15 ~13:28  
**Status:** ✅ Resolved

**Symptom:**
```
Python was not found... (Windows)
bash: python3: command not found (Linux/ChromeOS)
```

**Cause:** Python was not installed on this machine.

**Fix — Windows (PowerShell):**
```powershell
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

**Fix — Linux / ChromeOS (Debian/Ubuntu-based):**
```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv
```

**Fix — ChromeOS (if Linux environment not enabled):**  
Go to **Settings → Advanced → Developers → Linux development environment** and enable it first, then run the Linux commands above.

**Verify (all OS):**
```bash
python3 --version   # Linux/ChromeOS → Python 3.x.x
python --version    # Windows → Python 3.12.x
```

---

## Issue #002 — pip not on PATH after Python install `[Both Devs]`

**Encountered:** 2026-03-15 ~13:30  
**Status:** ✅ Resolved

**Symptom:** `pip` or `pip3` not recognized after installing Python.

**Cause:** Python's scripts/bin folder was not added to PATH in the current session.

**Fix — Windows (PowerShell):** Call via full path in the current session:
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m pip install -r requirements.txt
```
Then open a **new** terminal and `pip` should work normally.

**Fix — Linux / ChromeOS:**
```bash
# pip3 should work directly after apt install. If not:
python3 -m pip install -r requirements.txt

# If pip itself is missing:
sudo apt install -y python3-pip
```

**Packages required:** `rich`, `openai`, `python-dotenv`

---

## Issue #003 — Terminal must be restarted after Python install `[Both Devs]`

**Encountered:** 2026-03-15  
**Status:** ✅ Known — restart required

**Symptom:** `python` or `python3` not found immediately after install completes.

**Cause:** PATH changes only take effect in new terminal sessions.

**Fix — Windows:** Close PowerShell entirely and open a new window.  
**Fix — Linux / ChromeOS:** Run `source ~/.bashrc` or just open a new terminal tab.

---

## Issue #004 — simulator.py crashes with UnicodeEncodeError on Windows `[Dev 1 only]`

**Encountered:** 2026-03-15 ~13:32  
**Status:** ✅ Resolved (fixed in source code)

**Symptom:**
```
UnicodeEncodeError: 'charmap' codec can't encode character '\u2192' in position 27: character maps to <undefined>
```

**Cause:** Windows PowerShell defaults to the `cp1252` codepage, which cannot encode the `→` (U+2192) arrow character that was in a print statement inside `simulator.py`.

**Fix:** Replaced the Unicode arrow with an ASCII `->` in `simulator.py` line 61:
```python
# Before (crashed):
print(f"  [RING] {mac} → {ring_node} (RSSI {rssi})")
# After (fixed):
print(f"  [RING] {mac} -> {ring_node} (RSSI {rssi})")
```

**Verification:** `simulator.py` now streams to `scan_feed.jsonl` successfully. ✅

---

---

## Issue #005 — `.env` file missing / NEBIUS_API_KEY not loaded `[Dev 2 only]`

**Encountered:** To be watched for  
**Status:** ⚠️ Known risk — do this before running `agent.py`

**Symptom:**
```
AuthenticationError: No API key provided.
```
or the agent runs but gets a `401 Unauthorized` from Nebius.

**Cause:** The `.env` file was not created, or the variable name is wrong.

**Fix (all OS):** Create `.env` in the repo root:
```
NEBIUS_API_KEY=your_actual_key_here
```
Rules: **no spaces** around `=`, **no quotes** around the value.

**Verify — Windows:**
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -c "from dotenv import load_dotenv; import os; load_dotenv(); print('Key:', os.getenv('NEBIUS_API_KEY','NOT FOUND')[:8])"
```

**Verify — Linux / ChromeOS:**
```bash
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print('Key:', os.getenv('NEBIUS_API_KEY','NOT FOUND')[:8])"
```

---

## Issue #006 — LLM returns JSON wrapped in markdown fences `[Dev 2 only]`

**Encountered:** To be watched for  
**Status:** ⚠️ Known risk — defensive code required

**Symptom:**
```
json.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```
The LLM response looks like:
````
```json
[{"threat_level": "CRITICAL", ...}]
```
````

**Cause:** The model sometimes wraps its JSON in markdown code fences even when told not to.

**Fix:** Strip fences before parsing. Add this utility to `agent.py`:
```python
import re, json

def parse_llm_response(raw: str) -> list:
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        result = json.loads(cleaned)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        print(f"[WARN] Invalid JSON from LLM: {raw[:120]}")
        return []
```

---

## Issue #007 — LLM returns empty `[]` every cycle `[Dev 2 only]`

**Encountered:** To be watched for  
**Status:** ⚠️ Known risk

**Symptom:** `agent.py` reports `0 alerts written` every cycle even though the simulator is running.

**Cause:** The LLM needs enough data to correlate. If the `scan_feed.jsonl` tail is too short or too old, the pattern won't be visible. Also happens if the system prompt threshold is too strict.

**Fix options:**
1. Make sure `simulator.py` has been running for at least 30 seconds before the first agent cycle.
2. Lower the detection threshold in your prompt temporarily (e.g., `"2+ devices on 2+ nodes within 60 seconds"`).
3. Use the static test feed from `README_DEV2.md` Step 0 — it has a pre-planted pattern the LLM should always catch.

---

## Issue #008 — `scan_feed.jsonl` not found when agent starts `[Dev 2 only]`

**Encountered:** To be watched for  
**Status:** ⚠️ Known risk

**Symptom:**
```
FileNotFoundError: [Errno 2] No such file or directory: 'scan_feed.jsonl'
```

**Cause:** `agent.py` was started before `simulator.py` created the file, and the agent doesn't handle a missing file gracefully.

**Fix:** Add a file existence check to the top of the agent's read function:
```python
import os
if not os.path.exists("scan_feed.jsonl"):
    print("[AGENT] scan_feed.jsonl not found yet, waiting...")
    time.sleep(5)
    return []
```
Or simply start `simulator.py` first and wait ~3 seconds before starting `agent.py`.

---

---

## Issue #009 — `agent.py` crashes with UnicodeEncodeError on Windows `[Dev 2 only]`

**Encountered:** 2026-03-15 ~14:39  
**Status:** ✅ Resolved (fixed in source code)

**Symptom:**
```
UnicodeEncodeError: 'charmap' codec can't encode character '\U0001f916'
print("\U0001f916 SIGINT Sentinel Agent — Starting")
```

**Cause:** Same root cause as Issue #004. Windows PowerShell uses cp1252 by default. The 🤖 (U+1F916) robot emoji in `agent.py`'s startup banner cannot be encoded.

**Fix:** Replaced the emoji with an ASCII label in `agent.py` line 114:
```python
# Before (crashed):
print("\U0001f916 SIGINT Sentinel Agent — Starting")
# After (fixed):
print("[AGENT] SIGINT Sentinel Agent -- Starting")
```

**Verification:** Agent started successfully and completed the first LLM cycle, writing 3 CRITICAL alerts to `alerts.json`. ✅

---

<!-- 
  ADD NEW ISSUES BELOW THIS LINE
  Format:
  ## Issue #XXX — Short Description `[Both Devs]` or `[Dev 1 only]` or `[Dev 2 only]`
  **Encountered:** [date/time]
  **Status:** ✅ Resolved | ⏳ Pending | ⚠️ Known risk | ❌ Blocked
  **Symptom:** [what you saw]
  **Cause:** [why it happened]
  **Fix:** [exact commands or steps to resolve]
-->
