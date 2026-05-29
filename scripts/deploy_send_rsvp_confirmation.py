#!/usr/bin/env python3
"""Deploy the send-rsvp-confirmation Edge Function via Supabase Management API.

Requires a personal access token (not the anon or service_role DB keys):
  https://supabase.com/dashboard/account/tokens

Usage:
  export SUPABASE_ACCESS_TOKEN='sbp_...'
  python3 scripts/deploy_send_rsvp_confirmation.py

Optional:
  SUPABASE_PROJECT_REF   default: oxgonfjfqicvnzsakxcx (WedWeb)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FN_FILE = ROOT / "supabase/functions/send-rsvp-confirmation/index.ts"


def main() -> int:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        print(
            "Missing SUPABASE_ACCESS_TOKEN. Create one under Account → Access Tokens, then export it.",
            file=sys.stderr,
        )
        return 1

    ref = os.environ.get("SUPABASE_PROJECT_REF", "oxgonfjfqicvnzsakxcx").strip()
    if not FN_FILE.is_file():
        print(f"Missing function file: {FN_FILE}", file=sys.stderr)
        return 1

    metadata = json.dumps(
        {
            "entrypoint_path": "index.ts",
            "name": "send-rsvp-confirmation",
            "verify_jwt": False,
        },
        separators=(",", ":"),
    )

    url = f"https://api.supabase.com/v1/projects/{ref}/functions/deploy?slug=send-rsvp-confirmation"
    cmd = [
        "curl",
        "-sS",
        "-w",
        "\nHTTP_STATUS:%{http_code}\n",
        "-X",
        "POST",
        url,
        "-H",
        f"Authorization: Bearer {token}",
        "-F",
        f"metadata={metadata}",
        "-F",
        f"file@{FN_FILE};filename=index.ts",
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.stdout:
        print(proc.stdout.rstrip())
    if proc.stderr:
        print(proc.stderr, file=sys.stderr, end="")
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
