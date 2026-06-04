/**
 * MyUB first-time onboarding tour (dashboard).
 * Replay from Profile → dashboard.html?replayTour=1
 */
(function (global) {
    'use strict';

    var PAD = 8;
    var active = false;
    var stepIndex = 0;
    var rootEl = null;
    var spotlightEl = null;
    var tooltipEl = null;
    var highlightedEl = null;
    var resizeHandler = null;

    var STEPS = [
        {
            selector: '#sidebar',
            title: 'Your navigation hub',
            body: 'The sidebar is home base. Use Menu for academics, Social for classmates, and Account for your profile and sign out.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-gpa"]',
            title: 'GPA Calculator',
            body: 'Track courses, credits, and grades. MyUB calculates your GPA automatically as you add results.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-schedule"]',
            title: 'Schedule',
            body: 'Build your weekly timetable so classes, labs, and study blocks stay organized in one place.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-events"]',
            title: 'Campus events',
            body: 'Discover UB events, RSVP, and never miss workshops, sports, or society meetups.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-notes"]',
            title: 'Notes & past papers',
            body: 'Save lecture notes in Notes and browse Past Papers for revision — all tied to your program.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-groups"]',
            title: 'Study groups',
            body: 'Join or create study groups to collaborate, share files, and prepare for exams together.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-messages"]',
            title: 'Messages',
            body: 'Chat with friends and group members. Unread counts show on the badge when you have new messages.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-friends"]',
            title: 'Friends',
            body: 'Send friend requests, see who is online, and stay connected with your UB classmates.',
            openSidebar: true
        },
        {
            selector: '[data-tour="nav-profile"]',
            title: 'Your profile',
            body: 'Update your photo, program details, and preferences. You can replay this tour anytime from Profile.',
            openSidebar: true
        },
        {
            selector: '[data-tour="search"]',
            title: 'Quick search',
            body: 'Search pages, notes, friends, groups, and events from anywhere on the dashboard.',
            openSidebar: false
        },
        {
            selector: '[data-tour="notifications"]',
            title: 'Notifications',
            body: 'Stay on top of friend requests, messages, events, and important updates in one place.',
            openSidebar: false
        },
        {
            selector: '[data-tour="user-menu"]',
            title: 'Account menu',
            body: 'Open your menu for profile shortcuts, notification and sound settings, and sign out.',
            openSidebar: false
        },
        {
            selector: '[data-tour="welcome-banner"]',
            title: 'Your dashboard',
            body: 'This is your home screen — a daily snapshot with your greeting and what is happening today.',
            openSidebar: false
        },
        {
            selector: '[data-tour="stats"]',
            title: 'At-a-glance stats',
            body: 'Courses, credits, study groups, and pending tasks update as you use MyUB so you always know where you stand.',
            openSidebar: false
        }
    ];

    function getUserId() {
        if (global.currentUser && global.currentUser.id) return global.currentUser.id;
        return null;
    }

    function storageKey(suffix) {
        var id = getUserId();
        if (!id) return null;
        return 'myub_tour_' + suffix + '_' + id;
    }

    function isCompleted() {
        var k = storageKey('completed');
        return k && localStorage.getItem(k) === 'true';
    }

    function isSkipped() {
        var k = storageKey('skipped');
        return k && localStorage.getItem(k) === 'true';
    }

    function shouldAutoStart() {
        return !isCompleted() && !isSkipped();
    }

    function markCompleted() {
        var c = storageKey('completed');
        var s = storageKey('skipped');
        if (c) localStorage.setItem(c, 'true');
        if (s) localStorage.removeItem(s);
    }

    function markSkipped() {
        var s = storageKey('skipped');
        if (s) localStorage.setItem(s, 'true');
    }

    function ensureDom() {
        if (rootEl) return;
        rootEl = document.createElement('div');
        rootEl.id = 'myubTourRoot';
        rootEl.className = 'myub-tour-root';
        rootEl.setAttribute('aria-hidden', 'true');

        spotlightEl = document.createElement('div');
        spotlightEl.className = 'myub-tour-spotlight';
        spotlightEl.setAttribute('aria-hidden', 'true');

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'myub-tour-tooltip';
        tooltipEl.setAttribute('role', 'dialog');
        tooltipEl.setAttribute('aria-modal', 'true');
        tooltipEl.setAttribute('aria-labelledby', 'myubTourTitle');

        rootEl.appendChild(spotlightEl);
        rootEl.appendChild(tooltipEl);
        document.body.appendChild(rootEl);
    }

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function ensureSidebarOpen() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar || !isMobile()) return;
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
        return document.querySelector(selector);
    }

    function positionSpotlight(el) {
        var rect = el.getBoundingClientRect();
        var top = Math.max(4, rect.top - PAD);
        var left = Math.max(4, rect.left - PAD);
        var width = rect.width + PAD * 2;
        var height = rect.height + PAD * 2;

        spotlightEl.style.top = top + 'px';
        spotlightEl.style.left = left + 'px';
        spotlightEl.style.width = width + 'px';
        spotlightEl.style.height = height + 'px';
        spotlightEl.style.display = 'block';
    }

    function positionTooltip(el) {
        var rect = el.getBoundingClientRect();
        var tt = tooltipEl.getBoundingClientRect();
        var margin = 16;
        var top = rect.bottom + margin;
        var left = rect.left;

        if (top + tt.height > window.innerHeight - margin) {
            top = rect.top - tt.height - margin;
        }
        if (top < margin) top = margin;

        if (left + 360 > window.innerWidth - margin) {
            left = window.innerWidth - Math.min(360, window.innerWidth - 32) - margin;
        }
        if (left < margin) left = margin;

        tooltipEl.style.top = top + 'px';
        tooltipEl.style.left = left + 'px';
    }

    function renderTooltip() {
        var step = STEPS[stepIndex];
        var total = STEPS.length;
        var isFirst = stepIndex === 0;
        var isLast = stepIndex === total - 1;

        var dots = '';
        for (var i = 0; i < total; i++) {
            dots += '<span class="myub-tour-dot' + (i === stepIndex ? ' active' : '') + '"></span>';
        }

        tooltipEl.innerHTML =
            '<div class="myub-tour-step-label">Step ' + (stepIndex + 1) + ' of ' + total + '</div>' +
            '<h2 class="myub-tour-title" id="myubTourTitle">' + escapeHtml(step.title) + '</h2>' +
            '<p class="myub-tour-body">' + escapeHtml(step.body) + '</p>' +
            '<div class="myub-tour-actions">' +
            '<button type="button" class="myub-tour-btn myub-tour-btn-ghost" data-action="skip">Skip tour</button>' +
            '<div class="myub-tour-nav">' +
            (!isFirst ? '<button type="button" class="myub-tour-btn myub-tour-btn-secondary" data-action="back">Back</button>' : '') +
            '<button type="button" class="myub-tour-btn myub-tour-btn-primary" data-action="next">' +
            (isLast ? 'Finish' : 'Next') + '</button>' +
            '</div></div>' +
            '<div class="myub-tour-progress">' + dots + '</div>';

        tooltipEl.querySelector('[data-action="skip"]').addEventListener('click', skip);
        tooltipEl.querySelector('[data-action="next"]').addEventListener('click', next);
        var backBtn = tooltipEl.querySelector('[data-action="back"]');
        if (backBtn) backBtn.addEventListener('click', back);
    }

    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function scrollToTarget(el) {
        var rect = el.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 120) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }

    function showStep() {
        var step = STEPS[stepIndex];
        if (step.openSidebar) ensureSidebarOpen();

        var el = findTarget(step.selector);
        if (!el) {
            if (stepIndex < STEPS.length - 1) {
                stepIndex++;
                showStep();
                return;
            }
            finish(true);
            return;
        }

        clearHighlight();
        el.classList.add('myub-tour-highlight');
        highlightedEl = el;

        scrollToTarget(el);
        setTimeout(function () {
            positionSpotlight(el);
            renderTooltip();
            requestAnimationFrame(function () {
                positionTooltip(el);
            });
        }, step.openSidebar && isMobile() ? 320 : 80);
    }

    function bindResize() {
        unbindResize();
        resizeHandler = function () {
            if (!active || !highlightedEl) return;
            positionSpotlight(highlightedEl);
            positionTooltip(highlightedEl);
        };
        window.addEventListener('resize', resizeHandler);
        window.addEventListener('scroll', resizeHandler, true);
    }

    function unbindResize() {
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            window.removeEventListener('scroll', resizeHandler, true);
            resizeHandler = null;
        }
    }

    function start(opts) {
        opts = opts || {};
        if (active) return;
        if (!getUserId()) {
            console.warn('MyUBOnboarding: no user id');
            return;
        }
        if (!opts.replay && !opts.auto) return;
        if (opts.auto && !shouldAutoStart()) return;

        if (document.getElementById('welcomeModal') &&
            document.getElementById('welcomeModal').style.display === 'flex') {
            return;
        }

        ensureDom();
        active = true;
        stepIndex = 0;
        rootEl.classList.add('active');
        rootEl.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        bindResize();
        showStep();
    }

    function teardown() {
        active = false;
        clearHighlight();
        unbindResize();
        if (rootEl) {
            rootEl.classList.remove('active');
            rootEl.setAttribute('aria-hidden', 'true');
        }
        if (spotlightEl) spotlightEl.style.display = 'none';
        document.body.style.overflow = '';
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
        showPopup(
            'info',
            'Tour skipped',
            'No worries — you can replay the full app tour anytime from your Profile page under App tour.',
            'Got it'
        );
    }

    function finish(completed) {
        if (completed) markCompleted();
        teardown();
        if (completed) {
            showPopup(
                'success',
                "You're all set!",
                "Great job exploring MyUB. Jump into your schedule, connect with friends, and make the most of your semester. We've got your back.",
                'Start exploring'
            );
        }
    }

    function showPopup(type, title, message, btnLabel) {
        var overlay = document.createElement('div');
        overlay.className = 'myub-tour-popup-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        var icon = type === 'success' ? '🎓' : '💡';
        overlay.innerHTML =
            '<div class="myub-tour-popup">' +
            '<div class="myub-tour-popup-icon ' + type + '">' + icon + '</div>' +
            '<h3>' + escapeHtml(title) + '</h3>' +
            '<p>' + escapeHtml(message) + '</p>' +
            '<button type="button" class="myub-tour-btn myub-tour-btn-primary">' + escapeHtml(btnLabel) + '</button>' +
            '</div>';

        function close() {
            overlay.remove();
            document.body.style.overflow = '';
        }

        overlay.querySelector('button').addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    function checkReplayFromUrl() {
        try {
            var params = new URLSearchParams(global.location.search);
            if (params.get('replayTour') === '1') {
                var clean = global.location.pathname + global.location.hash;
                global.history.replaceState(null, '', clean);
                setTimeout(function () {
                    start({ replay: true });
                }, 700);
            }
        } catch (_) {}
    }

    global.MyUBOnboarding = {
        start: start,
        shouldAutoStart: shouldAutoStart,
        isCompleted: isCompleted,
        isSkipped: isSkipped,
        checkReplayFromUrl: checkReplayFromUrl
    };
})(typeof window !== 'undefined' ? window : this);
