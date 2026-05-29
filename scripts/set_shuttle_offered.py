#!/usr/bin/env python3
"""
Set `guests.shuttle_offered` from a CSV (service role).

Two modes (auto-detected from headers):

1) Export sync — CSV from `export_guests.py` with a marking column:

   - Required: `id` plus **`shuttle_offer`** OR **`shuttle_offered`** (exported DB
     column). If both are present, **`shuttle_offer`** wins for reading each row.

   Each row PATCHes `shuttle_offered` true/false to match the cell (blank = false).


2) Offer list — minimal CSV of people to flag:
   - `first_name`, `last_name` per row (optional `email` / `id` per row)
   - Sets `shuttle_offered = true` for each match (does not set false for others).

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


def export_sync_marking_column(fieldnames: list[str]) -> str | None:
    """CSV column whose values sync to guests.shuttle_offered."""
    if "shuttle_offer" in fieldnames:
        return "shuttle_offer"
    if "shuttle_offered" in fieldnames:
        return "shuttle_offered"
    return None


def parse_bool_cell(raw: str | None) -> bool:
    """Interpret spreadsheet / CSV cell as bool. Blank -> False."""
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
    url = f"{base}/rest/v1/guests?select=id,first_name,last_name,email,shuttle_offered"
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
    rows: list[dict[str, str]],
    by_id: dict[str, dict[str, Any]],
    marking_column: str,
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
        want = parse_bool_cell(row.get(marking_column))
        cur = by_id[id_raw].get("shuttle_offered")
        cur_bool = cur is True
        if cur_bool == want:
            skipped += 1
            continue
        try:
            rest_request(
                "PATCH",
                f"/rest/v1/guests?id=eq.{id_raw}",
                {"shuttle_offered": want},
            )
        except urllib.error.HTTPError as e:
            print(e.read().decode(), file=sys.stderr)
            errors += 1
            continue
        patched += 1
        print(
            f"Row {line_no}: id {id_raw} -> shuttle_offered={want}",
            file=sys.stderr,
        )
    return patched, skipped, errors


def run_offer_list(
    rows: list[dict[str, str]],
    by_name: dict[tuple[str, str], list[dict[str, Any]]],
    by_id: dict[str, dict[str, Any]],
) -> tuple[int, int, int]:
    """Returns (updated, skipped_already_offered, errors)."""
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
            if by_id[gid].get("shuttle_offered"):
                skipped_already += 1
                print(
                    f"Row {line_no}: already shuttle_offered (id {gid}), skipping.",
                    file=sys.stderr,
                )
                continue
            try:
                rest_request(
                    "PATCH",
                    f"/rest/v1/guests?id=eq.{gid}",
                    {"shuttle_offered": True},
                )
            except urllib.error.HTTPError as e:
                print(e.read().decode(), file=sys.stderr)
                errors += 1
                continue
            updated += 1
            print(f"Row {line_no}: set shuttle_offered for id {gid}", file=sys.stderr)
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
        if g.get("shuttle_offered"):
            skipped_already += 1
            print(
                f"Row {line_no}: already shuttle_offered (id {gid}), skipping.",
                file=sys.stderr,
            )
            continue

        try:
            rest_request(
                "PATCH",
                f"/rest/v1/guests?id=eq.{gid}",
                {"shuttle_offered": True},
            )
        except urllib.error.HTTPError as e:
            print(e.read().decode(), file=sys.stderr)
            errors += 1
            continue

        updated += 1
        print(
            f"Row {line_no}: set shuttle_offered for {g.get('first_name')} {g.get('last_name')} ({gid})",
            file=sys.stderr,
        )

    return updated, skipped_already, errors


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: set_shuttle_offered.py path/to/file.csv", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("CSV has no data rows.", file=sys.stderr)
        sys.exit(1)

    fieldnames = reader.fieldnames or []

    looks_like_bulk_export = "id" in fieldnames and (
        "first_name" in fieldnames or "last_name" in fieldnames
    )
    sync_mark = export_sync_marking_column(fieldnames)
    if looks_like_bulk_export and sync_mark is None:
        print(
            "ERROR: This file looks like a database export (columns include `id` and "
            "names) but there is no marking column.\n"
            "Add **`shuttle_offer`** OR use the exported **`shuttle_offered`** "
            "(set true/false per row).\n"
            "Without either, the script would mark every row as offered.\n"
            "If both columns exist, `shuttle_offer` is read for each row.\n"
            "To fix accidental all-offered: set false everywhere (or blank), save CSV, rerun.",
            file=sys.stderr,
        )
        sys.exit(1)

    all_guests = fetch_all_guests()
    by_name = index_guests(all_guests)
    by_id = {str(g["id"]): g for g in all_guests if g.get("id")}

    if "id" in fieldnames and sync_mark is not None:
        patched, skipped, errors = run_export_sync(rows, by_id, sync_mark)
        print(
            f"Export sync (via column {sync_mark!r}): patched {patched}, "
            f"unchanged {skipped}, errors {errors}.",
            file=sys.stderr,
        )
        if errors:
            sys.exit(1)
        return

    if "first_name" not in fieldnames and "id" not in fieldnames:
        print(
            "CSV must include: (`id` + `shuttle_offer` or `shuttle_offered`) for export sync, or "
            "first_name + last_name (or id-only offer list).",
            file=sys.stderr,
        )
        sys.exit(1)

    updated, skipped_already, errors = run_offer_list(rows, by_name, by_id)
    print(
        f"Done. Updated {updated}, skipped already offered {skipped_already}, errors {errors}.",
        file=sys.stderr,
    )
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
