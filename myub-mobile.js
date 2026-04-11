/**
 * MyUB Mobile / PWA Enhancements v1.0
 * ------------------------------------
 * Drop-in companion to myub-utils.js. Self-installs on DOM ready.
 * Include AFTER myub-utils.js on every page:
 *     <script src="myub-utils.js"></script>
 *     <script src="myub-mobile.js"></script>
 *
 * What it does:
 *  1. Pull-to-refresh: works in mobile browsers AND installed PWAs.
 *     Drag down >70px from scrollTop=0, release → page reloads.
 *  2. Scroll smoothness: applies -webkit-overflow-scrolling and
 *     touch-action hints to the main scroll container.
 *  3. Battery-safe: pauses pull-to-refresh listeners when tab is hidden.
 *
 * Note: this module assumes the bad `overscroll-behavior-y: none` rule
 * has been removed from html/body in the page's CSS. If it's still
 * there, the browser will swallow the touch deltas and PTR will not
 * trigger. Use the strip-overscroll.sh script in the same folder.
 */

(function () {
    'use strict';

    if (window.MyUBMobile) return; // idempotent

    var THRESHOLD_PX = 70;          // distance the user must drag
    var MAX_PULL_PX  = 140;         // visual cap on the indicator
    var RESIST       = 0.55;        // rubber-band resistance factor

    var indicator, spinner, label;
    var startY = null;
    var pulling = false;
    var pullDistance = 0;
    var refreshing = false;

    // -------- 1. INDICATOR DOM --------
    function buildIndicator() {
        indicator = document.createElement('div');
        indicator.id = 'myub-ptr-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.style.cssText = [
            'position:fixed',
            'top:0',
            'left:50%',
            'transform:translate(-50%,-100%)',
            'z-index:99999',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'gap:8px',
            'padding:10px 18px',
            'border-radius:0 0 14px 14px',
            'background:rgba(20,20,28,0.92)',
            'color:#fff',
            'font:500 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'box-shadow:0 6px 24px rgba(0,0,0,0.35)',
            'backdrop-filter:blur(8px)',
            '-webkit-backdrop-filter:blur(8px)',
            'transition:transform 240ms cubic-bezier(0.16,1,0.3,1),opacity 200ms',
            'opacity:0',
            'pointer-events:none',
            'will-change:transform,opacity'
        ].join(';');

        spinner = document.createElement('div');
        spinner.style.cssText = [
            'width:16px',
            'height:16px',
            'border:2px solid rgba(255,255,255,0.25)',
            'border-top-color:#fff',
            'border-radius:50%',
            'transition:transform 120ms linear'
        ].join(';');

        label = document.createElement('span');
        label.textContent = 'Pull to refresh';

        indicator.appendChild(spinner);
        indicator.appendChild(label);
        document.body.appendChild(indicator);
    }

    function setIndicator(distance, state) {
        if (!indicator) return;
        var pct = Math.min(distance / THRESHOLD_PX, 1);
        var translateY = Math.min(distance, MAX_PULL_PX) - 100;
        indicator.style.transform = 'translate(-50%,' + translateY + '%)';
        indicator.style.opacity = String(Math.min(pct + 0.1, 1));
        spinner.style.transform = 'rotate(' + (distance * 3) + 'deg)';
        if (state === 'release') {
            label.textContent = 'Release to refresh';
        } else if (state === 'refreshing') {
            label.textContent = 'Refreshing…';
            indicator.style.transform = 'translate(-50%,20%)';
            indicator.style.opacity = '1';
            spinner.style.animation = 'myub-ptr-spin 0.7s linear infinite';
        } else {
            label.textContent = 'Pull to refresh';
        }
    }

    function hideIndicator() {
        if (!indicator) return;
        indicator.style.transform = 'translate(-50%,-100%)';
        indicator.style.opacity = '0';
        spinner.style.animation = '';
    }

    // -------- 2. TOUCH HANDLERS --------
    function getScrollTop() {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    function onTouchStart(e) {
        if (refreshing) return;
        if (getScrollTop() > 0) { startY = null; return; }
        if (e.touches.length !== 1) { startY = null; return; }
        startY = e.touches[0].clientY;
        pulling = false;
        pullDistance = 0;
    }

    function onTouchMove(e) {
        if (refreshing || startY === null) return;
        var currentY = e.touches[0].clientY;
        var delta = currentY - startY;
        if (delta <= 0) { startY = null; hideIndicator(); return; }
        // The user is dragging downward at scrollTop=0 → start pulling.
        if (getScrollTop() > 0) { startY = null; hideIndicator(); return; }
        pulling = true;
        pullDistance = delta * RESIST;
        setIndicator(pullDistance, pullDistance >= THRESHOLD_PX ? 'release' : 'pull');
        // Only block native scroll once we're clearly in PTR mode, so taps
        // and short scrolls aren't interfered with.
        if (pullDistance > 12 && e.cancelable) e.preventDefault();
    }

    function onTouchEnd() {
        if (refreshing) return;
        if (!pulling) { startY = null; return; }
        if (pullDistance >= THRESHOLD_PX) {
            triggerRefresh();
        } else {
            hideIndicator();
        }
        startY = null;
        pulling = false;
        pullDistance = 0;
    }

    function triggerRefresh() {
        refreshing = true;
        setIndicator(THRESHOLD_PX, 'refreshing');
        // Small delay so the user actually sees the spinner before the
        // page tears itself down. Feels more responsive than instant.
        setTimeout(function () {
            window.location.reload();
        }, 320);
    }

    // -------- 3. SCROLL SMOOTHNESS --------
    function applyScrollHints() {
        var style = document.createElement('style');
        style.id = 'myub-mobile-scroll-hints';
        style.textContent = [
            '@keyframes myub-ptr-spin{to{transform:rotate(360deg)}}',
            'html,body{-webkit-overflow-scrolling:touch;}',
            // Modal/sidebar containment — prevents body bounce when a
            // modal is scrolled to its edges, replacing the overscroll
            // ban that used to live on html/body.
            '.modal,.sidebar,.dropdown-menu,[role="dialog"]{overscroll-behavior:contain;}',
            // Tame backdrop-filter cost on phones — biggest single
            // scroll-jank source on the existing topbar.
            '@media (hover:none) and (pointer:coarse){',
            '  .topbar,.app-topbar,header.topbar{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    // -------- 4. BATTERY-SAFE LIFECYCLE --------
    var listenersAttached = false;
    function attachListeners() {
        if (listenersAttached) return;
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove',  onTouchMove,  { passive: false });
        document.addEventListener('touchend',   onTouchEnd,   { passive: true });
        document.addEventListener('touchcancel',onTouchEnd,   { passive: true });
        listenersAttached = true;
    }
    function detachListeners() {
        if (!listenersAttached) return;
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchmove',  onTouchMove);
        document.removeEventListener('touchend',   onTouchEnd);
        document.removeEventListener('touchcancel',onTouchEnd);
        listenersAttached = false;
    }
    function onVisibilityChange() {
        if (document.hidden) detachListeners();
        else attachListeners();
    }

    // -------- 5. INIT --------
    function init() {
        applyScrollHints();
        buildIndicator();
        attachListeners();
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MyUBMobile = {
        version: '1.0.0',
        refresh: triggerRefresh,
        // Hook for future use: events.html will call this to register
        // a custom refresh handler instead of full page reload.
        setRefreshHandler: function (fn) {
            triggerRefresh = function () {
                refreshing = true;
                setIndicator(THRESHOLD_PX, 'refreshing');
                Promise.resolve(fn()).finally(function () {
                    refreshing = false;
                    hideIndicator();
                });
            };
        }
    };

})();
