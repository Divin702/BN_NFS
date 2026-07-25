# DigitalPersona Fingerprint Agent

A small local HTTP service (Flask, port **9000**) that captures fingerprints from a
**DigitalPersona U.are.U 4500** reader and does 1:N matching, for the NFS backend.

## Why an agent?

Browsers can't talk to USB fingerprint readers directly, and the NestJS backend has
no fingerprint engine. So this agent runs on the Windows PC with the reader:

- **Capture** uses `dpfpdd.dll` (device) + `dpfj.dll` (feature extraction).
- **Matching** happens here, in the agent, using `dpfj.dll`. The backend only stores
  and serves base64 templates — it does **not** compare fingerprints.

## Flow

| Step | Who calls | Endpoint | Result |
|------|-----------|----------|--------|
| Enroll | browser → agent | `POST http://localhost:9000/enroll` | `{ template: "<base64>" }` |
| Save   | browser → backend | `POST /clients/:id/fingerprint { template }` | stored on client |
| Identify | browser → agent | `POST http://localhost:9000/identify { backendUrl, token }` | `{ matched, clientId, score }` |

For identify, the agent fetches every enrolled template from
`GET /clients/fingerprints/templates` (needs a staff JWT) and matches locally.

## Setup

1. Reader driver (`usbdpfp`) — already installed and working.
2. SDK DLLs live in `C:\Program Files (x86)\NFS-Scanner\Native_DLLs\x64`.
   **`dpfpdd.dll` requires `nex_sdk.dll` in that same folder.** If it's missing the
   agent prints exactly that on startup — copy `nex_sdk.dll` from the SDK package
   these DLLs came from, or install the official HID DigitalPersona U.are.U SDK.
3. `py -m pip install -r requirements.txt`
4. `py agent.py`

## Diagnostics

- `py probe-dp.py`  — checks DLL load, bitness, exports, and reader init.
- `py pe-deps.py`   — lists a DLL's dependencies (shows the missing `nex_sdk.dll`).
- `py dpfj-test.py` — validates the matching-engine bindings (works today).

## Status

- ✅ Reader, driver, and matching engine (`dpfj.dll`) verified working.
- ⛔ **Capture is blocked until `nex_sdk.dll` is supplied** (see step 2). Everything
  else is ready — the agent runs the moment that DLL is in place.
