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
    console.warn('rsvp.js has already been loaded. Skipping re-initialization.');
} else {
    window.rsvpSystemInitialized = true;

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
            }
        } catch (error) {
            console.error('Error initializing Supabase client:', error);
        }
    } else if (!USE_MOCK_DATA) {
        console.warn('Supabase not initialized. Check that SUPABASE_CONFIG is defined and Supabase library is loaded.');
    }
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

// Guests currently being edited in the RSVP form (subset of matchedGuests)
let currentRsvpGuests = [];

// Split a single "full name" field into first + last (first word = first name, rest = last name)
function parseFullName(fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length === 0) {
        return { firstName: '', lastName: '' };
    }
    if (nameParts.length === 1) {
        return { firstName: nameParts[0], lastName: '' };
    }
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
}

// Helper function to get plus one for a guest
function getPlusOne(guestId) {
    return mockDatabase.guests.find(g => g.id === guestId);
}

// Helper function to find all guests linked to a guest (family group and/or plus-one pair)
function getLinkedGuests(guest) {
    const linked = [];
    const seen = new Set();
    function add(g) {
        if (g && !seen.has(g.id)) {
            seen.add(g.id);
            linked.push(g);
        }
    }
    add(guest);

    const fam = (guest.family && String(guest.family).trim()) || '';
    if (fam) {
        mockDatabase.guests.forEach(function (g) {
            const gf = (g.family && String(g.family).trim()) || '';
            if (gf && gf.toLowerCase() === fam.toLowerCase()) {
                add(g);
            }
        });
        expandPlusOneEdgesMock(linked, add);
        return linked;
    }

    if (guest.plus_one_id) {
        const plusOne = getPlusOne(guest.plus_one_id);
        if (plusOne && plusOne.id !== guest.id) {
            add(plusOne);
        }
    }

    const reverseLink = mockDatabase.guests.find(function (g) {
        return g.plus_one_id === guest.id && g.id !== guest.id;
    });
    if (reverseLink) {
        add(reverseLink);
    }

    return linked;
}

// After a family group is loaded, add anyone linked via plus_one (e.g. a guest's date not in `family`)
function expandPlusOneEdgesMock(linked, add) {
    const snapshot = linked.slice();
    snapshot.forEach(function (g) {
        if (g.plus_one_id) {
            const plusOne = getPlusOne(g.plus_one_id);
            if (plusOne) {
                add(plusOne);
            }
        }
        mockDatabase.guests.forEach(function (other) {
            if (other.plus_one_id === g.id && other.id !== g.id) {
                add(other);
            }
        });
    });
}

function exactNameMatchMock(fnLower, lnLower, guest) {
    var gfn = guest.first_name.trim().toLowerCase();
    var gln = guest.last_name.trim().toLowerCase();
    var nick = guest.nickname ? String(guest.nickname).trim().toLowerCase() : '';
    return (gfn === fnLower && gln === lnLower) || (!!nick && nick === fnLower && gln === lnLower);
}

