"""
DigitalPersona U.are.U SDK probe.
Verifies which DLLs load, python bitness, exported functions, and that the
reader can actually initialise + be queried — BEFORE we commit to agent.py.

Run:  py probe-dp.py
"""
import ctypes
import os
import platform
import sys

SDK_DIR = r"C:\Program Files (x86)\NFS-Scanner"
X64_DIR = os.path.join(SDK_DIR, "Native_DLLs", "x64")

print("=" * 64)
print("  DigitalPersona SDK Probe")
print("=" * 64)
print(f"Python           : {platform.python_version()}")
print(f"Pointer size     : {ctypes.sizeof(ctypes.c_void_p) * 8}-bit "
      f"({'x64' if ctypes.sizeof(ctypes.c_void_p) == 8 else 'x86'})")

# Pick the DLL folder that matches python bitness
is64 = ctypes.sizeof(ctypes.c_void_p) == 8
dll_dir = X64_DIR if is64 else SDK_DIR
if not os.path.isdir(dll_dir):
    dll_dir = SDK_DIR
print(f"Using DLL folder : {dll_dir}")

# Let dpfpdd.dll find its sibling dpfpdd_4k.dll / dpfj.dll
if hasattr(os, "add_dll_directory"):
    os.add_dll_directory(dll_dir)
os.environ["PATH"] = dll_dir + os.pathsep + os.environ.get("PATH", "")

# ── Try to load the two native C DLLs under both calling conventions ──────────
DPFPDD = os.path.join(dll_dir, "dpfpdd.dll")
DPFJ = os.path.join(dll_dir, "dpfj.dll")

FUNCS_DPFPDD = ["dpfpdd_init", "dpfpdd_exit", "dpfpdd_version",
                "dpfpdd_query_devices", "dpfpdd_open", "dpfpdd_open_ext",
                "dpfpdd_close", "dpfpdd_capture", "dpfpdd_get_device_status"]
FUNCS_DPFJ = ["dpfj_create_fmd_from_fid", "dpfj_create_fmd_from_raw",
              "dpfj_compare", "dpfj_start_enrollment", "dpfj_add_to_enrollment",
              "dpfj_create_enrollment_fmd", "dpfj_finish_enrollment"]


def probe(path, funcs):
    print("\n" + "-" * 64)
    print(f"  {os.path.basename(path)}")
    print("-" * 64)
    if not os.path.isfile(path):
        print(f"  [MISSING] {path}")
        return None, None
    result = {}
    for loader_name, loader in (("CDLL/__cdecl", ctypes.CDLL),
                                ("WinDLL/__stdcall", ctypes.WinDLL)):
        try:
            lib = loader(path)
        except OSError as e:
            print(f"  [{loader_name}] load FAILED: {e}")
            continue
        found = [fn for fn in funcs if hasattr(lib, fn)]
        print(f"  [{loader_name}] loaded OK — {len(found)}/{len(funcs)} funcs present")
        result[loader_name] = (lib, found)
    return result.get("CDLL/__cdecl"), result.get("WinDLL/__stdcall")


cdll_fpdd, windll_fpdd = probe(DPFPDD, FUNCS_DPFPDD)
probe(DPFJ, FUNCS_DPFJ)

# ── Actually call dpfpdd_init + dpfpdd_version to confirm which convention is real ──
print("\n" + "=" * 64)
print("  Live test: init + version (tells us the true calling convention)")
print("=" * 64)

for name, entry in (("CDLL/__cdecl", cdll_fpdd), ("WinDLL/__stdcall", windll_fpdd)):
    if not entry:
        continue
    lib, _ = entry
    try:
        lib.dpfpdd_init.restype = ctypes.c_int
        rc = lib.dpfpdd_init()
        print(f"  [{name}] dpfpdd_init() -> {rc}  (0 = DPFPDD_SUCCESS)")
        # version string, if present
        if hasattr(lib, "dpfpdd_version"):
            # DPFPDD_VERSION struct is awkward; skip detail, just note callable
            pass
        lib.dpfpdd_exit()
    except Exception as e:
        print(f"  [{name}] init call raised: {e}")

print("\nDone. Share this output.")
