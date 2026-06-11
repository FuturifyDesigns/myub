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
            var flag = global.localStorage.getItem(REMEMBER_FLAG_KEY);
            if (flag === 'true') return true;
            if (flag === 'false') return false;
            // Legacy users (before Remember Me flag): keep localStorage sessions working
            return true;
        } catch (_) {
            return true;
        }
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

    function loadRememberedCredentials() {
        var loginEmail = global.document.getElementById('loginEmail');
        var loginPassword = global.document.getElementById('loginPassword');
        var rememberCheckbox = global.document.getElementById('rememberMe');
        if (!loginEmail || !rememberCheckbox) return;

        var rememberMe = shouldPersistLogin();
        rememberCheckbox.checked = rememberMe;

        if (!rememberMe) return;

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

        if (rememberCheckbox.checked) {
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
            if (loginPassword) {
                loginPassword.value = '';
            }
        }
    }

    global.MyUBAuth = {
        shouldPersistLogin: shouldPersistLogin,
        getAuthStorage: getAuthStorage,
        createClient: createClient,
        saveRememberedCredentials: saveRememberedCredentials,
        clearRememberedCredentials: clearRememberedCredentials,
        loadRememberedCredentials: loadRememberedCredentials,
        handleRememberMeChange: handleRememberMeChange
    };
})(typeof window !== 'undefined' ? window : this);
