(function () {
    'use strict';

    var SESSION_KEY = 'rsvp-board-unlocked';
    // SHA-256 of "love"
    var PASSWORD_HASH =
        '686f746a95b6f836d7d70567c302c3f9ebb5ee0def3d1220ee9d4e9f34f5e131';

    var SELECT_COLS =
        'id, first_name, last_name, nickname, family, rsvp, meal_choice, marriott_stay, shuttle_rsvp, dietary_notes, general_notes, updated_at';

    var guests = [];
    var supabaseClient = null;

    var gateEl = document.getElementById('boardGate');
    var contentEl = document.getElementById('boardContent');
    var gateForm = document.getElementById('boardPasswordForm');
    var gateError = document.getElementById('boardGateError');
    var loadError = document.getElementById('boardLoadError');
    var searchInput = document.getElementById('boardSearch');
    var filterRsvp = document.getElementById('boardFilterRsvp');
    var filterMarriott = document.getElementById('boardFilterMarriott');
    var filterShuttle = document.getElementById('boardFilterShuttle');
    var filterMeal = document.getElementById('boardFilterMeal');
    var refreshBtn = document.getElementById('boardRefreshBtn');
    var lastUpdatedEl = document.getElementById('boardLastUpdated');
    var resultCountEl = document.getElementById('boardResultCount');
    var tableBody = document.getElementById('boardTableBody');
    var sortButtons = document.querySelectorAll('.board-sort-btn');

    // Default: pending first, then name. Clicking a header switches to that column.
    var sortKey = 'default';
    var sortDir = 'asc';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hexFromBuffer(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(function (b) {
                return b.toString(16).padStart(2, '0');
            })
            .join('');
    }

    async function sha256Hex(text) {
        var data = new TextEncoder().encode(text);
        var digest = await crypto.subtle.digest('SHA-256', data);
        return hexFromBuffer(digest);
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

    function rsvpStatus(guest) {
        if (guest.rsvp === 'yes' || guest.rsvp === 'no') return guest.rsvp;
        return 'pending';
    }

    function displayName(guest) {
        var parts = [guest.first_name, guest.last_name].filter(Boolean);
        var name = parts.join(' ');
        if (guest.nickname) {
            name += ' (“' + guest.nickname + '”)';
        }
        return name;
    }

    function formatUpdated(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    }

    function labelOrDash(value) {
        if (value == null || value === '') return '—';
        return String(value);
    }

    function compareByName(a, b) {
        var la = (a.last_name || '').toLowerCase();
        var lb = (b.last_name || '').toLowerCase();
        if (la < lb) return -1;
        if (la > lb) return 1;
        var fa = (a.first_name || '').toLowerCase();
        var fb = (b.first_name || '').toLowerCase();
        if (fa < fb) return -1;
        if (fa > fb) return 1;
        return 0;
    }

    function updatedAtMs(guest) {
        if (!guest.updated_at) return 0;
        var t = new Date(guest.updated_at).getTime();
        return isNaN(t) ? 0 : t;
    }

    function textSortValue(value) {
        if (value == null || value === '') return '';
        return String(value).toLowerCase();
    }

    function compareText(aVal, bVal) {
        var aEmpty = !aVal;
        var bEmpty = !bVal;
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
    }

    function compareGuests(a, b) {
        var result = 0;

        if (sortKey === 'default') {
            var sa = rsvpStatus(a);
            var sb = rsvpStatus(b);
            var pa = sa === 'pending' ? 0 : 1;
            var pb = sb === 'pending' ? 0 : 1;
            if (pa !== pb) return pa - pb;
            return compareByName(a, b);
        }

        if (sortKey === 'name') {
            result = compareByName(a, b);
        } else if (sortKey === 'family') {
            result = compareText(textSortValue(a.family), textSortValue(b.family));
        } else if (sortKey === 'rsvp') {
            result = compareText(rsvpStatus(a), rsvpStatus(b));
        } else if (sortKey === 'meal') {
            result = compareText(
                textSortValue(a.meal_choice),
                textSortValue(b.meal_choice)
            );
        } else if (sortKey === 'marriott') {
            result = compareText(
                textSortValue(a.marriott_stay),
                textSortValue(b.marriott_stay)
            );
        } else if (sortKey === 'shuttle') {
            result = compareText(
                textSortValue(a.shuttle_rsvp),
                textSortValue(b.shuttle_rsvp)
            );
        } else if (sortKey === 'dietary') {
            result = compareText(
                textSortValue(a.dietary_notes),
                textSortValue(b.dietary_notes)
            );
        } else if (sortKey === 'notes') {
            result = compareText(
                textSortValue(a.general_notes),
                textSortValue(b.general_notes)
            );
        } else if (sortKey === 'updated') {
            result = updatedAtMs(a) - updatedAtMs(b);
        }

        if (result === 0) {
            result = compareByName(a, b);
        }

        return sortDir === 'desc' ? -result : result;
    }

    function sortGuests(list) {
        return list.slice().sort(compareGuests);
    }

    function updateSortHeaders() {
        for (var i = 0; i < sortButtons.length; i++) {
            var btn = sortButtons[i];
            var key = btn.getAttribute('data-sort');
            var indicator = btn.querySelector('.board-sort-indicator');
            var active = sortKey === key;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-sort', active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
            if (indicator) {
                indicator.textContent = active ? (sortDir === 'asc' ? '↑' : '↓') : '';
            }
        }
    }

    function setSort(key) {
        if (sortKey === key) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortKey = key;
            sortDir = key === 'updated' ? 'desc' : 'asc';
        }
        updateSortHeaders();
        renderTable();
    }

    function computeSummary(list) {
        var summary = {
            yes: 0,
            no: 0,
            pending: 0,
            chicken: 0,
            beef: 0,
            vegetarian: 0,
            marriott: 0,
            shuttle: 0,
        };

        list.forEach(function (g) {
            var status = rsvpStatus(g);
            summary[status] += 1;

            if (status === 'yes') {
                if (g.meal_choice === 'chicken') summary.chicken += 1;
                if (g.meal_choice === 'beef') summary.beef += 1;
                if (g.meal_choice === 'vegetarian') summary.vegetarian += 1;
            }

            if (g.marriott_stay === 'yes') summary.marriott += 1;
            if (g.shuttle_rsvp === 'yes') summary.shuttle += 1;
        });

        return summary;
    }

    function pct(part, total) {
        if (!total) return 0;
        return Math.round((part / total) * 100);
    }

    function setBarSegment(el, count, total) {
        var width = total ? (count / total) * 100 : 0;
        el.style.width = width + '%';
        el.hidden = count === 0;
        el.title = count + ' (' + pct(count, total) + '%)';
    }

    function renderSummary(summary) {
        var total = summary.yes + summary.no + summary.pending;
        var mealTotal =
            summary.chicken + summary.beef + summary.vegetarian;

        document.getElementById('statTotal').textContent =
            total + ' guest' + (total === 1 ? '' : 's');
        document.getElementById('statYes').textContent = summary.yes;
        document.getElementById('statNo').textContent = summary.no;
        document.getElementById('statPending').textContent = summary.pending;
        document.getElementById('pctYes').textContent =
            '(' + pct(summary.yes, total) + '%)';
        document.getElementById('pctNo').textContent =
            '(' + pct(summary.no, total) + '%)';
        document.getElementById('pctPending').textContent =
            '(' + pct(summary.pending, total) + '%)';

        setBarSegment(document.getElementById('barYes'), summary.yes, total);
        setBarSegment(document.getElementById('barNo'), summary.no, total);
        setBarSegment(
            document.getElementById('barPending'),
            summary.pending,
            total
        );

        document.getElementById('boardRsvpBar').setAttribute(
            'aria-label',
            'RSVP breakdown: ' +
                summary.yes +
                ' yes (' +
                pct(summary.yes, total) +
                '%), ' +
                summary.no +
                ' no (' +
                pct(summary.no, total) +
                '%), ' +
                summary.pending +
                ' pending (' +
                pct(summary.pending, total) +
                '%)'
        );

        document.getElementById('statMealTotal').textContent =
            mealTotal +
            ' meal choice' +
            (mealTotal === 1 ? '' : 's') +
            ' (attending)';
        document.getElementById('statChicken').textContent = summary.chicken;
        document.getElementById('statBeef').textContent = summary.beef;
        document.getElementById('statVegetarian').textContent =
            summary.vegetarian;
        document.getElementById('pctChicken').textContent =
            '(' + pct(summary.chicken, mealTotal) + '%)';
        document.getElementById('pctBeef').textContent =
            '(' + pct(summary.beef, mealTotal) + '%)';
        document.getElementById('pctVegetarian').textContent =
            '(' + pct(summary.vegetarian, mealTotal) + '%)';

        setBarSegment(
            document.getElementById('barChicken'),
            summary.chicken,
            mealTotal
        );
        setBarSegment(
            document.getElementById('barBeef'),
            summary.beef,
            mealTotal
        );
        setBarSegment(
            document.getElementById('barVegetarian'),
            summary.vegetarian,
            mealTotal
        );

        document.getElementById('boardMealBar').setAttribute(
            'aria-label',
            'Meal breakdown: ' +
                summary.chicken +
                ' chicken (' +
                pct(summary.chicken, mealTotal) +
                '%), ' +
                summary.beef +
                ' beef (' +
                pct(summary.beef, mealTotal) +
                '%), ' +
                summary.vegetarian +
                ' vegetarian (' +
                pct(summary.vegetarian, mealTotal) +
                '%)'
        );

        document.getElementById('statMarriott').textContent = summary.marriott;
        document.getElementById('statShuttle').textContent = summary.shuttle;
    }

    function matchesChoiceFilter(value, filter) {
        if (filter === 'all') return true;
        if (filter === 'blank') return value == null || value === '';
        return value === filter;
    }

    function filteredGuests() {
        var query = (searchInput.value || '').trim().toLowerCase();
        var rsvpFilter = filterRsvp.value || 'all';
        var marriottFilter = filterMarriott.value || 'all';
        var shuttleFilter = filterShuttle.value || 'all';
        var mealFilter = filterMeal.value || 'all';

        return sortGuests(
            guests.filter(function (g) {
                var status = rsvpStatus(g);
                if (rsvpFilter !== 'all' && status !== rsvpFilter) return false;
                if (!matchesChoiceFilter(g.marriott_stay, marriottFilter)) {
                    return false;
                }
                if (!matchesChoiceFilter(g.shuttle_rsvp, shuttleFilter)) {
                    return false;
                }
                if (!matchesChoiceFilter(g.meal_choice, mealFilter)) {
                    return false;
                }

                if (!query) return true;

                var haystack = [
                    g.first_name,
                    g.last_name,
                    g.nickname,
                    g.family,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return haystack.indexOf(query) !== -1;
            })
        );
    }

    function renderTable() {
        var rows = filteredGuests();
        resultCountEl.textContent =
            rows.length +
            ' guest' +
            (rows.length === 1 ? '' : 's') +
            (rows.length !== guests.length
                ? ' (of ' + guests.length + ')'
                : '');

        if (!rows.length) {
            tableBody.innerHTML =
                '<tr><td colspan="9" class="board-empty">No guests match.</td></tr>';
            return;
        }

        tableBody.innerHTML = rows
            .map(function (g) {
                var status = rsvpStatus(g);
                return (
                    '<tr class="board-row board-row-' +
                    status +
                    '">' +
                    '<td>' +
                    escapeHtml(displayName(g)) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(labelOrDash(g.family)) +
                    '</td>' +
                    '<td><span class="board-badge board-badge-' +
                    status +
                    '">' +
                    escapeHtml(status) +
                    '</span></td>' +
                    '<td>' +
                    escapeHtml(labelOrDash(g.meal_choice)) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(labelOrDash(g.marriott_stay)) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(labelOrDash(g.shuttle_rsvp)) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(labelOrDash(g.dietary_notes)) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(labelOrDash(g.general_notes)) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(formatUpdated(g.updated_at)) +
                    '</td>' +
                    '</tr>'
                );
            })
            .join('');
    }

    function showGateError(message) {
        gateError.hidden = false;
        gateError.textContent = message;
    }

    function clearGateError() {
        gateError.hidden = true;
        gateError.textContent = '';
    }

    function showLoadError(message) {
        loadError.hidden = false;
        loadError.textContent = message;
    }

    function clearLoadError() {
        loadError.hidden = true;
        loadError.textContent = '';
    }

    function showBoard() {
        gateEl.hidden = true;
        contentEl.hidden = false;
    }

    function showGate() {
        gateEl.hidden = false;
        contentEl.hidden = true;
    }

    async function fetchGuests() {
        clearLoadError();
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Loading…';

        try {
            if (!supabaseClient) initSupabase();

            var result = await supabaseClient
                .from('guests')
                .select(SELECT_COLS);

            if (result.error) {
                throw new Error(result.error.message || 'Failed to load guests.');
            }

            guests = result.data || [];
            renderSummary(computeSummary(guests));
            renderTable();
            lastUpdatedEl.textContent =
                'Last updated ' +
                new Date().toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                });
        } catch (err) {
            console.error(err);
            showLoadError(
                err && err.message
                    ? err.message
                    : 'Could not load RSVP data.'
            );
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh';
        }
    }

    async function unlockWithPassword(password) {
        var hash = await sha256Hex(password);
        if (hash !== PASSWORD_HASH) {
            showGateError('Incorrect password.');
            return false;
        }
        sessionStorage.setItem(SESSION_KEY, '1');
        clearGateError();
        showBoard();
        await fetchGuests();
        return true;
    }

    function isUnlocked() {
        return sessionStorage.getItem(SESSION_KEY) === '1';
    }

    gateForm.addEventListener('submit', function (event) {
        event.preventDefault();
        clearGateError();
        var password = document.getElementById('boardPassword').value;
        unlockWithPassword(password).catch(function (err) {
            console.error(err);
            showGateError('Could not verify password. Try again.');
        });
    });

    searchInput.addEventListener('input', renderTable);
    filterRsvp.addEventListener('change', renderTable);
    filterMarriott.addEventListener('change', renderTable);
    filterShuttle.addEventListener('change', renderTable);
    filterMeal.addEventListener('change', renderTable);
    for (var i = 0; i < sortButtons.length; i++) {
        sortButtons[i].addEventListener('click', function () {
            setSort(this.getAttribute('data-sort'));
        });
    }
    refreshBtn.addEventListener('click', function () {
        fetchGuests();
    });

    document.addEventListener('DOMContentLoaded', function () {
        if (isUnlocked()) {
            showBoard();
            fetchGuests();
        } else {
            showGate();
        }
    });
})();
