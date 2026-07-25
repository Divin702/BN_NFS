"""
DigitalPersona U.are.U 4500 Fingerprint Agent
=============================================
Device : DigitalPersona U.are.U 4500  (VID_05BA / PID_000A, driver "usbdpfp")
SDK    : dpfpdd.dll  (capture)  +  dpfj.dll  (feature extraction & matching)
Runs   : Windows only, on the PC the reader is plugged into
Port   : http://localhost:9000

Architecture
------------
  * ENROLL   : capture finger 4x -> build one enrollment template (FMD) -> base64.
               The browser then POSTs that template to the NFS backend
               ( POST /clients/:id/fingerprint ).
  * IDENTIFY : capture finger 1x -> fetch every enrolled template from the backend
               ( GET /clients/fingerprints/templates ) -> run dpfj matching HERE
               -> return the matched clientId. (Matching happens in the agent,
               NOT in Node — the backend has no fingerprint engine.)

Setup
-----
  1. Reader driver already installed (usbdpfp) — confirmed working.
  2. The DigitalPersona SDK DLLs live in:
         C:\\Program Files (x86)\\NFS-Scanner\\Native_DLLs\\x64
     dpfpdd.dll ALSO needs its dependency  nex_sdk.dll  in that same folder.
     >>> If nex_sdk.dll is missing, capture cannot start — the agent will tell
         you exactly that on startup. Copy nex_sdk.dll (from the same SDK package
         these DLLs came from) next to dpfpdd.dll, OR install the official
         HID DigitalPersona U.are.U SDK.
  3. py -m pip install flask flask-cors requests
  4. py agent.py
"""

import base64
import ctypes
import os
import sys

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── Where the SDK DLLs live ──────────────────────────────────────────────────
# The agent needs a folder that contains BOTH dpfpdd.dll and dpfj.dll (and, for
# the OEM build, its dependency nex_sdk.dll). Set DP_SDK_DIR to override, else we
# search the usual spots and pick the first one where dpfpdd.dll actually loads.
_CANDIDATES = [
    os.environ.get("DP_SDK_DIR"),
    # Official U.are.U SDK / RTE install locations (preferred — self-contained)
    r"C:\Program Files\DigitalPersona\Bin",
    r"C:\Program Files (x86)\DigitalPersona\Bin",
    r"C:\Program Files\DigitalPersona\RTE\Bin",
    r"C:\Program Files (x86)\DigitalPersona\RTE\Bin",
    r"C:\Program Files\DigitalPersona\U.are.U SDK\Windows\Lib\x64",
    r"C:\Windows\System32",                       # RTE often copies runtime here
    # The OEM bundle shipped with this project (needs nex_sdk.dll)
    r"C:\Program Files (x86)\NFS-Scanner\Native_DLLs\x64",
    r"C:\Program Files (x86)\NFS-Scanner\Native_DLLs",
    r"C:\Program Files (x86)\NFS-Scanner",
]
DLL_DIR = next((d for d in _CANDIDATES
                if d and os.path.isfile(os.path.join(d, "dpfpdd.dll"))
                and os.path.isfile(os.path.join(d, "dpfj.dll"))), None)
if DLL_DIR is None:
    print("[ERR] Could not find a folder containing both dpfpdd.dll and dpfj.dll.")
    print("      Set DP_SDK_DIR to your DigitalPersona SDK folder, e.g.:")
    print('      set DP_SDK_DIR=C:\\path\\to\\sdk && py agent.py')
    sys.exit(1)
print(f"[INFO] Using SDK folder: {DLL_DIR}")

if hasattr(os, "add_dll_directory"):
    os.add_dll_directory(DLL_DIR)              # let dpfpdd.dll find its siblings
os.environ["PATH"] = DLL_DIR + os.pathsep + os.environ.get("PATH", "")

