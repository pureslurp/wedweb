# Guest list: import and export

Use this folder for **repeatable** CSV import/export against Supabase. For a one-off load, the Supabase Dashboard (Table Editor → Import / export) is often enough—see [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).

## Tier 1 — No scripts (manual)

1. **Prepare data** using [`../guests_import_template.csv`](../guests_import_template.csv) in Excel or Google Sheets.
   - Required: `first_name`, `last_name`.
   - Optional: `nickname` (alternate first name for RSVP search, e.g. `Bob` for `Robert`).
   - Optional: `email`, `phone`, `address`.
   - **`family`** — optional; use the **same text on every row** in a household (e.g. `Smith Family`). Anyone who searches will see everyone with that label. Leave blank for individuals; use `plus_one_*` helpers for couples without a family label if you prefer.
   - Plus-one helpers (not database columns): `plus_one_first_name`, `plus_one_last_name` — fill the plus one’s name; after rows exist, link pairs in SQL or use `import_guests.py` below.
   - Optional: `day_after_invited`, `day_after_rsvp` — usually leave blank; use [`set_day_after_invited.py`](set_day_after_invited.py) to mark invitees after guests exist.

2. **Import CSV** in Supabase: **Table Editor** → `guests` → **Insert** → **Import data from CSV** (see [Supabase docs](https://supabase.com/docs/guides/database/tables#importing-data)).

3. **Link plus-ones** if you did not use the Python importer: run `UPDATE` statements as in [SUPABASE_SETUP.md](../SUPABASE_SETUP.md), setting `plus_one_id` to the other guest’s `id`.

4. **Export** results: Table Editor → export CSV, or **SQL Editor** → `SELECT * FROM guests` and download results. Open the CSV in Google Sheets via **File → Import**.

## Tier 2 — Scripts (service role)

Scripts call the Supabase REST API with the **service role** key so inserts/updates work even when Row Level Security would block the anon key. **Never** put the service role key in frontend code or commit it.

### Environment variables

| Variable | Where to find it |
|----------|------------------|
| `SUPABASE_URL` | Project **Settings** → **API** → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Settings** → **API** → `service_role` (secret) |

Example (zsh/bash):

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret"
```

If you keep these in a **`.env`** file at the **repository root** (same folder as `setup.sql`), the Python scripts load it automatically—no need to `export` first. Existing shell variables still take precedence.

### Export all guests to CSV (stdout)

```bash
python3 scripts/export_guests.py > guests_export.csv
```

Import the file into Google Sheets (**File → Import → Upload**).

### Import from CSV

CSV headers should match the template (helper columns for plus-ones are optional):

```bash
python3 scripts/import_guests.py path/to/your_guests.csv
```

The script **inserts only** (no upsert). To change existing rows—such as marking who is invited to the day-after event—use **`set_day_after_invited.py`** below, SQL `UPDATE`, or the Table Editor; do not re-run the importer or you will duplicate guests.

The script inserts each data row, then sets `plus_one_id` when `plus_one_first_name` and `plus_one_last_name` match exactly one earlier inserted guest (case-insensitive). If several guests share the same name, the script picks one match and prints a warning—fix duplicates in the sheet if that happens.

### Day-after party — who is invited

**Option A — Full export (recommended for a clean sync)**

1. Export: `python3 scripts/export_guests.py > guests_export.csv`
2. Open in Excel or Google Sheets. **Add a new column** named exactly **`day_after_invite`** (this is your scratch column; the database column remains `day_after_invited`).
3. For each row, set **`day_after_invite`** to `true` or `false` (or `yes`/`no`, `1`/`0`, or leave blank = not invited). Every row in the file should reflect the invite list you want.
4. Save as CSV and run:

```bash
python3 scripts/set_day_after_invited.py guests_marked.csv
```

The script detects `id` + `day_after_invite` in the header and **syncs** `day_after_invited` in Supabase to match. Only rows that need a change are PATCHed.

**Option B — Short list (names only)**

Use a small CSV with **`first_name`** and **`last_name`** only (see below). The script sets **`day_after_invited = true`** for each match; it does **not** set others to false.

Optional columns for Option B only:

- **`email`** — if two guests share the same name, add their email on that row.
- **`id`** — if present for a row, that UUID is updated to invited `true` (useful when the script reports ambiguous name matches). To look up ids anytime, run **`export_guests.py`** or use the Table Editor.

Example `day_after_invitees.csv` (Option B):

```csv
first_name,last_name
Jane,Doe
Michael,Brown
```

```bash
python3 scripts/set_day_after_invited.py day_after_invitees.csv
```

If multiple people share one name pair, the script lists candidate **`id`** values; add **`email`** or **`id`** for those rows and run again.

### Aligning an older database

If optional columns are missing from `guests`, run the matching script in the SQL Editor once, as needed:

- [`add_post_rsvp_message.sql`](add_post_rsvp_message.sql)
- [`add_family_column.sql`](add_family_column.sql)
- [`add_nickname_column.sql`](add_nickname_column.sql)
- [`add_day_after_columns.sql`](add_day_after_columns.sql)
