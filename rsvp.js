// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navOverlay = document.getElementById('navOverlay');
    
    function closeMenu() {
        if (navToggle) navToggle.classList.remove('active');
        if (navMenu) navMenu.classList.remove('active');
        if (navOverlay) navOverlay.classList.remove('active');
    }
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            if (navOverlay) navOverlay.classList.toggle('active');
        });
        
        // Close menu when clicking on overlay
        if (navOverlay) {
            navOverlay.addEventListener('click', closeMenu);
        }
        
        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            const isClickInsideNav = navMenu.contains(event.target) || navToggle.contains(event.target);
            if (!isClickInsideNav && navMenu.classList.contains('active')) {
                closeMenu();
            }
        });
    }
});

// Configuration
const USE_MOCK_DATA = false; // Set to false when using real Supabase

// Prevent multiple script loads - check if already initialized
if (window.rsvpSystemInitialized) {
    console.warn('[RSVP DEBUG] rsvp.js has already been loaded. Skipping re-initialization.');
} else {
    window.rsvpSystemInitialized = true;
    
    console.log('[RSVP DEBUG] Script loading...');
    console.log('[RSVP DEBUG] USE_MOCK_DATA:', USE_MOCK_DATA);
    console.log('[RSVP DEBUG] window.supabase exists:', typeof window.supabase !== 'undefined');
    console.log('[RSVP DEBUG] SUPABASE_CONFIG exists:', typeof SUPABASE_CONFIG !== 'undefined');

    // Initialize Supabase client (only if not using mock data)
    // Use window object to store client and prevent re-initialization conflicts
    if (typeof window.rsvpSupabaseClient === 'undefined') {
        window.rsvpSupabaseClient = null;
    }
    
    var supabaseClient = window.rsvpSupabaseClient;
    
    if (!USE_MOCK_DATA && typeof window.supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
        try {
            if (!supabaseClient) {
                supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
                window.rsvpSupabaseClient = supabaseClient; // Store in window to prevent conflicts
                console.log('[RSVP DEBUG] Supabase client initialized successfully');
            } else {
                console.log('[RSVP DEBUG] Using existing Supabase client');
            }
        } catch (error) {
            console.error('[RSVP DEBUG] Error initializing Supabase client:', error);
        }
    } else {
        console.warn('[RSVP DEBUG] Supabase not initialized. Check that SUPABASE_CONFIG is defined and Supabase library is loaded.');
    }
    
    // Use the window-stored client
    var supabaseClient = window.rsvpSupabaseClient;
}

// Mock database (for testing)
let mockDatabase = {
    guests: []
};

// Load mock data
async function loadMockData() {
    try {
        const response = await fetch('mock-guests.json');
        const data = await response.json();
        mockDatabase = data;
        console.log('Mock data loaded:', mockDatabase.guests.length, 'guests');
    } catch (error) {
        console.error('Error loading mock data:', error);
    }
}

// Initialize mock data on page load
if (USE_MOCK_DATA) {
    loadMockData();
}

// Store current guest data
let currentGuest = null;
let currentPlusOne = null;

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

// Helper function to get plus one for a guest
function getPlusOne(guestId) {
    return mockDatabase.guests.find(g => g.id === guestId);
}

// Helper function to find all guests linked to a guest (including themselves and plus ones)
function getLinkedGuests(guest) {
    const linked = [guest];
    
    // Add their plus one if they have one
    if (guest.plus_one_id) {
        const plusOne = getPlusOne(guest.plus_one_id);
        if (plusOne && plusOne.id !== guest.id) {
            linked.push(plusOne);
        }
    }
    
    // Check if anyone else has this guest as their plus one
    const reverseLink = mockDatabase.guests.find(g => 
        g.plus_one_id === guest.id && g.id !== guest.id
    );
    if (reverseLink && !linked.find(l => l.id === reverseLink.id)) {
        linked.push(reverseLink);
    }
    
    return linked;
}

