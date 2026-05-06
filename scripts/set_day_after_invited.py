#!/usr/bin/env python3
"""
Set `guests.day_after_invited` from a CSV (service role).

Two modes (auto-detected from headers):

1) Export sync — CSV from `export_guests.py`, plus a column you add in the sheet:
   - Required headers: `id`, `day_after_invite`
   - Each row: PATCH that guest so `day_after_invited` matches `day_after_invite`
     (true/false; blank counts as false). Keeps the database aligned with the sheet.

2) Invite list — minimal CSV of people to flag as invited:
   - `first_name`, `last_name` per row (optional `email` / `id` per row)
   - Sets `day_after_invited = true` for each match (does not set false for others).

Loads credentials from the environment or repo-root `.env` (see `repo_env.py`).
"""
from __future__ import annotations

import csv
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

from repo_env import load_repo_env

load_repo_env()


def norm(s: str) -> str:
    return (s or "").strip().lower()


def norm_email(s: str) -> str:
    return (s or "").strip().lower()


def parse_day_after_invite_cell(raw: str | None) -> bool:
    """Truth values for day_after_invite (export sync). Blank -> False."""
    if raw is None:
        return False
    s = str(raw).strip()
    if not s:
        return False
    low = s.lower()
    if low in ("true", "1", "yes", "y", "x", "t"):
        return True
    if low in ("false", "0", "no", "n", "f"):
        return False
    print(f"Warning: ambiguous boolean {raw!r}, treating as false.", file=sys.stderr)
    return False