# ── Tunables ─────────────────────────────────────────────────────────────────
ENROLL_CAPTURES = 4        # typical number the SDK asks for (advisory, for the UI)
MAX_ENROLL_CAPTURES = 10   # safety stop; the SDK signals when it actually has enough
CAPTURE_TIMEOUT = 15000    # ms to wait for a finger per capture
MAX_FMD         = 2048     # bytes — generous buffer for one FMD template
MAX_IMG         = 500000   # bytes — generous buffer for one raw image
# Match threshold. dpfj_compare returns a dissimilarity score in 0..0x7FFFFFFF;
# false-match-rate = score / 0x7FFFFFFF. Lower score = better match.
# Target FAR of 1/100000 -> threshold ~= 0x7FFFFFFF / 100000.
PROBABILITY_ONE = 0x7FFFFFFF
TARGET_FAR      = 0.00001
MATCH_THRESHOLD = int(PROBABILITY_ONE * TARGET_FAR)   # ~21474

# ── SDK constants ────────────────────────────────────────────────────────────
DPFPDD_SUCCESS              = 0
DPFPDD_IMG_FMT_PIXEL_BUFFER = 0
DPFPDD_IMG_PROC_DEFAULT     = 0
DPFJ_FMD_ANSI_378_2004      = 0x001B0001
DPFJ_POSITION_UNKNOWN       = 0          # dpfj.h DPFJ_FINGER_POSITION
DPFJ_SUCCESS                = 0
# dpfj.h: DPERROR(err) = err | (0x05BA << 16)
DPFJ_E_MORE_DATA            = 0x0D | (0x05BA << 16)   # 0x05BA000D — "need more scans"
DPFPDD_MAX_DEVICE_NAME_LENGTH = 1024

# ── Load the DLLs (x64 -> __stdcall == __cdecl, so CDLL is fine) ─────────────
try:
    dpfj = ctypes.CDLL(os.path.join(DLL_DIR, "dpfj.dll"))
except OSError as e:
    print(f"[ERR] Cannot load dpfj.dll: {e}")
    sys.exit(1)

try:
    dpfpdd = ctypes.CDLL(os.path.join(DLL_DIR, "dpfpdd.dll"))
except OSError as e:
    print("[ERR] Cannot load dpfpdd.dll (the capture driver).")
    print(f"      {e}")
    print("      This almost always means its dependency  nex_sdk.dll  is not")
    print(f"      present in:  {DLL_DIR}")
    print("      Fix: copy nex_sdk.dll (from the same SDK package as these DLLs)")
    print("      into that folder, OR install the official DigitalPersona U.are.U SDK.")
    print("      (Run `py pe-deps.py` to list dpfpdd.dll's missing dependencies.)")
    sys.exit(1)

# ── dpfpdd structs ───────────────────────────────────────────────────────────
# NB: dpfpdd.h uses TWO different lengths — MAX_STR_LENGTH (128) inside
# dpfpdd_hw_descr, and MAX_DEVICE_NAME_LENGTH (1024) for dev_info.name.
# Using 1024 for both silently corrupts every field after descr.
DPFPDD_MAX_STR_LENGTH = 128

class DPFPDD_HW_DESCR(ctypes.Structure):
    _fields_ = [
        ("vendor_name",  ctypes.c_char * DPFPDD_MAX_STR_LENGTH),
        ("product_name", ctypes.c_char * DPFPDD_MAX_STR_LENGTH),
        ("serial_num",   ctypes.c_char * DPFPDD_MAX_STR_LENGTH),
    ]

class DPFPDD_HW_ID(ctypes.Structure):
    _fields_ = [("vendor_id", ctypes.c_ushort), ("product_id", ctypes.c_ushort)]

class DPFPDD_VER_INFO(ctypes.Structure):
    _fields_ = [
        ("major",       ctypes.c_int),
        ("minor",       ctypes.c_int),
        ("maintenance", ctypes.c_int),
    ]

class DPFPDD_HW_VERSION(ctypes.Structure):
    _fields_ = [
        ("hw_ver",  DPFPDD_VER_INFO),
        ("fw_ver",  DPFPDD_VER_INFO),
        ("bcd_rev", ctypes.c_ushort),
    ]

class DPFPDD_DEV_INFO(ctypes.Structure):
    _fields_ = [
        ("size",       ctypes.c_uint),
        ("name",       ctypes.c_char * DPFPDD_MAX_DEVICE_NAME_LENGTH),
        ("descr",      DPFPDD_HW_DESCR),
        ("id",         DPFPDD_HW_ID),
        ("ver",        DPFPDD_HW_VERSION),   # was missing -> misaligned the fields below
        ("modality",   ctypes.c_int),
        ("technology", ctypes.c_int),
    ]

