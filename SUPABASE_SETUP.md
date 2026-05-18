# Supabase Setup Guide for Wedding RSVP

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Enter project details and create the project
4. Wait for the database to be provisioned

## Step 2: Create the Guests Table

1. In your Supabase dashboard, go to the **SQL Editor**
2. Copy and paste the SQL from `setup.sql` (included in this project)
3. Click "Run" to execute the SQL

The table will include these columns:
- `id` (UUID, Primary Key)
- `first_name` (Text)
- `last_name` (Text)
- `nickname` (Text, optional) — Alternate first name for lookup (e.g. `Bob` for `Robert`). Guests can search with either legal first name or nickname plus last name.
- `email` (Text)
- `address` (Text)
- `phone` (Text)
- `family` (Text, optional) - Same value for everyone on one invitation (e.g. `Smith Family`); lookup shows the whole group. You can still set `plus_one_id` (or CSV plus-one helpers) for someone **outside** that label (e.g. a family member’s guest—everyone in the family group is included, then plus-one links are followed once). Leave `family` empty for solo guests or use only `plus_one_id` for couples.
- `plus_one_id` (UUID, Foreign Key) - Links to another guest's ID for plus ones (used when `family` is empty)
- `rsvp` (Text) - 'yes' or 'no'
- `meal_choice` (Text) - 'chicken', 'beef', 'fish', or 'vegetarian'
- `song_request` (Text)
- `dietary_notes` (Text)
- `general_notes` (Text)
- `post_rsvp_message` (Text, optional) - Optional note shown after RSVP (not used by the current site JS)
- `day_after_invited` (Boolean, default false) - If true, this guest may RSVP for the day-after gathering on the RSVP form
- `day_after_rsvp` (Text, optional) - `'yes'` or `'no'` when invited; null if not invited or not yet answered
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

If you already created `guests` from an older `setup.sql`, run these in the SQL Editor as needed: [`scripts/add_post_rsvp_message.sql`](scripts/add_post_rsvp_message.sql), [`scripts/add_family_column.sql`](scripts/add_family_column.sql), [`scripts/add_nickname_column.sql`](scripts/add_nickname_column.sql), [`scripts/add_day_after_columns.sql`](scripts/add_day_after_columns.sql).

### Name lookup: typos and nicknames

The RSVP page matches **legal first name + last name** (case-insensitive), or **nickname + last name** when `nickname` is set. If nothing matches, it runs a **fuzzy pass** using [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance) on the full string (`First Last` and, if present, `Nickname Last`), keeping matches within **2** edits by default (see `RSVP_FUZZY_MAX_DISTANCE` in [`rsvp.js`](rsvp.js)). That pass loads the guest list once (same as your existing public `SELECT` policy). For stricter control you could lower the threshold or replace this with a Postgres `pg_trgm` RPC later.

## Step 3: Get Your API Credentials

1. In your Supabase dashboard, go to **Project Settings** (gear icon)
2. Click on **API** in the sidebar
3. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** API key (under "Project API keys")

## Step 4: Update Your Website Configuration

1. Open `rsvp.js` in your project
2. Replace the placeholder values at the top of the file:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your Project URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your anon public key
```

## Step 5: Configure Row Level Security (RLS)

For security, enable RLS on your guests table:

1. In Supabase dashboard, go to **Authentication** → **Policies**
2. Select the `guests` table
3. Enable RLS
4. Add policies:

### Policy 1: Allow guests to read their own data
```sql
CREATE POLICY "Guests can view their own data"
ON guests FOR SELECT
USING (true);
```

### Policy 2: Allow guests to update their own RSVP
```sql
CREATE POLICY "Guests can update their own RSVP"
ON guests FOR UPDATE
USING (true);
```

**Note:** Since we're using name-based lookup (not authentication), we're allowing all authenticated requests. For production, you might want to implement more sophisticated security.

## Step 6: Populate Guest Data

You can add guests through:
1. **Supabase Table Editor** (UI) - Good for small lists
2. **SQL Insert Statements** - Good for bulk imports
3. **CSV Import** - Supabase supports CSV imports (see [`guests_import_template.csv`](guests_import_template.csv) for recommended column names, including optional `plus_one_first_name` / `plus_one_last_name` helpers)
4. **`scripts/import_guests.py`** - Repeatable import with service role; see [`scripts/README.md`](scripts/README.md)

Export back to a spreadsheet: Table Editor CSV export, or **`scripts/export_guests.py`** (documented in [`scripts/README.md`](scripts/README.md)).

### Day-after party invitations

Only some guests may be invited to the day-after gathering. The usual workflow is: export with **`scripts/export_guests.py`**, edit **`day_after_invited`** in the spreadsheet (or add **`day_after_invite`** — if both columns exist the script prefers **`day_after_invite`**), then run **`scripts/set_day_after_invited.py`** on that CSV — it syncs **`day_after_invited`** in the database (see [`scripts/README.md`](scripts/README.md)). Alternatively use a short name-only CSV, SQL, or the Table Editor. Guests submit **`day_after_rsvp`** on the website; you can also bulk-update in SQL if needed:

```sql
UPDATE guests SET day_after_invited = true
WHERE id IN ('uuid-1', 'uuid-2');
```

### Example SQL Insert:
```sql
-- Insert guests first
INSERT INTO guests (first_name, last_name, email, address, phone)
VALUES 
  ('John', 'Doe', 'john@example.com', '123 Main St, City, ST 12345', '555-0100'),
  ('Jane', 'Smith', 'jane@example.com', '456 Oak Ave, City, ST 12345', '555-0101');

-- Then link plus ones (after getting their IDs)
UPDATE guests SET plus_one_id = (SELECT id FROM guests WHERE first_name = 'Jane' AND last_name = 'Smith')
WHERE first_name = 'John' AND last_name = 'Doe';

UPDATE guests SET plus_one_id = (SELECT id FROM guests WHERE first_name = 'John' AND last_name = 'Doe')
WHERE first_name = 'Jane' AND last_name = 'Smith';
```

### Plus One Feature:
When a guest searches for their name, both they and their plus one will appear in the results. Each person RSVPs individually, but the system shows they are linked. To set up plus ones:
1. Add all guests to the database first
2. Use UPDATE queries to link guests by setting their `plus_one_id` to reference each other
3. The relationship is bidirectional - if Jane is John's plus one, John should be Jane's plus one

## Step 7: Test Your RSVP System

1. Make sure your website is running (GitHub Pages or local server)
2. Enter the guest's **first and last name** as stored in the database (case-insensitive), then select the correct person if a plus one is listed
3. Fill out the RSVP form
4. Check Supabase Table Editor to verify the data was updated

## Troubleshooting

### "Guest not found" error
- Check that the first and last names match exactly (case-insensitive)
- Verify the guest exists in your Supabase table

### JavaScript console errors
- Check browser console (F12) for detailed error messages
- Verify your Supabase URL and API key are correct
- Make sure the Supabase client library is loading

### CORS errors
- Make sure you're accessing the site via a proper URL (not file://)
- Check that your Supabase project allows requests from your domain

## Next Steps

Once everything is working:
1. Add all your wedding guests to the database
2. Test the RSVP flow thoroughly
3. Deploy to GitHub Pages
4. Share the link with your guests!

