"""Minimal PE import-table reader — lists the DLLs a given DLL depends on.
No external packages. Run: py pe-deps.py <path-to-dll>
"""
import struct
import sys
import os


def read_imports(path):
    with open(path, "rb") as f:
        data = f.read()

    if data[:2] != b"MZ":
        raise ValueError("not a PE file")
    pe_off = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe_off:pe_off + 4] != b"PE\0\0":
        raise ValueError("bad PE signature")

    coff = pe_off + 4
    machine = struct.unpack_from("<H", data, coff)[0]
    num_sections = struct.unpack_from("<H", data, coff + 2)[0]
    opt_size = struct.unpack_from("<H", data, coff + 16)[0]
    opt_off = coff + 20
    magic = struct.unpack_from("<H", data, opt_off)[0]
    is_pe32_plus = magic == 0x20B  # PE32+ = 64-bit

    # Data directories start after the fixed optional header portion
    dd_off = opt_off + (112 if is_pe32_plus else 96)
    # Import directory = index 1
    import_rva = struct.unpack_from("<I", data, dd_off + 1 * 8)[0]

    # Section table (to map RVA -> file offset)
    sect_off = opt_off + opt_size
    sections = []
    for i in range(num_sections):
        base = sect_off + i * 40
        vaddr = struct.unpack_from("<I", data, base + 12)[0]
        vsize = struct.unpack_from("<I", data, base + 8)[0]
        raw_ptr = struct.unpack_from("<I", data, base + 20)[0]
        raw_size = struct.unpack_from("<I", data, base + 16)[0]
        sections.append((vaddr, max(vsize, raw_size), raw_ptr))

    def rva_to_off(rva):
        for vaddr, vsize, raw_ptr in sections:
            if vaddr <= rva < vaddr + vsize:
                return raw_ptr + (rva - vaddr)
        return None

    names = []
    idt = rva_to_off(import_rva)
    if idt is None:
        return machine, names
    while True:
        name_rva = struct.unpack_from("<I", data, idt + 12)[0]
        if name_rva == 0:
            break
        off = rva_to_off(name_rva)
        end = data.index(b"\0", off)
        names.append(data[off:end].decode("ascii", "replace"))
        idt += 20
    return machine, names


def find_on_path(name, extra_dirs):
    for d in extra_dirs + os.environ.get("PATH", "").split(os.pathsep):
        if d and os.path.isfile(os.path.join(d, name)):
            return os.path.join(d, name)
    for d in (r"C:\Windows\System32", r"C:\Windows\SysWOW64"):
        if os.path.isfile(os.path.join(d, name)):
            return os.path.join(d, name)
    return None


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else \
        r"C:\Program Files (x86)\NFS-Scanner\Native_DLLs\x64\dpfpdd.dll"
    machine, imports = read_imports(target)
    print(f"Target : {target}")
    print(f"Machine: {'x64' if machine == 0x8664 else 'x86' if machine == 0x14c else hex(machine)}")
    print(f"Imports {len(imports)} DLL(s):\n")
    extra = [os.path.dirname(target)]
    for name in imports:
        loc = find_on_path(name, extra)
        flag = "OK   " if loc else "MISSING"
        print(f"  [{flag}] {name}" + (f"  -> {loc}" if loc else ""))