class DPFPDD_IMAGE_INFO(ctypes.Structure):
    _fields_ = [
        ("size",   ctypes.c_uint),
        ("width",  ctypes.c_uint),
        ("height", ctypes.c_uint),
        ("res",    ctypes.c_uint),
        ("bpp",    ctypes.c_uint),
    ]

DPFPDD_MAX_RESOLUTIONS = 16   # header declares resolutions[1]; over-allocate to read them all

class DPFPDD_DEV_CAPS(ctypes.Structure):
    _fields_ = [
        ("size",                ctypes.c_uint),
        ("can_capture_image",   ctypes.c_int),
        ("can_stream_image",    ctypes.c_int),
        ("can_extract_features", ctypes.c_int),
        ("can_match",           ctypes.c_int),
        ("can_identify",        ctypes.c_int),
        ("has_fp_storage",      ctypes.c_int),
        ("indicator_type",      ctypes.c_uint),
        ("has_pwr_mgmt",        ctypes.c_int),
        ("has_calibration",     ctypes.c_int),
        ("piv_compliant",       ctypes.c_int),
        ("resolution_cnt",      ctypes.c_uint),
        ("resolutions",         ctypes.c_uint * DPFPDD_MAX_RESOLUTIONS),
    ]

class DPFPDD_CAPTURE_PARAM(ctypes.Structure):
    _fields_ = [
        ("size",       ctypes.c_uint),
        ("image_fmt",  ctypes.c_int),
        ("image_proc", ctypes.c_int),
        ("image_res",  ctypes.c_uint),
    ]

class DPFPDD_CAPTURE_RESULT(ctypes.Structure):
    _fields_ = [
        ("size",    ctypes.c_uint),
        ("success", ctypes.c_int),
        ("quality", ctypes.c_uint),
        ("score",   ctypes.c_uint),        # was missing -> sizeof was 4 bytes short,
                                           # so dpfpdd_capture rejected result.size
                                           # with DPFPDD_E_INVALID_PARAMETER (0x05BA0014)
        ("info",    DPFPDD_IMAGE_INFO),
    ]

DPFPDD_DEV = ctypes.c_void_p

# ── dpfpdd signatures ────────────────────────────────────────────────────────
dpfpdd.dpfpdd_init.restype = ctypes.c_int
dpfpdd.dpfpdd_init.argtypes = []
dpfpdd.dpfpdd_exit.restype = ctypes.c_int
dpfpdd.dpfpdd_exit.argtypes = []
dpfpdd.dpfpdd_query_devices.restype = ctypes.c_int
dpfpdd.dpfpdd_query_devices.argtypes = [ctypes.POINTER(ctypes.c_uint),
                                        ctypes.POINTER(DPFPDD_DEV_INFO)]
dpfpdd.dpfpdd_open.restype = ctypes.c_int
dpfpdd.dpfpdd_open.argtypes = [ctypes.c_char_p, ctypes.POINTER(DPFPDD_DEV)]
dpfpdd.dpfpdd_close.restype = ctypes.c_int
dpfpdd.dpfpdd_close.argtypes = [DPFPDD_DEV]
dpfpdd.dpfpdd_get_device_capabilities.restype = ctypes.c_int
dpfpdd.dpfpdd_get_device_capabilities.argtypes = [DPFPDD_DEV,
                                                  ctypes.POINTER(DPFPDD_DEV_CAPS)]
dpfpdd.dpfpdd_capture.restype = ctypes.c_int
dpfpdd.dpfpdd_capture.argtypes = [
    DPFPDD_DEV,
    ctypes.POINTER(DPFPDD_CAPTURE_PARAM),
    ctypes.c_uint,                              # timeout ms
    ctypes.POINTER(DPFPDD_CAPTURE_RESULT),
    ctypes.POINTER(ctypes.c_uint),              # image_size in/out
    ctypes.POINTER(ctypes.c_ubyte),             # image buffer
]

