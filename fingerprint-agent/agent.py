"""
ARATEK A600 Fingerprint Agent
Runs locally on Windows. Exposes http://localhost:9000

Setup:
  1. Install ARATEK SDK from the disc/download that came with your A600.
  2. Place the SDK DLL next to this file (or ensure it is on PATH).
  3. pip install flask requests
  4. python agent.py

Update ARATEK_DLL below to match your actual DLL filename.
Common names: AFEDK.dll, AratekFP.dll, FpSDK.dll
Check the /include or /lib folder of your ARATEK SDK to confirm function names.
"""

import base64
import ctypes
import sys
from flask import Flask, jsonify, request
import requests

ARATEK_DLL = "AFEDK.dll"          # <-- change to your actual DLL filename
TEMPLATE_BUFFER_SIZE = 4096        # bytes; increase if SDK returns larger templates
MIN_QUALITY = 60                   # 0-100; reject scans below this
MATCH_THRESHOLD = 500              # 0-1000; score must beat this to be a match

# ── Load SDK ──────────────────────────────────────────────────────────────────

try:
    sdk = ctypes.CDLL(ARATEK_DLL)
except OSError as e:
    print(f"[ERROR] Could not load {ARATEK_DLL}: {e}")
    print("  Put the ARATEK DLL next to agent.py and update ARATEK_DLL.")
    sys.exit(1)

# ── Declare SDK functions ─────────────────────────────────────────────────────
# Adjust these to match the header files shipped with your ARATEK SDK.

# int AFE_Init()
sdk.AFE_Init.restype  = ctypes.c_int
sdk.AFE_Init.argtypes = []

# int AFE_Capture(unsigned char* buf, int* len, int* quality)
#   Blocks until finger placed. quality is 0-100.
sdk.AFE_Capture.restype  = ctypes.c_int
sdk.AFE_Capture.argtypes = [
    ctypes.POINTER(ctypes.c_ubyte),
    ctypes.POINTER(ctypes.c_int),
    ctypes.POINTER(ctypes.c_int),
]

# int AFE_Match(unsigned char* t1, int len1, unsigned char* t2, int len2)
#   Returns match score 0-1000. Higher = more similar.
sdk.AFE_Match.restype  = ctypes.c_int
sdk.AFE_Match.argtypes = [
    ctypes.POINTER(ctypes.c_ubyte), ctypes.c_int,
    ctypes.POINTER(ctypes.c_ubyte), ctypes.c_int,
]

# int AFE_Close()
sdk.AFE_Close.restype  = ctypes.c_int
sdk.AFE_Close.argtypes = []

# ── Init ──────────────────────────────────────────────────────────────────────

if sdk.AFE_Init() != 0:
    print("[ERROR] AFE_Init failed. Is the A600 plugged in?")
    sys.exit(1)

print("[OK] ARATEK A600 ready")

# ── Helpers ───────────────────────────────────────────────────────────────────

def capture_template():
    """Block until finger placed. Returns (raw_bytes, quality 0-100)."""
    buf     = (ctypes.c_ubyte * TEMPLATE_BUFFER_SIZE)()
    length  = ctypes.c_int(TEMPLATE_BUFFER_SIZE)
    quality = ctypes.c_int(0)
    ret = sdk.AFE_Capture(buf, ctypes.byref(length), ctypes.byref(quality))
    if ret != 0:
        raise RuntimeError(f"AFE_Capture returned error code {ret}")
    return bytes(buf[: length.value]), quality.value


def match_templates(t1: bytes, t2: bytes) -> int:
    """Returns ARATEK match score 0-1000."""
    a1 = (ctypes.c_ubyte * len(t1))(*t1)
    a2 = (ctypes.c_ubyte * len(t2))(*t2)
    return sdk.AFE_Match(a1, len(t1), a2, len(t2))

# ── Flask ─────────────────────────────────────────────────────────────────────

app = Flask(__name__)


@app.get("/status")
def status():
    return jsonify({"ready": True, "message": "Scanner ready"})


@app.post("/capture")
def capture():
    """
    Scan one finger and return its template.
    Response: { template: "<base64>", quality: 0-100 }
    Error 400: poor quality scan
    Error 500: SDK error
    """
    try:
        raw, quality = capture_template()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if quality < MIN_QUALITY:
        return jsonify({
            "error": f"Poor scan quality ({quality}/100). Clean the sensor and try again."
        }), 400

    return jsonify({"template": base64.b64encode(raw).decode(), "quality": quality})


@app.post("/identify")
def identify():
    """
    1. Scan a finger.
    2. Fetch all enrolled templates from the backend.
    3. Match using ARATEK SDK — returns the best match above threshold.

    Body: { "backendUrl": "http://localhost:3001", "token": "<jwt>" }
    Response: { matched: bool, clientId: str|null, score: int }
    """
    body = request.get_json(force=True)
    backend_url = body.get("backendUrl", "http://localhost:3001")
    token       = body.get("token", "")

    # 1. Capture
    try:
        raw_new, quality = capture_template()
    except Exception as e:
        return jsonify({"error": f"Capture failed: {e}"}), 500

    if quality < MIN_QUALITY:
        return jsonify({
            "error": f"Poor scan quality ({quality}/100). Try again."
        }), 400

    # 2. Fetch stored templates from backend
    try:
        resp = requests.get(
            f"{backend_url}/clients/fingerprints/templates",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        entries = resp.json()   # [{ clientId, template }, ...]
    except Exception as e:
        return jsonify({"error": f"Could not fetch templates from backend: {e}"}), 500

    if not entries:
        return jsonify({"matched": False, "clientId": None, "score": 0})

    # 3. Match with ARATEK SDK
    best_score  = 0
    best_client = None

    for entry in entries:
        try:
            stored = base64.b64decode(entry["template"])
            score  = match_templates(raw_new, stored)
            if score > best_score:
                best_score  = score
                best_client = entry["clientId"]
        except Exception:
            continue

    if best_score >= MATCH_THRESHOLD:
        return jsonify({"matched": True, "clientId": best_client, "score": best_score})

    return jsonify({"matched": False, "clientId": None, "score": best_score})


if __name__ == "__main__":
    print("[INFO] Fingerprint agent on http://localhost:9000")
    print("[INFO] Ctrl+C to stop")
    try:
        app.run(host="127.0.0.1", port=9000, debug=False)
    finally:
        sdk.AFE_Close()
