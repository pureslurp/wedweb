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

const MEAL_CHOICES = [
    {
        value: 'beef',
        label: 'Beef Tenderloin with Demi-Glace (8oz) — asparagus & mashed potatoes',
    },
    {
        value: 'chicken',
        label: 'Grilled Chicken Breast with Basil Pesto (10oz) — asparagus & mashed potatoes',
    },
    {
        value: 'vegetarian',
        label: 'Gnocchi Bolognese — Vegan & Vegetarian',
    },
];

function buildMealChoiceOptionsHtml() {
    return MEAL_CHOICES.map(function (choice) {
        return '<option value="' + choice.value + '">' + escapeHtml(choice.label) + '</option>';
    }).join('');
}

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
/** Guest ids who answered yes to the wedding on the last successful submit. */
let lastSubmittedAttendingGuestIds = [];

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

function expandMockLookupSeeds(seeds) {
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
    return matchesArray;
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

    return { guests: expandMockLookupSeeds(seeds), usedFuzzy: usedFuzzy };
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
async function expandSupabaseLookupSeeds(initialMatches) {
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

    return matchesArray;
}

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

    return { guests: await expandSupabaseLookupSeeds(initialMatches), usedFuzzy: usedFuzzy };
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
        errorMessage.textContent = 'Please enter your first and last name (e.g. Jane Doe or Sagi Ortega).';
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

/** Smaller = closer match; compares typed "first last" to legal name and to nickname + last. */
function fullNameDistance(queryFirst, queryLast, guest) {
    var fn = normalizeNamePart(guest.first_name);
    var ln = normalizeNamePart(guest.last_name);
    var nick = guest.nickname ? normalizeNamePart(guest.nickname) : '';
    var qFirst = normalizeNamePart(queryFirst);
    var qLast = normalizeNamePart(queryLast);
    var q = qFirst + ' ' + qLast;
    var legal = fn + ' ' + ln;
    var best = levenshtein(q, legal);
    if (nick && qLast === ln) {
        var nickFirstDist = levenshtein(qFirst, nick);
        if (nickFirstDist <= 1) {
            best = Math.min(best, nickFirstDist);
        }
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

function getWeddingBlocksRoot() {
    return document.getElementById('rsvpWeddingBlocksContainer');
}

function findGuestBlock(container, guestId) {
    if (!container) return undefined;
    return Array.from(container.querySelectorAll('.rsvp-guest-block')).find(function (b) {
        return String(b.dataset.guestId) === String(guestId);
    });
}

function isValidEmail(value) {
    var v = String(value || '').trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function buildGuestBlockHTML(guest) {
    const fn = escapeHtml(guest.first_name);
    const ln = escapeHtml(guest.last_name);
    return (
        '<div class="guest-section rsvp-guest-block" data-guest-id="' +
            escapeHtml(String(guest.id)) +
            '">' +
            '<h3 class="section-title">' + fn + ' ' + ln + '</h3>' +
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
                        buildMealChoiceOptionsHtml() +
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
        guestCard.innerHTML =
            '<h3 class="guest-name">' + escapeHtml(guest.first_name) + ' ' + escapeHtml(guest.last_name) + '</h3>' +
            roleHint;

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

function guestHasResponded(g) {
    return g.rsvp === 'yes' || g.rsvp === 'no';
}

function getSelectedGuests() {
    return matchedGuests.filter(function (g) {
        return selectedGuestIds.has(String(g.id));
    });
}

function partyHasAnyRsvp(guests) {
    return guests.some(guestHasResponded);
}

function continueFromGuestSelection() {
    if (selectedGuestIds.size === 0) return;
    var selected = getSelectedGuests();
    if (partyHasAnyRsvp(selected)) {
        openRsvpStatusForSelectedGuests();
    } else {
        openRsvpFormForSelectedGuests();
    }
}

function formatMealLabel(meal) {
    if (!meal) return '';
    var match = MEAL_CHOICES.find(function (choice) {
        return choice.value === meal;
    });
    if (match) return match.label;
    return String(meal).charAt(0).toUpperCase() + String(meal).slice(1);
}

function formatYesNoLabel(val, yesText, noText) {
    if (val === 'yes') return yesText || 'Yes';
    if (val === 'no') return noText || 'No';
    return null;
}

function rsvpStatusLine(label, value) {
    if (!value) return '';
    return (
        '<p><strong>' +
        escapeHtml(label) +
        ':</strong> <span class="rsvp-status-value">' +
        escapeHtml(String(value)) +
        '</span></p>'
    );
}

function buildRsvpStatusGuestCard(g) {
    var fn = escapeHtml(g.first_name);
    var ln = escapeHtml(g.last_name);
    var lines = [];
    var weddingStatus;

    if (g.rsvp === 'yes') {
        weddingStatus = 'Attending';
    } else if (g.rsvp === 'no') {
        weddingStatus = 'Not attending';
    } else {
        weddingStatus = 'Not yet responded';
    }
    lines.push(rsvpStatusLine('Wedding', weddingStatus));

    if (g.rsvp === 'yes') {
        if (g.meal_choice) {
            lines.push(rsvpStatusLine('Meal', formatMealLabel(g.meal_choice)));
        }
        var marriott = formatYesNoLabel(g.marriott_stay, 'Yes', 'No');
        if (marriott) {
            lines.push(rsvpStatusLine('Staying at Marriott (room block)', marriott));
        }
        if (g.marriott_stay === 'yes') {
            var shuttle = formatYesNoLabel(
                g.shuttle_rsvp,
                'Yes, planning to take the shuttle',
                'No',
            );
            if (shuttle) {
                lines.push(rsvpStatusLine('Hotel shuttle', shuttle));
            }
        }
        if (g.dietary_notes) {
            lines.push(rsvpStatusLine('Dietary restrictions', g.dietary_notes));
        }
        if (g.general_notes) {
            lines.push(rsvpStatusLine('General notes', g.general_notes));
        }
    }

    return (
        '<div class="guest-section rsvp-status-guest-block">' +
        '<h3 class="section-title">' +
        fn +
        ' ' +
        ln +
        '</h3>' +
        '<div class="rsvp-status-details">' +
        lines.join('') +
        '</div>' +
        '</div>'
    );
}

function openRsvpStatusForSelectedGuests() {
    if (selectedGuestIds.size === 0) return;

    var selected = getSelectedGuests();
    currentRsvpGuests = selected;

    var names = selected.map(function (g) {
        return g.first_name + ' ' + g.last_name;
    });
    var greeting = document.getElementById('rsvpStatusGreeting');
    if (greeting) {
        greeting.textContent = buildRsvpGreeting(names);
    }

    var container = document.getElementById('rsvpStatusBlocksContainer');
    if (container) {
        container.innerHTML = selected.map(buildRsvpStatusGuestCard).join('');
    }

    var actionBtn = document.getElementById('rsvpStatusActionBtn');
    if (actionBtn) {
        actionBtn.textContent = 'Edit RSVP';
    }

    var hint = document.getElementById('rsvpStatusHint');
    if (hint) {
        hint.style.display = 'block';
    }

    document.getElementById('guestSelectionSection').style.display = 'none';
    document.getElementById('rsvpStatusSection').style.display = 'block';
    document.getElementById('rsvpFormSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
}

function countTotalWizardSteps() {
    return 2;
}

function wizardStepLabel(activeIndex, total) {
    return 'Step ' + activeIndex + ' of ' + total;
}

function setActiveWizardStep(step) {
    var wedding = document.getElementById('rsvpStepWedding');
    var shuttle = document.getElementById('rsvpStepShuttle');
    if (wedding) {
        wedding.classList.toggle('is-active', step === 'wedding');
        wedding.style.display = step === 'wedding' ? '' : 'none';
    }
    if (shuttle) {
        shuttle.classList.toggle('is-active', step === 'shuttle');
        shuttle.style.display = step === 'shuttle' ? '' : 'none';
    }
    updateWizardIndicatorText(step);
}

function updateWizardIndicatorText(step) {
    var el = document.getElementById('rsvpWizardIndicator');
    if (!el) return;
    var total = countTotalWizardSteps();
    if (total <= 1) {
        el.textContent = '';
        return;
    }
    var idx = step === 'wedding' ? 1 : 2;
    el.textContent = wizardStepLabel(idx, total);
}

function updateWeddingNavButtons() {
    var nextBtn = document.getElementById('rsvpWeddingNextBtn');
    var subBtn = document.getElementById('rsvpWeddingSubmitBtn');
    if (!nextBtn || !subBtn) return;
    nextBtn.style.display = 'block';
    subBtn.style.display = 'none';
}

function updateMarriottShuttleFollowup(rowEl) {
    var follow = rowEl.querySelector('.rsvp-shuttle-followup');
    var shuttleSel = rowEl.querySelector('.rsvp-shuttle-response');
    var marriottSel = rowEl.querySelector('.rsvp-marriott-stay');
    if (!follow || !shuttleSel || !marriottSel) return;
    if (marriottSel.value === 'yes') {
        follow.style.display = 'block';
        shuttleSel.required = true;
    } else {
        follow.style.display = 'none';
        shuttleSel.required = false;
        shuttleSel.value = '';
    }
}

function buildHotelShuttleStepHtml() {
    var wrap = document.getElementById('rsvpShuttleBlocksContainer');
    if (!wrap) return;
    wrap.innerHTML = '';
    var root = getWeddingBlocksRoot();
    if (!root) return;

    var anyAttending = false;
    currentRsvpGuests.forEach(function (g) {
        var block = findGuestBlock(root, g.id);
        if (!block) return;
        var rsvpEl = block.querySelector('.rsvp-guest-response');
        if (!rsvpEl || rsvpEl.value !== 'yes') return;
        anyAttending = true;

        var fn = escapeHtml(g.first_name);
        var ln = escapeHtml(g.last_name);
        var html =
            '<div class="guest-section rsvp-shuttle-guest-block" data-guest-id="' +
            escapeHtml(String(g.id)) +
            '">' +
            '<h3 class="section-title">' + fn + ' ' + ln + '</h3>' +
            '<div class="form-group">' +
            '<label class="form-label">Is ' + fn + ' staying at the Auburn Hills Marriott Pontiac (our room-block hotel)?</label>' +
            '<select class="form-input rsvp-marriott-stay" required>' +
            '<option value="">Please select...</option>' +
            '<option value="yes">Yes</option>' +
            '<option value="no">No</option>' +
            '</select>' +
            '</div>' +
            '<div class="rsvp-shuttle-followup" style="display: none;">' +
            '<div class="form-group">' +
            '<label class="form-label">Will ' + fn + ' take the shuttle from the hotel to the wedding venue?</label>' +
            '<select class="form-input rsvp-shuttle-response">' +
            '<option value="">Please select...</option>' +
            '<option value="yes">Yes</option>' +
            '<option value="no">No</option>' +
            '</select>' +
            '</div>' +
            '</div>' +
            '</div>';
        wrap.insertAdjacentHTML('beforeend', html);
        var added = wrap.lastElementChild;
        var mSel = added && added.querySelector('.rsvp-marriott-stay');
        if (mSel && g.marriott_stay) {
            mSel.value = g.marriott_stay;
        }
        if (added) {
            updateMarriottShuttleFollowup(added);
            var sh = added.querySelector('.rsvp-shuttle-response');
            if (sh && g.shuttle_rsvp && mSel && mSel.value === 'yes') {
                sh.value = g.shuttle_rsvp;
            }
        }
    });

    if (!anyAttending) {
        wrap.innerHTML =
            '<p class="rsvp-hotel-step-empty">No one on this RSVP is attending the wedding, so we don&rsquo;t need hotel or shuttle details. Use <strong>Submit RSVP</strong> below to finish.</p>';
    }
}

function buildSuccessEmailFormHtml(attendingGuestIds) {
    var wrap = document.getElementById('successEmailBlocksContainer');
    if (!wrap) return;
    wrap.innerHTML = '';

    attendingGuestIds.forEach(function (guestId) {
        var g = currentRsvpGuests.find(function (guest) {
            return String(guest.id) === String(guestId);
        });
        if (!g) return;
        var fn = escapeHtml(g.first_name);
        var ln = escapeHtml(g.last_name);
        var savedEmail = g.email ? String(g.email).trim() : '';
        var emailValueAttr = savedEmail ? ' value="' + escapeHtml(savedEmail) + '"' : '';
        var html =
            '<div class="guest-section rsvp-success-email-guest-block" data-guest-id="' +
            escapeHtml(String(g.id)) +
            '">' +
            '<h3 class="section-title">' + fn + ' ' + ln + '</h3>' +
            '<div class="form-group">' +
            '<label class="form-label">Email (optional)</label>' +
            '<input type="email" class="form-input rsvp-success-guest-email" autocomplete="email" placeholder="you@example.com"' +
            emailValueAttr +
            '>' +
            '</div>' +
            '</div>';
        wrap.insertAdjacentHTML('beforeend', html);
    });
}

function showRsvpSuccessPage(isAnyoneAttending) {
    var successMsgAttending = document.getElementById('successMessageAttending');
    var successMsgNotAttending = document.getElementById('successMessageNotAttending');
    var emailSection = document.getElementById('successEmailSection');
    var emailStatus = document.getElementById('successEmailStatus');
    var sendBtn = document.getElementById('successSendEmailBtn');

    if (successMsgAttending && successMsgNotAttending) {
        if (isAnyoneAttending) {
            successMsgAttending.style.display = 'block';
            successMsgNotAttending.style.display = 'none';
        } else {
            successMsgAttending.style.display = 'none';
            successMsgNotAttending.style.display = 'block';
        }
    }

    if (emailStatus) {
        emailStatus.textContent = '';
        emailStatus.classList.remove('success-email-sent');
    }
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.display = '';
    }

    if (emailSection) {
        if (isAnyoneAttending && lastSubmittedAttendingGuestIds.length > 0) {
            buildSuccessEmailFormHtml(lastSubmittedAttendingGuestIds);
            emailSection.style.display = 'block';
        } else {
            emailSection.style.display = 'none';
            var emailWrap = document.getElementById('successEmailBlocksContainer');
            if (emailWrap) emailWrap.innerHTML = '';
        }
    }

    document.getElementById('rsvpFormSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'block';
}

function validateWeddingStep() {
    var root = getWeddingBlocksRoot();
    if (!root) return false;
    var blocks = root.querySelectorAll('.rsvp-guest-block');
    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var rsvpEl = block.querySelector('.rsvp-guest-response');
        if (!rsvpEl || !rsvpEl.value) {
            alert('Please select whether each guest is attending the wedding.');
            return false;
        }
        if (rsvpEl.value === 'yes') {
            var meal = block.querySelector('.rsvp-meal-choice');
            if (!meal || !meal.value) {
                alert('Please choose a meal for each guest who is attending.');
                return false;
            }
        }
    }
    return true;
}

function getSuccessEmailForGuestId(guestId) {
    var wrap = document.getElementById('successEmailBlocksContainer');
    if (!wrap) return null;
    var row = wrap.querySelector('.rsvp-success-email-guest-block[data-guest-id="' + guestId + '"]');
    if (!row) return null;
    var input = row.querySelector('.rsvp-success-guest-email');
    if (!input) return null;
    var v = input.value.trim();
    return v || null;
}

function validateSuccessEmails() {
    var wrap = document.getElementById('successEmailBlocksContainer');
    if (!wrap) return true;
    var rows = wrap.querySelectorAll('.rsvp-success-email-guest-block');
    for (var i = 0; i < rows.length; i++) {
        var input = rows[i].querySelector('.rsvp-success-guest-email');
        if (!input) continue;
        var v = input.value.trim();
        if (v && !isValidEmail(v)) {
            alert('Please enter a valid email address, or leave the field blank.');
            input.focus();
            return false;
        }
    }
    return true;
}

async function sendSuccessConfirmationEmails() {
    if (!validateSuccessEmails()) return;

    var emailsByGuestId = {};
    var anyEmail = false;
    lastSubmittedAttendingGuestIds.forEach(function (guestId) {
        var email = getSuccessEmailForGuestId(guestId);
        if (email) {
            emailsByGuestId[guestId] = email;
            anyEmail = true;
        }
    });

    if (!anyEmail) {
        alert('Enter at least one email address to send a confirmation, or skip this step.');
        return;
    }

    var sendBtn = document.getElementById('successSendEmailBtn');
    var statusEl = document.getElementById('successEmailStatus');
    if (sendBtn) sendBtn.disabled = true;

    try {
        var updateClient = window.rsvpSupabaseClient || supabaseClient;
        var guestIdsToEmail = [];

        for (var guestId in emailsByGuestId) {
            if (!Object.prototype.hasOwnProperty.call(emailsByGuestId, guestId)) continue;
            var email = emailsByGuestId[guestId];
            guestIdsToEmail.push(String(guestId));

            if (USE_MOCK_DATA) {
                updateGuestMock(guestId, { email: email });
            } else {
                if (!updateClient) {
                    throw new Error('Supabase client not initialized');
                }
                var res = await updateClient
                    .from('guests')
                    .update({ email: email, updated_at: new Date().toISOString() })
                    .eq('id', guestId);
                if (res.error) {
                    throw res.error;
                }
            }
        }

        if (!USE_MOCK_DATA && updateClient && typeof updateClient.functions !== 'undefined') {
            var fnRes = await updateClient.functions.invoke('send-rsvp-confirmation', {
                body: { guest_ids: guestIdsToEmail },
            });
            if (fnRes.error) {
                throw fnRes.error;
            }
        }

        if (statusEl) {
            statusEl.textContent = 'Confirmation email sent! Check your inbox (and spam folder).';
            statusEl.classList.add('success-email-sent');
        }
        if (sendBtn) sendBtn.style.display = 'none';
    } catch (err) {
        console.error('Error sending confirmation email:', err);
        alert('We could not send the confirmation email. Please try again.');
        if (sendBtn) sendBtn.disabled = false;
    }
}

function validateShuttleStep() {
    var wrap = document.getElementById('rsvpShuttleBlocksContainer');
    if (!wrap) return true;
    if (wrap.querySelector('.rsvp-hotel-step-empty')) {
        return true;
    }
    var rows = wrap.querySelectorAll('.rsvp-shuttle-guest-block');
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var mar = row.querySelector('.rsvp-marriott-stay');
        if (!mar || !mar.value) {
            alert('Please answer the hotel stay question for each guest listed.');
            return false;
        }
        if (mar.value === 'yes') {
            var sh = row.querySelector('.rsvp-shuttle-response');
            if (!sh || !sh.value) {
                alert('Please answer the shuttle question for each guest staying at the Marriott.');
                return false;
            }
        }
    }
    return true;
}

function getShuttleRsvpForGuestId(guestId) {
    var shuttleWrap = document.getElementById('rsvpShuttleBlocksContainer');
    if (!shuttleWrap) return null;
    var row = shuttleWrap.querySelector('.rsvp-shuttle-guest-block[data-guest-id="' + guestId + '"]');
    if (!row) return null;
    var sel = row.querySelector('.rsvp-shuttle-response');
    return sel && sel.value ? sel.value : null;
}

function getMarriottStayForGuestId(guestId) {
    var shuttleWrap = document.getElementById('rsvpShuttleBlocksContainer');
    if (!shuttleWrap) return null;
    var row = shuttleWrap.querySelector('.rsvp-shuttle-guest-block[data-guest-id="' + guestId + '"]');
    if (!row) return null;
    var sel = row.querySelector('.rsvp-marriott-stay');
    return sel && sel.value ? sel.value : null;
}

async function performRsvpSubmit() {
    if (!currentRsvpGuests || currentRsvpGuests.length === 0) {
        alert('Error: Guest information not found. Please start over.');
        return;
    }

    var root = getWeddingBlocksRoot();
    var blocks = root ? root.querySelectorAll('.rsvp-guest-block') : [];

    try {
        var updateClient = window.rsvpSupabaseClient || supabaseClient;
        var isAnyoneAttending = false;
        lastSubmittedAttendingGuestIds = [];

        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            var rsvpEl = block.querySelector('.rsvp-guest-response');
            if (!rsvpEl) continue;
            var rsvpResponse = rsvpEl.value;
            var mealEl = block.querySelector('.rsvp-meal-choice');
            var mealChoice = rsvpResponse === 'yes' && mealEl ? mealEl.value || null : null;
            var dietaryEl = block.querySelector('.rsvp-dietary-notes');
            var generalEl = block.querySelector('.rsvp-general-notes');
            var dietaryNotes = dietaryEl && dietaryEl.value.trim() ? dietaryEl.value.trim() : null;
            var generalNotes = generalEl && generalEl.value.trim() ? generalEl.value.trim() : null;
            var guestId = block.dataset.guestId;

            if (rsvpResponse === 'yes') {
                isAnyoneAttending = true;
                lastSubmittedAttendingGuestIds.push(String(guestId));
            }

            var marriottStay = null;
            var shuttleRsvp = null;
            if (rsvpResponse === 'yes') {
                marriottStay = getMarriottStayForGuestId(guestId);
                if (marriottStay === 'yes') {
                    shuttleRsvp = getShuttleRsvpForGuestId(guestId);
                }
            }

            if (USE_MOCK_DATA) {
                var mockPayload = {
                    rsvp: rsvpResponse,
                    meal_choice: mealChoice,
                    dietary_notes: dietaryNotes,
                    general_notes: generalNotes,
                    marriott_stay: marriottStay,
                    shuttle_rsvp: shuttleRsvp
                };
                var result = updateGuestMock(guestId, mockPayload);
                if (!result.success) {
                    throw new Error(result.error);
                }
            } else {
                if (!updateClient) {
                    throw new Error('Supabase client not initialized');
                }
                var updatePayload = {
                    rsvp: rsvpResponse,
                    meal_choice: mealChoice,
                    dietary_notes: dietaryNotes,
                    general_notes: generalNotes,
                    marriott_stay: marriottStay,
                    shuttle_rsvp: shuttleRsvp,
                    updated_at: new Date().toISOString()
                };
                var res = await updateClient.from('guests').update(updatePayload).eq('id', guestId);
                if (res.error) {
                    throw res.error;
                }
            }
        }

        showRsvpSuccessPage(isAnyoneAttending);
    } catch (err) {
        console.error('Error submitting RSVP:', err);
        alert('An error occurred while submitting your RSVP. Please try again.');
    }
}

function clearWizardStepDom() {
    var shuttleC = document.getElementById('rsvpShuttleBlocksContainer');
    if (shuttleC) shuttleC.innerHTML = '';
    var ind = document.getElementById('rsvpWizardIndicator');
    if (ind) ind.textContent = '';
}

function resetSuccessSection() {
    lastSubmittedAttendingGuestIds = [];
    var emailSection = document.getElementById('successEmailSection');
    var emailWrap = document.getElementById('successEmailBlocksContainer');
    var emailStatus = document.getElementById('successEmailStatus');
    var sendBtn = document.getElementById('successSendEmailBtn');
    if (emailSection) emailSection.style.display = 'none';
    if (emailWrap) emailWrap.innerHTML = '';
    if (emailStatus) {
        emailStatus.textContent = '';
        emailStatus.classList.remove('success-email-sent');
    }
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.display = '';
    }
}

async function openRsvpFormForSelectedGuests() {
    if (selectedGuestIds.size === 0) return;

    const selected = getSelectedGuests();
    currentRsvpGuests = selected;

    const names = selected.map(function (g) {
        return g.first_name + ' ' + g.last_name;
    });
    document.getElementById('guestGreeting').textContent = buildRsvpGreeting(names);

    clearWizardStepDom();

    const container = getWeddingBlocksRoot();
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
    });

    setActiveWizardStep('wedding');
    updateWeddingNavButtons();
    updateWizardIndicatorText('wedding');
    document.getElementById('guestSelectionSection').style.display = 'none';
    document.getElementById('rsvpStatusSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
    document.getElementById('rsvpFormSection').style.display = 'block';
}

function resetRsvpFlow() {
    var weddingRoot = getWeddingBlocksRoot();
    if (weddingRoot) weddingRoot.innerHTML = '';
    clearWizardStepDom();
    resetSuccessSection();
    setActiveWizardStep('wedding');
    currentRsvpGuests = [];
    selectedGuestIds = new Set();
    lastSubmittedAttendingGuestIds = [];
    document.getElementById('rsvpFormSection').style.display = 'none';
    document.getElementById('rsvpStatusSection').style.display = 'none';
    document.getElementById('guestSelectionSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
    document.getElementById('nameLookupSection').style.display = 'block';
}

const continueToRsvpBtn = document.getElementById('continueToRsvpBtn');
if (continueToRsvpBtn) {
    continueToRsvpBtn.addEventListener('click', function () {
        continueFromGuestSelection();
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

const rsvpWeddingFormWrap = document.getElementById('rsvpWeddingFormWrap');
if (rsvpWeddingFormWrap) {
    rsvpWeddingFormWrap.addEventListener('change', function (e) {
        const t = e.target;
        if (t && t.classList && t.classList.contains('rsvp-guest-response')) {
            const block = t.closest('.rsvp-guest-block');
            if (block) {
                if (t.value === 'yes') {
                    showAttendingFieldsForBlock(block, true);
                } else {
                    showAttendingFieldsForBlock(block, false);
                }
                updateWeddingNavButtons();
            }
        }
    });
}

const rsvpShuttleFormWrap = document.getElementById('rsvpShuttleFormWrap');
if (rsvpShuttleFormWrap) {
    rsvpShuttleFormWrap.addEventListener('change', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('rsvp-marriott-stay')) {
            var row = t.closest('.rsvp-shuttle-guest-block');
            if (row) {
                updateMarriottShuttleFollowup(row);
            }
        }
    });
}

function wireIfPresent(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

wireIfPresent('rsvpWeddingNextBtn', async function () {
    if (!validateWeddingStep()) return;
    buildHotelShuttleStepHtml();
    setActiveWizardStep('shuttle');
});

wireIfPresent('rsvpShuttleSubmitBtn', async function () {
    if (!validateShuttleStep()) return;
    await performRsvpSubmit();
});

wireIfPresent('successSendEmailBtn', async function () {
    await sendSuccessConfirmationEmails();
});

wireIfPresent('successReturnHomeBtn', function () {
    window.location.href = 'index.html';
});

wireIfPresent('rsvpShuttleBackBtn', function () {
    setActiveWizardStep('wedding');
});

wireIfPresent('rsvpStatusActionBtn', function () {
    openRsvpFormForSelectedGuests();
});

wireIfPresent('rsvpStatusBackBtn', function () {
    document.getElementById('rsvpStatusSection').style.display = 'none';
    document.getElementById('guestSelectionSection').style.display = 'block';
});

// Back button handler from RSVP form → status summary or guest selection
const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', function () {
        var weddingRoot = getWeddingBlocksRoot();
        if (weddingRoot) weddingRoot.innerHTML = '';
        clearWizardStepDom();
        setActiveWizardStep('wedding');
        document.getElementById('rsvpFormSection').style.display = 'none';

        var selected = getSelectedGuests();
        if (partyHasAnyRsvp(selected)) {
            openRsvpStatusForSelectedGuests();
        } else {
            document.getElementById('rsvpStatusSection').style.display = 'none';
            document.getElementById('guestSelectionSection').style.display = 'block';
        }
    });
}

// Back button handler from guest selection
const backToNameBtn = document.getElementById('backToNameBtn');
if (backToNameBtn) {
    backToNameBtn.addEventListener('click', function () {
        resetRsvpFlow();
    });
}