# ── dpfj signatures (verified with dpfj-test.py) ─────────────────────────────
dpfj.dpfj_create_fmd_from_raw.restype = ctypes.c_int
dpfj.dpfj_create_fmd_from_raw.argtypes = [
    ctypes.c_void_p, ctypes.c_uint,             # image_data, image_size
    ctypes.c_uint, ctypes.c_uint, ctypes.c_uint,  # width, height, dpi
    ctypes.c_int,                               # finger_pos   <- was missing
    ctypes.c_uint,                              # cbeff_id     <- was missing
    ctypes.c_int,                               # fmd_type
    ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint),  # fmd, fmd_size
]
dpfj.dpfj_compare.restype = ctypes.c_int
dpfj.dpfj_compare.argtypes = [
    ctypes.c_int, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,
    ctypes.c_int, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,
    ctypes.POINTER(ctypes.c_uint),
]
dpfj.dpfj_start_enrollment.restype = ctypes.c_int
dpfj.dpfj_start_enrollment.argtypes = [ctypes.c_int]
dpfj.dpfj_add_to_enrollment.restype = ctypes.c_int
dpfj.dpfj_add_to_enrollment.argtypes = [
    ctypes.c_int, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,
]
dpfj.dpfj_create_enrollment_fmd.restype = ctypes.c_int
dpfj.dpfj_create_enrollment_fmd.argtypes = [ctypes.c_void_p,
                                            ctypes.POINTER(ctypes.c_uint)]
dpfj.dpfj_finish_enrollment.restype = ctypes.c_int
dpfj.dpfj_finish_enrollment.argtypes = []

# ── Global device state ──────────────────────────────────────────────────────
_dev = DPFPDD_DEV(None)

# Capture resolution, in DPI. NEVER hardcode this: the U.are.U 4500 advertises
# exactly one supported resolution (700), and passing anything else — 500, or the
# "512" you might expect from the datasheet — makes dpfpdd_capture fail with
# DPFPDD_E_INVALID_PARAMETER (0x05BA0014). Filled in from the reader at startup.
_capture_res = 0


def _sdk_init():
    """Init driver, find the reader, open it. Raises RuntimeError with a clear
    message so the browser/user knows exactly what to fix."""
    global _dev

    rc = dpfpdd.dpfpdd_init()
    if rc != DPFPDD_SUCCESS:
        raise RuntimeError(f"dpfpdd_init failed (code 0x{rc:08X})")

    # Two-pass query: first get the count, then fill the array.
    count = ctypes.c_uint(0)
    dpfpdd.dpfpdd_query_devices(ctypes.byref(count), None)
    if count.value == 0:
        raise RuntimeError("No DigitalPersona reader found — is the 4500 plugged in?")

    arr = (DPFPDD_DEV_INFO * count.value)()
    for i in range(count.value):
        arr[i].size = ctypes.sizeof(DPFPDD_DEV_INFO)
    rc = dpfpdd.dpfpdd_query_devices(ctypes.byref(count), arr)
    if rc != DPFPDD_SUCCESS:
        raise RuntimeError(f"dpfpdd_query_devices failed (code 0x{rc:08X})")

    dev_name = arr[0].name                       # bytes; the instance path
    rc = dpfpdd.dpfpdd_open(dev_name, ctypes.byref(_dev))
    if rc != DPFPDD_SUCCESS:
        raise RuntimeError(f"dpfpdd_open failed (code 0x{rc:08X})")

    print(f"[OK]  Reader opened: "
          f"{arr[0].descr.product_name.decode(errors='replace').strip()}")

    # Ask the reader which resolutions it actually supports and use the first one.
    global _capture_res
    caps = DPFPDD_DEV_CAPS()
    caps.size = ctypes.sizeof(DPFPDD_DEV_CAPS)
    rc = dpfpdd.dpfpdd_get_device_capabilities(_dev, ctypes.byref(caps))
    if rc != DPFPDD_SUCCESS:
        raise RuntimeError(f"dpfpdd_get_device_capabilities failed — {_dpfpdd_err(rc)}")
    if caps.resolution_cnt == 0:
        raise RuntimeError("Reader reports no supported capture resolutions.")

    supported = [caps.resolutions[i]
                 for i in range(min(caps.resolution_cnt, DPFPDD_MAX_RESOLUTIONS))]
    _capture_res = supported[0]
    print(f"[OK]  Capture resolution: {_capture_res} dpi (reader supports {supported})")


