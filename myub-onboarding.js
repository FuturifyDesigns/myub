/**
 * MyUB multi-page onboarding tour
 */
(function (global) {
    'use strict';

    var PAD = 6;
    var FIT_PAD = 4;
    var TOOLTIP_RESERVE = 260;
    var MIN_SPOTLIGHT_H = 72;
    var TOUR_TOP_PAD = 72;
    var LAYOUT_SETTLE_MS = 80;
    var MOBILE_BREAKPOINT = 900;
    var RESIZE_DEBOUNCE_MS = 180;
    var TOUR_SESSION_KEY = 'myub_tour_session';
    var MASCOTS = {
        waving: 'myub-mascot-waving.png',
        explaining: 'myub-mascot-explaining.png',
        thumbs: 'myub-mascot-thumbs-up.png',
        confident: 'myub-mascot-confident.png'
    };
    var MASCOT_CACHE = 'v=2';
    var TOUR_FORCE_VISIBLE = '.topbar, .sidebar, .welcome-banner, .stat-card, .card, .quick-action, .nav-item, ' +
        '.groups-panel, .chat-panel, .groups-container, .conversations-panel, .messages-container, ' +
        '.friends-main, .profile-header-card, .progression-card, .gpa-summary, .schedule-header, ' +
        '.events-header, .notes-header, .toolbar, .tabs, .stat-value, .gpa-value, .page-content, ' +
        '.main-content, .dashboard, .gpa-page, .hub-page, .hub-explainer, .course-grid, .conversation-item, .friend-card, .request-card';
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
    var viewportHandler = null;
    var resizeDebounceTimer = null;
    var scrollLockHandler = null;
    var keyLockHandler = null;
    var lockedScrollY = 0;
    var stepTargetRetryTimer = null;
    var lastTooltipPageIndex = -1;

    var TOUR_PAGES = [
        {
            file: 'dashboard.html',
            steps: [
                { selector: '[data-tour="welcome-banner"]', title: 'Dashboard', body: 'Your home screen — stats up top, quick actions below, and search plus notifications in the header.', fit: true, mascot: 'waving' },
                { selector: '[data-tour="quick-actions"]', title: 'Quick actions', body: 'One-tap shortcuts to GPA, Course Hub, notes, schedule, messages, and more.', fit: true, mascot: 'explaining' },
                { selector: '[data-tour="gpa-display"]', title: 'Your GPA at a glance', body: 'See cumulative GPA, this semester\'s GPA, progress toward your GPA goal, and a countdown to your next exam.', fit: true, mascot: 'explaining' }
            ]
        },
        {
            file: 'gpa-calculator.html',
            steps: [
                { selector: '[data-tour="gpa-progression"]', title: 'GPA Calculator', body: 'Track degree progress and credits toward graduation. Set a GPA goal in Profile to see your progress here.', fit: true, mascot: 'explaining' },
                { selector: '[data-tour="gpa-tabs"]', title: 'What-if & tools', body: 'Model future grades with the What-if Simulator, plan exam targets with Grade Predictor, and export a transcript-style PDF.', fit: true, mascot: 'explaining' },
                { selector: '[data-tour="gpa-semesters-tour"]', title: 'Semesters & courses', body: 'Add semesters and course grades here. Tap a course code to open Course Hub, or expand CA marks while a semester is in progress.', anchorTop: true, flush: true, compact: true, mascot: 'explaining' },
            ]
        },
        {
            file: 'course.html',
            steps: [
                { selector: '[data-tour="course-hub-intro"]', title: 'Course Hub', body: 'Pick any course to see its grade, credits, and quick links to notes, past papers, study groups, and schedule — all filtered to that module.', fit: true, anchorTop: true, scrollTop: true, mascot: 'explaining' }
            ]
        },
        {
            file: 'schedule.html',
            steps: [
                { selector: '[data-tour="schedule-header"]', title: 'Schedule', body: 'Switch between month, week, and list views, navigate dates, and add events. Open a class or exam and use Add to GPA to send it to your calculator.', fit: true, mascot: 'explaining' }
            ]
        },
        {
            file: 'events.html',
            steps: [
                { selector: '[data-tour="events-header"]', title: 'Events', body: 'Browse campus events, RSVP, and create your own from the tabs above the list.', mascot: 'explaining' }
            ]
        },
        {
            file: 'notes.html',
            steps: [
                { selector: '[data-tour="notes-header"]', title: 'Notes', body: 'Create notes with New Note, upload files, then search and filter your library below.', mascot: 'explaining' }
            ]
        },
        {
            file: 'past-papers.html',
            steps: [
                { selector: '[data-tour="papers-upload"]', title: 'Past Papers', body: 'Upload exam papers for classmates, then search and browse shared resources below.', compact: true, mascot: 'explaining' }
            ]
        },
        {
            file: 'study-groups.html',
            steps: [
                { selector: '[data-tour="groups-container"]', title: 'Study Groups', body: 'Find or create groups on the left, then chat and share files in the workspace on the right.', panels: true, mascot: 'confident' }
            ]
        },
        {
            file: 'messages.html',
            steps: [
                { selector: '[data-tour="messages-main"]', title: 'Messages', body: 'Pick a conversation on the left, then read and send messages on the right.', panels: true, mascot: 'explaining' }
            ]
        },
        {
            file: 'friends.html',
            steps: [
                { selector: '[data-tour="friends-main"]', title: 'Friends', body: 'See your friends, handle requests, and search for students to connect with.', fit: true, mascot: 'confident' }
            ]
        },
        {
            file: 'profile.html',
            steps: [
                { selector: '[data-tour="profile-header"]', title: 'Profile & goals', body: 'Update your photo and details, set your GPA goal, and replay this guided tour anytime from the App tour card below.', fit: true, mascot: 'thumbs' }
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
        if (on) {
            global.localStorage.setItem(k, '1');
            try { global.sessionStorage.setItem(TOUR_SESSION_KEY, '1'); } catch (_) {}
            markTourPrep();
        } else {
            global.localStorage.removeItem(k);
            clearTourPrep();
        }
    }

    function isTourSession() {
        try {
            if (/[?&]tour=1/.test(global.location.search)) return true;
            if (global.sessionStorage.getItem(TOUR_SESSION_KEY) === '1') return true;
        } catch (_) {}
        return isTourActive();
    }

    function markTourPrep() {
        try {
            global.document.documentElement.classList.add('myub-tour-prep');
        } catch (_) {}
    }

    function clearTourPrep() {
        try {
            global.document.documentElement.classList.remove('myub-tour-prep');
            global.sessionStorage.removeItem(TOUR_SESSION_KEY);
        } catch (_) {}
    }

    var tourPrepGuardTimer = null;

    function forceAllTourContentVisible() {
        try {
            if (global.gsap) {
                global.gsap.globalTimeline.pause();
                global.gsap.killTweensOf(TOUR_FORCE_VISIBLE);
            }
        } catch (_) {}
        try {
            global.document.querySelectorAll(TOUR_FORCE_VISIBLE).forEach(function (el) {
                if (el.tagName === 'IMG') {
                    el.style.opacity = '1';
                    el.style.visibility = 'visible';
                    return;
                }
                el.style.opacity = '1';
                el.style.visibility = 'visible';
                if (el.id !== 'sidebar' && !(el.classList && el.classList.contains('sidebar'))) {
                    el.style.transform = 'none';
                }
            });
        } catch (_) {}
    }

    function startTourPrepGuard() {
        if (tourPrepGuardTimer) {
            global.clearInterval(tourPrepGuardTimer);
            tourPrepGuardTimer = null;
        }
        forceAllTourContentVisible();
        var runs = 0;
        var maxRuns = isNarrow() ? 3 : 6;
        var intervalMs = isNarrow() ? 120 : 80;
        tourPrepGuardTimer = global.setInterval(function () {
            forceAllTourContentVisible();
            runs += 1;
            if (runs >= maxRuns) {
                global.clearInterval(tourPrepGuardTimer);
                tourPrepGuardTimer = null;
            }
        }, intervalMs);
    }

    function stopTourPrepGuard() {
        if (tourPrepGuardTimer) {
            global.clearInterval(tourPrepGuardTimer);
            tourPrepGuardTimer = null;
        }
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
        stopTourPrepGuard();
        clearTourPrep();
        setTourActive(false);
    }

    function markSkipped() {
        var s = storageKey('skipped');
        if (s) global.localStorage.setItem(s, 'true');
        stopTourPrepGuard();
        clearTourPrep();
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
        global.document.documentElement.style.overflow = 'hidden';
        global.document.body.style.overflow = 'hidden';
        scrollLockHandler = function (e) {
            e.preventDefault();
            global.scrollTo(0, lockedScrollY);
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
        global.document.documentElement.style.overflow = '';
        global.document.body.style.overflow = '';
        global.scrollTo(0, lockedScrollY);
    }

    function isNarrow() {
        return global.innerWidth <= MOBILE_BREAKPOINT;
    }

    function getTourViewport() {
        var vv = global.visualViewport;
        if (vv) {
            return {
                width: vv.width,
                height: vv.height,
                offsetTop: vv.offsetTop || 0,
                offsetLeft: vv.offsetLeft || 0
            };
        }
        return {
            width: global.innerWidth,
            height: global.innerHeight,
            offsetTop: 0,
            offsetLeft: 0
        };
    }

    function getTourTopPad() {
        return isNarrow() ? 52 : TOUR_TOP_PAD;
    }

    function getScrollAnchorTop() {
        var anchor = getTourTopPad();
        var topbar = global.document.querySelector('main .topbar, .main-content .topbar, .topbar');
        if (!topbar) return anchor;
        try {
            var tb = topbar.getBoundingClientRect();
            if (tb.height >= 8 && tb.bottom > anchor) {
                anchor = Math.ceil(tb.bottom) + 8;
            }
        } catch (_) {}
        return anchor;
    }

    function getTourMargin() {
        return isNarrow() ? 8 : 12;
    }

    function isRectInTourViewport(rect, vw, vh) {
        if (!rect || rect.width < 2 || rect.height < 2) return false;
        return rect.right > 2 && rect.bottom > 2 && rect.left < vw - 2 && rect.top < vh - 2;
    }

    function isPanelVisibleOnMobile(el) {
        if (!el || !el.getBoundingClientRect) return false;
        try {
            var style = global.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (parseFloat(style.opacity) < 0.05) return false;
        } catch (_) {}
        var rect = el.getBoundingClientRect();
        var vp = getTourViewport();
        if (!isRectInTourViewport(rect, vp.width, vp.height)) return false;
        if (el.classList.contains('hidden')) return false;
        return rect.width >= 12 && rect.height >= 12;
    }

    function syncTourMobileClass() {
        if (!rootEl) return;
        if (isNarrow()) {
            rootEl.classList.add('myub-tour-mobile');
            global.document.documentElement.classList.add('myub-tour-mobile');
        } else {
            rootEl.classList.remove('myub-tour-mobile');
            global.document.documentElement.classList.remove('myub-tour-mobile');
        }
    }

    function ensureMobileTourReady() {
        closeMobileSidebar();
        syncTourMobileClass();
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
    }

    function clearHighlight() {
        if (highlightedEl) {
            highlightedEl.classList.remove('myub-tour-highlight', 'myub-tour-outline-target');
            highlightedEl = null;
        }
        global.document.querySelectorAll('.myub-tour-highlight, .myub-tour-nav-active, .myub-tour-outline-target').forEach(function (el) {
            el.classList.remove('myub-tour-highlight', 'myub-tour-nav-active', 'myub-tour-outline-target');
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

    function isInSidebar(el) {
        return !!(el && el.closest && el.closest('#sidebar, .sidebar, aside.sidebar'));
    }

    function findTarget(selector) {
        if (!selector) return null;
        var scopes = ['.dashboard', 'main.main-content', 'main.page-content', 'main', '.gpa-page', '.hub-page', '#pickerView', '.groups-container', '.groups-panel', '.messages-container', '.profile-page', '.friends-page', '.friends-main', '.calendar-container', '.notes-header'];
        var i;
        for (i = 0; i < scopes.length; i++) {
            try {
                var scope = global.document.querySelector(scopes[i]);
                if (scope) {
                    var scoped = scope.querySelector(selector);
                    if (scoped && isTourVisible(scoped) && !isInSidebar(scoped)) return scoped;
                }
            } catch (_) {}
        }
        try {
            var el = global.document.querySelector(selector);
            if (el && isTourVisible(el) && !isInSidebar(el)) return el;
        } catch (_) {}
        return null;
    }

    function getTooltipHeight() {
        var reserve = isNarrow() ? 200 : TOOLTIP_RESERVE;
        if (!tooltipEl) return reserve;
        var h = tooltipEl.offsetHeight;
        if (!h && tooltipEl.getBoundingClientRect) {
            h = tooltipEl.getBoundingClientRect().height;
        }
        return Math.max(reserve, (h || (isNarrow() ? 160 : 200)) + (isNarrow() ? 20 : 32));
    }

    function closeTourDropdowns() {
        global.document.querySelectorAll(
            '.notification-dropdown.show, .notif-dropdown.show, .user-dropdown.show, .search-results-dropdown.show'
        ).forEach(function (dd) {
            dd.classList.remove('show');
        });
    }

    function waitForLayoutSettled(callback) {
        global.requestAnimationFrame(function () {
            global.requestAnimationFrame(function () {
                if (callback) callback();
            });
        });
    }

    function stabilizePageForTour(el) {
        forceAllTourContentVisible();
        if (!el) return;
        try {
            el.querySelectorAll('img').forEach(function (img) {
                img.style.opacity = '1';
                img.style.visibility = 'visible';
            });
        } catch (_) {}
    }

    function syncTourScroll() {
        try {
            global.scrollTo(0, lockedScrollY);
        } catch (_) {
            global.scrollTo(0, lockedScrollY);
        }
    }

    function getViewportSpotlightOffset() {
        if (!isNarrow()) return { top: 0, left: 0 };
        var vp = getTourViewport();
        return { top: vp.offsetTop || 0, left: vp.offsetLeft || 0 };
    }

    function unionRects(nodes, panelsOnly) {
        panelsOnly = !!panelsOnly;
        var union = null;
        var i;
        var vp = getTourViewport();
        for (i = 0; i < nodes.length; i++) {
            var child = nodes[i];
            if (!child || !child.getBoundingClientRect) continue;
            if (panelsOnly && isNarrow() && !isPanelVisibleOnMobile(child)) continue;
            try {
                if (global.getComputedStyle(child).display === 'none') continue;
            } catch (_) {}
            var cr = child.getBoundingClientRect();
            if (panelsOnly && !isRectInTourViewport(cr, vp.width, vp.height)) continue;
            if (cr.width < 2 || cr.height < 2) continue;
            if (!union) {
                union = { top: cr.top, left: cr.left, right: cr.right, bottom: cr.bottom };
            } else {
                union.top = Math.min(union.top, cr.top);
                union.left = Math.min(union.left, cr.left);
                union.right = Math.max(union.right, cr.right);
                union.bottom = Math.max(union.bottom, cr.bottom);
            }
        }
        if (!union) return null;
        return {
            top: union.top,
            left: union.left,
            width: union.right - union.left,
            height: union.bottom - union.top,
            right: union.right,
            bottom: union.bottom
        };
    }

    function measureTargetRect(el) {
        if (!el || !el.getBoundingClientRect) return null;
        syncTourScroll();
        el.offsetHeight;
        return getTargetRect(el);
    }

    function getTargetRect(el) {
        if (!el || !el.getBoundingClientRect) return null;
        var step = getCurrentStep();
        if (step && step.panels) {
            var panels = el.querySelectorAll('.groups-panel, .chat-panel, .conversations-panel');
            if (panels.length < 2) {
                panels = el.children;
            }
            var panelUnion = unionRects(panels, true);
            if (panelUnion) return panelUnion;
            if (isNarrow()) {
                var pi;
                for (pi = 0; pi < panels.length; pi++) {
                    if (isPanelVisibleOnMobile(panels[pi])) {
                        return panels[pi].getBoundingClientRect();
                    }
                }
            }
            var containerRect = el.getBoundingClientRect();
            if (containerRect.width >= 4 && containerRect.height >= 4) {
                return containerRect;
            }
        }
        if ((step && step.fit) || (isNarrow() && !(step && step.panels))) {
            var fitRect = el.getBoundingClientRect();
            if (fitRect.width >= 4 && fitRect.height >= 4) {
                if (step && step.capHeight) {
                    var capReserve = getTooltipHeight() + (isNarrow() ? 16 : 24);
                    var capMaxH = Math.max(MIN_SPOTLIGHT_H, getTourViewport().height - capReserve - getTourTopPad());
                    if (fitRect.height > capMaxH) {
                        return {
                            top: fitRect.top,
                            left: fitRect.left,
                            width: fitRect.width,
                            height: capMaxH,
                            right: fitRect.right,
                            bottom: fitRect.top + capMaxH
                        };
                    }
                }
                return fitRect;
            }
        }
        return el.getBoundingClientRect();
    }

    function ensureHighlightedMedia(el) {
        if (!el || !el.querySelectorAll) return;
        el.querySelectorAll('img').forEach(function (img) {
            img.loading = 'eager';
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            if (!img.complete && img.src) {
                var src = img.src;
                img.src = '';
                img.src = src;
            }
        });
    }

    function getMaxSpotlightHeight(top, maxBottom) {
        var vh = global.innerHeight;
        var reserve = getTooltipHeight() + 24;
        return Math.max(MIN_SPOTLIGHT_H, Math.min(420, Math.floor(vh * 0.45), vh - reserve - TOUR_TOP_PAD));
    }

    function revealSpotlight() {
        if (!spotlightEl) return;
        spotlightEl.style.display = 'block';
        global.requestAnimationFrame(function () {
            if (spotlightEl) spotlightEl.classList.add('is-visible');
        });
    }

    function ensureTourOnTop() {
        if (rootEl && rootEl.parentNode !== global.document.body) {
            global.document.body.appendChild(rootEl);
        }
        if (tooltipEl && rootEl && tooltipEl.parentNode === rootEl) {
            rootEl.appendChild(tooltipEl);
        }
    }

    function positionTooltipBottom() {
        if (!tooltipEl) return;
        ensureTourOnTop();
        tooltipEl.classList.remove('is-anchor');
        tooltipEl.classList.add('is-bottom');
        tooltipEl.style.top = 'auto';
        tooltipEl.style.bottom = '';
        tooltipEl.style.left = '50%';
        tooltipEl.style.right = 'auto';
        tooltipEl.style.transform = 'translateX(-50%)';
    }

    function updateStepLayout(el) {
        if (!active || !el || !spotlightEl) return;
        ensureTourOnTop();
        ensureHighlightedMedia(el);
        var step = getCurrentStep();
        if (step && step.flush) {
            syncTourScroll();
            el.offsetHeight;
            positionTooltipBottom();
            spotlightEl.classList.remove('is-visible');
            spotlightEl.classList.add('is-flush');
            spotlightEl.style.display = 'none';
            return;
        }
        var rect = measureTargetRect(el);
        if (!rect || rect.width < 4 || rect.height < 4) {
            spotlightEl.classList.remove('is-visible', 'is-flush');
            spotlightEl.style.display = 'none';
            positionTooltipBottom();
            return;
        }
        var vp = getTourViewport();
        var vh = vp.height;
        var vw = vp.width;
        var margin = getTourMargin();
        var reserve = getTooltipHeight() + (isNarrow() ? 12 : 16);
        var maxBottom = vh - reserve;
        var fullFrame = !!(step && (step.compact || step.fit || step.panels)) || isNarrow();
        var edge = (step && step.flush) ? 0 : (fullFrame ? (isNarrow() ? 5 : FIT_PAD) : PAD);
        var top;
        var left;
        var width;
        var height;
        if (fullFrame) {
            width = rect.width + edge * 2;
            height = rect.height + edge * 2;
            top = rect.top - edge;
            left = rect.left - edge;
            if (step && step.flush) {
                top = Math.floor(rect.top) - 1;
                left = Math.floor(rect.left) - 1;
                width = Math.ceil(rect.width) + 2;
                height = Math.ceil(rect.height) + 2;
            } else if (step && step.capHeight) {
                var maxFrameH = maxBottom - top;
                if (maxFrameH > 0 && height > maxFrameH) {
                    height = Math.max(MIN_SPOTLIGHT_H, maxFrameH);
                }
            }
            if (left < margin) {
                var leftShift = margin - left;
                left = margin;
                width = Math.max(8, width - leftShift);
            }
            if (left + width > vw - margin) {
                width = Math.max(8, vw - margin - left);
            }
        } else {
            top = Math.max(margin, rect.top - PAD);
            left = Math.max(margin, rect.left - PAD);
            var maxSpotH = getMaxSpotlightHeight(top, maxBottom);
            width = Math.min(rect.width + PAD * 2, vw - margin * 2);
            height = Math.min(rect.height + PAD * 2, maxSpotH);
            if (top + height > maxBottom) {
                height = Math.max(MIN_SPOTLIGHT_H, maxBottom - top);
            }
            if (height < MIN_SPOTLIGHT_H && rect.height >= 24) {
                height = Math.min(maxSpotH, Math.max(MIN_SPOTLIGHT_H, maxBottom - top));
            }
        }
        if (!fullFrame) {
            if (left + width > vw - margin) {
                left = Math.max(margin, vw - margin - width);
            }
            if (top + height > maxBottom) {
                height = Math.max(MIN_SPOTLIGHT_H, maxBottom - top);
            }
        }
        if (width < 8 || height < 8) {
            spotlightEl.classList.remove('is-visible', 'is-flush');
            spotlightEl.style.display = 'none';
        } else {
            var vo = getViewportSpotlightOffset();
            spotlightEl.style.top = (top + vo.top) + 'px';
            spotlightEl.style.left = (left + vo.left) + 'px';
            spotlightEl.style.width = width + 'px';
            spotlightEl.style.height = height + 'px';
            if (step && step.flush) {
                spotlightEl.classList.add('is-flush');
            } else {
                spotlightEl.classList.remove('is-flush');
            }
            try {
                var br = global.getComputedStyle(el).borderRadius;
                if (step && step.flush) {
                    spotlightEl.style.borderRadius = br && br !== '0px' ? br : '18px';
                } else if (step && step.compact) {
                    spotlightEl.style.borderRadius = '10px';
                } else if (fullFrame) {
                    spotlightEl.style.borderRadius = br && br !== '0px' ? br : '16px';
                } else {
                    spotlightEl.style.borderRadius = br && br !== '0px' ? br : '12px';
                }
            } catch (_) {
                spotlightEl.style.borderRadius = step && step.compact ? '10px' : '12px';
            }
            revealSpotlight();
        }
        positionTooltipBottom();
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

    function applyTourScroll(y, smooth) {
        lockedScrollY = Math.max(0, Math.min(y, getMaxTourScroll()));
        var behavior = smooth ? 'smooth' : 'auto';
        try {
            global.scrollTo({ top: lockedScrollY, left: 0, behavior: behavior });
        } catch (_) {
            global.scrollTo(0, lockedScrollY);
        }
    }

    function scrollToTarget(el) {
        if (!el) return;
        var step = getCurrentStep();
        var rect = getTargetRect(el) || el.getBoundingClientRect();
        var scrollY = global.scrollY || 0;
        var reserve = getTooltipHeight() + (isNarrow() ? 16 : 24);
        var vh = getTourViewport().height;
        var edge = isNarrow() ? 5 : FIT_PAD;
        var topPad = getTourTopPad();
        var smooth = !isNarrow() && !!(step && step.panels);

        if (step && (step.anchorTop || step.scrollTop || step.capHeight)) {
            var scrollRect = el.getBoundingClientRect();
            scrollY += scrollRect.top - getScrollAnchorTop();
            applyTourScroll(Math.max(0, Math.min(scrollY, getMaxTourScroll())), false);
            return;
        }

        if (step && (step.fit || step.panels)) {
            if (rect.bottom + edge > vh - reserve) {
                scrollY += rect.bottom + edge - (vh - reserve);
            }
            if (rect.top - edge < topPad) {
                scrollY += rect.top - edge - topPad;
            }
        } else {
            scrollY += rect.top - topPad;
        }
        applyTourScroll(Math.max(0, Math.min(scrollY, getMaxTourScroll())), smooth);
    }

    function targetNeedsScroll(el) {
        if (!el) return false;
        var step = getCurrentStep();
        if (step && (step.anchorTop || step.scrollTop || step.capHeight)) return true;
        if (!(step && (step.fit || step.panels))) return true;
        var rect = getTargetRect(el) || el.getBoundingClientRect();
        var reserve = getTooltipHeight() + (isNarrow() ? 16 : 24);
        var vh = getTourViewport().height;
        var edge = isNarrow() ? 5 : FIT_PAD;
        var topPad = getTourTopPad();
        return rect.bottom + edge > vh - reserve || rect.top - edge < topPad;
    }

    function layoutStep(el, done) {
        if (!el || !active) {
            if (done) done();
            return;
        }
        ensureMobileTourReady();
        stabilizePageForTour(el);
        var step = getCurrentStep();
        var needsScroll = targetNeedsScroll(el);
        scrollToTarget(el);
        var scrollDelay = isNarrow()
            ? (needsScroll ? 100 : 24)
            : (needsScroll ? ((step && (step.panels || step.anchorTop || step.flush)) ? 120 : 48) : 16);
        global.setTimeout(function () {
            if (!active || highlightedEl !== el) {
                if (done) done();
                return;
            }
            waitForLayoutSettled(function () {
                if (!active || highlightedEl !== el) {
                    if (done) done();
                    return;
                }
                updateStepLayout(el);
                var settleMs = isNarrow()
                    ? LAYOUT_SETTLE_MS
                    : (step && step.fit ? LAYOUT_SETTLE_MS : 0);
                if (!settleMs) {
                    if (done) done();
                    return;
                }
                global.setTimeout(function () {
                    if (!active || highlightedEl !== el) {
                        if (done) done();
                        return;
                    }
                    waitForLayoutSettled(function () {
                        if (!active || highlightedEl !== el) {
                            if (done) done();
                            return;
                        }
                        updateStepLayout(el);
                        if (done) done();
                    });
                }, settleMs);
            });
        }, scrollDelay);
    }

    function closeMobileSidebar() {
        if (!isNarrow()) return;
        var sidebar = global.document.getElementById('sidebar');
        var overlay = global.document.getElementById('sidebarOverlay');
        if (sidebar) {
            sidebar.classList.remove('open');
        }
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    function destroyTourCompletely() {
        active = false;
        try { stopTourPrepGuard(); } catch (_) {}
        try { teardown(); } catch (_) {}
        try { closeMobileSidebar(); } catch (_) {}
        try { unlockScroll(); } catch (_) {}
        try { clearTourPrep(); } catch (_) {}
        try { setTourActive(false); } catch (_) {}

        // Nuke any leftover tour layers that can trap clicks after skip/finish
        try {
            global.document.querySelectorAll(
                '.myub-tour-root, .myub-tour-popup-overlay, .myub-tour-spotlight, .myub-tour-tooltip'
            ).forEach(function (el) {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });
        } catch (_) {}

        try {
            global.document.documentElement.classList.remove(
                'myub-tour-active',
                'myub-tour-prep',
                'myub-tour-mobile'
            );
            global.document.body.classList.remove('myub-tour-active');
            global.document.documentElement.style.overflow = '';
            global.document.body.style.overflow = '';
            global.document.documentElement.style.pointerEvents = '';
            global.document.body.style.pointerEvents = '';
        } catch (_) {}

        // Close any stuck mobile sidebar dimmer on desktop too
        try {
            var sidebar = global.document.getElementById('sidebar');
            var overlay = global.document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('show');
        } catch (_) {}

        try {
            var qs = new URLSearchParams(global.location.search);
            if (qs.has('tour') || qs.has('replayTour')) {
                qs.delete('tour');
                qs.delete('replayTour');
                var next = global.location.pathname + (qs.toString() ? '?' + qs.toString() : '') + global.location.hash;
                global.history.replaceState(null, '', next);
            }
        } catch (_) {}

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

    function getMascotSrc(key) {
        var file = MASCOTS[key] || MASCOTS.explaining;
        return file + '?' + MASCOT_CACHE;
    }

    function resolveStepMascot(step, isFirst, isLast) {
        if (step && step.mascot) return step.mascot;
        if (isFirst) return 'waving';
        if (isLast) return 'thumbs';
        return 'explaining';
    }

    function createMascotImg(key, className) {
        var img = global.document.createElement('img');
        img.className = className || 'myub-tour-mascot';
        img.src = getMascotSrc(key);
        img.alt = '';
        img.loading = 'eager';
        img.decoding = 'async';
        return img;
    }

    function createMascotBlock(key, imgClass, stageClass) {
        var stage = global.document.createElement('div');
        stage.className = stageClass || 'myub-mascot-stage';
        var img = createMascotImg(key, imgClass);
        stage.appendChild(img);
        return stage;
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

        var mascotKey = resolveStepMascot(step, isFirst, isLast);
        var mascotWrap = global.document.createElement('div');
        mascotWrap.className = 'myub-tour-mascot-wrap';
        mascotWrap.appendChild(createMascotBlock(mascotKey, 'myub-tour-mascot'));
        tooltipEl.appendChild(mascotWrap);

        var label = global.document.createElement('div');
        label.className = 'myub-tour-step-label';
        label.textContent = 'Step ' + gStep + ' of ' + total;

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

    function cancelStepTargetRetry() {
        if (stepTargetRetryTimer) {
            global.clearTimeout(stepTargetRetryTimer);
            stepTargetRetryTimer = null;
        }
    }

    function applyStepHighlight(el) {
        if (!active || !el) return;
        highlightedEl = el;
        el.classList.add('myub-tour-highlight');
        var step = getCurrentStep();
        if (step && step.flush) {
            el.classList.add('myub-tour-outline-target');
        }
        layoutStep(highlightedEl);
    }

    function retryFindStepTarget(attempts) {
        if (!active) return;
        forceAllTourContentVisible();
        var step = getCurrentStep();
        if (!step) return;
        var el = findTarget(step.selector);
        if (el) {
            applyStepHighlight(el);
            return;
        }
        if (attempts < 150) {
            stepTargetRetryTimer = global.setTimeout(function () {
                retryFindStepTarget(attempts + 1);
            }, 100);
        }
    }

    function showStep() {
        if (!active) return;
        var step = getCurrentStep();
        var page = getCurrentPage();
        if (!step || !page) {
            finish(true);
            return;
        }

        forceAllTourContentVisible();
        cancelStepTargetRetry();
        hideSidebarBand();
        clearHighlight();
        closeTourDropdowns();
        renderTooltip();
        if (tooltipEl) {
            if (pageIndex !== lastTooltipPageIndex) {
                tooltipEl.classList.remove('is-entering');
                void tooltipEl.offsetWidth;
                tooltipEl.classList.add('is-entering');
                lastTooltipPageIndex = pageIndex;
            } else {
                tooltipEl.classList.remove('is-entering');
            }
        }

        if (backdropEl) backdropEl.style.display = 'none';
        if (spotlightEl) spotlightEl.classList.remove('is-visible');

        if (stepIndex === 0 || (step && step.scrollTop)) {
            scrollToTop();
        }

        var el = findTarget(step.selector);
        if (el) {
            applyStepHighlight(el);
        } else {
            if (spotlightEl) {
                spotlightEl.classList.remove('is-visible');
                spotlightEl.style.display = 'none';
            }
            positionTooltipBottom();
            retryFindStepTarget(0);
        }

        ensureTourOnTop();
    }

    function handleTourResize() {
        if (!active || !highlightedEl) return;
        if (resizeDebounceTimer) {
            global.clearTimeout(resizeDebounceTimer);
        }
        resizeDebounceTimer = global.setTimeout(function () {
            resizeDebounceTimer = null;
            if (!active || !highlightedEl) return;
            ensureMobileTourReady();
            if (isNarrow()) {
                updateStepLayout(highlightedEl);
                return;
            }
            stabilizePageForTour(highlightedEl);
            scrollToTarget(highlightedEl);
            updateStepLayout(highlightedEl);
        }, RESIZE_DEBOUNCE_MS);
    }

    function bindResize() {
        unbindResize();
        resizeHandler = handleTourResize;
        global.addEventListener('resize', resizeHandler);
        if (global.visualViewport) {
            viewportHandler = handleTourResize;
            global.visualViewport.addEventListener('resize', viewportHandler);
            global.visualViewport.addEventListener('scroll', viewportHandler);
        }
    }

    function unbindResize() {
        if (resizeDebounceTimer) {
            global.clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = null;
        }
        if (resizeHandler) {
            global.removeEventListener('resize', resizeHandler);
            global.removeEventListener('scroll', resizeHandler, true);
            resizeHandler = null;
        }
        if (viewportHandler && global.visualViewport) {
            global.visualViewport.removeEventListener('resize', viewportHandler);
            global.visualViewport.removeEventListener('scroll', viewportHandler);
            viewportHandler = null;
        }
    }

    function runTour() {
        stopTourPrepGuard();
        forceAllTourContentVisible();
        ensureDom();
        ensureMobileTourReady();
        active = true;
        scrollToTop();
        lockScroll();
        rootEl.classList.add('active');
        rootEl.setAttribute('aria-hidden', 'false');
        global.requestAnimationFrame(function () {
            if (rootEl) rootEl.classList.add('is-ready');
        });
        bindResize();
        showStep();
    }

    function teardown() {
        active = false;
        cancelStepTargetRetry();
        clearHighlight();
        hideSidebarBand();
        unbindResize();
        unlockScroll();
        if (rootEl) {
            rootEl.classList.remove('active');
            rootEl.setAttribute('aria-hidden', 'true');
        }
        if (backdropEl) backdropEl.style.display = 'none';
        if (spotlightEl) {
            spotlightEl.classList.remove('is-visible');
            spotlightEl.style.display = 'none';
        }
        if (rootEl) {
            rootEl.classList.remove('is-ready');
            rootEl.classList.remove('myub-tour-mobile');
        }
        global.document.documentElement.classList.remove('myub-tour-mobile');
    }

    function navigateToPage(idx, step) {
        var pages = getPagesNormalized();
        if (idx < 0 || idx >= pages.length) return;
        step = typeof step === 'number' ? step : 0;
        markTourPrep();
        startTourPrepGuard();
        teardown();
        setStoredPageIndex(idx);
        setStoredStepIndex(step);
        setTourActive(true);
        pageIndex = idx;
        stepIndex = step;
        lastTooltipPageIndex = -1;
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
        else {
            stopTourPrepGuard();
            clearTourPrep();
            setTourActive(false);
        }
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
        var mascotKey = type === 'success' ? 'thumbs' : 'confident';
        var h3 = global.document.createElement('h3');
        h3.textContent = title;
        var p = global.document.createElement('p');
        p.textContent = message;
        var btn = global.document.createElement('button');
        btn.type = 'button';
        btn.className = 'myub-tour-btn myub-tour-btn-primary';
        btn.textContent = btnLabel;
        function close() {
            try {
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            } catch (_) {}
            destroyTourCompletely();
        }
        btn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        popup.appendChild(createMascotBlock(mascotKey, 'myub-tour-popup-mascot', 'myub-mascot-stage myub-mascot-stage-popup'));
        popup.appendChild(h3);
        popup.appendChild(p);
        popup.appendChild(btn);
        overlay.appendChild(popup);
        global.document.body.appendChild(overlay);
    }

    function getLoadingEl() {
        return global.document.getElementById('loadingScreen') || global.document.getElementById('loadingState');
    }

    function isMainContentVisible() {
        var main = global.document.getElementById('mainContent');
        if (!main) {
            main = global.document.querySelector('main.main-content, main.page-content, .gpa-page');
        }
        if (!main) return false;
        try {
            var style = global.getComputedStyle(main);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        } catch (_) {}
        return main.offsetWidth > 0 || main.offsetHeight > 0;
    }

    function isFriendsTourReady() {
        if (getPageFile() !== 'friends.html') return true;
        return global.document.body.getAttribute('data-friends-stats-ready') === '1';
    }

    function isProfileTourReady() {
        if (getPageFile() !== 'profile.html') return true;
        var name = global.document.getElementById('profileName');
        var avatar = global.document.getElementById('profileAvatar');
        if (!name || !avatar) return false;
        if (!name.textContent || !name.textContent.trim()) return false;
        if (avatar.textContent === '--' && !avatar.querySelector('img')) return false;
        return true;
    }

    function isCourseTourReady() {
        if (getPageFile() !== 'course.html') return true;
        var main = global.document.getElementById('mainContent');
        if (!main) return false;
        try {
            if (global.getComputedStyle(main).display === 'none') return false;
        } catch (_) {
            if (main.style.display === 'none') return false;
        }
        var picker = global.document.getElementById('pickerView');
        if (!picker) return false;
        try {
            return global.getComputedStyle(picker).display !== 'none';
        } catch (_) {
            return picker.style.display !== 'none';
        }
    }

    function isPageReadyForTour() {
        var loading = getLoadingEl();
        var loadingDone = !loading;
        if (loading) {
            try {
                loadingDone = loading.style.display === 'none' || global.getComputedStyle(loading).display === 'none';
            } catch (_) {
                loadingDone = true;
            }
        }
        return loadingDone && isMainContentVisible() && isFriendsTourReady() && isProfileTourReady() && isCourseTourReady();
    }

    function isCurrentStepTargetReady() {
        var step = getCurrentStep();
        if (!step || !step.selector) return true;
        var el = findTarget(step.selector);
        if (!el) return false;
        var rect = getTargetRect(el);
        return !!(rect && rect.width >= 12 && rect.height >= 12);
    }

    function waitForPageReady(callback, attempts) {
        attempts = attempts || 0;
        if (isTourSession()) {
            markTourPrep();
            forceAllTourContentVisible();
        }
        var ready = isPageReadyForTour() && isCurrentStepTargetReady();
        if (ready || attempts > 100) {
            forceAllTourContentVisible();
            scrollToTop();
            waitForLayoutSettled(callback);
            return;
        }
        global.setTimeout(function () { waitForPageReady(callback, attempts + 1); }, 40);
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

    function abandonIfFinished() {
        if (isCompleted() || isSkipped()) {
            stopTourPrepGuard();
            clearTourPrep();
            setTourActive(false);
            return true;
        }
        return false;
    }

    function resumeIfActive() {
        resolveUserId(function (userId) {
            if (!userId) return;
            if (abandonIfFinished()) return;
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
            } else if (tourQs && !isTourActive() && shouldAutoStart()) {
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
            if (!opts.force && !shouldAutoStart()) return;
            if (!opts.force && !opts.afterWelcome && isWelcomeOpen()) return;

            markTourPrep();
            closeMobileSidebar();

            if (opts.force) {
                resetTourProgress();
                pageIndex = 0;
                stepIndex = 0;
            } else if (!isTourActive()) {
                resetTourProgress();
                pageIndex = 0;
                stepIndex = 0;
            } else {
                syncToStoredProgress();
            }

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

    function shouldSkipEntrance() {
        return isTourSession() ||
            global.document.documentElement.classList.contains('myub-tour-active') ||
            global.document.documentElement.classList.contains('myub-tour-prep');
    }

    global.MyUBOnboarding = {
        start: start,
        beginTour: beginTour,
        waitForSidebarThenStart: waitForSidebarThenStart,
        shouldAutoStart: shouldAutoStart,
        shouldSkipEntrance: shouldSkipEntrance,
        isCompleted: isCompleted,
        isSkipped: isSkipped,
        isTourActive: isTourActive,
        resumeIfActive: resumeIfActive,
        resetTourProgress: resetTourProgress,
        destroyTourCompletely: destroyTourCompletely,
        mascots: MASCOTS,
        getMascotSrc: getMascotSrc
    };

    global.startMyUBTour = function (force) {
        beginTour({ force: !!force, afterWelcome: !force });
    };

    function boot() {
        if (abandonIfFinished()) return;
        if (isTourSession()) {
            markTourPrep();
            startTourPrepGuard();
        }
        resumeIfActive();
    }

    // If a leftover tour layer is somehow still present after finish/skip,
    // first click on navigation clears it so the site stays usable.
    try {
        global.document.addEventListener('click', function (e) {
            if (active) return;
            var t = e.target;
            if (!t || !t.closest) return;
            if (!t.closest('.nav-item, a[href$=".html"], .sidebar a')) return;
            var stray = global.document.querySelector('.myub-tour-root, .myub-tour-popup-overlay');
            if (stray) destroyTourCompletely();
        }, true);
    } catch (_) {}

    if (!abandonIfFinished() && isTourSession()) {
        markTourPrep();
        startTourPrepGuard();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        global.setTimeout(boot, 0);
    }
})(typeof window !== 'undefined' ? window : this);
