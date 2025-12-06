// Supabase Configuration
// Note: The anon public key is safe to expose in client-side code
// Security is handled by Row Level Security (RLS) policies in Supabase

const SUPABASE_CONFIG = {
    // Your Project URL (found in Settings → API → Project URL)
    url: 'https://oxgonfjfqicvnzsakxcx.supabase.co',
    
    // Your anon public key (found in Settings → API → anon public)
    // Paste the long JWT token here (starts with eyJhbG...)
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Z29uZmpmcWljdm56c2FreGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4ODMwODgsImV4cCI6MjA3ODQ1OTA4OH0.MbQ--bywSfMPhk827MUl8XNOd8S15aVOZn7YtgoKlBg'
};