def _sdk_free():
    if _dev:
        dpfpdd.dpfpdd_close(_dev)
    dpfpdd.dpfpdd_exit()


# Error/quality decoding — dpfpdd.h: DPERROR(err) = err | (0x05BA << 16)
_DPFPDD_ERRORS = {
    0x0a: "not implemented",
    0x0b: "generic SDK failure",
    0x0c: "no data",
    0x0d: "more data needed (buffer too small)",
    0x14: "invalid parameter — a ctypes struct layout does not match dpfpdd.h "
          "(check the `size` fields); this is a code bug, not a finger problem",
    0x15: "invalid device — the reader handle is stale; unplug/replug or restart the agent",
    0x1e: "device busy — another program holds the reader",
    0x1f: "device failure — unplug and replug the reader",
    0x21: "PAD (liveness) library missing",
    0x22: "PAD data missing",
    0x23: "PAD license missing or invalid",
    0x24: "PAD failure",
}

# dpfpdd.h DPFPDD_QUALITY_* bit flags (0 == good)
_QUALITY_FLAGS = [
    (1 << 0,  "timed out — no finger detected"),
    (1 << 1,  "capture canceled"),
    (1 << 2,  "no finger detected"),
    (1 << 3,  "fake finger detected"),
    (1 << 4,  "finger too far left"),
    (1 << 5,  "finger too far right"),
    (1 << 6,  "finger too high"),
    (1 << 7,  "finger too low"),
    (1 << 8,  "finger off centre"),
    (1 << 9,  "scan skewed"),
    (1 << 10, "scan too short"),
    (1 << 11, "scan too long"),
    (1 << 12, "swipe too slow"),
    (1 << 13, "swipe too fast"),
    (1 << 14, "wrong swipe direction"),
    (1 << 15, "reader needs cleaning"),
]


# dpfj.h shares the 0x05BA facility but has its OWN codes above 0x14 —
# do not decode dpfj results with the dpfpdd table.
_DPFJ_ERRORS = {
    0x0a:  "not implemented",
    0x0b:  "feature extraction failed — the image had no usable ridge detail",
    0x0c:  "no data",
    # NB: context-dependent. From dpfj_add_to_enrollment this means "more scans
    # needed" and is NOT an error — that path handles it before reaching here.
    0x0d:  "more data needed (or the supplied buffer was too small)",
    0x14:  "invalid parameter — a dpfj call signature does not match dpfj.h; "
           "this is a code bug, not a finger problem",
    0x65:  "invalid fingerprint image",
    0x66:  "too small an area of the finger was on the reader — press the pad of "
           "your finger flat across the whole sensor and hold still",
    0xc9:  "invalid or corrupt template (FMD)",
    0x12d: "enrolment already in progress",
    0x12e: "enrolment was not started",
    0x12f: "enrolment not ready — more captures needed",
    0x130: "these scans do not look like the same finger — start the enrolment again",
}


def _dpfj_err(rc: int) -> str:
    if (rc >> 16) & 0xFFFF == 0x05BA:
        low = rc & 0xFFFF
        if low in _DPFJ_ERRORS:
            return f"{_DPFJ_ERRORS[low]} (code 0x{rc:08X})"
    return f"unknown dpfj error (code 0x{rc:08X})"


def _dpfpdd_err(rc: int) -> str:
    """Human-readable dpfpdd error, so the UI never says 're-place finger' for a code bug."""
    if (rc >> 16) & 0xFFFF == 0x05BA:
        low = rc & 0xFFFF
        if low in _DPFPDD_ERRORS:
            return f"{_DPFPDD_ERRORS[low]} (code 0x{rc:08X})"
    return f"unknown SDK error (code 0x{rc:08X})"


def _quality_msg(quality: int) -> str:
    reasons = [txt for bit, txt in _QUALITY_FLAGS if quality & bit]
    if not reasons:
        return f"capture rejected (quality 0x{quality:08X}) — try again"
    return "capture rejected: " + ", ".join(reasons)


