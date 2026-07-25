"""
Validate dpfj.dll (DigitalPersona FingerJet) binding signatures without a live
capture. We can't make a *valid* FMD from a synthetic image (no real ridges),
but a clean non-zero return code (instead of an access-violation crash) proves
the ctypes signatures + calling convention are correct.

Run: py dpfj-test.py
"""
import ctypes
import os

SDK_DIR = r"C:\Program Files (x86)\NFS-Scanner"
X64_DIR = os.path.join(SDK_DIR, "Native_DLLs", "x64")
if hasattr(os, "add_dll_directory"):
    os.add_dll_directory(X64_DIR)
os.environ["PATH"] = X64_DIR + os.pathsep + os.environ.get("PATH", "")

dpfj = ctypes.CDLL(os.path.join(X64_DIR, "dpfj.dll"))

# ── Constants ────────────────────────────────────────────────────────────────
DPFJ_FMD_ANSI_378_2004 = 0x001B0001
DPFJ_PROBABILITY_ONE = 0x7FFFFFFF
MAX_FMD = 2048

# ── Signatures ───────────────────────────────────────────────────────────────
dpfj.dpfj_create_fmd_from_raw.restype = ctypes.c_int
dpfj.dpfj_create_fmd_from_raw.argtypes = [
    ctypes.c_void_p, ctypes.c_uint,           # image_data, image_size
    ctypes.c_uint, ctypes.c_uint, ctypes.c_uint,  # width, height, dpi
    ctypes.c_int,                             # fmd_format
    ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint),  # fmd out, fmd_size in/out
]

dpfj.dpfj_compare.restype = ctypes.c_int
dpfj.dpfj_compare.argtypes = [
    ctypes.c_int, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,  # fmd1
    ctypes.c_int, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint,  # fmd2
    ctypes.POINTER(ctypes.c_uint),                                # score
]

dpfj.dpfj_start_enrollment.restype = ctypes.c_int
dpfj.dpfj_start_enrollment.argtypes = [ctypes.c_int]
dpfj.dpfj_finish_enrollment.restype = ctypes.c_int
dpfj.dpfj_finish_enrollment.argtypes = []

print("dpfj.dll bound OK. Testing calls (non-zero = expected, no crash = binding OK):\n")

# 1) create_fmd_from_raw on a blank 320x480 500dpi image — expect a clean error
W, H, DPI = 320, 480, 500
img = (ctypes.c_ubyte * (W * H))(*([128] * (W * H)))  # flat grey, no ridges
fmd = (ctypes.c_ubyte * MAX_FMD)()
fmd_len = ctypes.c_uint(MAX_FMD)
rc = dpfj.dpfj_create_fmd_from_raw(
    img, W * H, W, H, DPI, DPFJ_FMD_ANSI_378_2004, fmd, ctypes.byref(fmd_len)
)
print(f"  dpfj_create_fmd_from_raw(blank) -> {rc}  (nonzero expected: no minutiae)")

# 2) start/finish enrollment round-trip — should return 0
rc1 = dpfj.dpfj_start_enrollment(DPFJ_FMD_ANSI_378_2004)
rc2 = dpfj.dpfj_finish_enrollment()
print(f"  dpfj_start_enrollment -> {rc1}   dpfj_finish_enrollment -> {rc2}  (0 = success)")

# 3) compare two empty buffers — expect clean non-zero (invalid fmd), no crash
score = ctypes.c_uint(0)
b1 = (ctypes.c_ubyte * MAX_FMD)()
b2 = (ctypes.c_ubyte * MAX_FMD)()
rc = dpfj.dpfj_compare(
    DPFJ_FMD_ANSI_378_2004, b1, MAX_FMD, 0,
    DPFJ_FMD_ANSI_378_2004, b2, MAX_FMD, 0,
    ctypes.byref(score),
)
print(f"  dpfj_compare(empty,empty) -> {rc}  score={score.value}  (nonzero expected)")

print("\nIf you see numbers above and no crash, the matching bindings are correct.")
