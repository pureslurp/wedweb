#!/usr/bin/env python3
"""
Import guests from a CSV file (see guests_import_template.csv in the repo root).

Pass 1: inserts each row (minus helper columns plus_one_first_name / plus_one_last_name).
Pass 2: sets plus_one_id using those helper columns and resolved UUIDs.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""
from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


INSERTABLE = {
    "first_name",
    "last_name",
    "nickname",
    "email",
    "address",
    "phone",
    "family",
    "post_rsvp_message",
    "rsvp",
    "meal_choice",
    "song_request",
    "dietary_notes",
    "general_notes",
}

HELPER = ("plus_one_first_name", "plus_one_last_name")


def norm(s: str) -> str:
    return (s or "").strip().lower()


def rest_request(
    method: str, path: str, body: dict | list | None = None
) -> tuple[int, Any]:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
        sys.exit(1)

    data = None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if body is not None:
        data = json.dumps(body).encode()

    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode()
        status = resp.status
    if not raw.strip():
        return status, None
    return status, json.loads(raw)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: import_guests.py path/to/guests.csv", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("CSV has no data rows.", file=sys.stderr)
        sys.exit(1)

    name_to_ids: dict[tuple[str, str], list[str]] = {}
    inserted_ids: list[str | None] = []

    for i, row in enumerate(rows):
        payload: dict[str, Any] = {}
        for k, v in row.items():
            if k is None or k in HELPER:
                continue
            if k not in INSERTABLE:
                continue
            if v is None or str(v).strip() == "":
                continue
            payload[k] = str(v).strip()

        if "first_name" not in payload or "last_name" not in payload:
            print(f"Row {i + 2}: missing first_name or last_name, skipping.", file=sys.stderr)
            inserted_ids.append(None)
            continue

        try:
            _, data = rest_request("POST", "/rest/v1/guests", payload)
        except urllib.error.HTTPError as e:
            print(e.read().decode(), file=sys.stderr)
            sys.exit(1)

        if not data or not isinstance(data, list) or not data[0].get("id"):
            print(f"Row {i + 2}: unexpected response: {data!r}", file=sys.stderr)
            sys.exit(1)

        gid = str(data[0]["id"])
        inserted_ids.append(gid)
        key = (norm(payload["first_name"]), norm(payload["last_name"]))
        name_to_ids.setdefault(key, []).append(gid)

    # Pass 2: plus-one links
    for i, row in enumerate(rows):
        gid = inserted_ids[i] if i < len(inserted_ids) else None
        if not gid:
            continue
        pfn = row.get("plus_one_first_name") or ""
        pln = row.get("plus_one_last_name") or ""
        if not norm(pfn) or not norm(pln):
            continue
        target_key = (norm(pfn), norm(pln))
        candidates = name_to_ids.get(target_key) or []
        if not candidates:
            print(
                f"Row {i + 2}: no guest found named {pfn.strip()} {pln.strip()} for plus_one link.",
                file=sys.stderr,
            )
            continue
        if len(candidates) > 1:
            print(
                f"Row {i + 2}: multiple guests named {pfn.strip()} {pln.strip()}; using first id.",
                file=sys.stderr,
            )
        plus_id = candidates[0]
        if plus_id == gid:
            print(f"Row {i + 2}: plus_one cannot reference self, skipping.", file=sys.stderr)
            continue
        patch = {"plus_one_id": plus_id}
        try:
            rest_request(
                "PATCH",
                f"/rest/v1/guests?id=eq.{gid}",
                patch,
            )
        except urllib.error.HTTPError as e:
            print(e.read().decode(), file=sys.stderr)
            sys.exit(1)

    print(f"Processed {len(rows)} CSV row(s).", file=sys.stderr)


if __name__ == "__main__":
    main()
