"""
ARATEK A600 Fingerprint Agent — Real SDK
=========================================
Uses: AraTrustFinger.dll (from Aratek TrustFinger SDK For Windows v1.0.8)
Runs: Windows only (the machine the A600 is plugged into)
Port: http://localhost:9000

Setup (on Windows):
  1. Install drivers: run AratekA600.msi + Aratek_Finger_Module_Drivers.exe
  2. Copy these DLLs into this same folder:
       AraTrustFinger.dll   (from SDK/CPP/x64/)
       AraNFIQ.dll          (from SDK/CPP/x64/)
       AraWSQ.dll           (from SDK/CPP/x64/)
  3. pip install flask flask-cors requests
  4. python agent.py

Enroll flow  : POST /enroll    — user places finger 3 times → returns base64 template
Identify flow: POST /identify  — user places finger once  → returns matched clientId
"""

import base64
import ctypes
import os
import sys

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────────────────────

DLL_NAME       = "AraTrustFinger.dll"   # must be in same folder or on PATH
FEATURE_SIZE   = 4096                   # bytes — generous; SDK uses fixed internal size
TEMPLATE_SIZE  = 8192                   # bytes — generous; SDK uses fixed internal size
CAPTURE_TIMEOUT = 15000                 # ms to wait for finger placement per capture
SECURITY_LEVEL  = 4                     # 1=lowest … 5=highest FAR/FRR

# ── Load DLL ─────────────────────────────────────────────────────────────────

_dll_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), DLL_NAME)

try:
    # __stdcall convention → WinDLL
    sdk = ctypes.WinDLL(_dll_path)
    print(f"[OK]  Loaded {DLL_NAME}")
except OSError as e:
    print(f"[ERR] Cannot load {DLL_NAME}: {e}")
    print(f"      Expected path: {_dll_path}")
    print("      Copy AraTrustFinger.dll (x64) from the SDK into this folder.")
    sys.exit(1)

# ── Declare SDK function signatures ──────────────────────────────────────────

sdk.ARAFPSCAN_GlobalInit.restype  = ctypes.c_int
sdk.ARAFPSCAN_GlobalInit.argtypes = []

sdk.ARAFPSCAN_GlobalFree.restype  = ctypes.c_int
sdk.ARAFPSCAN_GlobalFree.argtypes = []

sdk.ARAFPSCAN_GetDeviceCount.restype  = ctypes.c_int
sdk.ARAFPSCAN_GetDeviceCount.argtypes = [ctypes.POINTER(ctypes.c_int)]

sdk.ARAFPSCAN_OpenDevice.restype  = ctypes.c_int
sdk.ARAFPSCAN_OpenDevice.argtypes = [ctypes.POINTER(ctypes.c_void_p), ctypes.c_int]

sdk.ARAFPSCAN_CloseDevice.restype  = ctypes.c_int
sdk.ARAFPSCAN_CloseDevice.argtypes = [ctypes.POINTER(ctypes.c_void_p)]

sdk.ARAFPSCAN_GetImageInfo.restype  = ctypes.c_int
sdk.ARAFPSCAN_GetImageInfo.argtypes = [
    ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_int),
    ctypes.POINTER(ctypes.c_int),
    ctypes.POINTER(ctypes.c_int),
]

sdk.ARAFPSCAN_CaptureRawData.restype  = ctypes.c_int
sdk.ARAFPSCAN_CaptureRawData.argtypes = [
    ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_ubyte)
]

sdk.ARAFPSCAN_ExtractFeature.restype  = ctypes.c_int
sdk.ARAFPSCAN_ExtractFeature.argtypes = [
    ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_ubyte)
]

sdk.ARAFPSCAN_GeneralizeTemplate.restype  = ctypes.c_int
sdk.ARAFPSCAN_GeneralizeTemplate.argtypes = [
    ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_ubyte),   # feature 1
    ctypes.POINTER(ctypes.c_ubyte),   # feature 2
    ctypes.POINTER(ctypes.c_ubyte),   # feature 3
    ctypes.POINTER(ctypes.c_ubyte),   # output template
]