def rest_request(
    method: str, path: str, body: dict[str, Any] | None = None
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
        "Prefer": "return=minimal",
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


def fetch_all_guests() -> list[dict[str, Any]]:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    url = f"{base}/rest/v1/guests?select=id,first_name,last_name,email,day_after_invited"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(req) as resp:
        rows = json.loads(resp.read().decode())
    return rows if isinstance(rows, list) else []


def index_guests(rows: list[dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    out: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for r in rows:
        fn = norm(str(r.get("first_name", "")))
        ln = norm(str(r.get("last_name", "")))
        out.setdefault((fn, ln), []).append(r)
    return out


def run_export_sync(
    rows: list[dict[str, str]], by_id: dict[str, dict[str, Any]]
) -> tuple[int, int, int]:
    """Returns (patched_count, skipped_unchanged, errors)."""
    patched = 0
    skipped = 0
    errors = 0
    for i, row in enumerate(rows):
        line_no = i + 2
        id_raw = (row.get("id") or "").strip()
        if not id_raw:
            print(f"Row {line_no}: missing id, skipping.", file=sys.stderr)
            errors += 1
            continue
        if id_raw not in by_id:
            print(f"Row {line_no}: no guest with id={id_raw}", file=sys.stderr)
            errors += 1
            continue
        want = parse_day_after_invite_cell(row.get("day_after_invite"))
        cur = by_id[id_raw].get("day_after_invited")
        # Normalize DB boolean vs missing
        cur_bool = cur is True
        if cur_bool == want:
            skipped += 1
            continue
        try:
            rest_request(
                "PATCH",
                f"/rest/v1/guests?id=eq.{id_raw}",
                {"day_after_invited": want},
            )
        except urllib.error.HTTPError as e:
            print(e.read().decode(), file=sys.stderr)
            errors += 1
            continue
        patched += 1
        print(
            f"Row {line_no}: id {id_raw} -> day_after_invited={want}",
            file=sys.stderr,
        )
    return patched, skipped, errors


def run_invite_list(
    rows: list[dict[str, str]],
    by_name: dict[tuple[str, str], list[dict[str, Any]]],
    by_id: dict[str, dict[str, Any]],
) -> tuple[int, int, int]:
    """Returns (updated, skipped_already_invited, errors)."""
    updated = 0
    skipped_already = 0
    errors = 0
    for i, row in enumerate(rows):
        line_no = i + 2
        id_raw = (row.get("id") or "").strip()
        if id_raw:
            if id_raw not in by_id:
                print(f"Row {line_no}: no guest with id={id_raw}", file=sys.stderr)
                errors += 1
                continue
            gid = id_raw
            if by_id[gid].get("day_after_invited"):
                skipped_already += 1
                print(
                    f"Row {line_no}: already invited (id {gid}), skipping.",
                    file=sys.stderr,
                )
                continue
            try:
                rest_request(
                    "PATCH",
                    f"/rest/v1/guests?id=eq.{gid}",
                    {"day_after_invited": True},
                )
            except urllib.error.HTTPError as e:
                print(e.read().decode(), file=sys.stderr)
                errors += 1
                continue
            updated += 1
            print(f"Row {line_no}: set day_after_invited for id {gid}", file=sys.stderr)
            continue

        fn = norm(row.get("first_name") or "")
        ln = norm(row.get("last_name") or "")
        if not fn or not ln:
            print(
                f"Row {line_no}: missing first_name or last_name (or use id).",
                file=sys.stderr,
            )
            errors += 1
            continue

        candidates = list(by_name.get((fn, ln), []))
        email_filter = norm_email(row.get("email") or "")
        if email_filter:
            candidates = [
                c
                for c in candidates
                if norm_email(str(c.get("email") or "")) == email_filter
            ]

        if len(candidates) == 0:
            print(
                f"Row {line_no}: no guest matching "
                f"'{row.get('first_name')}' '{row.get('last_name')}'"
                + (f" with email matching '{row.get('email')}'" if email_filter else ""),
                file=sys.stderr,
            )
            errors += 1
            continue

        if len(candidates) > 1:
            print(
                f"Row {line_no}: multiple guests named "
                f"'{row.get('first_name')}' '{row.get('last_name')}'. "
                "Add an 'email' column for this row, or an 'id' column. Candidates:",
                file=sys.stderr,
            )
            for c in candidates:
                em = c.get("email") or ""
                print(f"  id={c['id']} email={em!r}", file=sys.stderr)
            errors += 1
            continue

        g = candidates[0]
        gid = str(g["id"])
        if g.get("day_after_invited"):
            skipped_already += 1
            print(
                f"Row {line_no}: already invited (id {gid}), skipping.",
                file=sys.stderr,
            )
            continue

        try:
            rest_request(
                "PATCH",
                f"/rest/v1/guests?id=eq.{gid}",
                {"day_after_invited": True},
            )
        except urllib.error.HTTPError as e:
            print(e.read().decode(), file=sys.stderr)
            errors += 1
            continue

        updated += 1
        print(
            f"Row {line_no}: set day_after_invited for {g.get('first_name')} {g.get('last_name')} ({gid})",
            file=sys.stderr,
        )

    return updated, skipped_already, errors


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: set_day_after_invited.py path/to/file.csv", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("CSV has no data rows.", file=sys.stderr)
        sys.exit(1)

    fieldnames = reader.fieldnames or []

    all_guests = fetch_all_guests()
    by_name = index_guests(all_guests)
    by_id = {str(g["id"]): g for g in all_guests if g.get("id")}

    if "id" in fieldnames and "day_after_invite" in fieldnames:
        patched, skipped, errors = run_export_sync(rows, by_id)
        print(
            f"Export sync: patched {patched}, unchanged {skipped}, errors {errors}.",
            file=sys.stderr,
        )
        if errors:
            sys.exit(1)
        return

    if "first_name" not in fieldnames and "id" not in fieldnames:
        print(
            "CSV must include: (id + day_after_invite) for export sync, or "
            "first_name + last_name (or id) for invite list.",
            file=sys.stderr,
        )
        sys.exit(1)

    updated, skipped_already, errors = run_invite_list(rows, by_name, by_id)
    print(
        f"Done. Updated {updated}, skipped already invited {skipped_already}, errors {errors}.",
        file=sys.stderr,
    )
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
