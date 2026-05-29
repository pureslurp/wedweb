#!/usr/bin/env python3
"""
Export all rows from public.guests to CSV on stdout.

Loads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the process environment,
or from a `.env` file at the repository root (without overriding existing exports).
"""
from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.request

from repo_env import load_repo_env

load_repo_env()


def main() -> None:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
        sys.exit(1)

    url = f"{base}/rest/v1/guests?select=*"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            rows = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        sys.exit(1)

    if not rows:
        w = csv.writer(sys.stdout)
        w.writerow(
            [
                "id",
                "first_name",
                "last_name",
                "email",
                "address",
                "phone",
                "post_rsvp_message",
                "plus_one_id",
                "rsvp",
                "meal_choice",
                "song_request",
                "dietary_notes",
                "general_notes",
                "created_at",
                "updated_at",
            ]
        )
        return

    fieldnames = sorted(rows[0].keys())
    w = csv.DictWriter(sys.stdout, fieldnames=fieldnames, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)


if __name__ == "__main__":
    main()