// Mock: exact match (legal or nickname + last), else Levenshtein within RSVP_FUZZY_MAX_DISTANCE; then expand linked guests
function lookupGuestsMock(firstName, lastName) {
    var fn = (firstName || '').trim().toLowerCase();
    var ln = (lastName || '').trim().toLowerCase();
    var seeds = mockDatabase.guests.filter(function (guest) {
        return exactNameMatchMock(fn, ln, guest);
    });
    var usedFuzzy = false;
    if (seeds.length === 0) {
        seeds = fuzzyFilterGuests(mockDatabase.guests, firstName, lastName);
        usedFuzzy = seeds.length > 0;
    }

    var matchesArray = [];
    var addedIds = new Set();
    seeds.forEach(function (guest) {
        var linkedGuests = getLinkedGuests(guest);
        linkedGuests.forEach(function (linkedGuest) {
            if (!addedIds.has(linkedGuest.id)) {
                addedIds.add(linkedGuest.id);
                matchesArray.push(linkedGuest);
            }
        });
    });

    return { guests: matchesArray, usedFuzzy: usedFuzzy };
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

// Helper function to find all linked guests from Supabase (same `family` label and/or plus-one pair)
async function getLinkedGuestsSupabase(guest) {
    const client = window.rsvpSupabaseClient || supabaseClient;
    if (!client) {
        console.error('Supabase client not available in getLinkedGuestsSupabase');
        return [guest]; // Return at least the guest itself
    }

    const linked = [];
    const seen = new Set();
    function add(g) {
        if (g && g.id != null && !seen.has(g.id)) {
            seen.add(g.id);
            linked.push(g);
        }
    }
    add(guest);

    const fam = (guest.family && String(guest.family).trim()) || '';
    if (fam) {
        const { data: familyMembers, error } = await client
            .from('guests')
            .select('*')
            .eq('family', fam);

        if (error) {
            console.error('getLinkedGuestsSupabase family query:', error);
            return linked;
        }
        (familyMembers || []).forEach(function (m) {
            add(m);
        });
        await expandPlusOneEdgesSupabase(client, linked, add);
        return linked;
    }

    if (guest.plus_one_id) {
        const plusOne = await getPlusOneSupabase(guest.plus_one_id);
        if (plusOne && plusOne.id !== guest.id) {
            add(plusOne);
        }
    }

    const { data: reverseLinks } = await client
        .from('guests')
        .select('*')
        .eq('plus_one_id', guest.id);

    if (reverseLinks && reverseLinks.length > 0) {
        reverseLinks.forEach(function (reverseLink) {
            add(reverseLink);
        });
    }

    return linked;
}

// For each guest already in `linked`, add their plus_one and anyone who lists them as plus_one
async function expandPlusOneEdgesSupabase(client, linked, add) {
    const snapshot = linked.slice();
    for (let i = 0; i < snapshot.length; i++) {
        const g = snapshot[i];
        if (g.plus_one_id) {
            const plusOne = await getPlusOneSupabase(g.plus_one_id);
            if (plusOne) {
                add(plusOne);
            }
        }
        const { data: reverseLinks } = await client
            .from('guests')
            .select('*')
            .eq('plus_one_id', g.id);
        if (reverseLinks && reverseLinks.length > 0) {
            reverseLinks.forEach(function (r) {
                add(r);
            });
        }
    }
}

// Lookup: exact ilike on first+last, plus nickname+last if column exists; else fuzzy (Levenshtein) on full guest list
async function lookupGuestsSupabase(firstName, lastName) {
    var client = window.rsvpSupabaseClient || supabaseClient;

    if (!client) {
        throw new Error('Supabase client not initialized. Please refresh the page.');
    }

    var fn = firstName.trim();
    var ln = lastName.trim();

    var byLegal = [];
    var res1 = await client
        .from('guests')
        .select('*')
        .ilike('first_name', fn)
        .ilike('last_name', ln);

    if (res1.error) {
        if (res1.error.code === 'PGRST301' || (res1.error.message && (res1.error.message.includes('permission') || res1.error.message.includes('policy')))) {
            throw new Error('Database query blocked. This may be a Row Level Security (RLS) issue. Please check your Supabase RLS policies allow public SELECT access.');
        }
        throw res1.error;
    }
    byLegal = res1.data || [];

    var byNick = [];
    var res2 = await client
        .from('guests')
        .select('*')
        .not('nickname', 'is', null)
        .neq('nickname', '')
        .ilike('nickname', fn)
        .ilike('last_name', ln);

    if (res2.error) {
        console.warn('RSVP: nickname query failed (add scripts/add_nickname_column.sql if the column is missing):', res2.error.message || res2.error);
    } else {
        byNick = res2.data || [];
    }

    var byId = new Map();
    byLegal.forEach(function (g) {
        byId.set(g.id, g);
    });
    byNick.forEach(function (g) {
        byId.set(g.id, g);
    });
    var initialMatches = Array.from(byId.values());
    var usedFuzzy = false;

    if (initialMatches.length === 0) {
        var resAll = await client.from('guests').select('*');
        if (resAll.error) {
            throw resAll.error;
        }
        initialMatches = fuzzyFilterGuests(resAll.data || [], fn, ln);
        usedFuzzy = initialMatches.length > 0;
    }

    var seen = new Set();
    var matchesArray = [];

    for (var i = 0; i < initialMatches.length; i++) {
        var guest = initialMatches[i];
        var linkedGuests = await getLinkedGuestsSupabase(guest);
        linkedGuests.forEach(function (linkedGuest) {
            if (!seen.has(linkedGuest.id)) {
                seen.add(linkedGuest.id);
                matchesArray.push(linkedGuest);
            }
        });
    }

    return { guests: matchesArray, usedFuzzy: usedFuzzy };
}

// Unified lookup — returns { guests, usedFuzzy }
async function lookupGuests(firstName, lastName) {
    if (USE_MOCK_DATA) {
        return lookupGuestsMock(firstName, lastName);
    }
    if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
    }
    return await lookupGuestsSupabase(firstName, lastName);
}