// Mock lookup function for local testing
function lookupGuestsMock(fullName) {
    const { firstName, lastName } = parseFullName(fullName);
    const matchesArray = [];
    const addedIds = new Set();
    
    mockDatabase.guests.forEach(guest => {
        const matchesFirst = guest.first_name.toLowerCase().includes(firstName.toLowerCase()) ||
                           firstName.toLowerCase().includes(guest.first_name.toLowerCase());
        const matchesLast = lastName ? 
            (guest.last_name.toLowerCase().includes(lastName.toLowerCase()) ||
             lastName.toLowerCase().includes(guest.last_name.toLowerCase())) : true;
        
        if (matchesFirst && matchesLast) {
            // Get all linked guests (person + their plus one)
            const linkedGuests = getLinkedGuests(guest);
            
            linkedGuests.forEach(linkedGuest => {
                if (!addedIds.has(linkedGuest.id)) {
                    addedIds.add(linkedGuest.id);
                    matchesArray.push(linkedGuest);
                }
            });
        }
    });
    
    return matchesArray;
}

// Helper function to get plus one from Supabase
async function getPlusOneSupabase(guestId) {
    if (!guestId) return null;
    
    const { data, error } = await supabaseClient
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single();
    
    return data || null;
}

// Helper function to find all linked guests from Supabase
async function getLinkedGuestsSupabase(guest) {
    const client = window.rsvpSupabaseClient || supabaseClient;
    if (!client) {
        console.error('[RSVP DEBUG] Supabase client not available in getLinkedGuestsSupabase');
        return [guest]; // Return at least the guest itself
    }
    
    const linked = [guest];
    
    // Add their plus one if they have one
    if (guest.plus_one_id) {
        const plusOne = await getPlusOneSupabase(guest.plus_one_id);
        if (plusOne && plusOne.id !== guest.id) {
            linked.push(plusOne);
        }
    }
    
    // Check if anyone else has this guest as their plus one
    const { data: reverseLinks } = await client
        .from('guests')
        .select('*')
        .eq('plus_one_id', guest.id);
    
    if (reverseLinks && reverseLinks.length > 0) {
        reverseLinks.forEach(reverseLink => {
            if (reverseLink.id !== guest.id && !linked.find(l => l.id === reverseLink.id)) {
                linked.push(reverseLink);
            }
        });
    }
    
    return linked;
}

