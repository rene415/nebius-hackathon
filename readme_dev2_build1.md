# Dev 2 Troubleshooting & Build Log

## Build 1 — 2026-03-15

### Issues

#### Issue 1: `python3-venv` not installed
- **Symptom:** `python3 -m venv venv` failed — `ensurepip is not available`
- **Fix:** `sudo apt install python3.13-venv`
- **Status:** ✅ Resolved

#### Issue 2: Wrong Nebius API base URL
- **Symptom:** API calls hung indefinitely (no response, no timeout)
- **Cause:** README specified `https://api.studio.nebius.com/v1/` but the correct URL is `https://api.studio.nebius.ai/v1/`
- **Fix:** Changed base_url to `.ai` domain in `nebius_client.py` and `agent.py`
- **Status:** ✅ Resolved

#### Issue 3: Model name `Meta-Llama-3.1-70B-Instruct` does not exist
- **Symptom:** 404 error — `The model does not exist`
- **Cause:** Nebius no longer hosts Llama 3.1 70B. The correct model is `meta-llama/Llama-3.3-70B-Instruct`
- **Fix:** Updated model string in both `nebius_client.py` and `agent.py`
- **Status:** ✅ Resolved

#### Issue 4: No timeout on API calls
- **Symptom:** Script hangs forever on bad URL / unreachable endpoint
- **Fix:** Added `httpx.Timeout(10.0, connect=5.0)` to the client
- **Status:** ✅ Resolved

### Files Created
- `nebius_client.py` — API connection test (10s timeout, correct URL + model)
- `agent.py` — Agentic loop: reads `scan_feed.jsonl`, sends to LLM, writes `alerts.json`
- `run_local.sh` — Convenience script to run all components in venv
- `alerts.json` — Stub alert for Dev 1's dashboard
- `scan_feed.jsonl` — Now populated by Dev 1's simulator
- `.env` — API key (user-provided)
- `.gitignore` — Ignores venv, .env, __pycache__, etc.

### API Connection Test
- `nebius_client.py` → returned `OK` ✅

### Pending
- Full integration test with simulator + agent + dashboard