// Step 1: Name Lookup Form Handler
const nameLookupForm = document.getElementById('nameLookupForm');
if (nameLookupForm) {
    nameLookupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
    
    if (!fullName) {
        errorMessage.textContent = 'Please enter your name.';
        errorMessage.style.display = 'block';
        return;
    }
    
    const { firstName, lastName } = parseFullName(fullName);
    if (!firstName || !lastName) {
        errorMessage.textContent = 'Please enter your full name (e.g. Jane Doe).';
        errorMessage.style.display = 'block';
        return;
    }
    
    try {
        var lookupResult = await lookupGuests(firstName, lastName);
        var guests = lookupResult.guests;

        if (!guests || guests.length === 0) {
            errorMessage.textContent = 'Guest not found. Please check your name and try again, or click "Text Me" below for assistance.';
            errorMessage.style.display = 'block';
            return;
        }

        displayGuestList(guests, { usedFuzzy: lookupResult.usedFuzzy });
        
        document.getElementById('nameLookupSection').style.display = 'none';
        document.getElementById('guestSelectionSection').style.display = 'block';
        
    } catch (err) {
        console.error('Error looking up guest:', err);
        errorMessage.textContent = 'An error occurred. Please try again later.';
        errorMessage.style.display = 'block';
    }
    });
}

// Store the matched guests for later use
let matchedGuests = [];
/** @type {Set<string>} */
let selectedGuestIds = new Set();

// Escape text for safe insertion into HTML (e.g. family labels from DB)
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Typo-tolerant name matching (Levenshtein on full "First Last" vs DB, and vs "Nickname Last" if set)
var RSVP_FUZZY_MAX_DISTANCE = 2;

function levenshtein(a, b) {
    a = (a || '').toLowerCase();
    b = (b || '').toLowerCase();
    var m = a.length;
    var n = b.length;
    var d = [];
    var i;
    var j;
    for (i = 0; i <= m; i++) {
        d[i] = [];
        d[i][0] = i;
    }
    for (j = 0; j <= n; j++) {
        d[0][j] = j;
    }
    for (i = 1; i <= m; i++) {
        for (j = 1; j <= n; j++) {
            var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost
            );
        }
    }
    return d[m][n];
}

