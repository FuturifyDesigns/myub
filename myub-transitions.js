/**
 * MyUB Page Transitions — curtain + centered logo (in sync)
 */
(function () {
    'use strict';

    document.documentElement.classList.add('myub-enhanced');

    var STORAGE_KEY = 'myub_pt';
    var FROM_TRANSITION_KEY = 'myub_from_transition';
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var TRANSITION_STYLE = 'curtain';
    var PANEL_DUR = 0.5;
    var PANEL_STAGGER = 0.045;

    var LOGO_HTML =
        '<div class="myub-pt-logo-mark">' +
            '<div class="myub-pt-m-wrap">' +
                '<div class="myub-pt-cap">' +
                    '<svg viewBox="0 0 100 70" aria-hidden="true">' +
                        '<polygon points="50,6 95,24 50,42 5,24" fill="#ffffff"/>' +
                        '<circle cx="50" cy="24" r="4.5" fill="#1a365d" stroke="#ffffff" stroke-width="1.5"/>' +
                        '<rect x="32" y="38" width="36" height="18" rx="2.5" fill="#ffffff"/>' +
                        '<circle cx="78" cy="24" r="4" fill="#c41e3a"/>' +
                        '<path d="M78 28 Q82 44 80 54" stroke="#c41e3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
                        '<ellipse cx="80" cy="57" rx="5" ry="8" fill="#c41e3a"/>' +
                    '</svg>' +
                '</div>' +
                '<span class="myub-pt-m">M</span>' +
            '</div>' +
            '<span class="myub-pt-ub">yUB</span>' +
        '</div>';

    function ensureOverlay() {
        var el = document.getElementById('myubPageTransition');
        if (!el) {
            el = document.createElement('div');
            el.id = 'myubPageTransition';
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
        }
        el.className = 'myub-pt myub-pt--' + TRANSITION_STYLE;
        el.innerHTML =
            '<div class="myub-pt-curtain"><i></i><i></i><i></i><i></i><i></i></div>' +
            '<div class="myub-pt-logo">' + LOGO_HTML + '</div>';
        return el;
    }

    function isInternalHtmlLink(a) {
        if (!a || !a.getAttribute('href')) return false;
        if (a.target === '_blank' || a.hasAttribute('download')) return false;
        if (a.hasAttribute('data-no-transition')) return false;
        if (a.getAttribute('href').charAt(0) === '#') return false;
        try {
            var u = new URL(a.href, location.href);
            if (u.origin !== location.origin) return false;
            var p = u.pathname;
            return /\.html$/i.test(p) || p === '/' || /\/$/.test(p);
        } catch (e) {
            return false;
        }
    }

    function prepEnterOverlay() {
        if (REDUCED || !sessionStorage.getItem(STORAGE_KEY)) return;
        var overlay = ensureOverlay();
        overlay.classList.add('active', 'entering', 'myub-pt-prep');
    }

    function runExit(url) {
        if (REDUCED) {
            location.href = url;
            return;
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ style: TRANSITION_STYLE }));
        sessionStorage.setItem(FROM_TRANSITION_KEY, '1');

        var g = window.gsap;
        var overlay = ensureOverlay();
        overlay.classList.add('active', 'myub-pt-anim');
        overlay.classList.remove('entering', 'myub-pt-prep');

        if (!g) {
            setTimeout(function () { location.href = url; }, 120);
            return;
        }

        var panels = overlay.querySelectorAll('.myub-pt-curtain i');
        var logoMark = overlay.querySelector('.myub-pt-logo-mark');

        var tl = g.timeline({ onComplete: function () { location.href = url; } });
        tl.set(panels, { yPercent: 100 })
          .set(logoMark, { opacity: 0, scale: 0.72, rotate: -6 })
          .to(panels, {
              yPercent: 0,
              duration: PANEL_DUR,
              ease: 'power4.inOut',
              stagger: PANEL_STAGGER
          }, 0)
          .to(logoMark, {
              opacity: 1,
              scale: 1,
              rotate: 0,
              duration: 0.38,
              ease: 'back.out(1.5)'
          }, 0);
    }

    function runEnter() {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw || REDUCED) return;

        try { JSON.parse(raw); } catch (e) { return; }
        sessionStorage.removeItem(STORAGE_KEY);

        var g = window.gsap;
        var overlay = document.getElementById('myubPageTransition') || ensureOverlay();
        overlay.classList.add('active', 'entering', 'myub-pt-anim');
        overlay.classList.remove('myub-pt-prep');

        if (!g) {
            overlay.classList.remove('active', 'entering');
            if (overlay.parentNode) overlay.remove();
            return;
        }

        var panels = overlay.querySelectorAll('.myub-pt-curtain i');
        var logoMark = overlay.querySelector('.myub-pt-logo-mark');

        var finish = function () {
            overlay.classList.remove('active', 'entering', 'myub-pt-prep', 'myub-pt-anim');
            setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 80);
            document.dispatchEvent(new CustomEvent('myub-transition-done'));
        };

        g.set(panels, { yPercent: 0 });
        g.set(logoMark, { opacity: 1, scale: 1, rotate: 0 });

        var tl = g.timeline({ onComplete: finish });
        tl.to(panels, {
              yPercent: -100,
              duration: PANEL_DUR,
              ease: 'power4.inOut',
              stagger: PANEL_STAGGER * 0.85
          }, 0)
          .to(logoMark, {
              opacity: 0,
              scale: 1.1,
              rotate: 4,
              duration: PANEL_DUR * 0.9,
              ease: 'power2.in'
          }, 0);
    }

    function navigate(url, clickEvent) {
        runExit(url);
    }

    window.myubNavigate = navigate;

    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href]');
        if (!isInternalHtmlLink(a)) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(a.href, e);
    }, true);

    function bootEnter() {
        var attempts = 0;
        var wait = setInterval(function () {
            attempts++;
            if (window.gsap || attempts > 16) {
                clearInterval(wait);
                runEnter();
            }
        }, 30);
    }

    prepEnterOverlay();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootEnter);
    } else {
        bootEnter();
    }
})();
