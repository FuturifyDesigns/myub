/**
 * MyUB Animations — scroll reveals & micro-interactions
 * Above-fold content reveals immediately; no long hidden states.
 */
(function () {
    'use strict';

    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var html = document.documentElement;
    html.classList.add('myub-enhanced');

    function isMobilePerf() {
        if (window.MyUBPerf && window.MyUBPerf.isMobile) return window.MyUBPerf.isMobile();
        return window.matchMedia('(max-width: 900px)').matches ||
            window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }

    var MOBILE_PERF = isMobilePerf();
    if (MOBILE_PERF) {
        html.classList.add('myub-mobile-perf');
    }

    var FROM_TRANSITION_KEY = 'myub_from_transition';

    function shouldSkipAnimations() {
        if (REDUCED || MOBILE_PERF) return true;
        if (html.classList.contains('myub-tour-active')) return true;
        if (html.classList.contains('myub-tour-prep')) return true;
        if (/[?&]tour=1/.test(location.search)) return true;
        if (window.MyUBOnboarding && window.MyUBOnboarding.shouldSkipEntrance &&
            window.MyUBOnboarding.shouldSkipEntrance()) return true;
        return false;
    }

    function cameFromTransition() {
        if (sessionStorage.getItem(FROM_TRANSITION_KEY) === '1') {
            sessionStorage.removeItem(FROM_TRANSITION_KEY);
            return true;
        }
        return false;
    }

    function forceVisible(selector) {
        document.querySelectorAll(selector).forEach(function (el) {
            el.style.opacity = '';
            el.style.transform = '';
            el.style.visibility = '';
            el.classList.remove('myub-reveal', 'myub-reveal-left', 'myub-reveal-scale');
        });
    }

    function isInViewport(el) {
        var rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight * 0.94 && rect.bottom > 0;
    }

    /* ── Scroll progress bar ── */
    function initScrollProgress() {
        if (REDUCED) return;
        var bar = document.createElement('div');
        bar.className = 'myub-scroll-progress';
        bar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bar);

        function update() {
            var scrollTop = window.scrollY || document.documentElement.scrollTop;
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
            bar.style.width = pct + '%';
        }

        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    var REVEAL_SELECTORS = [
        '.card',
        '.stat-card',
        '.quick-action',
        '.welcome-banner',
        '.schedule-item',
        '.event-card',
        '.note-card',
        '.paper-card',
        '.friend-card',
        '.feature-item',
        '.profile-header-card',
        '.progression-card',
        '.hs-item',
        '.schedule-header',
        '.events-header',
        '.notes-header',
        '.toolbar'
    ].join(', ');

    function isDashboard() {
        return /dashboard\.html/.test(location.pathname) || location.pathname.endsWith('/');
    }

    function isAuthPage() {
        return !!document.getElementById('authLanding');
    }

    function tagRevealElements() {
        if (isDashboard() || isAuthPage()) return;
        var seen = new Set();
        document.querySelectorAll(REVEAL_SELECTORS).forEach(function (el) {
            if (seen.has(el) || el.closest('.myub-tour-root')) return;
            seen.add(el);
            el.classList.add('myub-reveal');
            if (el.classList.contains('stat-card') || el.classList.contains('quick-action')) {
                el.classList.add('myub-reveal-scale');
            }
            if (el.classList.contains('schedule-item') || el.classList.contains('hs-item')) {
                el.classList.add('myub-reveal-left');
            }
        });
    }

    function revealState(el) {
        return {
            y: el.classList.contains('myub-reveal-left') ? 0 : 20,
            x: el.classList.contains('myub-reveal-left') ? -20 : 0,
            opacity: 0,
            scale: el.classList.contains('myub-reveal-scale') ? 0.96 : 1
        };
    }

    function initScrollReveals(fastPath) {
        if (isDashboard() || isAuthPage()) return;

        var reveals = document.querySelectorAll('.myub-reveal');
        if (!reveals.length) return;

        if (shouldSkipAnimations() || fastPath) {
            forceVisible('.myub-reveal');
            return;
        }

        var g = window.gsap;
        if (!g) {
            forceVisible('.myub-reveal');
            return;
        }

        if (window.ScrollTrigger) {
            g.registerPlugin(window.ScrollTrigger);
        }

        var inView = [];
        var belowFold = [];
        reveals.forEach(function (el) {
            if (isInViewport(el)) inView.push(el);
            else belowFold.push(el);
        });

        if (inView.length) {
            g.fromTo(inView,
                { y: 18, opacity: 0, scale: 0.98 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: fastPath ? 0.28 : 0.45,
                    stagger: fastPath ? 0.03 : 0.05,
                    ease: 'power2.out',
                    clearProps: 'transform,opacity'
                }
            );
        }

        if (belowFold.length && window.ScrollTrigger) {
            belowFold.forEach(function (el) {
                g.fromTo(el,
                    revealState(el),
                    {
                        y: 0,
                        x: 0,
                        opacity: 1,
                        scale: 1,
                        duration: 0.55,
                        ease: 'power2.out',
                        clearProps: 'transform,opacity',
                        scrollTrigger: {
                            trigger: el,
                            start: 'top 94%',
                            toggleActions: 'play none none none',
                            once: true
                        }
                    }
                );
            });
        } else if (belowFold.length) {
            g.fromTo(belowFold,
                { y: 16, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.4,
                    stagger: 0.04,
                    ease: 'power2.out',
                    clearProps: 'all'
                }
            );
        }

        setTimeout(function () { forceVisible('.myub-reveal'); }, 1500);
    }

    function initPageEntrance(fastPath) {
        if (shouldSkipAnimations() || isAuthPage() || fastPath) return;
        var g = window.gsap;
        if (!g || location.pathname.includes('dashboard')) return;

        var hasSidebar = document.querySelector('.sidebar');
        if (!hasSidebar) return;

        var main = document.getElementById('mainContent');
        if (main && main.style.display === 'none') return;

        try {
            g.fromTo('.topbar',
                { y: -10, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'all' });
        } catch (e) {
            forceVisible('.topbar');
        }
    }

    function initCardSpotlight() {
        /* Disabled — glow tracking reads as generic AI UI */
        return;
    }

    function initMagneticHover() {
        /* Disabled — magnetic drift feels gimmicky for an education portal */
        return;
    }

    function initBannerParallax() {
        /* Disabled — keep welcome banner solid and stable */
        return;
    }

    function initEduInteractions() {
        if (REDUCED || MOBILE_PERF) return;
        document.querySelectorAll('.quick-action, .stat-card, .nav-item').forEach(function (el) {
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (el.tagName === 'A' || el.tagName === 'BUTTON') return;
                    var link = el.querySelector('a');
                    if (link) link.click();
                }
            });
        });
    }

    function initCounters() {
        if (shouldSkipAnimations() || isDashboard()) return;
        var g = window.gsap;
        if (!g || !window.ScrollTrigger) return;

        document.querySelectorAll('.stat-info h3, .gpa-value').forEach(function (el) {
            var text = el.textContent.trim();
            var num = parseFloat(text);
            if (isNaN(num)) return;
            var decimals = (text.split('.')[1] || '').length;
            var obj = { val: 0 };
            g.to(obj, {
                val: num,
                duration: 1,
                ease: 'power2.out',
                scrollTrigger: { trigger: el, start: 'top 90%', once: true },
                onUpdate: function () {
                    el.textContent = decimals > 0
                        ? obj.val.toFixed(decimals)
                        : Math.round(obj.val).toString();
                }
            });
        });
    }

    function initNavRipple() {
        document.querySelectorAll('.nav-item').forEach(function (item) {
            item.addEventListener('click', function (e) {
                var ripple = document.createElement('span');
                ripple.style.cssText =
                    'position:absolute;border-radius:50%;background:rgba(255,255,255,0.15);' +
                    'transform:scale(0);animation:myubRipple 0.5s ease-out;pointer-events:none;';
                var rect = item.getBoundingClientRect();
                var size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
                ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
                item.appendChild(ripple);
                setTimeout(function () { ripple.remove(); }, 500);
            });
        });
    }

    if (!document.getElementById('myub-ripple-style')) {
        var style = document.createElement('style');
        style.id = 'myub-ripple-style';
        style.textContent = '@keyframes myubRipple{to{transform:scale(2.5);opacity:0}}';
        document.head.appendChild(style);
    }

    function observeDynamicContent() {
        if (MOBILE_PERF || !window.MutationObserver) return;
        var debounce;
        new MutationObserver(function () {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                tagRevealElements();
                initCardSpotlight();
                if (window.ScrollTrigger) window.ScrollTrigger.refresh();
            }, 200);
        }).observe(document.getElementById('mainContent') || document.body, {
            childList: true,
            subtree: true
        });
    }

    function runAnimations(fastPath) {
        initScrollReveals(fastPath);
        initPageEntrance(fastPath);
        initCounters();
    }

    function boot() {
        if (isAuthPage()) return;

        var fastPath = cameFromTransition() || MOBILE_PERF;

        if (!MOBILE_PERF) {
            initScrollProgress();
        }
        tagRevealElements();
        if (!MOBILE_PERF) {
            initCardSpotlight();
            initMagneticHover();
            initBannerParallax();
            initEduInteractions();
        }
        initNavRipple();
        if (!MOBILE_PERF) {
            observeDynamicContent();
        }

        if (MOBILE_PERF) {
            forceVisible('.myub-reveal, .topbar, .sidebar .nav-item, .card, .stat-card, .main-content, #mainContent');
            return;
        }

        if (fastPath) {
            runAnimations(true);
        } else {
            var attempts = 0;
            var waitGsap = setInterval(function () {
                attempts++;
                if (window.gsap || attempts > 12) {
                    clearInterval(waitGsap);
                    runAnimations(false);
                }
            }, 40);
        }

        document.addEventListener('myub-transition-done', function () {
            forceVisible('.myub-reveal, .topbar, .sidebar .nav-item, .card, .stat-card, .main-content, #mainContent');
            runAnimations(true);
        });

        setTimeout(function () {
            forceVisible('.myub-reveal, .topbar, .sidebar .nav-item, .card, .stat-card');
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