function normalizeNamePart(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/** Smaller = closer match; compares typed "first last" to legal name and to "nickname last". */
function fullNameDistance(queryFirst, queryLast, guest) {
    var fn = normalizeNamePart(guest.first_name);
    var ln = normalizeNamePart(guest.last_name);
    var nick = guest.nickname ? normalizeNamePart(guest.nickname) : '';
    var q = normalizeNamePart(queryFirst) + ' ' + normalizeNamePart(queryLast);
    var legal = fn + ' ' + ln;
    var best = levenshtein(q, legal);
    if (nick) {
        best = Math.min(best, levenshtein(q, nick + ' ' + ln));
    }
    return best;
}

function fuzzyFilterGuests(guestRows, queryFirst, queryLast) {
    var scored = guestRows.map(function (g) {
        return { g: g, d: fullNameDistance(queryFirst, queryLast, g) };
    });
    scored = scored.filter(function (x) {
        return x.d <= RSVP_FUZZY_MAX_DISTANCE;
    });
    scored.sort(function (a, b) {
        return a.d - b.d;
    });
    return scored.map(function (x) {
        return x.g;
    });
}

function findGuestBlock(container, guestId) {
    return Array.from(container.querySelectorAll('.rsvp-guest-block')).find(function (b) {
        return String(b.dataset.guestId) === String(guestId);
    });
}

function buildGuestBlockHTML(guest) {
    const fn = escapeHtml(guest.first_name);
    const ln = escapeHtml(guest.last_name);
    const email = guest.email ? escapeHtml(guest.email) : 'Not provided';
    const phone = guest.phone ? escapeHtml(guest.phone) : 'Not provided';
    const address = guest.address ? escapeHtml(guest.address) : 'Not provided';
    const dayAfterInvited =
        guest.day_after_invited === true || guest.day_after_invited === 'true';
    const dayAfterSection = dayAfterInvited
        ? '<div class="form-group rsvp-day-after-group">' +
              '<label class="form-label">Will ' + fn + ' attend the day-after gathering?</label>' +
              '<select class="form-input rsvp-day-after-response" required>' +
                  '<option value="">Please select...</option>' +
                  '<option value="yes">Yes</option>' +
                  '<option value="no">No</option>' +
              '</select>' +
          '</div>'
        : '';
    return (
        '<div class="guest-section rsvp-guest-block" data-guest-id="' +
            escapeHtml(String(guest.id)) +
            '" data-day-after-invited="' +
            (dayAfterInvited ? 'true' : 'false') +
            '">' +
            '<h3 class="section-title">' + fn + ' ' + ln + '</h3>' +
            '<div class="guest-info">' +
                '<p><strong>Email:</strong> ' + email + '</p>' +
                '<p><strong>Phone:</strong> ' + phone + '</p>' +
                '<p><strong>Address:</strong> ' + address + '</p>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">Will ' + fn + ' be attending?</label>' +
                '<select class="form-input rsvp-guest-response" required>' +
                    '<option value="">Please select...</option>' +
                    '<option value="yes">Yes, will attend</option>' +
                    '<option value="no">No, cannot attend</option>' +
                '</select>' +
            '</div>' +
            '<div class="rsvp-attending-fields" style="display: none;">' +
                '<div class="form-group rsvp-meal-choice-group">' +
                    '<label class="form-label">Meal choice</label>' +
                    '<select class="form-input rsvp-meal-choice">' +
                        '<option value="">Please select...</option>' +
                        '<option value="chicken">Chicken</option>' +
                        '<option value="beef">Beef</option>' +
                        '<option value="fish">Fish</option>' +
                        '<option value="vegetarian">Vegetarian</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label">Dietary restrictions (optional)</label>' +
                    '<textarea class="form-input form-textarea rsvp-dietary-notes" rows="3" placeholder="Allergies or dietary restrictions"></textarea>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label">General notes (optional)</label>' +
                    '<textarea class="form-input form-textarea rsvp-general-notes" rows="3" placeholder="Anything else you would like to share"></textarea>' +
                '</div>' +
            '</div>' +
            dayAfterSection +
        '</div>'
    );
}

function showAttendingFieldsForBlock(blockEl, show) {
    const wrap = blockEl.querySelector('.rsvp-attending-fields');
    const meal = blockEl.querySelector('.rsvp-meal-choice');
    if (!wrap || !meal) return;
    wrap.style.display = show ? 'block' : 'none';
    meal.required = !!show;
    if (!show) {
        meal.value = '';
    }
}

function updateSongGroupVisibility() {
    const form = document.getElementById('rsvpDetailsForm');
    const grp = document.getElementById('songRequestGroup');
    if (!form || !grp) return;
    const anyYes = Array.from(form.querySelectorAll('.rsvp-guest-response')).some(function (el) {
        return el.value === 'yes';
    });
    grp.style.display = anyYes ? 'block' : 'none';
}

// Display list of matching guests (one card per person; multi-select)
function displayGuestList(guests, options) {
    options = options || {};
    var usedFuzzy = !!options.usedFuzzy;
    var sub = document.getElementById('guestSelectionSubtitle');
    if (sub) {
        sub.textContent = usedFuzzy
            ? 'These names are close to what you typed — select everyone on this invitation.'
            : 'We found the following people on this invitation:';
    }

    matchedGuests = guests;
    selectedGuestIds = new Set();
    const guestList = document.getElementById('guestList');
    guestList.innerHTML = '';

    guests.forEach(function (guest) {
        const guestCard = document.createElement('div');
        guestCard.className = 'guest-card-display';
        guestCard.dataset.guestId = guest.id;
        guestCard.setAttribute('role', 'button');
        guestCard.setAttribute('aria-pressed', 'false');
        guestCard.tabIndex = 0;

        const famLabel = (guest.family && String(guest.family).trim()) || '';
        let roleHint = '';
        if (famLabel) {
            roleHint = '<p class="guest-role-hint">' + escapeHtml(famLabel) + '</p>';
        }
        const emailLine = guest.email ? '<p class="guest-details">' + escapeHtml(guest.email) + '</p>' : '';
        const addressLine = guest.address ? '<p class="guest-details">' + escapeHtml(guest.address) + '</p>' : '';

        guestCard.innerHTML =
            '<h3 class="guest-name">' + escapeHtml(guest.first_name) + ' ' + escapeHtml(guest.last_name) + '</h3>' +
            roleHint +
            emailLine +
            addressLine;

        guestCard.addEventListener('click', function () {
            toggleGuestCard(guest.id);
        });
        guestCard.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                toggleGuestCard(guest.id);
            }
        });

        guestList.appendChild(guestCard);
    });

    document.querySelectorAll('.guest-card-display').forEach(function (card) {
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    });
    updateContinueButton();
}

