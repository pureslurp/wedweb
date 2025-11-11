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

// Helper function to parse full name into first and last name
function parseFullName(fullName) {
    const nameParts = fullName.trim().split(/\s+/); // Split on whitespace
    
    if (nameParts.length === 1) {
        // Only one name provided
        return { firstName: nameParts[0], lastName: '' };
    } else if (nameParts.length === 2) {
        // First and last name
        return { firstName: nameParts[0], lastName: nameParts[1] };
    } else {
        // Multiple names - assume first word is first name, rest is last name
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        return { firstName, lastName };
    }
}

// Smart lookup function that tries multiple strategies
async function lookupGuest(fullName) {
    const { firstName, lastName } = parseFullName(fullName);
    
    // Strategy 1: Try exact match with parsed first and last name
    let { data, error } = await supabase
        .from('guests')
        .select('*')
        .ilike('first_name', firstName)
        .ilike('last_name', lastName);
    
    if (data && data.length > 0) {
        return data[0]; // Return first match
    }
    
    // Strategy 2: If no exact match and there's a last name, try partial matches
    if (lastName) {
        // Try matching where first name starts with the input
        const { data: data2 } = await supabase
            .from('guests')
            .select('*')
            .ilike('first_name', `${firstName}%`)
            .ilike('last_name', `${lastName}%`);
        
        if (data2 && data2.length > 0) {
            return data2[0];
        }
    }
    
    // Strategy 3: Try searching across the full name field (if people typed it differently)
    // Search for first name in either field
    const { data: data3 } = await supabase
        .from('guests')
        .select('*')
        .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${firstName}%`);
    
    if (data3 && data3.length > 0) {
        // Filter to see if any match includes the last name too
        const match = data3.find(guest => 
            guest.last_name.toLowerCase().includes(lastName.toLowerCase())
        );
        if (match) return match;
        
        // If only one result, return it
        if (data3.length === 1) return data3[0];
    }
    
    // No match found
    return null;
}

// Step 1: Name Lookup Form Handler
document.getElementById('nameLookupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const errorMessage = document.getElementById('errorMessage');
    
    // Clear previous error
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
    
    if (!fullName) {
        errorMessage.textContent = 'Please enter your full name.';
        errorMessage.style.display = 'block';
        return;
    }
    
    try {
        // Use smart lookup function
        const guest = await lookupGuest(fullName);
        
        if (!guest) {
            errorMessage.textContent = 'Guest not found. Please check your name and try again, or contact the couple for assistance.';
            errorMessage.style.display = 'block';
            return;
        }
        
        // Store guest data
        currentGuest = guest;
        
        // Populate guest info display
        document.getElementById('guestGreeting').textContent = `Welcome, ${guest.first_name} ${guest.last_name}!`;
        document.getElementById('displayEmail').textContent = guest.email || 'Not provided';
        document.getElementById('displayPhone').textContent = guest.phone || 'Not provided';
        document.getElementById('displayAddress').textContent = guest.address || 'Not provided';
        
        // If guest has already RSVP'd, pre-fill the form
        if (guest.rsvp) {
            document.getElementById('rsvpResponse').value = guest.rsvp;
            if (guest.rsvp === 'yes') {
                showAttendingFields();
                if (guest.meal_choice) document.getElementById('mealChoice').value = guest.meal_choice;
            }
        }
        if (guest.song_request) document.getElementById('songRequest').value = guest.song_request;
        if (guest.dietary_notes) document.getElementById('dietaryNotes').value = guest.dietary_notes;
        
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
