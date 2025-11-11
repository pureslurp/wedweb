// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
// Note: You'll need to include the Supabase client library in your HTML
let supabase;
if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Store current guest data
let currentGuest = null;

// Step 1: Name Lookup Form Handler
document.getElementById('nameLookupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const errorMessage = document.getElementById('errorMessage');
    
    // Clear previous error
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
    
    try {
        // Query Supabase for guest
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .single();
        
        if (error || !data) {
            errorMessage.textContent = 'Guest not found. Please check your name and try again, or contact the couple for assistance.';
            errorMessage.style.display = 'block';
            return;
        }
        
        // Store guest data
        currentGuest = data;
        
        // Populate guest info display
        document.getElementById('guestGreeting').textContent = `Welcome, ${data.first_name} ${data.last_name}!`;
        document.getElementById('displayEmail').textContent = data.email || 'Not provided';
        document.getElementById('displayPhone').textContent = data.phone || 'Not provided';
        document.getElementById('displayAddress').textContent = data.address || 'Not provided';
        
        // If guest has already RSVP'd, pre-fill the form
        if (data.rsvp) {
            document.getElementById('rsvpResponse').value = data.rsvp;
            if (data.rsvp === 'yes') {
                showAttendingFields();
                if (data.meal_choice) document.getElementById('mealChoice').value = data.meal_choice;
            }
        }
        if (data.song_request) document.getElementById('songRequest').value = data.song_request;
        if (data.dietary_notes) document.getElementById('dietaryNotes').value = data.dietary_notes;
        
        // Show RSVP form, hide name lookup
        document.getElementById('nameLookupSection').style.display = 'none';
        document.getElementById('rsvpFormSection').style.display = 'block';
        
    } catch (err) {
        console.error('Error looking up guest:', err);
        errorMessage.textContent = 'An error occurred. Please try again later.';
        errorMessage.style.display = 'block';
    }
});

// Handle RSVP response change - show/hide attending fields
document.getElementById('rsvpResponse').addEventListener('change', function() {
    if (this.value === 'yes') {
        showAttendingFields();
    } else {
        hideAttendingFields();
    }
});

function showAttendingFields() {
    document.getElementById('mealChoiceGroup').style.display = 'block';
    document.getElementById('songRequestGroup').style.display = 'block';
    document.getElementById('dietaryNotesGroup').style.display = 'block';
    document.getElementById('mealChoice').required = true;
}

function hideAttendingFields() {
    document.getElementById('mealChoiceGroup').style.display = 'none';
    document.getElementById('songRequestGroup').style.display = 'none';
    document.getElementById('dietaryNotesGroup').style.display = 'none';
    document.getElementById('mealChoice').required = false;
}

// Step 2: RSVP Details Form Handler
document.getElementById('rsvpDetailsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!currentGuest) {
        alert('Error: Guest information not found. Please start over.');
        return;
    }
    
    const rsvpResponse = document.getElementById('rsvpResponse').value;
    const mealChoice = document.getElementById('mealChoice').value || null;
    const songRequest = document.getElementById('songRequest').value.trim() || null;
    const dietaryNotes = document.getElementById('dietaryNotes').value.trim() || null;
    
    try {
        // Update guest record in Supabase
        const { error } = await supabase
            .from('guests')
            .update({
                rsvp: rsvpResponse,
                meal_choice: mealChoice,
                song_request: songRequest,
                dietary_notes: dietaryNotes,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentGuest.id);
        
        if (error) {
            throw error;
        }
        
        // Show success message
        document.getElementById('rsvpFormSection').style.display = 'none';
        document.getElementById('successSection').style.display = 'block';
        
    } catch (err) {
        console.error('Error submitting RSVP:', err);
        alert('An error occurred while submitting your RSVP. Please try again.');
    }
});

// Back button handler
document.getElementById('backBtn').addEventListener('click', function() {
    // Reset form
    document.getElementById('rsvpDetailsForm').reset();
    currentGuest = null;
    
    // Show name lookup, hide RSVP form
    document.getElementById('rsvpFormSection').style.display = 'none';
    document.getElementById('nameLookupSection').style.display = 'block';
});
