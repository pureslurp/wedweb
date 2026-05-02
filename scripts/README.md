# Guest list: import and export

Use this folder for **repeatable** CSV import/export against Supabase. For a one-off load, the Supabase Dashboard (Table Editor → Import / export) is often enough—see [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).

## Tier 1 — No scripts (manual)

1. **Prepare data** using [`../guests_import_template.csv`](../guests_import_template.csv) in Excel or Google Sheets.
   - Required: `first_name`, `last_name`.
   - Optional: `nickname` (alternate first name for RSVP search, e.g. `Bob` for `Robert`).
   - Optional: `email`, `phone`, `address`.
   - **`family`** — optional; use the **same text on every row** in a household (e.g. `Smith Family`). Anyone who searches will see everyone with that label. Leave blank for individuals; use `plus_one_*` helpers for couples without a family label if you prefer.
   - Plus-one helpers (not database columns): `plus_one_first_name`, `plus_one_last_name` — fill the plus one’s name; after rows exist, link pairs in SQL or use `import_guests.py` below.
   - Leave RSVP columns blank for guests to fill on the website.

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

The script inserts each data row, then sets `plus_one_id` when `plus_one_first_name` and `plus_one_last_name` match exactly one earlier inserted guest (case-insensitive). If several guests share the same name, the script picks one match and prints a warning—fix duplicates in the sheet if that happens.

### Aligning an older database

If `post_rsvp_message` is missing from `guests`, run [`add_post_rsvp_message.sql`](add_post_rsvp_message.sql) in the SQL Editor once.
