/**
 * MyUB Consent Manager — Botswana Data Protection Act, 2024
 * Handles cookie/similar-tech preferences and site-wide consent UI.
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'myub_consent_v1';
    var VERSION = 1;

    var defaultPrefs = {
        version: VERSION,
        necessary: true,
        preferences: false,
        functional: false,
        decidedAt: null
    };

    function readPrefs() {
        try {
            var raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== VERSION) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function writePrefs(prefs) {
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) { /* ignore quota */ }
        try {
            global.dispatchEvent(new CustomEvent('myub-consent-changed', { detail: prefs }));
        } catch (e2) { /* ignore */ }
    }

    function hasDecision() {
        return !!readPrefs();
    }

    function getPrefs() {
        return readPrefs() || Object.assign({}, defaultPrefs);
    }

    function allowPreferences() {
        var p = readPrefs();
        return !!(p && p.preferences);
    }

    function allowFunctional() {
        var p = readPrefs();
        return !!(p && p.functional);
    }

    function saveChoice(partial) {
        var prefs = {
            version: VERSION,
            necessary: true,
            preferences: !!partial.preferences,
            functional: !!partial.functional,
            decidedAt: new Date().toISOString()
        };
        writePrefs(prefs);
        hideBanner();
        hideModal();
        return prefs;
    }

    function acceptAll() {
        return saveChoice({ preferences: true, functional: true });
    }

    function rejectOptional() {
        return saveChoice({ preferences: false, functional: false });
    }

    function ensureStyles() {
        if (document.getElementById('myub-consent-styles')) return;
        var style = document.createElement('style');
        style.id = 'myub-consent-styles';
        style.textContent = [
            '#myub-consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:100050;',
            'max-width:720px;margin:0 auto;background:#0f2744;color:#fff;border:1px solid rgba(255,255,255,.14);',
            'border-radius:18px;padding:18px 18px 16px;box-shadow:0 24px 60px rgba(0,0,0,.45);',
            'font-family:Outfit,system-ui,sans-serif;display:none}',
            '#myub-consent-banner.show{display:block}',
            '#myub-consent-banner h2{font-family:Sora,system-ui,sans-serif;font-size:16px;margin:0 0 8px}',
            '#myub-consent-banner p{font-size:13px;line-height:1.55;color:rgba(255,255,255,.78);margin:0 0 14px}',
            '#myub-consent-banner a{color:#93c5fd}',
            '#myub-consent-banner .myub-consent-actions{display:flex;flex-wrap:wrap;gap:8px}',
            '#myub-consent-banner button{border:none;border-radius:10px;padding:10px 14px;font-size:13px;',
            'font-weight:600;cursor:pointer;font-family:inherit}',
            '#myub-consent-banner .btn-accept{background:#2c5282;color:#fff}',
            '#myub-consent-banner .btn-reject{background:rgba(255,255,255,.08);color:#fff;',
            'border:1px solid rgba(255,255,255,.14)}',
            '#myub-consent-banner .btn-manage{background:transparent;color:rgba(255,255,255,.8);',
            'border:1px solid rgba(255,255,255,.18)}',
            '#myub-consent-modal{position:fixed;inset:0;z-index:100060;background:rgba(8,23,38,.72);',
            'display:none;align-items:center;justify-content:center;padding:20px;',
            'font-family:Outfit,system-ui,sans-serif}',
            '#myub-consent-modal.show{display:flex}',
            '#myub-consent-modal .card{background:#fff;color:#0f172a;border-radius:18px;max-width:480px;',
            'width:100%;padding:24px;box-shadow:0 24px 50px rgba(0,0,0,.3)}',
            '#myub-consent-modal h2{font-family:Sora,system-ui,sans-serif;font-size:18px;margin:0 0 8px;color:#1a365d}',
            '#myub-consent-modal p{font-size:13px;color:#64748b;line-height:1.55;margin:0 0 16px}',
            '#myub-consent-modal .opt{display:flex;gap:12px;align-items:flex-start;padding:12px 0;',
            'border-top:1px solid #e2e8f0}',
            '#myub-consent-modal .opt strong{display:block;font-size:14px;color:#0f172a}',
            '#myub-consent-modal .opt span{display:block;font-size:12px;color:#64748b;margin-top:2px}',
            '#myub-consent-modal .modal-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}',
            '#myub-consent-modal button{border:none;border-radius:10px;padding:11px 14px;font-size:13px;',
            'font-weight:600;cursor:pointer;font-family:inherit}',
            '#myub-consent-modal .btn-save{background:#1a365d;color:#fff}',
            '#myub-consent-modal .btn-all{background:#e2e8f0;color:#1e293b}',
            '#myub-consent-fab{position:fixed;left:14px;bottom:14px;z-index:100040;border:none;',
            'border-radius:999px;padding:10px 14px;background:#0f2744;color:#fff;font-size:12px;',
            'font-weight:600;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.28);',
            'font-family:Outfit,system-ui,sans-serif;border:1px solid rgba(255,255,255,.14)}',
            '@media(max-width:520px){#myub-consent-banner{left:10px;right:10px;bottom:10px}}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureBanner() {
        if (document.getElementById('myub-consent-banner')) return;
        ensureStyles();
        var banner = document.createElement('div');
        banner.id = 'myub-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML =
            '<h2>Your privacy choices</h2>' +
            '<p>MyUB uses essential storage to keep you signed in and secure. Optional preferences and functional features (like push helpers) are used only if you allow them. ' +
            'Read our <a href="privacy.html">Privacy Policy</a> and <a href="cookies.html">Cookie Policy</a> (Botswana Data Protection Act, 2024).</p>' +
            '<div class="myub-consent-actions">' +
                '<button type="button" class="btn-accept" data-action="accept">Accept all</button>' +
                '<button type="button" class="btn-reject" data-action="reject">Essential only</button>' +
                '<button type="button" class="btn-manage" data-action="manage">Manage</button>' +
            '</div>';
        document.body.appendChild(banner);
        banner.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            if (action === 'accept') acceptAll();
            else if (action === 'reject') rejectOptional();
            else if (action === 'manage') openPreferences();
        });
    }

    function ensureModal() {
        if (document.getElementById('myub-consent-modal')) return;
        ensureStyles();
        var modal = document.createElement('div');
        modal.id = 'myub-consent-modal';
        modal.innerHTML =
            '<div class="card" role="dialog" aria-modal="true" aria-labelledby="myub-consent-title">' +
                '<h2 id="myub-consent-title">Cookie &amp; storage preferences</h2>' +
                '<p>Choose optional categories. Necessary items stay on so MyUB can function securely.</p>' +
                '<div class="opt">' +
                    '<input type="checkbox" checked disabled id="myub-c-necessary">' +
                    '<div><strong>Necessary</strong><span>Auth, security, session timeout, consent record.</span></div>' +
                '</div>' +
                '<div class="opt">' +
                    '<input type="checkbox" id="myub-c-preferences">' +
                    '<div><strong>Preferences</strong><span>Theme, UI state, remember-me flags stored locally.</span></div>' +
                '</div>' +
                '<div class="opt">' +
                    '<input type="checkbox" id="myub-c-functional">' +
                    '<div><strong>Functional</strong><span>Push notification helpers (OneSignal) when you enable alerts.</span></div>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<button type="button" class="btn-save" data-action="save">Save choices</button>' +
                    '<button type="button" class="btn-all" data-action="all">Accept all</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) hideModal();
            var btn = e.target.closest('button[data-action]');
            if (!btn) return;
            if (btn.getAttribute('data-action') === 'all') {
                acceptAll();
                return;
            }
            if (btn.getAttribute('data-action') === 'save') {
                saveChoice({
                    preferences: !!document.getElementById('myub-c-preferences').checked,
                    functional: !!document.getElementById('myub-c-functional').checked
                });
            }
        });
    }

    function ensureFab() {
        if (document.getElementById('myub-consent-fab')) return;
        if (!hasDecision()) return;
        ensureStyles();
        var fab = document.createElement('button');
        fab.id = 'myub-consent-fab';
        fab.type = 'button';
        fab.textContent = 'Privacy choices';
        fab.addEventListener('click', openPreferences);
        document.body.appendChild(fab);
    }

    function showBanner() {
        ensureBanner();
        document.getElementById('myub-consent-banner').classList.add('show');
    }

    function hideBanner() {
        var banner = document.getElementById('myub-consent-banner');
        if (banner) banner.classList.remove('show');
        ensureFab();
    }

    function openPreferences() {
        ensureModal();
        var prefs = getPrefs();
        document.getElementById('myub-c-preferences').checked = !!prefs.preferences;
        document.getElementById('myub-c-functional').checked = !!prefs.functional;
        document.getElementById('myub-consent-modal').classList.add('show');
        hideBanner();
    }

    function hideModal() {
        var modal = document.getElementById('myub-consent-modal');
        if (modal) modal.classList.remove('show');
    }

    function init() {
        if (!hasDecision()) {
            showBanner();
        } else {
            ensureFab();
        }
    }

    function ensureFunctionalConsent(message) {
        if (allowFunctional()) return true;
        var ok = global.confirm(message ||
            'This feature uses a third-party service that stores functional data (for example push notifications). Allow functional cookies/storage to continue?');
        if (!ok) return false;
        var prefs = getPrefs();
        saveChoice({ preferences: !!prefs.preferences, functional: true });
        return true;
    }

    global.MyUBConsent = {
        init: init,
        getPrefs: getPrefs,
        hasDecision: hasDecision,
        allowPreferences: allowPreferences,
        allowFunctional: allowFunctional,
        ensureFunctionalConsent: ensureFunctionalConsent,
        acceptAll: acceptAll,
        rejectOptional: rejectOptional,
        openPreferences: openPreferences,
        saveChoice: saveChoice
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : this);
