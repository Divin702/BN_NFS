"""
Mock Fingerprint Agent — for testing on Mac/Windows WITHOUT the ARATEK scanner.

Usage:
  pip install flask requests
  python mock-agent.py

What it does:
  - /status    → always returns ready
  - /capture   → returns a random fake template (each call is a different "finger")
  - /identify  → captures a fake template then fetches real templates from your
                 backend and returns the FIRST enrolled client it finds
                 (simulates a successful match so you can test the full UI flow)

Switch ALWAYS_MATCH = False to simulate "no match found".
"""

import base64
import os
import random

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

BACKEND_URL  = os.getenv("BACKEND_URL", "http://localhost:3001")
ALWAYS_MATCH = True   # set False to test "no client found" path

app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
}})


def fake_template() -> str:
    """Return a random 256-byte base64 string — simulates an ARATEK template."""
    raw = bytes(random.randint(0, 255) for _ in range(256))
    return base64.b64encode(raw).decode()


@app.get("/status")
def status():
    return jsonify({"ready": True, "message": "Mock scanner ready"})


@app.post("/capture")
def capture():
    """Simulate a fingerprint capture — returns a fake template + quality 85."""
    print("[mock] /capture called — returning fake template")
    return jsonify({"template": fake_template(), "quality": 85})


@app.post("/identify")
def identify():
    """
    Simulate identification:
      1. Generate a fake scan template.
      2. Fetch all enrolled client templates from the backend.
      3. If ALWAYS_MATCH=True, return the first enrolled client as a match.
         If ALWAYS_MATCH=False, return no match.
    """
    body        = request.get_json(force=True) or {}
    backend_url = body.get("backendUrl", BACKEND_URL)
    token       = body.get("token", "")

    print(f"[mock] /identify called  backend={backend_url}  always_match={ALWAYS_MATCH}")

    # Fetch enrolled templates from the real backend
    try:
        resp = requests.get(
            f"{backend_url}/clients/fingerprints/templates",
            headers={"Authorization": f"Bearer {token}"},
            timeout=8,
        )
        resp.raise_for_status()
        body = resp.json()
        # Backend wraps responses: { success: true, data: [...] }
        entries = body.get("data", body) if isinstance(body, dict) else body
        print(f"[mock] fetched {len(entries)} enrolled template(s) from backend")
    except Exception as e:
        print(f"[mock] could not reach backend: {e}")
        return jsonify({"error": f"Could not reach backend: {e}"}), 500

    if not entries or not ALWAYS_MATCH:
        print("[mock] returning: no match")
        return jsonify({"matched": False, "clientId": None, "score": 0})

    # Return the first enrolled client as the "match"
    best = entries[0]
    print(f"[mock] returning match: clientId={best['clientId']}")
    return jsonify({"matched": True, "clientId": best["clientId"], "score": 820})


if __name__ == "__main__":
    print("=" * 55)
    print("  Mock Fingerprint Agent")
    print(f"  Listening on  http://localhost:9000")
    print(f"  Backend URL   {BACKEND_URL}")
    print(f"  Always match  {ALWAYS_MATCH}")
    print("=" * 55)
    app.run(host="0.0.0.0", port=9000, debug=False)
