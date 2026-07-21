/**
 * Shared left sidebar navigation — consistent layout and active state on all app pages.
 */
(function () {
    'use strict';

    var MENU_ITEMS = [
        { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard', tour: 'nav-dashboard', icon: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>' },
        { id: 'gpa-calculator', href: 'gpa-calculator.html', label: 'GPA Calculator', tour: 'nav-gpa', icon: '<path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>' },
        { id: 'course', href: 'course.html', label: 'Course Hub', tour: 'nav-course', icon: '<path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>' },
        { id: 'schedule', href: 'schedule.html', label: 'Schedule', tour: 'nav-schedule', icon: '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' },
        { id: 'events', href: 'events.html', label: 'Events', tour: 'nav-events', icon: '<path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>' },
        { id: 'notes', href: 'notes.html', label: 'Notes', tour: 'nav-notes', icon: '<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>' },
        { id: 'past-papers', href: 'past-papers.html', label: 'Past Papers', tour: 'nav-papers', icon: '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>' }
    ];

    var SOCIAL_ITEMS = [
        { id: 'study-groups', href: 'study-groups.html', label: 'Study Groups', tour: 'nav-groups', icon: '<path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>' },
        { id: 'messages', href: 'messages.html', label: 'Messages', tour: 'nav-messages', icon: '<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>', badgeId: 'sidebarMsgBadge' },
        { id: 'friends', href: 'friends.html', label: 'Friends', tour: 'nav-friends', icon: '<path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>', badgeId: 'sidebarFriendsBadge' }
    ];

    function getActivePageId() {
        var file = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
        return file.replace(/\.html$/, '');
    }

    function navLink(item, activeId) {
        var active = item.id === activeId ? ' active' : '';
        var badge = item.badgeId
            ? '<span class="badge" id="' + item.badgeId + '" style="display:none;">0</span>'
            : '';
        var tourAttr = item.tour ? ' data-tour="' + item.tour + '"' : '';
        return '<a href="' + item.href + '" class="nav-item' + active + '"' + tourAttr + '>' +
            '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + item.icon + '</svg>' +
            item.label + badge + '</a>';
    }

    function renderNav(activeId) {
        var menuHtml = MENU_ITEMS.map(function (item) { return navLink(item, activeId); }).join('');
        var socialHtml = SOCIAL_ITEMS.map(function (item) { return navLink(item, activeId); }).join('');
        var profileActive = activeId === 'profile' ? ' active' : '';

        return '' +
            '<div class="nav-section">' +
                '<div class="nav-section-title">Menu</div>' + menuHtml +
            '</div>' +
            '<div class="nav-section">' +
                '<div class="nav-section-title">Social</div>' + socialHtml +
            '</div>' +
            '<div class="nav-section">' +
                '<div class="nav-section-title">Account</div>' +
                '<a href="profile.html" class="nav-item' + profileActive + '" data-tour="nav-profile">' +
                    '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
                        '<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>' +
                    '</svg>Profile</a>' +
                '<a href="privacy.html" class="nav-item' + (activeId === 'privacy' ? ' active' : '') + '">' +
                    '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
                        '<path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>' +
                    '</svg>Privacy</a>' +
                '<a href="data-rights.html" class="nav-item' + (activeId === 'data-rights' ? ' active' : '') + '">' +
                    '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
                        '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>' +
                    '</svg>Your Rights</a>' +
                '<button type="button" class="nav-item" onclick="MyUBSidebar.signOut()">' +
                    '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
                        '<path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>' +
                    '</svg>Sign Out</button>' +
            '</div>';
    }

    function init() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Strip broken/duplicate blocks from legacy markup (e.g. repeated MENU sections)
        sidebar.querySelectorAll('.nav-section').forEach(function (el) {
            el.remove();
        });

        var nav = sidebar.querySelector('nav');
        if (!nav) {
            nav = document.createElement('nav');
            sidebar.appendChild(nav);
        }

        nav.innerHTML = renderNav(getActivePageId());
        sidebar.setAttribute('data-myub-sidebar', 'ready');
    }

    function signOut() {
        if (typeof window.handleLogout === 'function') {
            return window.handleLogout();
        }
        if (typeof window.logout === 'function') {
            return window.logout();
        }
    }

    window.MyUBSidebar = { init: init, signOut: signOut, renderNav: renderNav, getActivePageId: getActivePageId };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