sdk.ARAFPSCAN_Verify.restype  = ctypes.c_int
sdk.ARAFPSCAN_Verify.argtypes = [
    ctypes.c_void_p,
    ctypes.c_int,                     # security level
    ctypes.POINTER(ctypes.c_ubyte),   # live feature
    ctypes.POINTER(ctypes.c_ubyte),   # enrolled template
    ctypes.POINTER(ctypes.c_int),     # out: score
    ctypes.POINTER(ctypes.c_int),     # out: result (1=match, 0=no match)
]

# ── Global state ──────────────────────────────────────────────────────────────

_handle     = ctypes.c_void_p(None)
_img_width  = 160    # default for FAP20; updated by GetImageInfo
_img_height = 160

# ── SDK lifecycle ─────────────────────────────────────────────────────────────

def _sdk_init():
    global _handle, _img_width, _img_height

    ret = sdk.ARAFPSCAN_GlobalInit()
    # -115 = "already initialised" — safe to ignore
    if ret not in (0, -115):
        raise RuntimeError(f"GlobalInit failed: {ret}")

    count = ctypes.c_int(0)
    ret = sdk.ARAFPSCAN_GetDeviceCount(ctypes.byref(count))
    if ret != 0:
        raise RuntimeError(f"GetDeviceCount failed: {ret}")
    if count.value == 0:
        raise RuntimeError("No ARATEK device found — is the A600 plugged in?")

    ret = sdk.ARAFPSCAN_OpenDevice(ctypes.byref(_handle), 0)
    # -117 = "already opened" — safe to ignore
    if ret not in (0, -117):
        raise RuntimeError(f"OpenDevice failed: {ret}")

    w = ctypes.c_int(0)
    h = ctypes.c_int(0)
    dpi = ctypes.c_int(0)
    sdk.ARAFPSCAN_GetImageInfo(_handle, ctypes.byref(w), ctypes.byref(h), ctypes.byref(dpi))
    if w.value > 0:
        _img_width  = w.value
        _img_height = h.value
    print(f"[OK]  Device open — image size {_img_width}x{_img_height}, {dpi.value} DPI")


def _sdk_free():
    sdk.ARAFPSCAN_CloseDevice(ctypes.byref(_handle))
    sdk.ARAFPSCAN_GlobalFree()


# ── Core helpers ──────────────────────────────────────────────────────────────

def _capture_feature():
    """
    Wait for a finger, capture raw image, extract feature.
    Returns a ctypes array of FEATURE_SIZE bytes.
    Raises RuntimeError on SDK error.
    """
    img_size = _img_width * _img_height
    raw_buf  = (ctypes.c_ubyte * img_size)()

    ret = sdk.ARAFPSCAN_CaptureRawData(_handle, CAPTURE_TIMEOUT, raw_buf)
    if ret != 0:
        raise RuntimeError(f"CaptureRawData failed (code {ret}). "
                           "Lift and re-place finger, or check device connection.")

    feat_buf = (ctypes.c_ubyte * FEATURE_SIZE)()
    ret = sdk.ARAFPSCAN_ExtractFeature(_handle, 0, feat_buf)
    if ret != 0:
        raise RuntimeError(f"ExtractFeature failed (code {ret}). "
                           "Finger quality too low — try again.")

    return feat_buf


# ── Flask app ─────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    """Check if the scanner is ready."""
    try:
        count = ctypes.c_int(0)
        sdk.ARAFPSCAN_GetDeviceCount(ctypes.byref(count))
        if count.value == 0:
            return jsonify({"status": "error", "message": "No device found"}), 503
        return jsonify({"status": "ok", "message": "Scanner ready", "devices": count.value})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.post("/enroll")
