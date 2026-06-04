/**
 * MyUB multi-page onboarding tour
 */
(function (global) {
    'use strict';

    var PAD = 0;
    var LIBRARY_MIN_H = 160;
    var COMPACT_MIN = 40;
    var cachedUserId = null;
    var active = false;
    var pageIndex = 0;
    var stepIndex = 0;

    var rootEl = null;
    var backdropEl = null;
    var sidebarBandEl = null;
    var spotlightEl = null;
    var tooltipEl = null;
    var highlightedEl = null;
    var resizeHandler = null;
    var scrollLockHandler = null;
    var keyLockHandler = null;
    var lockedScrollY = 0;

    var TOUR_PAGES = [
        {
            file: 'dashboard.html',
            steps: [
                { selector: '[data-tour="welcome-banner"]', title: 'Your dashboard', body: 'Your home screen — daily greeting, campus updates, and a snapshot of your day.' },
                { selector: '[data-tour="stats"]', title: 'Quick stats', body: 'Track courses, credits earned, study groups, and pending tasks at a glance.' },
                { selector: '[data-tour="quick-actions"]', title: 'Quick actions', body: 'Jump straight to GPA, notes, schedule, and other tools in one click.' },
                { selector: '[data-tour="search"]', title: 'Search', body: 'Find pages, notes, friends, groups, and events across MyUB.' },
                { selector: '[data-tour="notifications"]', title: 'Notifications', body: 'Friend requests, messages, and campus alerts show up here.' }
            ]
        },
        {
            file: 'gpa-calculator.html',
            navTour: 'nav-gpa',
            steps: [
                { selector: '[data-tour="gpa-progression"]', title: 'Degree progression', body: 'See credits earned toward your program and how close you are to graduating.' },
                { selector: '[data-tour="gpa-tabs"]', title: 'GPA & predictor', body: 'Switch between calculating your current GPA and predicting grades for upcoming courses.' },
                { selector: '[data-tour="gpa-summary"]', title: 'Your GPA summary', body: 'See cumulative GPA, total credits, course count, and degree classification at a glance.' },
                { selector: '[data-tour="gpa-semesters"]', title: 'Manage semesters', body: 'Add semesters, enter courses with grades, and MyUB calculates your GPA automatically.' }
            ]
        },
        {
            file: 'schedule.html',
            navTour: 'nav-schedule',
            steps: [
                { selector: '[data-tour="schedule-header"]', title: 'Your timetable', body: 'View and manage your weekly class schedule in one place.' },
                { selector: '[data-tour="schedule-layout"]', title: 'Plan your week', body: 'Add classes, labs, and study blocks — drag to organize your time.' }
            ]
        },
        {
            file: 'events.html',
            navTour: 'nav-events',
            steps: [
                { selector: '[data-tour="events-header"]', title: 'Campus events', body: 'Discover what is happening at UB — workshops, sports, societies, and more.' },
                { selector: '[data-tour="events-feed"]', title: 'Browse & RSVP', body: 'Tap an event to see details and RSVP so you never miss out.' }
            ]
        },
        {
            file: 'notes.html',
            navTour: 'nav-notes',
            steps: [
                { selector: '[data-tour="notes-new"]', title: 'Create notes', body: 'Start a new note or upload study files for your courses.' },
                { selector: '[data-tour="notes-toolbar"]', title: 'Organize notes', body: 'Search, filter pinned notes, and switch between grid or list view.' },
                { selector: '[data-tour="notes-library"]', title: 'Your library', body: 'All your notes and uploaded files live here, sorted by course.' }
            ]
        },
        {
            file: 'past-papers.html',
            navTour: 'nav-papers',
            steps: [
                { selector: '[data-tour="papers-upload"]', title: 'Upload papers', body: 'Share past exam papers and resources with classmates (PDF, images, DOCX).' },
                { selector: '[data-tour="papers-toolbar"]', title: 'Find papers', body: 'Search and filter by type, date, or show only your uploads.' },
                { selector: '[data-tour="papers-library"]', title: 'Paper library', body: 'Browse shared past papers and revision resources by course.' }
            ]
        },
        {
            file: 'study-groups.html',
            navTour: 'nav-groups',
            steps: [
                { selector: '[data-tour="groups-panel"]', title: 'Study groups', body: 'Collaborate with classmates — join existing groups or create your own.' },
                { selector: '[data-tour="groups-tabs"]', title: 'My groups & discover', body: 'Switch between groups you belong to and groups you can join.' },
                { selector: '[data-tour="groups-list"]', title: 'Group workspace', body: 'Chat, share files, and coordinate study sessions with your group.' }
            ]
        },
        {
            file: 'messages.html',
            navTour: 'nav-messages',
            steps: [
                { selector: '[data-tour="messages-list"]', title: 'Conversations', body: 'All your chats in one list — search to find a friend or group quickly.' },
                { selector: '[data-tour="messages-chat"]', title: 'Real-time chat', body: 'Send messages, see online status, and stay connected with classmates.' }
            ]
        },
        {
            file: 'friends.html',
            navTour: 'nav-friends',
            steps: [
                { selector: '[data-tour="friends-stats"]', title: 'Your network', body: 'See friends, pending requests, and who is online on campus.' },
                { selector: '[data-tour="friends-tabs"]', title: 'Friends & requests', body: 'Accept incoming requests or search for classmates to connect with.' }
            ]
        },
        {
            file: 'profile.html',
            navTour: 'nav-profile',
            steps: [
                { selector: '[data-tour="profile-header"]', title: 'Profile overview', body: 'Your photo, name, student ID, program, and online status.' },
                { selector: '[data-tour="profile-details"]', title: 'Personal details', body: 'View and edit your name, email, year of study, program, and bio.' },
                { selector: '[data-tour="profile-replay"]', title: 'Replay this tour', body: 'Come back here anytime and tap Replay app tour to walk through MyUB again.' }
            ]
        }
    ];

    function getPageFile() {
        var f = (global.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
        return f.indexOf('.html') === -1 ? f + '.html' : f;
    }

    function normalizePage(page) {
        if (page.steps) return page;
        return {
            file: page.file,
            steps: [{
                selector: page.selector,
                title: page.title,
                body: page.body,
                navTour: page.navTour
            }]
        };
    }

    function getPagesNormalized() {
        return TOUR_PAGES.map(normalizePage);
    }

    function totalStepCount() {
        var n = 0;
        getPagesNormalized().forEach(function (p) { n += p.steps.length; });
        return n;
    }

    function globalStepNumber() {
        var pages = getPagesNormalized();
        var n = 0;
        for (var i = 0; i < pageIndex; i++) n += pages[i].steps.length;
        return n + stepIndex + 1;
    }

    function getUserId() {
        if (cachedUserId) return cachedUserId;
        if (global.currentUser && global.currentUser.id) return global.currentUser.id;
        return null;
    }

    function resolveUserId(callback) {
        var id = getUserId();
        if (id) {
            cachedUserId = id;
            callback(id);
            return;
        }
        var client = global.supabaseClient;
        if (!client || !client.auth) {
            callback(null);
            return;
        }
        client.auth.getSession().then(function (res) {
            var user = res.data && res.data.session && res.data.session.user;
            if (user && user.id) {
                cachedUserId = user.id;
                if (!global.currentUser) global.currentUser = user;
                callback(user.id);
            } else {
                callback(null);
            }
        }).catch(function () { callback(null); });
    }

    function storageKey(suffix) {
        var id = getUserId();
        return id ? 'myub_tour_' + suffix + '_' + id : null;
    }

    function isCompleted() {
        var k = storageKey('completed');
        return !!(k && global.localStorage.getItem(k) === 'true');
    }

    function isSkipped() {
        var k = storageKey('skipped');
        return !!(k && global.localStorage.getItem(k) === 'true');
    }

    function shouldAutoStart() {
        return !isCompleted() && !isSkipped();
    }

    function isTourActive() {
        var k = storageKey('active');
        return !!(k && global.localStorage.getItem(k) === '1');
    }

    function setTourActive(on) {
        var k = storageKey('active');
        if (!k) return;
        if (on) global.localStorage.setItem(k, '1');
        else global.localStorage.removeItem(k);
    }

    function getStoredPageIndex() {
        var k = storageKey('page');
        var v = parseInt(global.localStorage.getItem(k) || '0', 10);
        return isNaN(v) ? 0 : Math.max(0, Math.min(v, TOUR_PAGES.length - 1));
    }

    function setStoredPageIndex(idx) {
        var k = storageKey('page');
        if (k) global.localStorage.setItem(k, String(idx));
    }

    function getStoredStepIndex() {
        var k = storageKey('step');
        var v = parseInt(global.localStorage.getItem(k) || '0', 10);
        return isNaN(v) ? 0 : Math.max(0, v);
    }

    function setStoredStepIndex(idx) {
        var k = storageKey('step');
        if (k) global.localStorage.setItem(k, String(idx));
    }

    function resetTourProgress() {
        setStoredPageIndex(0);
        setStoredStepIndex(0);
        setTourActive(true);
        var c = storageKey('completed');
        var s = storageKey('skipped');
        if (c) global.localStorage.removeItem(c);
        if (s) global.localStorage.removeItem(s);
    }

    function markCompleted() {
        var c = storageKey('completed');
        var s = storageKey('skipped');
        if (c) global.localStorage.setItem(c, 'true');
        if (s) global.localStorage.removeItem(s);
        setTourActive(false);
    }

    function markSkipped() {
        var s = storageKey('skipped');
        if (s) global.localStorage.setItem(s, 'true');
        setTourActive(false);
    }

    function isWelcomeOpen() {
        var el = global.document.getElementById('welcomeModal');
        if (!el) return false;
        if (el.style.display === 'flex') return true;
        if (el.style.display === 'none') return false;
        try {
            return global.getComputedStyle(el).display !== 'none';
        } catch (_) {
            return false;
        }
    }

    function ensureDom() {
        if (rootEl) return;
        rootEl = global.document.createElement('div');
        rootEl.id = 'myubTourRoot';
        rootEl.className = 'myub-tour-root';

        backdropEl = global.document.createElement('div');
        backdropEl.className = 'myub-tour-backdrop';

        sidebarBandEl = global.document.createElement('div');
        sidebarBandEl.className = 'myub-tour-sidebar-band';
        sidebarBandEl.setAttribute('aria-hidden', 'true');

        spotlightEl = global.document.createElement('div');
        spotlightEl.className = 'myub-tour-spotlight';

        tooltipEl = global.document.createElement('div');
        tooltipEl.className = 'myub-tour-tooltip';
        tooltipEl.setAttribute('role', 'dialog');
        tooltipEl.setAttribute('aria-modal', 'true');

        rootEl.appendChild(backdropEl);
        rootEl.appendChild(sidebarBandEl);
        rootEl.appendChild(spotlightEl);
        rootEl.appendChild(tooltipEl);
        global.document.body.appendChild(rootEl);
    }

    function lockScroll() {
        lockedScrollY = global.scrollY || global.pageYOffset || 0;
        global.document.documentElement.classList.add('myub-tour-active');
        global.document.body.classList.add('myub-tour-active');
        global.document.body.style.overflow = 'hidden';
        global.document.body.style.position = 'fixed';
        global.document.body.style.top = '-' + lockedScrollY + 'px';
        global.document.body.style.left = '0';
        global.document.body.style.right = '0';
        global.document.body.style.width = '100%';
        var main = findTarget('#mainContent, .main-content');
        if (main) {
            main.style.overflow = 'hidden';
            main.style.touchAction = 'none';
        }
        scrollLockHandler = function (e) {
            e.preventDefault();
        };
        global.addEventListener('wheel', scrollLockHandler, { passive: false, capture: true });
        global.addEventListener('touchmove', scrollLockHandler, { passive: false, capture: true });
        keyLockHandler = function (e) {
            if (!active) return;
            var keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
            if (keys.indexOf(e.key) !== -1) e.preventDefault();
        };
        global.addEventListener('keydown', keyLockHandler, true);
    }

    function unlockScroll() {
        if (scrollLockHandler) {
            global.removeEventListener('wheel', scrollLockHandler, { capture: true });
            global.removeEventListener('touchmove', scrollLockHandler, { capture: true });
            scrollLockHandler = null;
        }
        if (keyLockHandler) {
            global.removeEventListener('keydown', keyLockHandler, true);
            keyLockHandler = null;
        }
        global.document.documentElement.classList.remove('myub-tour-active');
        global.document.body.classList.remove('myub-tour-active');
        global.document.body.style.overflow = '';
        global.document.body.style.position = '';
        global.document.body.style.top = '';
        global.document.body.style.left = '';
        global.document.body.style.right = '';
        global.document.body.style.width = '';
        global.document.body.style.removeProperty('overflow');
        global.document.body.style.removeProperty('position');
        global.document.body.style.removeProperty('top');
        var main = findTarget('#mainContent, .main-content');
        if (main) {
            main.style.overflow = '';
            main.style.touchAction = '';
        }
        global.scrollTo(0, lockedScrollY);
    }

    function isNarrow() {
        return global.innerWidth <= 900;
    }

    function getSidebarWidth() {
        if (isNarrow()) return 260;
        try {
            var v = parseInt(global.getComputedStyle(global.document.documentElement).getPropertyValue('--sidebar-w'), 10);
            if (!isNaN(v) && v > 40) return v;
        } catch (_) {}
        return 260;
    }

    function ensureSidebarOpen() {
        if (!isNarrow()) return;
        var sidebar = global.document.getElementById('sidebar');
        if (!sidebar) return;
        if (!sidebar.classList.contains('open') && typeof global.toggleSidebar === 'function') {
            global.toggleSidebar();
        }
    }

    function clearHighlight() {
        if (highlightedEl) {
            highlightedEl.classList.remove('myub-tour-highlight');
            highlightedEl = null;
        }
        global.document.querySelectorAll('.myub-tour-highlight, .myub-tour-nav-active').forEach(function (el) {
            el.classList.remove('myub-tour-highlight', 'myub-tour-nav-active');
        });
    }

    function isTourVisible(el) {
        if (!el || !el.getBoundingClientRect) return false;
        try {
            var style = global.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (parseFloat(style.opacity) < 0.05) return false;
        } catch (_) {}
        var rect = el.getBoundingClientRect();
        return rect.width >= 2 && rect.height >= 2;
    }

    function isLibraryTour(tourId) {
        return tourId === 'notes-library' || tourId === 'papers-library' ||
            tourId === 'events-feed' || tourId === 'groups-list';
    }

    function isCompactTour(tourId) {
        return tourId === 'notes-new' || tourId === 'papers-upload' ||
            tourId === 'search' || tourId === 'notifications';
    }

    function findTarget(selector) {
        if (!selector) return null;
        var parts = selector.split(',').map(function (s) { return s.trim(); });
        for (var i = 0; i < parts.length; i++) {
            try {
                var nodes = global.document.querySelectorAll(parts[i]);
                for (var j = 0; j < nodes.length; j++) {
                    if (isTourVisible(nodes[j])) return nodes[j];
                }
            } catch (_) {}
        }
        return null;
    }

    function findFallbackInContainer(container, selectors) {
        if (!container) return null;
        for (var i = 0; i < selectors.length; i++) {
            var el = container.querySelector(selectors[i]);
            if (el && isTourVisible(el)) return el;
        }
        return null;
    }

    function getTourFocusElement(el) {
        if (!el) return null;
        var tourId = el.getAttribute && el.getAttribute('data-tour');

        if (tourId === 'notifications') {
            return el.querySelector('#notificationBell, .icon-btn, button') || el;
        }
        if (tourId === 'search') {
            return el.matches && el.matches('.search-box') ? el : (el.querySelector('.search-box') || el);
        }
        if (el.closest && el.closest('.topbar')) {
            if (el.matches('button, .icon-btn, .search-box, .notif-btn')) return el;
            var topFocus = el.querySelector('button.icon-btn, button.notif-btn, .search-box, #notificationBell');
            if (topFocus) return topFocus;
            return el;
        }
        if (isLibraryTour(tourId)) {
            var empty = findFallbackInContainer(el, ['#emptyState', '.empty-state', '#eventsEmpty']);
            if (empty && isTourVisible(empty)) {
                var er = empty.getBoundingClientRect();
                if (er.height >= 80) return empty;
            }
        }
        return el;
    }

    function expandRect(rect, minW, minH) {
        var w = rect.width;
        var h = rect.height;
        var left = rect.left;
        var top = rect.top;
        if (w < minW) {
            var cx = left + w / 2;
            left = cx - minW / 2;
            w = minW;
        }
        if (h < minH) {
            h = minH;
        }
        return {
            top: top,
            left: left,
            width: w,
            height: h,
            right: left + w,
            bottom: top + h
        };
    }

    function getHighlightRect(el) {
        var target = getTourFocusElement(el) || el;
        var rect = target.getBoundingClientRect();
        var tourId = target.getAttribute && target.getAttribute('data-tour');

        if (isCompactTour(tourId) || (target.closest && target.closest('.topbar'))) {
            return expandRect(rect, COMPACT_MIN, COMPACT_MIN);
        }
        if (isLibraryTour(tourId)) {
            return expandRect(rect, 120, LIBRARY_MIN_H);
        }
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
        };
    }

    function closeTourDropdowns() {
        global.document.querySelectorAll(
            '.notification-dropdown.show, .notif-dropdown.show, .user-dropdown.show, .search-results-dropdown.show'
        ).forEach(function (dd) {
            dd.classList.remove('show');
        });
    }

    function waitForLayoutSettled(callback) {
        global.document.body.classList.add('myub-tour-positioning');
        global.requestAnimationFrame(function () {
            global.requestAnimationFrame(function () {
                global.setTimeout(function () {
                    global.document.body.classList.remove('myub-tour-positioning');
                    if (callback) callback();
                }, 48);
            });
        });
    }

    function positionTooltip(rect, el) {
        if (!tooltipEl) return;
        tooltipEl.classList.remove('is-anchor', 'is-bottom');
        tooltipEl.style.top = '';
        tooltipEl.style.bottom = '';
        tooltipEl.style.left = '';
        tooltipEl.style.right = '';
        tooltipEl.style.transform = '';
        tooltipEl.style.maxWidth = '';

        var tipH = tooltipEl.offsetHeight || 200;
        var tipW = Math.min(400, tooltipEl.offsetWidth || 400);
        var gap = 16;
        var vh = global.innerHeight;
        var vw = global.innerWidth;
        var inTop = isInTopbar(el);

        if (inTop) {
            var top = rect.bottom + gap;
            if (top + tipH > vh - 16) {
                top = Math.max(12, rect.top - tipH - gap);
            }
            var left = rect.left + rect.width / 2 - tipW / 2;
            left = Math.max(12, Math.min(left, vw - tipW - 12));
            tooltipEl.classList.add('is-anchor');
            tooltipEl.style.top = top + 'px';
            tooltipEl.style.left = left + 'px';
            tooltipEl.style.transform = 'none';
            tooltipEl.style.maxWidth = tipW + 'px';
            return;
        }

        var spaceBelow = vh - rect.bottom - gap;
        if (spaceBelow >= tipH + 20) {
            tooltipEl.classList.add('is-anchor');
            tooltipEl.style.top = (rect.bottom + gap) + 'px';
            tooltipEl.style.left = '50%';
            tooltipEl.style.transform = 'translateX(-50%)';
            return;
        }

        tooltipEl.classList.add('is-bottom');
    }

    function updateStepLayout(el) {
        if (!active || !el) return;
        var focus = getTourFocusElement(el) || el;
        var rect = getHighlightRect(el);
        positionSpotlightOnRect(rect, focus);
        positionTooltip(rect, focus);
    }

    function applySpotlightRadius(el) {
        if (!spotlightEl || !el) return;
        var radius = '12px';
        try {
            var style = global.getComputedStyle(el);
            var tl = parseFloat(style.borderTopLeftRadius) || 0;
            var tr = parseFloat(style.borderTopRightRadius) || 0;
            var br = parseFloat(style.borderBottomRightRadius) || 0;
            var bl = parseFloat(style.borderBottomLeftRadius) || 0;
            var maxR = Math.max(tl, tr, br, bl);
            if (maxR > 0) radius = style.borderRadius || (maxR + 'px');
        } catch (_) {}
        spotlightEl.style.borderRadius = radius;
    }

    function scrollToTop() {
        applyTourScroll(0);
        try {
            global.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch (_) {
            global.scrollTo(0, 0);
        }
        global.document.documentElement.scrollTop = 0;
        global.document.body.scrollTop = 0;
        var main = findTarget('#mainContent, .main-content');
        if (main) main.scrollTop = 0;
    }

    function getMaxTourScroll() {
        var doc = global.document.documentElement;
        var body = global.document.body;
        var h = Math.max(
            doc.scrollHeight,
            body.scrollHeight,
            doc.offsetHeight,
            body.offsetHeight
        );
        return Math.max(0, h - global.innerHeight);
    }

    function applyTourScroll(y) {
        lockedScrollY = Math.max(0, Math.min(y, getMaxTourScroll()));
        if (global.document.body.classList.contains('myub-tour-active')) {
            global.document.body.style.top = '-' + lockedScrollY + 'px';
        }
    }

    function getTooltipBottomReserve() {
        if (!tooltipEl) return 280;
        var h = tooltipEl.offsetHeight;
        if (!h && tooltipEl.getBoundingClientRect) {
            h = tooltipEl.getBoundingClientRect().height;
        }
        return Math.max(220, (h || 200) + 40);
    }

    function isInTopbar(el) {
        return !!(el && el.closest && el.closest('.topbar'));
    }

    function scrollHighlightIntoView(el, done) {
        if (!el || !active) {
            if (done) done();
            return;
        }

        var focus = getTourFocusElement(el) || el;
        var inTop = isInTopbar(focus);
        if (inTop) {
            applyTourScroll(0);
            waitForLayoutSettled(done);
            return;
        }

        var topMargin = 64;
        var bottomReserve = getTooltipBottomReserve() + 20;
        var viewportH = global.innerHeight;
        var bandBottom = viewportH - bottomReserve;
        var bandHeight = Math.max(120, bandBottom - topMargin);
        var rect = getHighlightRect(el);
        var scrollDelta = 0;

        if (rect.height <= bandHeight) {
            var idealTop = topMargin + (bandHeight - rect.height) / 2;
            scrollDelta = rect.top - idealTop;
        } else {
            if (rect.top < topMargin) scrollDelta = rect.top - topMargin;
            if (rect.bottom > bandBottom) {
                scrollDelta = Math.max(scrollDelta, rect.bottom - bandBottom);
            }
        }

        if (Math.abs(scrollDelta) >= 1) {
            applyTourScroll(lockedScrollY + scrollDelta);
        }

        waitForLayoutSettled(function () {
            if (!active || !el) {
                if (done) done();
                return;
            }
            var r2 = getHighlightRect(el);
            var fix = 0;
            if (r2.height <= bandHeight) {
                var ideal2 = topMargin + (bandHeight - r2.height) / 2;
                fix = r2.top - ideal2;
            } else {
                if (r2.top < topMargin) fix = r2.top - topMargin;
                if (r2.bottom > bandBottom) fix = Math.max(fix, r2.bottom - bandBottom);
            }
            if (Math.abs(fix) >= 2) {
                applyTourScroll(lockedScrollY + fix);
                waitForLayoutSettled(done);
            } else if (done) {
                done();
            }
        });
    }

    function closeMobileSidebar() {
        if (!isNarrow()) return;
        var sidebar = global.document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open') && typeof global.toggleSidebar === 'function') {
            global.toggleSidebar();
        }
    }

    function destroyTourCompletely() {
        teardown();
        closeMobileSidebar();
        if (rootEl && rootEl.parentNode) {
            rootEl.parentNode.removeChild(rootEl);
        }
        rootEl = null;
        backdropEl = null;
        sidebarBandEl = null;
        spotlightEl = null;
        tooltipEl = null;
    }

    function hideSidebarBand() {
        if (sidebarBandEl) {
            sidebarBandEl.style.display = 'none';
            sidebarBandEl.classList.remove('show');
        }
    }

    function markActiveNav(navTour) {
        if (!navTour) return;
        var nav = findTarget('[data-tour="' + navTour + '"]');
        if (nav) nav.classList.add('myub-tour-nav-active');
    }

    function positionSpotlightOnRect(rect, el) {
        if (rect.width < 2 || rect.height < 2) {
            spotlightEl.style.display = 'none';
            return;
        }
        spotlightEl.style.display = 'block';
        var top = Math.max(4, rect.top - PAD);
        var left = Math.max(4, rect.left - PAD);
        var width = rect.width + PAD * 2;
        var height = rect.height + PAD * 2;
        var maxRight = global.innerWidth - 4;
        var maxBottom = global.innerHeight - 4;
        if (left + width > maxRight) width = maxRight - left;
        if (top + height > maxBottom) height = maxBottom - top;
        spotlightEl.style.top = top + 'px';
        spotlightEl.style.left = left + 'px';
        spotlightEl.style.width = Math.max(2, width) + 'px';
        spotlightEl.style.height = Math.max(2, height) + 'px';
        applySpotlightRadius(el);
    }

    function positionSpotlight(el) {
        if (!el) return;
        var focus = getTourFocusElement(el) || el;
        positionSpotlightOnRect(getHighlightRect(el), focus);
    }

    function getCurrentStep() {
        var pages = getPagesNormalized();
        var page = pages[pageIndex];
        return page && page.steps[stepIndex] ? page.steps[stepIndex] : null;
    }

    function getCurrentPage() {
        return getPagesNormalized()[pageIndex];
    }

    function isLastStepOnPage() {
        var page = getCurrentPage();
        return page && stepIndex >= page.steps.length - 1;
    }

    function isLastPage() {
        return pageIndex >= TOUR_PAGES.length - 1;
    }

    function renderTooltip() {
        var step = getCurrentStep();
        if (!step) return;
        var page = getCurrentPage();
        var total = totalStepCount();
        var gStep = globalStepNumber();
        var isFirst = pageIndex === 0 && stepIndex === 0;
        var isLast = isLastPage() && isLastStepOnPage();

        while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);

        var label = global.document.createElement('div');
        label.className = 'myub-tour-step-label';
        label.textContent = 'Page ' + (pageIndex + 1) + ' of ' + TOUR_PAGES.length + ' · Step ' + gStep + ' of ' + total;

        var title = global.document.createElement('h2');
        title.className = 'myub-tour-title';
        title.textContent = step.title;

        var body = global.document.createElement('p');
        body.className = 'myub-tour-body';
        body.textContent = step.body;

        var actions = global.document.createElement('div');
        actions.className = 'myub-tour-actions';

        var skipBtn = global.document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'myub-tour-btn myub-tour-btn-ghost';
        skipBtn.textContent = 'Skip tour';
        skipBtn.addEventListener('click', skip);

        var nav = global.document.createElement('div');
        nav.className = 'myub-tour-nav';

        if (!isFirst) {
            var backBtn = global.document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'myub-tour-btn myub-tour-btn-secondary';
            backBtn.textContent = 'Back';
            backBtn.addEventListener('click', back);
            nav.appendChild(backBtn);
        }

        var nextBtn = global.document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'myub-tour-btn myub-tour-btn-primary';
        if (isLast) {
            nextBtn.textContent = 'Finish';
        } else if (isLastStepOnPage()) {
            nextBtn.textContent = 'Next page →';
        } else {
            nextBtn.textContent = 'Next';
        }
        nextBtn.addEventListener('click', next);
        nav.appendChild(nextBtn);

        actions.appendChild(skipBtn);
        actions.appendChild(nav);

        tooltipEl.appendChild(label);
        tooltipEl.appendChild(title);
        tooltipEl.appendChild(body);
        tooltipEl.appendChild(actions);
    }

    function showStep() {
        if (!active) return;
        var step = getCurrentStep();
        var page = getCurrentPage();
        if (!step || !page) {
            finish(true);
            return;
        }

        spotlightEl.style.display = 'none';
        hideSidebarBand();
        clearHighlight();
        closeTourDropdowns();
        renderTooltip();

        if (backdropEl) backdropEl.style.display = 'none';

        var navTour = step.navTour || page.navTour;
        markActiveNav(navTour);

        if (stepIndex === 0) {
            scrollToTop();
        }

        var el = findTarget(step.selector);
        if (el) {
            highlightedEl = el;
            var focus = getTourFocusElement(el) || el;
            focus.classList.add('myub-tour-highlight');
            scrollHighlightIntoView(highlightedEl, function () {
                if (!active || highlightedEl !== el) return;
                updateStepLayout(highlightedEl);
            });
        } else {
            spotlightEl.style.display = 'none';
        }

        if (rootEl && tooltipEl && tooltipEl.parentNode === rootEl) {
            rootEl.appendChild(tooltipEl);
        }
    }

    function bindResize() {
        unbindResize();
        resizeHandler = function () {
            if (!active || !highlightedEl) return;
            scrollHighlightIntoView(highlightedEl, function () {
                if (!active || !highlightedEl) return;
                updateStepLayout(highlightedEl);
            });
        };
        global.addEventListener('resize', resizeHandler);
    }

    function unbindResize() {
        if (resizeHandler) {
            global.removeEventListener('resize', resizeHandler);
            global.removeEventListener('scroll', resizeHandler, true);
            resizeHandler = null;
        }
    }

    function runTour() {
        ensureDom();
        active = true;
        scrollToTop();
        lockScroll();
        rootEl.classList.add('active');
        rootEl.setAttribute('aria-hidden', 'false');
        bindResize();
        showStep();
    }

    function teardown() {
        active = false;
        clearHighlight();
        hideSidebarBand();
        unbindResize();
        unlockScroll();
        if (rootEl) {
            rootEl.classList.remove('active');
            rootEl.setAttribute('aria-hidden', 'true');
        }
        if (backdropEl) backdropEl.style.display = 'none';
        if (spotlightEl) spotlightEl.style.display = 'none';
    }

    function navigateToPage(idx, step) {
        var pages = getPagesNormalized();
        if (idx < 0 || idx >= pages.length) return;
        step = typeof step === 'number' ? step : 0;
        teardown();
        setStoredPageIndex(idx);
        setStoredStepIndex(step);
        setTourActive(true);
        pageIndex = idx;
        stepIndex = step;
        var target = pages[idx].file;
        if (getPageFile() === target) {
            waitForPageReady(runTour);
        } else {
            global.location.href = target + '?tour=1';
        }
    }

    function next() {
        if (!isLastStepOnPage()) {
            stepIndex++;
            setStoredStepIndex(stepIndex);
            showStep();
            return;
        }
        if (isLastPage()) {
            finish(true);
            return;
        }
        navigateToPage(pageIndex + 1, 0);
    }

    function back() {
        if (stepIndex > 0) {
            stepIndex--;
            setStoredStepIndex(stepIndex);
            showStep();
            return;
        }
        if (pageIndex > 0) {
            var prevIdx = pageIndex - 1;
            var prev = getPagesNormalized()[prevIdx];
            navigateToPage(prevIdx, prev.steps.length - 1);
        }
    }

    function skip() {
        markSkipped();
        destroyTourCompletely();
        showPopup('info', 'Tour skipped', 'You can replay the full app tour anytime from Profile → App tour.', 'Got it');
    }

    function finish(completed) {
        if (completed) markCompleted();
        else setTourActive(false);
        destroyTourCompletely();
        if (completed) {
            showPopup('success', "You're all set!", "You've toured every main area of MyUB. Explore, connect, and make the most of your semester.", 'Start exploring');
        }
    }

    function showPopup(type, title, message, btnLabel) {
        destroyTourCompletely();
        var overlay = global.document.createElement('div');
        overlay.className = 'myub-tour-popup-overlay';
        overlay.setAttribute('data-myub-tour-popup', '1');
        var popup = global.document.createElement('div');
        popup.className = 'myub-tour-popup';
        var iconWrap = global.document.createElement('div');
        iconWrap.className = 'myub-tour-popup-icon ' + type;
        iconWrap.textContent = type === 'success' ? '🎓' : '💡';
        var h3 = global.document.createElement('h3');
        h3.textContent = title;
        var p = global.document.createElement('p');
        p.textContent = message;
        var btn = global.document.createElement('button');
        btn.type = 'button';
        btn.className = 'myub-tour-btn myub-tour-btn-primary';
        btn.textContent = btnLabel;
        function close() {
            overlay.remove();
            unlockScroll();
        }
        btn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        popup.appendChild(iconWrap);
        popup.appendChild(h3);
        popup.appendChild(p);
        popup.appendChild(btn);
        overlay.appendChild(popup);
        global.document.body.appendChild(overlay);
    }

    function waitForPageReady(callback, attempts) {
        attempts = attempts || 0;
        var loading = global.document.getElementById('loadingScreen');
        var loadingDone = !loading || loading.style.display === 'none' || global.getComputedStyle(loading).display === 'none';
        var main = findTarget('#mainContent, .main-content, .gpa-page, .profile-page');
        var mainOk = main && (main.offsetWidth > 0 || main.offsetHeight > 0);
        if ((loadingDone && mainOk) || attempts > 80) {
            scrollToTop();
            global.setTimeout(callback, 200);
            return;
        }
        global.setTimeout(function () { waitForPageReady(callback, attempts + 1); }, 100);
    }

    function syncToStoredProgress() {
        pageIndex = getStoredPageIndex();
        stepIndex = getStoredStepIndex();
        var page = getPagesNormalized()[pageIndex];
        if (page && stepIndex >= page.steps.length) {
            stepIndex = page.steps.length - 1;
            setStoredStepIndex(stepIndex);
        }
    }

    function resumeIfActive() {
        resolveUserId(function (userId) {
            if (!userId) return;
            var qs = new URLSearchParams(global.location.search);
            var tourQs = qs.get('tour') === '1';
            var replayQs = qs.get('replayTour') === '1';

            if (replayQs) {
                resetTourProgress();
                if (getPageFile() !== 'dashboard.html') {
                    global.location.replace('dashboard.html?tour=1');
                    return;
                }
                pageIndex = 0;
                stepIndex = 0;
            } else if (!isTourActive() && !tourQs) {
                return;
            } else if (tourQs && !isTourActive()) {
                resetTourProgress();
            }

            syncToStoredProgress();
            var expected = getPagesNormalized()[pageIndex].file;
            if (getPageFile() !== expected) {
                if (tourQs || isTourActive()) {
                    global.location.replace(expected + '?tour=1');
                }
                return;
            }

            if (global.MyUBSidebar && typeof global.MyUBSidebar.init === 'function') {
                global.MyUBSidebar.init();
            }

            if (qs.has('tour') || qs.has('replayTour')) {
                try {
                    global.history.replaceState(null, '', global.location.pathname + global.location.hash);
                } catch (_) {}
            }

            waitForPageReady(runTour);
        });
    }

    function beginTour(opts) {
        opts = opts || {};
        resolveUserId(function (userId) {
            if (!userId) return;
            if (opts.afterWelcome && !opts.force && isCompleted()) return;
            if (!opts.force && !opts.afterWelcome && isWelcomeOpen()) return;

            resetTourProgress();
            pageIndex = 0;
            stepIndex = 0;

            if (getPageFile() !== 'dashboard.html') {
                global.location.href = 'dashboard.html?tour=1';
                return;
            }

            if (global.MyUBSidebar && typeof global.MyUBSidebar.init === 'function') {
                global.MyUBSidebar.init();
            }

            waitForPageReady(runTour);
        });
    }

    function start(opts) {
        beginTour(opts);
    }

    function waitForSidebarThenStart(opts, delayMs) {
        global.setTimeout(function () { beginTour(opts); }, delayMs || 400);
    }

    global.MyUBOnboarding = {
        start: start,
        beginTour: beginTour,
        waitForSidebarThenStart: waitForSidebarThenStart,
        shouldAutoStart: shouldAutoStart,
        isCompleted: isCompleted,
        isSkipped: isSkipped,
        resumeIfActive: resumeIfActive,
        resetTourProgress: resetTourProgress
    };

    global.startMyUBTour = function (force) {
        beginTour({ force: !!force, afterWelcome: !force });
    };

    function boot() {
        resumeIfActive();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        global.setTimeout(boot, 0);
    }
})(typeof window !== 'undefined' ? window : this);