def _capture_fmd():
    """Wait for a finger, capture a raw image, extract one FMD template.
    Returns a bytes object (the FMD). Raises RuntimeError on any SDK error."""
    param = DPFPDD_CAPTURE_PARAM()
    param.size       = ctypes.sizeof(DPFPDD_CAPTURE_PARAM)
    param.image_fmt  = DPFPDD_IMG_FMT_PIXEL_BUFFER
    param.image_proc = DPFPDD_IMG_PROC_DEFAULT
    param.image_res  = _capture_res               # from the reader, not hardcoded

    result = DPFPDD_CAPTURE_RESULT()
    result.size = ctypes.sizeof(DPFPDD_CAPTURE_RESULT)
    result.info.size = ctypes.sizeof(DPFPDD_IMAGE_INFO)

    img_buf  = (ctypes.c_ubyte * MAX_IMG)()
    img_size = ctypes.c_uint(MAX_IMG)

    rc = dpfpdd.dpfpdd_capture(_dev, ctypes.byref(param), CAPTURE_TIMEOUT,
                               ctypes.byref(result), ctypes.byref(img_size), img_buf)
    if rc != DPFPDD_SUCCESS:
        raise RuntimeError(f"capture failed — {_dpfpdd_err(rc)}")
    if result.success == 0:
        raise RuntimeError(_quality_msg(result.quality))

    # Extract the FMD (minutiae template) from the raw image.
    fmd     = (ctypes.c_ubyte * MAX_FMD)()
    fmd_len = ctypes.c_uint(MAX_FMD)
    rc = dpfj.dpfj_create_fmd_from_raw(
        img_buf, img_size.value,
        result.info.width, result.info.height, result.info.res,
        DPFJ_POSITION_UNKNOWN,      # finger_pos — we don't track which finger
        0,                          # cbeff_id — 0 is the documented default
        DPFJ_FMD_ANSI_378_2004, fmd, ctypes.byref(fmd_len))
    if rc != DPFJ_SUCCESS:
        raise RuntimeError(_dpfj_err(rc))

    return bytes(fmd[:fmd_len.value])


def _compare(live_fmd: bytes, enrolled_fmd: bytes) -> int:
    """Return dpfj dissimilarity score (lower = better). -1 on error."""
    lb = (ctypes.c_ubyte * len(live_fmd)).from_buffer_copy(live_fmd)
    eb = (ctypes.c_ubyte * len(enrolled_fmd)).from_buffer_copy(enrolled_fmd)
    score = ctypes.c_uint(0)
    rc = dpfj.dpfj_compare(
        DPFJ_FMD_ANSI_378_2004, lb, len(live_fmd), 0,
        DPFJ_FMD_ANSI_378_2004, eb, len(enrolled_fmd), 0,
        ctypes.byref(score))
    if rc != DPFJ_SUCCESS:
        return -1
    return score.value


# ── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*",
                             "methods": ["GET", "POST", "OPTIONS"],
                             "allow_headers": ["Content-Type", "Authorization"]}})


@app.get("/health")
def health():
    return jsonify({"status": "ok", "message": "DigitalPersona agent ready"})


