/**
 * MyUB shared auth helpers — Remember Me + Supabase storage
 */
(function (global) {
    'use strict';

    var REMEMBER_FLAG_KEY = 'myub_remember_me';
    var REMEMBER_EMAIL_KEY = 'myub_remembered_email';
    var REMEMBER_PASSWORD_KEY = 'myub_remembered_password_b64';

    function shouldPersistLogin() {
        try {
            return global.localStorage.getItem(REMEMBER_FLAG_KEY) === 'true';
        } catch (_) {
            return false;
        }
    }

    function preferencesAllowed() {
        if (!global.MyUBConsent) return true;
        // If user has not decided yet, allow temporary remember-me until they choose.
        if (typeof global.MyUBConsent.hasDecision === 'function' && !global.MyUBConsent.hasDecision()) {
            return true;
        }
        return !!(global.MyUBConsent.allowPreferences && global.MyUBConsent.allowPreferences());
    }

    function ensurePreferencesForRememberMe() {
        if (!global.MyUBConsent || typeof global.MyUBConsent.saveChoice !== 'function') return;
        if (preferencesAllowed() && global.MyUBConsent.hasDecision && global.MyUBConsent.hasDecision()) return;
        var prefs = global.MyUBConsent.getPrefs ? global.MyUBConsent.getPrefs() : {};
        global.MyUBConsent.saveChoice({
            preferences: true,
            functional: !!(prefs && prefs.functional)
        });
    }

    function getAuthStorage() {
        return shouldPersistLogin() ? global.localStorage : global.sessionStorage;
    }

    function createClient(url, key) {
        if (!global.supabase || typeof global.supabase.createClient !== 'function') {
            return null;
        }
        var client = global.supabase.createClient(url, key, {
            auth: {
                persistSession: true,
                storage: getAuthStorage(),
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        global.supabaseClient = client;
        return client;
    }

    function encodePassword(password) {
        try {
            return global.btoa(unescape(global.encodeURIComponent(password)));
        } catch (_) {
            return '';
        }
    }

    function decodePassword(encoded) {
        if (!encoded) return '';
        try {
            return global.decodeURIComponent(global.escape(global.atob(encoded)));
        } catch (_) {
            return '';
        }
    }

    function saveRememberedCredentials(email, password) {
        try {
            if (!email || !password) return;
            if (!preferencesAllowed()) {
                ensurePreferencesForRememberMe();
            }
            global.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
            global.localStorage.setItem(REMEMBER_PASSWORD_KEY, encodePassword(password));
            global.localStorage.setItem(REMEMBER_FLAG_KEY, 'true');
        } catch (_) {}
    }

    function clearRememberedCredentials() {
        try {
            global.localStorage.removeItem(REMEMBER_EMAIL_KEY);
            global.localStorage.removeItem(REMEMBER_PASSWORD_KEY);
            global.localStorage.setItem(REMEMBER_FLAG_KEY, 'false');
        } catch (_) {}
    }

    function syncRememberCheckbox() {
        var rememberCheckbox = global.document.getElementById('rememberMe');
        if (!rememberCheckbox) return;
        rememberCheckbox.checked = shouldPersistLogin();
        rememberCheckbox.setAttribute('aria-checked', rememberCheckbox.checked ? 'true' : 'false');
    }

    function loadRememberedCredentials() {
        var loginEmail = global.document.getElementById('loginEmail');
        var loginPassword = global.document.getElementById('loginPassword');
        var rememberCheckbox = global.document.getElementById('rememberMe');
        if (!loginEmail || !rememberCheckbox) return;

        var rememberMe = shouldPersistLogin() && preferencesAllowed();
        rememberCheckbox.checked = rememberMe;
        rememberCheckbox.setAttribute('aria-checked', rememberMe ? 'true' : 'false');

        if (!rememberMe) {
            // Keep flag honest if preferences were revoked
            if (shouldPersistLogin() && !preferencesAllowed()) {
                clearRememberedCredentials();
            }
            return;
        }

        var email = global.localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (email) {
            loginEmail.value = email;
        }

        if (loginPassword) {
            var password = decodePassword(global.localStorage.getItem(REMEMBER_PASSWORD_KEY));
            if (password) {
                loginPassword.value = password;
            }
        }
    }

    function handleRememberMeChange() {
        var rememberCheckbox = global.document.getElementById('rememberMe');
        var loginEmail = global.document.getElementById('loginEmail');
        var loginPassword = global.document.getElementById('loginPassword');
        if (!rememberCheckbox) return;

        rememberCheckbox.setAttribute('aria-checked', rememberCheckbox.checked ? 'true' : 'false');

        if (rememberCheckbox.checked) {
            ensurePreferencesForRememberMe();
            var email = loginEmail ? loginEmail.value.trim().toLowerCase() : '';
            var password = loginPassword ? loginPassword.value : '';
            if (email && password) {
                saveRememberedCredentials(email, password);
            } else if (email) {
                try {
                    global.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
                    global.localStorage.setItem(REMEMBER_FLAG_KEY, 'true');
                } catch (_) {}
            } else {
                try {
                    global.localStorage.setItem(REMEMBER_FLAG_KEY, 'true');
                } catch (_) {}
            }
        } else {
            clearRememberedCredentials();
        }
    }

    // If user turns off Preferences in the cookie modal, drop remember-me data.
    try {
        global.addEventListener('myub-consent-changed', function (e) {
            var detail = e && e.detail;
            if (detail && detail.preferences === false) {
                clearRememberedCredentials();
                syncRememberCheckbox();
                var loginPassword = global.document.getElementById('loginPassword');
                if (loginPassword) loginPassword.value = '';
            }
        });
    } catch (_) {}

    global.MyUBAuth = {
        shouldPersistLogin: shouldPersistLogin,
        getAuthStorage: getAuthStorage,
        createClient: createClient,
        saveRememberedCredentials: saveRememberedCredentials,
        clearRememberedCredentials: clearRememberedCredentials,
        loadRememberedCredentials: loadRememberedCredentials,
        handleRememberMeChange: handleRememberMeChange,
        syncRememberCheckbox: syncRememberCheckbox
    };
})(typeof window !== 'undefined' ? window : this);
