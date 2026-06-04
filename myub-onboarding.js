/**
 * MyUB dashboard onboarding tour
 */
(function (global) {
    'use strict';

    var PAD = 10;
    var cachedUserId = null;
    var active = false;
    var stepIndex = 0;
    var rootEl = null;
    var backdropEl = null;
    var spotlightEl = null;
    var tooltipEl = null;
    var highlightedEl = null;
    var resizeHandler = null;

    var STEPS = [
        { selector: '#sidebar', title: 'Your navigation hub', body: 'The sidebar is home base — Menu for academics, Social for classmates, and Account for your profile.', openSidebar: true },
        { selector: '[data-tour="nav-gpa"]', title: 'GPA Calculator', body: 'Track courses, credits, and grades. MyUB calculates your GPA as you add results.', openSidebar: true },
        { selector: '[data-tour="nav-schedule"]', title: 'Schedule', body: 'Build your weekly timetable so classes and study blocks stay organized.', openSidebar: true },
        { selector: '[data-tour="nav-events"]', title: 'Campus events', body: 'Discover UB events, RSVP, and never miss workshops or society meetups.', openSidebar: true },
        { selector: '[data-tour="nav-notes"]', title: 'Notes & past papers', body: 'Save lecture notes and browse past papers for revision.', openSidebar: true },
        { selector: '[data-tour="nav-groups"]', title: 'Study groups', body: 'Join or create study groups to collaborate and prepare for exams.', openSidebar: true },
        { selector: '[data-tour="nav-messages"]', title: 'Messages', body: 'Chat with friends and group members. Badges show unread counts.', openSidebar: true },
        { selector: '[data-tour="nav-friends"]', title: 'Friends', body: 'Send friend requests and stay connected with classmates.', openSidebar: true },
        { selector: '[data-tour="nav-profile"]', title: 'Your profile', body: 'Update your photo, program, and preferences. Replay this tour anytime from Profile.', openSidebar: true },
        { selector: '[data-tour="search"]', title: 'Quick search', body: 'Search pages, notes, friends, groups, and events from the dashboard.', openSidebar: false },
        { selector: '[data-tour="notifications"]', title: 'Notifications', body: 'Friend requests, messages, events, and important updates appear here.', openSidebar: false },
        { selector: '[data-tour="user-menu"]', title: 'Account menu', body: 'Profile shortcuts, notification settings, sound, and sign out.', openSidebar: false },
        { selector: '[data-tour="welcome-banner"]', title: 'Your dashboard', body: 'Your daily home screen with a greeting and what is happening today.', openSidebar: false },
        { selector: '[data-tour="stats"]', title: 'At-a-glance stats', body: 'Courses, credits, study groups, and tasks update as you use MyUB.', openSidebar: false }
    ];

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

    function markCompleted() {
        var c = storageKey('completed');
        var s = storageKey('skipped');
        if (c) global.localStorage.setItem(c, 'true');
        if (s) global.localStorage.removeItem(s);
    }

    function markSkipped() {
        var s = storageKey('skipped');
        if (s) global.localStorage.setItem(s, 'true');
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
        rootEl.setAttribute('aria-hidden', 'true');

        backdropEl = global.document.createElement('div');
        backdropEl.className = 'myub-tour-backdrop';

        spotlightEl = global.document.createElement('div');
        spotlightEl.className = 'myub-tour-spotlight';

        tooltipEl = global.document.createElement('div');
        tooltipEl.className = 'myub-tour-tooltip';
        tooltipEl.setAttribute('role', 'dialog');
        tooltipEl.setAttribute('aria-modal', 'true');

        rootEl.appendChild(backdropEl);
        rootEl.appendChild(spotlightEl);
        rootEl.appendChild(tooltipEl);
        global.document.body.appendChild(rootEl);
    }

    function isNarrow() {
        return global.innerWidth <= 900;
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
    }

    function findTarget(selector) {
        try {
            return global.document.querySelector(selector);
        } catch (_) {
            return null;
        }
    }

    function positionSpotlight(el) {
        var rect = el.getBoundingClientRect();
        if (rect.width < 2 && rect.height < 2) {
            spotlightEl.style.display = 'none';
            return;
        }
        var top = Math.max(4, rect.top - PAD);
        var left = Math.max(4, rect.left - PAD);
        spotlightEl.style.display = 'block';
        spotlightEl.style.top = top + 'px';
        spotlightEl.style.left = left + 'px';
        spotlightEl.style.width = (rect.width + PAD * 2) + 'px';
        spotlightEl.style.height = (rect.height + PAD * 2) + 'px';
    }

    function escapeHtml(str) {
        var d = global.document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function renderTooltip() {
        var step = STEPS[stepIndex];
        var total = STEPS.length;
        var isFirst = stepIndex === 0;
        var isLast = stepIndex === total - 1;

        while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);

        var label = global.document.createElement('div');
        label.className = 'myub-tour-step-label';
        label.textContent = 'Step ' + (stepIndex + 1) + ' of ' + total;

        var title = global.document.createElement('h2');
        title.className = 'myub-tour-title';
        title.id = 'myubTourTitle';
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
        nextBtn.textContent = isLast ? 'Finish' : 'Next';
        nextBtn.addEventListener('click', next);
        nav.appendChild(nextBtn);

        actions.appendChild(skipBtn);
        actions.appendChild(nav);

        var progress = global.document.createElement('div');
        progress.className = 'myub-tour-progress';
        for (var i = 0; i < total; i++) {
            var dot = global.document.createElement('span');
            dot.className = 'myub-tour-dot' + (i === stepIndex ? ' active' : '');
            progress.appendChild(dot);
        }

        tooltipEl.appendChild(label);
        tooltipEl.appendChild(title);
        tooltipEl.appendChild(body);
        tooltipEl.appendChild(actions);
        tooltipEl.appendChild(progress);
    }

    function showStep() {
        if (!active) return;
        var step = STEPS[stepIndex];
        if (step.openSidebar) ensureSidebarOpen();

        var el = findTarget(step.selector);
        clearHighlight();

        renderTooltip();
        backdropEl.style.display = 'block';

        if (el) {
            el.classList.add('myub-tour-highlight');
            highlightedEl = el;
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            } catch (_) {}
            global.setTimeout(function () {
                if (!active) return;
                positionSpotlight(el);
            }, step.openSidebar && isNarrow() ? 400 : 100);
        } else {
            spotlightEl.style.display = 'none';
        }
    }

    function bindResize() {
        unbindResize();
        resizeHandler = function () {
            if (!active || !highlightedEl) return;
            positionSpotlight(highlightedEl);
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
        stepIndex = 0;
        rootEl.classList.add('active');
        rootEl.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('myub-tour-active');
        global.document.body.style.overflow = 'hidden';
        bindResize();
        showStep();
    }

    function start(opts) {
        opts = opts || {};
        if (active) return;

        var force = !!(opts.force || opts.replay);
        var afterWelcome = !!opts.afterWelcome;
        var auto = !!opts.auto;

        if (!force && !afterWelcome && !auto) return;

        resolveUserId(function (userId) {
            if (!userId) {
                if (global.console && global.console.error) {
                    global.console.error('MyUBOnboarding: could not resolve user id');
                }
                return;
            }

            if (auto && !force && !afterWelcome && !shouldAutoStart()) return;
            if (afterWelcome && !force && isCompleted()) return;
            if (!force && !afterWelcome && isWelcomeOpen()) return;

            if (global.MyUBSidebar && typeof global.MyUBSidebar.init === 'function') {
                global.MyUBSidebar.init();
            }

            global.setTimeout(runTour, force || afterWelcome ? 200 : 100);
        });
    }

    function teardown() {
        active = false;
        clearHighlight();
        unbindResize();
        if (rootEl) {
            rootEl.classList.remove('active');
            rootEl.setAttribute('aria-hidden', 'true');
        }
        if (backdropEl) backdropEl.style.display = 'none';
        if (spotlightEl) spotlightEl.style.display = 'none';
        global.document.body.classList.remove('myub-tour-active');
        global.document.body.style.overflow = '';
    }

    function next() {
        if (stepIndex < STEPS.length - 1) {
            stepIndex++;
            showStep();
        } else {
            finish(true);
        }
    }

    function back() {
        if (stepIndex > 0) {
            stepIndex--;
            showStep();
        }
    }

    function skip() {
        markSkipped();
        teardown();
        showPopup('info', 'Tour skipped', 'You can replay the full app tour anytime from Profile → App tour.', 'Got it');
    }

    function finish(completed) {
        if (completed) markCompleted();
        teardown();
        if (completed) {
            showPopup('success', "You're all set!", "Great job exploring MyUB. Jump into your schedule, connect with friends, and make the most of your semester.", 'Start exploring');
        }
    }

    function showPopup(type, title, message, btnLabel) {
        var overlay = global.document.createElement('div');
        overlay.className = 'myub-tour-popup-overlay';

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
            global.document.body.style.overflow = '';
        }
        btn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

        popup.appendChild(iconWrap);
        popup.appendChild(h3);
        popup.appendChild(p);
        popup.appendChild(btn);
        overlay.appendChild(popup);
        global.document.body.appendChild(overlay);
        global.document.body.style.overflow = 'hidden';
    }

    function waitForSidebarThenStart(opts, delayMs) {
        global.setTimeout(function () { start(opts); }, delayMs || 400);
    }

    function checkReplayFromUrl() {
        try {
            var params = new URLSearchParams(global.location.search);
            if (params.get('replayTour') === '1') {
                global.history.replaceState(null, '', global.location.pathname + global.location.hash);
                waitForSidebarThenStart({ force: true }, 600);
            }
        } catch (_) {}
    }

    global.MyUBOnboarding = {
        start: start,
        waitForSidebarThenStart: waitForSidebarThenStart,
        shouldAutoStart: shouldAutoStart,
        isCompleted: isCompleted,
        isSkipped: isSkipped,
        checkReplayFromUrl: checkReplayFromUrl
    };

    global.startMyUBTour = function (force) {
        start(force ? { force: true } : { afterWelcome: true });
    };

    function bootFromUrl() {
        try {
            if (new URLSearchParams(global.location.search).get('replayTour') === '1') {
                waitForSidebarThenStart({ force: true }, 800);
            }
        } catch (_) {}
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootFromUrl);
    } else {
        global.setTimeout(bootFromUrl, 0);
    }
})(typeof window !== 'undefined' ? window : this);