@app.post("/enroll")
def enroll():
    """Capture ENROLL_CAPTURES fingerprints -> one enrollment template.
    Response 200: { "template": "<base64>", "captures": N }"""
    rc = dpfj.dpfj_start_enrollment(DPFJ_FMD_ANSI_378_2004)
    if rc != DPFJ_SUCCESS:
        return jsonify({"error": f"start_enrollment failed — {_dpfj_err(rc)}"}), 500

    try:
        # The SDK decides how many samples it needs — it is NOT a fixed count.
        # dpfj_add_to_enrollment returns:
        #   DPFJ_E_MORE_DATA -> good scan, keep going
        #   DPFJ_SUCCESS     -> enough samples, enrolment is ready
        # Treating MORE_DATA as an error aborts enrolment on the first scan.
        taken = 0
        ready = False
        while taken < MAX_ENROLL_CAPTURES:
            print(f"[ENROLL] capture {taken + 1} (need ~{ENROLL_CAPTURES}) — place finger …")
            fmd = _capture_fmd()
            buf = (ctypes.c_ubyte * len(fmd)).from_buffer_copy(fmd)
            rc = dpfj.dpfj_add_to_enrollment(DPFJ_FMD_ANSI_378_2004, buf, len(fmd), 0)
            taken += 1

            if rc == DPFJ_SUCCESS:
                print(f"[ENROLL] capture {taken} OK — enrolment ready")
                ready = True
                break
            if rc == DPFJ_E_MORE_DATA:
                print(f"[ENROLL] capture {taken} OK — more needed")
                continue

            dpfj.dpfj_finish_enrollment()
            return jsonify({"error": f"add_to_enrollment failed — {_dpfj_err(rc)}"}), 500

        if not ready:
            dpfj.dpfj_finish_enrollment()
            return jsonify({"error":
                f"Enrolment did not complete after {taken} scans. Use the same "
                f"finger each time and cover the whole sensor."}), 500

        out     = (ctypes.c_ubyte * MAX_FMD)()
        out_len = ctypes.c_uint(MAX_FMD)
        rc = dpfj.dpfj_create_enrollment_fmd(out, ctypes.byref(out_len))
        dpfj.dpfj_finish_enrollment()
        if rc != DPFJ_SUCCESS:
            return jsonify({"error": f"create_enrollment_fmd failed — {_dpfj_err(rc)}"}), 500

        template = base64.b64encode(bytes(out[:out_len.value])).decode()
        print(f"[ENROLL] template built OK ({out_len.value} bytes, {taken} scans)")
        return jsonify({"template": template, "captures": taken})
    except RuntimeError as e:
        dpfj.dpfj_finish_enrollment()
        return jsonify({"error": str(e)}), 500


@app.post("/identify")
def identify():
    """Capture 1 finger, match against all enrolled templates from the backend.
    Body: { "backendUrl": "...", "token": "<jwt>" }
    Response: { "matched": bool, "clientId": str|None, "score": int }"""
    body        = request.get_json(force=True, silent=True) or {}
    backend_url = body.get("backendUrl", "http://localhost:3001").rstrip("/")
    token       = body.get("token", "")

    try:
        print("[IDENTIFY] place finger …")
        live = _capture_fmd()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    try:
        resp = requests.get(f"{backend_url}/clients/fingerprints/templates",
                            headers={"Authorization": f"Bearer {token}"}, timeout=10)
        resp.raise_for_status()
        payload = resp.json()
        entries = payload.get("data", payload) if isinstance(payload, dict) else payload
    except Exception as e:
        return jsonify({"error": f"could not fetch templates: {e}"}), 500

    # `enrolled` lets the UI distinguish "nobody is enrolled yet" from
    # "scanned fine, but this finger isn't a match" — very different problems.
    if not entries:
        return jsonify({"matched": False, "clientId": None, "score": 0, "enrolled": 0})

    print(f"[IDENTIFY] matching against {len(entries)} template(s) …")
    best_score  = PROBABILITY_ONE + 1     # lower is better
    best_client = None
    for entry in entries:
        tpl_b64   = entry.get("template")
        client_id = entry.get("clientId")
        if not tpl_b64 or not client_id:
            continue
        try:
            enrolled = base64.b64decode(tpl_b64)
        except Exception:
            continue
        score = _compare(live, enrolled)
        if score < 0:
            continue
        if score < best_score:
            best_score  = score
            best_client = client_id

    if best_client is not None and best_score <= MATCH_THRESHOLD:
        print(f"[IDENTIFY] MATCH clientId={best_client} score={best_score}")
        return jsonify({"matched": True, "clientId": best_client,
                        "score": best_score, "enrolled": len(entries)})

    print(f"[IDENTIFY] no match (best score={best_score})")
    return jsonify({"matched": False, "clientId": None,
                    "score": best_score if best_client else 0,
                    "enrolled": len(entries)})


if __name__ == "__main__":
    try:
        _sdk_init()
    except RuntimeError as e:
        print(f"[ERR] {e}")
        sys.exit(1)

    print("[INFO] DigitalPersona agent listening on http://localhost:9000")
    print("[INFO] Ctrl+C to stop\n")
    try:
        app.run(host="127.0.0.1", port=9000, debug=False, threaded=False)
    finally:
        print("\n[INFO] shutting down …")
        _sdk_free()