function toggleGuestCard(guestId) {
    const id = String(guestId);
    if (selectedGuestIds.has(id)) {
        selectedGuestIds.delete(id);
    } else {
        selectedGuestIds.add(id);
    }
    document.querySelectorAll('.guest-card-display').forEach(function (card) {
        const cid = String(card.dataset.guestId);
        const on = selectedGuestIds.has(cid);
        card.classList.toggle('selected', on);
        card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    updateContinueButton();
}

function updateContinueButton() {
    const continueBtn = document.getElementById('continueToRsvpBtn');
    if (continueBtn) {
        continueBtn.disabled = selectedGuestIds.size === 0;
    }
}

function buildRsvpGreeting(names) {
    if (names.length === 0) return '';
    if (names.length === 1) return 'RSVP for ' + names[0];
    if (names.length === 2) return 'RSVP for ' + names[0] + ' & ' + names[1];
    return 'RSVP for ' + names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

async function openRsvpFormForSelectedGuests() {
    if (selectedGuestIds.size === 0) return;

    const selected = matchedGuests.filter(function (g) {
        return selectedGuestIds.has(String(g.id));
    });
    currentRsvpGuests = selected;

    const names = selected.map(function (g) {
        return g.first_name + ' ' + g.last_name;
    });
    document.getElementById('guestGreeting').textContent = buildRsvpGreeting(names);

    const container = document.getElementById('rsvpBlocksContainer');
    container.innerHTML = selected.map(buildGuestBlockHTML).join('');

    selected.forEach(function (g) {
        const block = findGuestBlock(container, g.id);
        if (!block) return;
        const sel = block.querySelector('.rsvp-guest-response');
        if (g.rsvp) {
            sel.value = g.rsvp;
            if (g.rsvp === 'yes') {
                showAttendingFieldsForBlock(block, true);
                const meal = block.querySelector('.rsvp-meal-choice');
                if (meal && g.meal_choice) meal.value = g.meal_choice;
            }
        }
        const diet = block.querySelector('.rsvp-dietary-notes');
        if (diet && g.dietary_notes) diet.value = g.dietary_notes;
        const gen = block.querySelector('.rsvp-general-notes');
        if (gen && g.general_notes) gen.value = g.general_notes;
        const dayAfter = block.querySelector('.rsvp-day-after-response');
        if (dayAfter && g.day_after_rsvp) dayAfter.value = g.day_after_rsvp;
    });

    const songInput = document.getElementById('songRequest');
    songInput.value = '';
    for (let i = 0; i < selected.length; i++) {
        if (selected[i].song_request) {
            songInput.value = selected[i].song_request;
            break;
        }
    }

    updateSongGroupVisibility();
    document.getElementById('guestSelectionSection').style.display = 'none';
    document.getElementById('rsvpFormSection').style.display = 'block';
}

const continueToRsvpBtn = document.getElementById('continueToRsvpBtn');
if (continueToRsvpBtn) {
    continueToRsvpBtn.addEventListener('click', function () {
        openRsvpFormForSelectedGuests();
    });
}

// Mock update function (used when USE_MOCK_DATA is true)
function updateGuestMock(guestId, updates) {
    const guestIndex = mockDatabase.guests.findIndex(function (g) {
        return String(g.id) === String(guestId);
    });
    if (guestIndex !== -1) {
        mockDatabase.guests[guestIndex] = {
            ...mockDatabase.guests[guestIndex],
            ...updates,
            updated_at: new Date().toISOString()
        };
        return { success: true };
    }
    return { success: false, error: 'Guest not found' };
}

const rsvpDetailsForm = document.getElementById('rsvpDetailsForm');
if (rsvpDetailsForm) {
    rsvpDetailsForm.addEventListener('change', function (e) {
        const t = e.target;
        if (t && t.classList && t.classList.contains('rsvp-guest-response')) {
            const block = t.closest('.rsvp-guest-block');
            if (block) {
                if (t.value === 'yes') {
                    showAttendingFieldsForBlock(block, true);
                } else {
                    showAttendingFieldsForBlock(block, false);
                }
                updateSongGroupVisibility();
            }
        }
    });

    rsvpDetailsForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!currentRsvpGuests || currentRsvpGuests.length === 0) {
            alert('Error: Guest information not found. Please start over.');
            return;
        }

        const songRequest = document.getElementById('songRequest').value.trim() || null;
        const container = document.getElementById('rsvpBlocksContainer');
        const blocks = container ? container.querySelectorAll('.rsvp-guest-block') : [];

        for (let v = 0; v < blocks.length; v++) {
            const vb = blocks[v];
            if (vb.getAttribute('data-day-after-invited') === 'true') {
                const da = vb.querySelector('.rsvp-day-after-response');
                if (!da || !da.value) {
                    alert('Please answer the day-after gathering question for each invited guest.');
                    return;
                }
            }
        }

        try {
            const updateClient = window.rsvpSupabaseClient || supabaseClient;
            let isAnyoneAttending = false;

            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
                const rsvpEl = block.querySelector('.rsvp-guest-response');
                if (!rsvpEl) continue;
                const rsvpResponse = rsvpEl.value;
                const mealEl = block.querySelector('.rsvp-meal-choice');
                const mealChoice = rsvpResponse === 'yes' && mealEl ? mealEl.value || null : null;
                const dietaryEl = block.querySelector('.rsvp-dietary-notes');
                const generalEl = block.querySelector('.rsvp-general-notes');
                const dietaryNotes = dietaryEl && dietaryEl.value.trim() ? dietaryEl.value.trim() : null;
                const generalNotes = generalEl && generalEl.value.trim() ? generalEl.value.trim() : null;
                const guestId = block.dataset.guestId;
                const dayAfterInvited = block.getAttribute('data-day-after-invited') === 'true';
                const dayAfterEl = block.querySelector('.rsvp-day-after-response');

                if (rsvpResponse === 'yes') {
                    isAnyoneAttending = true;
                }

                const dayAfterRsvp =
                    dayAfterInvited && dayAfterEl && dayAfterEl.value ? dayAfterEl.value : null;

                if (USE_MOCK_DATA) {
                    const mockPayload = {
                        rsvp: rsvpResponse,
                        meal_choice: mealChoice,
                        song_request: songRequest,
                        dietary_notes: dietaryNotes,
                        general_notes: generalNotes
                    };
                    if (dayAfterInvited) {
                        mockPayload.day_after_rsvp = dayAfterRsvp;
                    }
                    const result = updateGuestMock(guestId, mockPayload);
                    if (!result.success) {
                        throw new Error(result.error);
                    }
                } else {
                    if (!updateClient) {
                        throw new Error('Supabase client not initialized');
                    }
                    const updatePayload = {
                        rsvp: rsvpResponse,
                        meal_choice: mealChoice,
                        song_request: songRequest,
                        dietary_notes: dietaryNotes,
                        general_notes: generalNotes,
                        updated_at: new Date().toISOString()
                    };
                    if (dayAfterInvited) {
                        updatePayload.day_after_rsvp = dayAfterRsvp;
                    }
                    const { error } = await updateClient
                        .from('guests')
                        .update(updatePayload)
                        .eq('id', guestId);

                    if (error) {
                        throw error;
                    }
                }
            }

            const successMsgAttending = document.getElementById('successMessageAttending');
            const successMsgNotAttending = document.getElementById('successMessageNotAttending');

            if (!successMsgAttending || !successMsgNotAttending) {
                console.error('Success message elements not found. Please refresh the page.');
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

            document.getElementById('rsvpFormSection').style.display = 'none';
            document.getElementById('successSection').style.display = 'block';
        } catch (err) {
            console.error('Error submitting RSVP:', err);
            alert('An error occurred while submitting your RSVP. Please try again.');
        }
    });
}

// Back button handler from RSVP form
const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', function () {
        const form = document.getElementById('rsvpDetailsForm');
        if (form) form.reset();
        const blocks = document.getElementById('rsvpBlocksContainer');
        if (blocks) blocks.innerHTML = '';
        currentRsvpGuests = [];
        selectedGuestIds = new Set();
        document.getElementById('rsvpFormSection').style.display = 'none';
        document.getElementById('nameLookupSection').style.display = 'block';
    });
}

// Back button handler from guest selection
const backToNameBtn = document.getElementById('backToNameBtn');
if (backToNameBtn) {
    backToNameBtn.addEventListener('click', function () {
        selectedGuestIds = new Set();
        document.getElementById('guestSelectionSection').style.display = 'none';
        document.getElementById('nameLookupSection').style.display = 'block';
    });
}
