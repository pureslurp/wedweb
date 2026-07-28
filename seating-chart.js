(function () {
    'use strict';

    var SELECT_COLS = 'first_name, last_name, nickname, table_number, rsvp';

    var guests = [];
    var supabaseClient = null;

    var searchInput = document.getElementById('seatingSearch');
    var resultsEl = document.getElementById('seatingResults');
    var statusEl = document.getElementById('seatingStatus');
    var errorEl = document.getElementById('seatingError');

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function initSupabase() {
        if (
            typeof window.supabase === 'undefined' ||
            typeof SUPABASE_CONFIG === 'undefined'
        ) {
            throw new Error('Supabase is not configured.');
        }
        supabaseClient = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
    }

    function displayName(guest) {
        var parts = [guest.first_name, guest.last_name].filter(Boolean);
        var name = parts.join(' ');
        if (guest.nickname) {
            name += ' (“' + guest.nickname + '”)';
        }
        return name;
    }

    function companionName(guest) {
        return [guest.first_name, guest.last_name].filter(Boolean).join(' ');
    }

    function sortGuests(list) {
        return list.slice().sort(function (a, b) {
            var lastA = (a.last_name || '').toLowerCase();
            var lastB = (b.last_name || '').toLowerCase();
            if (lastA < lastB) return -1;
            if (lastA > lastB) return 1;
            var firstA = (a.first_name || '').toLowerCase();
            var firstB = (b.first_name || '').toLowerCase();
            if (firstA < firstB) return -1;
            if (firstA > firstB) return 1;
            return 0;
        });
    }

    function matchesQuery(guest, query) {
        if (!query) return true;
        var haystack = [
            guest.first_name,
            guest.last_name,
            guest.nickname,
            [guest.first_name, guest.last_name].filter(Boolean).join(' '),
            [guest.last_name, guest.first_name].filter(Boolean).join(' '),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.indexOf(query) !== -1;
    }

    function filteredGuests() {
        var query = (searchInput.value || '').trim().toLowerCase();
        return guests.filter(function (g) {
            return matchesQuery(g, query);
        });
    }

    function tablematesFor(guest) {
        return guests.filter(function (g) {
            return (
                g !== guest &&
                g.table_number != null &&
                guest.table_number != null &&
                String(g.table_number) === String(guest.table_number)
            );
        });
    }

    function setStatus(text, visible) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.hidden = !visible;
    }

    function setError(message) {
        if (!errorEl) return;
        if (message) {
            errorEl.textContent = message;
            errorEl.hidden = false;
        } else {
            errorEl.textContent = '';
            errorEl.hidden = true;
        }
    }

    function lastNameLetter(guest) {
        var last = (guest.last_name || '').trim();
        var ch = last.charAt(0).toUpperCase();
        if (ch >= 'A' && ch <= 'Z') return ch;
        return '#';
    }

    function renderResults() {
        var rows = filteredGuests();
        var query = (searchInput.value || '').trim();
        var sameTable =
            rows.length > 0 &&
            rows.every(function (g) {
                return (
                    g.table_number != null &&
                    String(g.table_number) === String(rows[0].table_number)
                );
            });
        var showCompanions =
            query.length >= 3 || (query.length > 0 && sameTable);

        resultsEl.innerHTML = '';

        if (!guests.length) {
            resultsEl.hidden = true;
            setStatus('Seating assignments are not available yet.', true);
            return;
        }

        if (!rows.length) {
            resultsEl.hidden = true;
            setStatus(
                query
                    ? 'No guests match “' + query + '”. Try another spelling.'
                    : 'No guests found.',
                true
            );
            return;
        }

        setStatus(
            rows.length === guests.length
                ? rows.length + ' guests seated'
                : rows.length + ' of ' + guests.length + ' guests',
            true
        );

        var html = '';
        var currentLetter = '';
        var rowIndex = 0;
        for (var i = 0; i < rows.length; i++) {
            var g = rows[i];
            var letter = lastNameLetter(g);
            if (letter !== currentLetter) {
                currentLetter = letter;
                html +=
                    '<li class="seating-letter" aria-label="Last names starting with ' +
                    escapeHtml(letter) +
                    '">' +
                    '<span class="seating-letter-mark">' +
                    escapeHtml(letter) +
                    '</span>' +
                    '</li>';
            }

            var companionsHtml = '';
            if (showCompanions) {
                var mates = tablematesFor(g);
                if (mates.length) {
                    companionsHtml =
                        '<div class="seating-companions">' +
                        '<p class="seating-companions-label">You are also sitting with</p>' +
                        '<ul class="seating-companions-list">';
                    for (var m = 0; m < mates.length; m++) {
                        companionsHtml +=
                            '<li class="seating-companions-item">' +
                            escapeHtml(companionName(mates[m])) +
                            '</li>';
                    }
                    companionsHtml += '</ul></div>';
                }
            }

            html +=
                '<li class="seating-row' +
                (companionsHtml ? ' seating-row--with' : '') +
                '" style="--seating-i:' +
                rowIndex +
                '">' +
                '<div class="seating-row-body">' +
                '<span class="seating-row-name">' +
                escapeHtml(displayName(g)) +
                '</span>' +
                '<span class="seating-row-table" aria-label="Table ' +
                escapeHtml(String(g.table_number)) +
                '">' +
                '<span class="seating-row-table-label">Table</span>' +
                '<span class="seating-row-table-num">' +
                escapeHtml(String(g.table_number)) +
                '</span>' +
                '</span>' +
                '</div>' +
                companionsHtml +
                '</li>';
            rowIndex += 1;
        }
        resultsEl.innerHTML = html;
        resultsEl.hidden = false;
    }

    async function fetchGuests() {
        setError('');
        setStatus('Loading seating…', true);
        resultsEl.hidden = true;

        var result = await supabaseClient
            .from('guests')
            .select(SELECT_COLS)
            .eq('rsvp', 'yes')
            .not('table_number', 'is', null);

        if (result.error) {
            throw result.error;
        }

        guests = sortGuests(
            (result.data || []).filter(function (g) {
                return g.table_number != null && g.table_number !== '';
            })
        );
        renderResults();
    }

    async function boot() {
        try {
            initSupabase();
            await fetchGuests();
        } catch (err) {
            console.error(err);
            setStatus('', false);
            resultsEl.hidden = true;
            setError(
                'Unable to load the seating chart. Please try again in a moment.'
            );
        }
    }

    searchInput.addEventListener('input', renderResults);
    boot();
})();
