/**
 * MyUB multi-page onboarding tour
 */
(function (global) {
    'use strict';

    var PAD = 8;
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

    var TOUR_PAGES = [
        {
            file: 'dashboard.html',
            steps: [
                { selector: '[data-tour="welcome-banner"]', title: 'Your dashboard', body: 'Your home screen — daily greeting, campus updates, and a snapshot of your day.' },
                { selector: '[data-tour="stats"]', title: 'Quick stats', body: 'Track courses, credits earned, study groups, and pending tasks at a glance.' },
                { selector: '.main-grid .quick-actions', title: 'Quick actions', body: 'Jump straight to GPA, notes, schedule, and other tools in one click.' },
                { selector: '[data-tour="search"]', title: 'Search', body: 'Find pages, notes, friends, groups, and events across MyUB.' },
                { selector: '[data-tour="notifications"]', title: 'Notifications', body: 'Friend requests, messages, and campus alerts show up here.' }
            ]
        },
        {
            file: 'gpa-calculator.html',
            navTour: 'nav-gpa',
            steps: [
                { selector: '#progressionCard, .progression-card', title: 'Degree progression', body: 'See credits earned toward your program and how close you are to graduating.' },
                { selector: '.tabs', title: 'GPA & predictor', body: 'Switch between calculating your current GPA and predicting grades for upcoming courses.' },
                { selector: '#calculatorTab, .gpa-page', title: 'Add your courses', body: 'Enter course codes, credits, and grades — MyUB calculates your GPA automatically.' }
            ]
        },
        {
            file: 'schedule.html',
            navTour: 'nav-schedule',
            steps: [
                { selector: '.schedule-header', title: 'Your timetable', body: 'View and manage your weekly class schedule in one place.' },
                { selector: '.schedule-layout', title: 'Plan your week', body: 'Add classes, labs, and study blocks — drag to organize your time.' }
            ]
        },
        {
            file: 'events.html',
            navTour: 'nav-events',
            steps: [
                { selector: '.events-header', title: 'Campus events', body: 'Discover what is happening at UB — workshops, sports, societies, and more.' },
                { selector: '.events-grid, #eventsGrid', title: 'Browse & RSVP', body: 'Tap an event to see details and RSVP so you never miss out.' }
            ]
        },
        {
            file: 'notes.html',
            navTour: 'nav-notes',
            steps: [
                { selector: '.topbar .btn-primary', title: 'Create notes', body: 'Start a new note or upload study files for your courses.' },
                { selector: '.content-area .toolbar', title: 'Organize notes', body: 'Search, filter pinned notes, and switch between grid or list view.' },
                { selector: '#notesGrid, #notesList', title: 'Your library', body: 'All your notes and uploaded files live here, sorted by course.' }
            ]
        },
        {
            file: 'past-papers.html',
            navTour: 'nav-papers',
            steps: [
                { selector: '#uploadFileBtn', title: 'Upload papers', body: 'Share past exam papers and resources with classmates (PDF, images, DOCX).' },
                { selector: '.content-area .toolbar', title: 'Find papers', body: 'Search and filter by type, date, or show only your uploads.' },
                { selector: '#papersGrid', title: 'Paper library', body: 'Browse shared past papers and revision resources by course.' }
            ]
        },
        {
            file: 'study-groups.html',
            navTour: 'nav-groups',
            steps: [
                { selector: '.groups-header', title: 'Study groups', body: 'Collaborate with classmates — join existing groups or create your own.' },
                { selector: '.groups-tabs', title: 'My groups & discover', body: 'Switch between groups you belong to and groups you can join.' },
                { selector: '#groupsPanel', title: 'Group workspace', body: 'Chat, share files, and coordinate study sessions with your group.' }
            ]
        },
        {
            file: 'messages.html',
            navTour: 'nav-messages',
            steps: [
                { selector: '.conversations-panel', title: 'Conversations', body: 'All your chats in one list — search to find a friend or group quickly.' },
                { selector: '.chat-panel', title: 'Real-time chat', body: 'Send messages, see online status, and stay connected with classmates.' }
            ]
        },
        {
            file: 'friends.html',
            navTour: 'nav-friends',
            steps: [
                { selector: '.friends-page', title: 'Your network', body: 'See friends, pending requests, and who is online on campus.' },
                { selector: '.friends-page .tabs', title: 'Friends & requests', body: 'Accept incoming requests or search for classmates to connect with.' }
            ]
        },
        {
            file: 'profile.html',
            navTour: 'nav-profile',
            steps: [
                { selector: '.profile-header-card', title: 'Profile overview', body: 'Your photo, name, student ID, program, and online status.' },
                { selector: '.profile-page > .card', title: 'Personal details', body: 'View and edit your name, email, year of study, program, and bio.' },
                { selector: '.tour-replay-card', title: 'Replay this tour', body: 'Come back here anytime and tap Replay app tour to walk through MyUB again.' }
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
        global.document.querySelectorAll('.myub-tour-highlight').forEach(function (el) {
            el.classList.remove('myub-tour-highlight');
        });
    }

    function findTarget(selector) {
        if (!selector) return null;
        var parts = selector.split(',').map(function (s) { return s.trim(); });
        for (var i = 0; i < parts.length; i++) {
            try {
                var el = global.document.querySelector(parts[i]);
                if (el) return el;
            } catch (_) {}
        }
        return null;
    }

    function scrollToTop() {
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

    function showSidebarBand(navTour) {
        ensureSidebarOpen();
        var w = getSidebarWidth();
        sidebarBandEl.style.display = 'block';
        sidebarBandEl.classList.add('show');
        sidebarBandEl.style.width = w + 'px';
        sidebarBandEl.style.left = '0';
        sidebarBandEl.style.top = '0';
        sidebarBandEl.style.height = '100vh';
        sidebarBandEl.style.height = '100dvh';

        if (navTour) {
            var nav = findTarget('[data-tour="' + navTour + '"]');
            if (nav) {
                nav.classList.add('myub-tour-highlight');
                highlightedEl = nav;
            }
        }
    }

    function positionSpotlightOnRect(rect) {
        if (rect.width < 2 || rect.height < 2) {
            spotlightEl.style.display = 'none';
            return;
        }
        spotlightEl.style.display = 'block';
        spotlightEl.style.top = Math.max(4, rect.top - PAD) + 'px';
        spotlightEl.style.left = Math.max(4, rect.left - PAD) + 'px';
        spotlightEl.style.width = (rect.width + PAD * 2) + 'px';
        spotlightEl.style.height = (rect.height + PAD * 2) + 'px';
    }

    function positionSpotlight(el) {
        positionSpotlightOnRect(el.getBoundingClientRect());
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

        clearHighlight();
        renderTooltip();
        if (backdropEl) backdropEl.style.display = 'none';

        var navTour = step.navTour || page.navTour;
        var onDashboard = page.file === 'dashboard.html';

        if (onDashboard) {
            hideSidebarBand();
        } else if (navTour) {
            showSidebarBand(navTour);
        } else {
            hideSidebarBand();
        }

        var el = findTarget(step.selector);
        if (el) {
            el.classList.add('myub-tour-highlight');
            highlightedEl = el;
            if (stepIndex === 0) {
                scrollToTop();
            } else {
                try {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                } catch (_) {}
            }
            global.setTimeout(function () {
                if (!active) return;
                positionSpotlight(el);
            }, stepIndex === 0 ? 80 : (navTour && !onDashboard ? 280 : 160));
        } else {
            spotlightEl.style.display = 'none';
        }
    }

    function bindResize() {
        unbindResize();
        resizeHandler = function () {
            if (!active) return;
            var step = getCurrentStep();
            var page = getCurrentPage();
            if (page && page.file !== 'dashboard.html' && (step.navTour || page.navTour)) {
                showSidebarBand(step.navTour || page.navTour);
            }
            var el = highlightedEl || (step && findTarget(step.selector));
            if (el) positionSpotlight(el);
        };
        global.addEventListener('resize', resizeHandler);
        global.addEventListener('scroll', resizeHandler, true);
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
        rootEl.classList.add('active');
        rootEl.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('myub-tour-active');
        global.document.body.style.overflow = 'hidden';
        bindResize();
        showStep();
    }

    function teardown() {
        active = false;
        clearHighlight();
        hideSidebarBand();
        unbindResize();
        if (rootEl) {
            rootEl.classList.remove('active');
            rootEl.setAttribute('aria-hidden', 'true');
        }
        if (backdropEl) backdropEl.style.display = 'none';
        if (spotlightEl) spotlightEl.style.display = 'none';
        global.document.body.classList.remove('myub-tour-active');
        global.document.body.style.overflow = '';
        global.document.body.style.removeProperty('overflow');
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
            global.document.body.classList.remove('myub-tour-active');
            global.document.body.style.overflow = '';
            global.document.body.style.removeProperty('overflow');
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