// Smart lookup function that returns all potential matches (Supabase version)
async function lookupGuestsSupabase(fullName) {
    // Use window-stored client if available, fall back to local variable
    const client = window.rsvpSupabaseClient || supabaseClient;
    
    if (!client) {
        const errorMsg = 'Supabase client not initialized. Please refresh the page.';
        console.error('[RSVP DEBUG]', errorMsg);
        throw new Error(errorMsg);
    }
    
    // First, test if we can query the database at all
    console.log('[RSVP DEBUG] Testing database connection...');
    const { data: testData, error: testError, count } = await client
        .from('guests')
        .select('*', { count: 'exact' })
        .limit(5);
    
    if (testError) {
        console.error('[RSVP DEBUG] Database connection error:', testError);
        
        // Check if it's an RLS/permission error
        if (testError.code === 'PGRST301' || testError.message.includes('permission') || testError.message.includes('policy')) {
            const rlsErrorMsg = 'Database query blocked. This may be a Row Level Security (RLS) issue. Please check your Supabase RLS policies allow public SELECT access.';
            console.error('[RSVP DEBUG]', rlsErrorMsg);
            throw new Error(rlsErrorMsg);
        }
        
        throw testError;
    }
    
    // Warn if database is empty (might indicate RLS issue)
    if (count === 0) {
        console.warn('[RSVP DEBUG] Database test returned 0 guests. If you expect data, this may indicate an RLS policy issue.');
    }
    
    console.log('[RSVP DEBUG] Database test - Total guests in DB:', count, 'Sample data:', testData);
    
    const { firstName, lastName } = parseFullName(fullName);
    console.log('[RSVP DEBUG] Parsed name - firstName:', firstName, 'lastName:', lastName);
    const allMatches = new Set(); // Use Set to avoid duplicates
    const matchesArray = [];
    const initialMatches = [];
    
    // Strategy 1: Try exact match with parsed first and last name
    console.log('[RSVP DEBUG] Strategy 1: Querying for exact match...');
    let { data: data1, error: error1 } = await client
        .from('guests')
        .select('*')
        .ilike('first_name', firstName);
    
    if (lastName) {
        // If we have a last name, filter by it too
        const { data: data1b, error: error1b } = await client
            .from('guests')
            .select('*')
            .ilike('first_name', firstName)
            .ilike('last_name', lastName);
        data1 = data1b;
        error1 = error1b;
    }
    
    if (error1) {
        console.error('[RSVP DEBUG] Strategy 1 error:', error1);
    } else {
        console.log('[RSVP DEBUG] Strategy 1 returned', data1 ? data1.length : 0, 'guests');
    }
    
    if (data1 && data1.length > 0) {
        initialMatches.push(...data1);
    }
    
    // Strategy 2: If there's a last name, try partial matches
    if (lastName) {
        console.log('[RSVP DEBUG] Strategy 2: Querying for partial match...');
        const { data: data2, error: error2 } = await client
            .from('guests')
            .select('*')
            .ilike('first_name', `${firstName}%`)
            .ilike('last_name', `${lastName}%`);
        
        if (error2) {
            console.error('[RSVP DEBUG] Strategy 2 error:', error2);
        } else {
            console.log('[RSVP DEBUG] Strategy 2 returned', data2 ? data2.length : 0, 'guests');
        }
        
        if (data2 && data2.length > 0) {
            data2.forEach(guest => {
                if (!initialMatches.find(g => g.id === guest.id)) {
                    initialMatches.push(guest);
                }
            });
        }
    }
    
    // Strategy 3: Try searching across both name fields
    console.log('[RSVP DEBUG] Strategy 3: Querying with OR pattern...');
    const { data: data3, error: error3 } = await client
        .from('guests')
        .select('*')
        .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${firstName}%`);
    
    if (error3) {
        console.error('[RSVP DEBUG] Strategy 3 error:', error3);
    } else {
        console.log('[RSVP DEBUG] Strategy 3 returned', data3 ? data3.length : 0, 'guests');
    }
    
    if (data3 && data3.length > 0) {
        data3.forEach(guest => {
            // Only add if it seems relevant
            const guestFullName = `${guest.first_name} ${guest.last_name}`.toLowerCase();
            if (guestFullName.includes(firstName.toLowerCase()) || 
                (lastName && guestFullName.includes(lastName.toLowerCase()))) {
                if (!initialMatches.find(g => g.id === guest.id)) {
                    initialMatches.push(guest);
                }
            }
        });
    }
    
    // Now fetch linked guests (plus ones) for each match
    for (const guest of initialMatches) {
        const linkedGuests = await getLinkedGuestsSupabase(guest);
        
        linkedGuests.forEach(linkedGuest => {
            if (!allMatches.has(linkedGuest.id)) {
                allMatches.add(linkedGuest.id);
                matchesArray.push(linkedGuest);
            }
        });
    }
    
    return matchesArray;
}

// Unified lookup function
async function lookupGuests(fullName) {
    console.log('[RSVP DEBUG] lookupGuests called, USE_MOCK_DATA:', USE_MOCK_DATA);
    if (USE_MOCK_DATA) {
        console.log('[RSVP DEBUG] Using mock data lookup');
        return lookupGuestsMock(fullName);
    } else {
        console.log('[RSVP DEBUG] Using Supabase lookup, supabase client:', supabaseClient ? 'initialized' : 'null');
        if (!supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        return await lookupGuestsSupabase(fullName);
    }
}

// Step 1: Name Lookup Form Handler
console.log('[RSVP DEBUG] Attempting to attach name lookup form handler...');
const nameLookupForm = document.getElementById('nameLookupForm');
if (!nameLookupForm) {
    console.error('[RSVP DEBUG] ERROR: nameLookupForm element not found!');
} else {
    console.log('[RSVP DEBUG] nameLookupForm element found, attaching handler...');
    nameLookupForm.addEventListener('submit', async function(e) {
    console.log('[RSVP DEBUG] Form submit event fired!');
    e.preventDefault();
    console.log('[RSVP DEBUG] Prevented default form submission');
    
    const fullName = document.getElementById('fullName').value.trim();
    console.log('[RSVP DEBUG] Full name entered:', fullName);
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
        // Use smart lookup function to get all matches
        console.log('[RSVP DEBUG] Calling lookupGuests with:', fullName);
        const guests = await lookupGuests(fullName);
        console.log('[RSVP DEBUG] Lookup returned', guests ? guests.length : 0, 'guests');
        
        if (!guests || guests.length === 0) {
            errorMessage.textContent = 'Guest not found. Please check your name and try again, or click "Text Me" below for assistance.';
            errorMessage.style.display = 'block';
            return;
        }
        
        // Display guest selection list
        displayGuestList(guests);
        
        // Show guest selection, hide name lookup
        document.getElementById('nameLookupSection').style.display = 'none';
        document.getElementById('guestSelectionSection').style.display = 'block';
        
    } catch (err) {
        console.error('Error looking up guest:', err);
        errorMessage.textContent = 'An error occurred. Please try again later.';
        errorMessage.style.display = 'block';
    }
    });
    console.log('[RSVP DEBUG] Name lookup form handler attached successfully');
}

// Store the matched guests for later use
let matchedGuests = [];
let selectedGuests = new Set(); // Track selected guest IDs

// Display list of matching guests
function displayGuestList(guests) {
    matchedGuests = guests; // Store for the continue button
    selectedGuests.clear(); // Reset selection
    const guestList = document.getElementById('guestList');
    guestList.innerHTML = ''; // Clear previous results
    
    guests.forEach(guest => {
        const guestCard = document.createElement('div');
        guestCard.className = 'guest-card-display';
        guestCard.dataset.guestId = guest.id; // Store guest ID for selection
        
        // Check if guest has a plus one
        let plusOneInfo = '';
        if (guest.plus_one_id) {
            // Find the plus one in the matched guests list
            const plusOne = matchedGuests.find(g => g.id === guest.plus_one_id);
            if (plusOne) {
                plusOneInfo = `<p class="guest-plus-one">Plus One: ${plusOne.first_name} ${plusOne.last_name}</p>`;
            }
        }
        
        guestCard.innerHTML = `
            <h3 class="guest-name">${guest.first_name} ${guest.last_name}</h3>
            <p class="guest-details">${guest.email || ''}</p>
            <p class="guest-details">${guest.address || ''}</p>
            ${plusOneInfo}
        `;
        
        // Add click handler to toggle selection
        guestCard.addEventListener('click', function() {
            toggleGuestSelection(guest.id, guestCard);
        });
        
        guestList.appendChild(guestCard);
    });
    
    // Disable continue button initially
    updateContinueButton();
}

// Toggle guest selection
function toggleGuestSelection(guestId, cardElement) {
    if (selectedGuests.has(guestId)) {
        selectedGuests.delete(guestId);
        cardElement.classList.remove('selected');
    } else {
        selectedGuests.add(guestId);
        cardElement.classList.add('selected');
    }
    updateContinueButton();
}

// Update continue button state
function updateContinueButton() {
    const continueBtn = document.getElementById('continueToRsvpBtn');
    if (selectedGuests.size > 0) {
        continueBtn.disabled = false;
    } else {
        continueBtn.disabled = true;
    }
}

// Continue button handler from guest selection
document.getElementById('continueToRsvpBtn').addEventListener('click', async function() {
    if (selectedGuests.size > 0) {
        // Get the first selected guest
        const selectedGuestId = Array.from(selectedGuests)[0];
        const guest = matchedGuests.find(g => g.id === selectedGuestId);
        
        if (guest) {
            await selectGuest(guest);
        }
    }
});

// Handle guest selection
async function selectGuest(guest) {
    // Store guest data
    currentGuest = guest;
    currentPlusOne = null;
    
    // Check if guest has a plus one
    if (guest.plus_one_id) {
        if (USE_MOCK_DATA) {
            currentPlusOne = getPlusOne(guest.plus_one_id);
        } else {
            currentPlusOne = await getPlusOneSupabase(guest.plus_one_id);
        }
    }
    
    // Build greeting
    let greeting = currentPlusOne 
        ? `RSVP for ${guest.first_name} ${guest.last_name} & ${currentPlusOne.first_name} ${currentPlusOne.last_name}`
        : `RSVP for ${guest.first_name} ${guest.last_name}`;
    
    // Populate primary guest info
    document.getElementById('guestGreeting').textContent = greeting;
    document.getElementById('primaryGuestName').textContent = `${guest.first_name} ${guest.last_name}`;
    document.getElementById('displayEmail').textContent = guest.email || 'Not provided';
    document.getElementById('displayPhone').textContent = guest.phone || 'Not provided';
    document.getElementById('displayAddress').textContent = guest.address || 'Not provided';
    
    // Pre-fill primary guest data if they've already RSVP'd
    if (guest.rsvp) {
        document.getElementById('rsvpResponse').value = guest.rsvp;
        if (guest.rsvp === 'yes') {
            showAttendingFields('primary');
            if (guest.meal_choice) document.getElementById('mealChoice').value = guest.meal_choice;
        }
    } else {
        document.getElementById('rsvpResponse').value = '';
    }
    if (guest.song_request) document.getElementById('songRequest').value = guest.song_request;
    if (guest.dietary_notes) document.getElementById('dietaryNotes').value = guest.dietary_notes;
    if (guest.general_notes) document.getElementById('generalNotes').value = guest.general_notes;
    
    // Handle plus one section
    if (currentPlusOne) {
        document.getElementById('plusOneSection').style.display = 'block';
        document.getElementById('plusOneName').textContent = `${currentPlusOne.first_name} ${currentPlusOne.last_name}`;
        document.getElementById('displayPlusOneEmail').textContent = currentPlusOne.email || 'Not provided';
        document.getElementById('displayPlusOnePhone').textContent = currentPlusOne.phone || 'Not provided';
        
        // Pre-fill plus one data if they've already RSVP'd
        if (currentPlusOne.rsvp) {
            document.getElementById('plusOneRsvpResponse').value = currentPlusOne.rsvp;
            if (currentPlusOne.rsvp === 'yes') {
                showAttendingFields('plusOne');
                if (currentPlusOne.meal_choice) document.getElementById('plusOneMealChoice').value = currentPlusOne.meal_choice;
            }
        } else {
            document.getElementById('plusOneRsvpResponse').value = '';
        }
        if (currentPlusOne.dietary_notes) document.getElementById('plusOneDietaryNotes').value = currentPlusOne.dietary_notes;
        if (currentPlusOne.general_notes) document.getElementById('plusOneGeneralNotes').value = currentPlusOne.general_notes;
        // Use shared song request
        if (!guest.song_request && currentPlusOne.song_request) {
            document.getElementById('songRequest').value = currentPlusOne.song_request;
        }
    } else {
        document.getElementById('plusOneSection').style.display = 'none';
    }
    
    // Show RSVP form, hide guest selection
    document.getElementById('guestSelectionSection').style.display = 'none';
    document.getElementById('rsvpFormSection').style.display = 'block';
}

// Handle RSVP response change - show/hide attending fields
document.getElementById('rsvpResponse').addEventListener('change', function() {
    if (this.value === 'yes') {
        showAttendingFields('primary');
    } else {
        hideAttendingFields('primary');
    }
});

// Handle Plus One RSVP response change
document.getElementById('plusOneRsvpResponse').addEventListener('change', function() {
    if (this.value === 'yes') {
        showAttendingFields('plusOne');
    } else {
        hideAttendingFields('plusOne');
    }
});

function showAttendingFields(type) {
    if (type === 'primary') {
        document.getElementById('mealChoiceGroup').style.display = 'block';
        document.getElementById('dietaryNotesGroup').style.display = 'block';
        document.getElementById('generalNotesGroup').style.display = 'block';
        document.getElementById('mealChoice').required = true;
        // Show song request if either person is attending
        document.getElementById('songRequestGroup').style.display = 'block';
    } else if (type === 'plusOne') {
        document.getElementById('plusOneMealChoiceGroup').style.display = 'block';
        document.getElementById('plusOneDietaryNotesGroup').style.display = 'block';
        document.getElementById('plusOneGeneralNotesGroup').style.display = 'block';
        document.getElementById('plusOneMealChoice').required = true;
        // Show song request if either person is attending
        document.getElementById('songRequestGroup').style.display = 'block';
    }
}

function hideAttendingFields(type) {
    if (type === 'primary') {
        document.getElementById('mealChoiceGroup').style.display = 'none';
        document.getElementById('dietaryNotesGroup').style.display = 'none';
        document.getElementById('generalNotesGroup').style.display = 'none';
        document.getElementById('mealChoice').required = false;
        
        // Hide song request only if plus one is also not attending
        const plusOneRsvp = document.getElementById('plusOneRsvpResponse').value;
        if (plusOneRsvp !== 'yes') {
            document.getElementById('songRequestGroup').style.display = 'none';
        }
    } else if (type === 'plusOne') {
        document.getElementById('plusOneMealChoiceGroup').style.display = 'none';
        document.getElementById('plusOneDietaryNotesGroup').style.display = 'none';
        document.getElementById('plusOneGeneralNotesGroup').style.display = 'none';
        document.getElementById('plusOneMealChoice').required = false;
        
        // Hide song request only if primary is also not attending
        const primaryRsvp = document.getElementById('rsvpResponse').value;
        if (primaryRsvp !== 'yes') {
            document.getElementById('songRequestGroup').style.display = 'none';
        }
    }
}

// Mock update function
function updateGuestMock(guestId, updates) {
    const guestIndex = mockDatabase.guests.findIndex(g => g.id === guestId);
    if (guestIndex !== -1) {
        mockDatabase.guests[guestIndex] = {
            ...mockDatabase.guests[guestIndex],
            ...updates,
            updated_at: new Date().toISOString()
        };
        console.log('Mock database updated:', mockDatabase.guests[guestIndex]);
        return { success: true };
    }
    return { success: false, error: 'Guest not found' };
}

// Step 2: RSVP Details Form Handler
console.log('[RSVP DEBUG] Attempting to attach RSVP details form handler...');
const rsvpDetailsForm = document.getElementById('rsvpDetailsForm');
if (!rsvpDetailsForm) {
    console.error('[RSVP DEBUG] ERROR: rsvpDetailsForm element not found!');
} else {
    console.log('[RSVP DEBUG] rsvpDetailsForm element found, attaching handler...');
    rsvpDetailsForm.addEventListener('submit', async function(e) {
    console.log('[RSVP DEBUG] RSVP details form submit event fired!');
    e.preventDefault();
    console.log('[RSVP DEBUG] Prevented default form submission');
    
    if (!currentGuest) {
        console.error('[RSVP DEBUG] ERROR: currentGuest is null!');
        alert('Error: Guest information not found. Please start over.');
        return;
    }
    console.log('[RSVP DEBUG] Current guest:', currentGuest);
    
    const rsvpResponse = document.getElementById('rsvpResponse').value;
    const mealChoice = document.getElementById('mealChoice').value || null;
    const songRequest = document.getElementById('songRequest').value.trim() || null;
    const dietaryNotes = document.getElementById('dietaryNotes').value.trim() || null;
    const generalNotes = document.getElementById('generalNotes').value.trim() || null;
    
    try {
        // Update primary guest
        if (USE_MOCK_DATA) {
            const result = updateGuestMock(currentGuest.id, {
                rsvp: rsvpResponse,
                meal_choice: mealChoice,
                song_request: songRequest,
                dietary_notes: dietaryNotes,
                general_notes: generalNotes
            });
            
            if (!result.success) {
                throw new Error(result.error);
            }
        } else {
            const updateClient = window.rsvpSupabaseClient || supabaseClient;
            if (!updateClient) {
                throw new Error('Supabase client not initialized');
            }
            
            const { error } = await updateClient
                .from('guests')
                .update({
                    rsvp: rsvpResponse,
                    meal_choice: mealChoice,
                    song_request: songRequest,
                    dietary_notes: dietaryNotes,
                    general_notes: generalNotes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentGuest.id);
            
            if (error) {
                throw error;
            }
        }
        
        // Update plus one if they exist
        if (currentPlusOne) {
            const plusOneRsvpResponse = document.getElementById('plusOneRsvpResponse').value;
            const plusOneMealChoice = document.getElementById('plusOneMealChoice').value || null;
            const plusOneDietaryNotes = document.getElementById('plusOneDietaryNotes').value.trim() || null;
            const plusOneGeneralNotes = document.getElementById('plusOneGeneralNotes').value.trim() || null;
            
            if (USE_MOCK_DATA) {
                const result = updateGuestMock(currentPlusOne.id, {
                    rsvp: plusOneRsvpResponse,
                    meal_choice: plusOneMealChoice,
                    song_request: songRequest, // Share song request
                    dietary_notes: plusOneDietaryNotes,
                    general_notes: plusOneGeneralNotes
                });
                
                if (!result.success) {
                    throw new Error(result.error);
                }
            } else {
                const updateClient = window.rsvpSupabaseClient || supabaseClient;
                if (!updateClient) {
                    throw new Error('Supabase client not initialized');
                }
                
                const { error } = await updateClient
                    .from('guests')
                    .update({
                        rsvp: plusOneRsvpResponse,
                        meal_choice: plusOneMealChoice,
                        song_request: songRequest,
                        dietary_notes: plusOneDietaryNotes,
                        general_notes: plusOneGeneralNotes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentPlusOne.id);
                
                if (error) {
                    throw error;
                }
            }
        }
        
        // Determine which success message to show based on RSVP responses
        const plusOneRsvp = currentPlusOne ? document.getElementById('plusOneRsvpResponse').value : '';
        const isAnyoneAttending = rsvpResponse === 'yes' || plusOneRsvp === 'yes';
        
        // Get success message elements
        const successMsgAttending = document.getElementById('successMessageAttending');
        const successMsgNotAttending = document.getElementById('successMessageNotAttending');
        
        // Check if elements exist (in case page wasn't refreshed after update)
        if (!successMsgAttending || !successMsgNotAttending) {
            console.error('Success message elements not found. Please refresh the page.');
            // Fallback behavior
            document.getElementById('rsvpFormSection').style.display = 'none';
            document.getElementById('successSection').style.display = 'block';
            return;
        }
        
        if (isAnyoneAttending) {
            successMsgAttending.style.display = 'block';
            successMsgNotAttending.style.display = 'none';
        } else {
            successMsgAttending.style.display = 'none';
            successMsgNotAttending.style.display = 'block';
        }
        
        // Show success message
        document.getElementById('rsvpFormSection').style.display = 'none';
        document.getElementById('successSection').style.display = 'block';
        
    } catch (err) {
        console.error('[RSVP DEBUG] Error submitting RSVP:', err);
        alert('An error occurred while submitting your RSVP. Please try again.');
    }
    });
    console.log('[RSVP DEBUG] RSVP details form handler attached successfully');
}

// Back button handler from RSVP form
document.getElementById('backBtn').addEventListener('click', function() {
    // Reset form
    document.getElementById('rsvpDetailsForm').reset();
    currentGuest = null;
    currentPlusOne = null;
    
    // Hide conditional fields
    hideAttendingFields('primary');
    hideAttendingFields('plusOne');
    
    // Show name lookup, hide RSVP form
    document.getElementById('rsvpFormSection').style.display = 'none';
    document.getElementById('nameLookupSection').style.display = 'block';
});

// Back button handler from guest selection
document.getElementById('backToNameBtn').addEventListener('click', function() {
    // Show name lookup, hide guest selection
    document.getElementById('guestSelectionSection').style.display = 'none';
    document.getElementById('nameLookupSection').style.display = 'block';
});