def enroll():
    """
    Capture 3 fingerprints and build a single robust template.

    The caller (browser) should instruct the user to place their finger 3 times.
    Each capture blocks for up to CAPTURE_TIMEOUT ms waiting for a finger.

    Response 200: { "template": "<base64>", "captures": 3 }
    Response 500: { "error": "..." }
    """
    features = []

    for i in range(3):
        print(f"[ENROLL] Waiting for capture {i+1}/3 …")
        try:
            feat = _capture_feature()
            features.append(feat)
            print(f"[ENROLL] Capture {i+1}/3 OK")
        except RuntimeError as e:
            return jsonify({"error": f"Capture {i+1}/3 failed: {e}"}), 500

    # Combine 3 features into one durable template
    tpl_buf = (ctypes.c_ubyte * TEMPLATE_SIZE)()
    ret = sdk.ARAFPSCAN_GeneralizeTemplate(
        _handle,
        features[0], features[1], features[2],
        tpl_buf,
    )
    if ret != 0:
        return jsonify({"error": f"GeneralizeTemplate failed (code {ret})"}), 500

    template_b64 = base64.b64encode(bytes(tpl_buf)).decode()
    print("[ENROLL] Template generated OK")
    return jsonify({"template": template_b64, "captures": 3})


@app.post("/identify")
def identify():
    """
    Capture 1 fingerprint and match it against all enrolled client templates.

    Body (JSON):
      {
        "backendUrl": "http://localhost:3001",   // NFS backend
        "token": "<jwt>"                          // staff JWT
      }

    The agent calls GET /clients/fingerprints/templates on the backend,
    then calls ARAFPSCAN_Verify for each template until a match is found.

    Response 200: { "matched": true,  "clientId": "<uuid>", "score": <int> }
                  { "matched": false, "clientId": null,     "score": <int> }
    Response 500: { "error": "..." }
    """
    body        = request.get_json(force=True, silent=True) or {}
    backend_url = body.get("backendUrl", "http://localhost:3001").rstrip("/")
    token       = body.get("token", "")

    # 1. Capture live fingerprint feature
    print("[IDENTIFY] Waiting for finger …")
    try:
        live_feat = _capture_feature()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    print("[IDENTIFY] Captured OK")

    # 2. Fetch all enrolled templates from NFS backend
    try:
        resp = requests.get(
            f"{backend_url}/clients/fingerprints/templates",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        entries = resp.json()   # [{ clientId: "...", template: "<b64>" }, ...]
    except Exception as e:
        return jsonify({"error": f"Could not fetch templates: {e}"}), 500

    if not entries:
        print("[IDENTIFY] No enrolled templates in DB")
        return jsonify({"matched": False, "clientId": None, "score": 0})

    print(f"[IDENTIFY] Matching against {len(entries)} templates …")

    # 3. 1:N matching — stop at first match
    best_score  = 0
    best_client = None

    for entry in entries:
        tpl_b64  = entry.get("template")
        client_id = entry.get("clientId")
        if not tpl_b64 or not client_id:
            continue

        tpl_bytes = base64.b64decode(tpl_b64)
        tpl_buf   = (ctypes.c_ubyte * len(tpl_bytes))(*tpl_bytes)

        score  = ctypes.c_int(0)
        result = ctypes.c_int(0)
        ret = sdk.ARAFPSCAN_Verify(
            _handle, SECURITY_LEVEL,
            live_feat, tpl_buf,
            ctypes.byref(score),
            ctypes.byref(result),
        )

        if ret == 0 and result.value == 1:
            print(f"[IDENTIFY] Match → clientId={client_id}  score={score.value}")
            return jsonify({
                "matched":  True,
                "clientId": client_id,
                "score":    score.value,
            })

        if score.value > best_score:
            best_score  = score.value
            best_client = client_id

    print(f"[IDENTIFY] No match (best score={best_score})")
    return jsonify({"matched": False, "clientId": None, "score": best_score})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        _sdk_init()
    except RuntimeError as e:
        print(f"[ERR] {e}")
        sys.exit(1)

    print("[INFO] Fingerprint agent listening on http://localhost:9000")
    print("[INFO] Ctrl+C to stop\n")

    try:
        app.run(host="127.0.0.1", port=9000, debug=False, threaded=False)
    finally:
        print("\n[INFO] Shutting down …")
        _sdk_free()
