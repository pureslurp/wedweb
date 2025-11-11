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
- `email` (Text)
- `address` (Text)
- `phone` (Text)
- `rsvp` (Text) - 'yes' or 'no'
- `meal_choice` (Text) - 'chicken', 'beef', 'fish', or 'vegetarian'
- `song_request` (Text)
- `dietary_notes` (Text)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

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
3. **CSV Import** - Supabase supports CSV imports

### Example SQL Insert:
```sql
INSERT INTO guests (first_name, last_name, email, address, phone)
VALUES 
  ('John', 'Doe', 'john@example.com', '123 Main St, City, ST 12345', '555-0100'),
  ('Jane', 'Smith', 'jane@example.com', '456 Oak Ave, City, ST 12345', '555-0101');
```

## Step 7: Test Your RSVP System

1. Make sure your website is running (GitHub Pages or local server)
2. Enter a guest's name that you've added to the database
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

