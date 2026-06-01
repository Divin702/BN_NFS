"""
Run this on Windows to find the ARATEK SDK DLL and its exported functions.
It will print exactly what to put in agent.py.

Usage:
  python find-sdk.py
"""

import os
import sys
import ctypes
import glob

# ── 1. Search common ARATEK SDK install locations ─────────────────────────────

search_dirs = [
    r"C:\Program Files\ARATEK",
    r"C:\Program Files (x86)\ARATEK",
    r"C:\ARATEK",
    r"C:\Program Files\AratekFP",
    r"C:\Program Files (x86)\AratekFP",
    r".",           # current directory
    r"..",          # parent directory
]

print("=" * 60)
print("  ARATEK SDK Finder")
print("=" * 60)

# ── 2. Find all .dll files in those locations ──────────────────────────────────

found_dlls = []
for d in search_dirs:
    if os.path.isdir(d):
        for dll in glob.glob(os.path.join(d, "**", "*.dll"), recursive=True):
            found_dlls.append(dll)

if not found_dlls:
    print("\n[!] No DLLs found in common locations.")
    print("    Please tell me where you installed the ARATEK SDK")
    print("    e.g. C:\\MySDK\\lib\\fingerprint.dll")
    sys.exit(1)

print(f"\nFound {len(found_dlls)} DLL(s):\n")
for dll in found_dlls:
    print(f"  {dll}")

# ── 3. Try to load each DLL and get exports ────────────────────────────────────

print("\n" + "=" * 60)
print("  Checking which DLLs load successfully:")
print("=" * 60)

loadable = []
for dll_path in found_dlls:
    try:
        lib = ctypes.CDLL(dll_path)
        print(f"\n  ✓ LOADED: {dll_path}")
        loadable.append((dll_path, lib))
    except Exception as e:
        print(f"  ✗ Failed: {os.path.basename(dll_path)} — {e}")

if not loadable:
    print("\n[!] None of the DLLs loaded. SDK may not be installed correctly.")
    sys.exit(1)

# ── 4. Try common ARATEK function names on each loaded DLL ────────────────────

common_funcs = [
    # Init / Open
    "AFE_Init", "AFE_Open", "AFE_InitDevice", "Init",
    "ABS_Open", "ABS_Init",
    "FP_Init", "FP_Open",
    "ZKFPM_Init", "ZKFPMInit",
    # Capture
    "AFE_Capture", "AFE_GetImage", "AFE_Enroll",
    "ABS_Capture",
    "FP_Capture", "FP_GetImage",
    # Match
    "AFE_Match", "AFE_Verify", "AFE_Identify",
    "ABS_VerifyMatch",
    "FP_Match", "FP_Verify",
    # Close
    "AFE_Close", "AFE_Free", "AFE_CloseDevice",
    "ABS_Close",
    "FP_Close",
]

print("\n" + "=" * 60)
print("  Functions found in loaded DLLs:")
print("=" * 60)

for dll_path, lib in loadable:
    print(f"\n  DLL: {os.path.basename(dll_path)}")
    found_funcs = []
    for fn in common_funcs:
        try:
            getattr(lib, fn)
            found_funcs.append(fn)
        except AttributeError:
            pass
    if found_funcs:
        print(f"  Found: {', '.join(found_funcs)}")
        print(f"\n  *** SET THIS IN agent.py ***")
        print(f"  ARATEK_DLL = r\"{dll_path}\"")
    else:
        print("  No known functions found in this DLL.")

print("\n" + "=" * 60)
print("  Share the output above so I can update agent.py for you.")
print("=" * 60)
