/**
 * MyUB Security Enhancement Module
 * Version: 1.1.0
 * 
 * This script adds essential security layers to MyUB application.
 * Include this script in all HTML pages BEFORE other scripts.
 */

// =============================================
// CONSOLE PROTECTION (Must run first!)
// =============================================
(function() {
    'use strict';
    
    // Disable verbose logging in production
    if (window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1' &&
        window.location.hostname !== '192.168.') {
        
        const noop = function() {};
        
        // Store original for security warnings only
        const originalWarn = console.warn;
        const originalError = console.error;
        
        // Silence non-critical logs
        console.log = noop;
        console.debug = noop;
        console.info = noop;
        console.table = noop;
        console.trace = noop;
        console.dir = noop;
        console.dirxml = noop;
        console.group = noop;
        console.groupCollapsed = noop;
        console.groupEnd = noop;
        console.time = noop;
        console.timeEnd = noop;
        console.timeLog = noop;
        console.count = noop;
        console.countReset = noop;
        
        // Keep warnings and errors but filter stack traces
        console.warn = function(...args) {
            // Only show security-related warnings
            const msg = args.join(' ');
            if (msg.includes('Security:')) {
                originalWarn.apply(console, args);
            }
        };
        
        console.error = function(...args) {
            // Show errors but without full stack traces in production
            originalError.apply(console, ['MyUB Error:', args[0]]);
        };
        
        // Indicate production mode silently
        window.__MYUB_PROD__ = true;
    }
})();

(function() {
    'use strict';

    // =============================================
    // 1. XSS PROTECTION - Enhanced HTML Escaping
    // =============================================
    
    // Override or ensure escapeHtml is robust
    window.escapeHtml = function(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        return str.replace(/[&<>"'`=\/]/g, function(char) {
            return map[char];
        });
    };

    // Sanitize URL to prevent javascript: protocol attacks
    window.sanitizeUrl = function(url) {
        if (!url) return '';
        url = String(url).trim();
        
        // Block dangerous protocols
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        const lowerUrl = url.toLowerCase();
        
        for (const protocol of dangerousProtocols) {
            if (lowerUrl.startsWith(protocol)) {
                console.warn('Security: Blocked dangerous URL protocol:', protocol);
                return '';
            }
        }
        
        return url;
    };

    // Safe innerHTML alternative
    window.safeSetHTML = function(element, html) {
        if (!element) return;
        
        // Create a document fragment for safer insertion
        const template = document.createElement('template');
        template.innerHTML = html;
        
        // Remove dangerous elements
        const dangerous = template.content.querySelectorAll('script, iframe, object, embed, form[action*="javascript"]');
        dangerous.forEach(el => el.remove());
        
        // Remove dangerous attributes
        const allElements = template.content.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove event handlers
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || 
                    attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:') ||
                    attr.name === 'src' && attr.value.toLowerCase().startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        element.innerHTML = '';
        element.appendChild(template.content);
    };

    // =============================================
    // 2. CSRF PROTECTION
    // =============================================
    
    // Generate CSRF token
    window.MyUBSecurity = window.MyUBSecurity || {};
    
    MyUBSecurity.generateCSRFToken = function() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    // Store CSRF token in session
    MyUBSecurity.csrfToken = sessionStorage.getItem('myub_csrf_token');
    if (!MyUBSecurity.csrfToken) {
        MyUBSecurity.csrfToken = MyUBSecurity.generateCSRFToken();
        sessionStorage.setItem('myub_csrf_token', MyUBSecurity.csrfToken);
    }

    // =============================================
    // 3. CLICKJACKING PROTECTION
    // =============================================
    
    // Frame-busting (for browsers that don't support CSP)
    if (window.self !== window.top) {
        console.warn('Security: Page loaded in frame, attempting to break out');
        try {
            window.top.location = window.self.location;
        } catch (e) {
            // If we can't break out, hide the page
            document.body.style.display = 'none';
            console.error('Security: Unable to break out of frame');
        }
    }

    // =============================================
    // 4. INPUT VALIDATION & SANITIZATION
    // =============================================
    
    MyUBSecurity.validateInput = {
        // Validate email format
        email: function(email) {
            const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return regex.test(email);
        },
        
        // Validate student ID (alphanumeric, reasonable length)
        studentId: function(id) {
            const regex = /^[a-zA-Z0-9]{5,20}$/;
            return regex.test(id);
        },
        
        // Validate name (letters, spaces, hyphens, apostrophes only)
        name: function(name) {
            const regex = /^[a-zA-Z\s\-']{2,50}$/;
            return regex.test(name);
        },
        
        // Validate UUID format
        uuid: function(uuid) {
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return regex.test(uuid);
        },
        
        // Sanitize user input for display
        sanitizeText: function(text, maxLength = 10000) {
            if (!text) return '';
            text = String(text).substring(0, maxLength);
            return window.escapeHtml(text);
        }
    };

    // =============================================
    // 5. RATE LIMITING (Client-side)
    // =============================================
    
    MyUBSecurity.rateLimiter = {
        requests: {},
        
        check: function(action, limit = 10, windowMs = 60000) {
            const now = Date.now();
            const key = action;
            
            if (!this.requests[key]) {
                this.requests[key] = [];
            }
            
            // Remove old requests outside the window
            this.requests[key] = this.requests[key].filter(time => now - time < windowMs);
            
            if (this.requests[key].length >= limit) {
                console.warn('Security: Rate limit exceeded for action:', action);
                return false;
            }
            
            this.requests[key].push(now);
            return true;
        }
    };

    // =============================================
    // 6. SECURE LOCAL STORAGE WRAPPER
    // =============================================
    
    MyUBSecurity.storage = {
        // Never store sensitive data - this is for non-sensitive preferences only
        sensitiveKeys: ['password', 'token', 'secret', 'key', 'auth', 'credential'],
        
        isSensitive: function(key) {
            const lowerKey = key.toLowerCase();
            return this.sensitiveKeys.some(s => lowerKey.includes(s));
        },
        
        set: function(key, value) {
            if (this.isSensitive(key)) {
                console.warn('Security: Refusing to store sensitive data in localStorage:', key);
                return false;
            }
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        },
        
        get: function(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },
        
        remove: function(key) {
            localStorage.removeItem(key);
        }
    };

    // =============================================
    // 7. ADMIN PAGE PROTECTION
    // =============================================
    
    MyUBSecurity.adminProtection = {
        // This should be validated server-side, but adds client-side layer
        checkAdminAccess: async function(supabaseClient, expectedAdminId) {
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                
                if (!user) {
                    console.warn('Security: No authenticated user');
                    return false;
                }
                
                // Verify user ID matches expected admin
                if (user.id !== expectedAdminId) {
                    console.warn('Security: User is not admin');
                    return false;
                }
                
                // Double-check session is valid
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) {
                    console.warn('Security: No valid session');
                    return false;
                }
                
                return true;
            } catch (e) {
                console.error('Security: Admin check failed:', e);
                return false;
            }
        }
    };

    // =============================================
    // 8. SESSION SECURITY
    // =============================================
    
    MyUBSecurity.session = {
        // Session timeout (30 minutes of inactivity)
        timeoutMs: 30 * 60 * 1000,
        warningBeforeMs: 2 * 60 * 1000,
        checkIntervalMs: 30000,
        lastActivity: Date.now(),
        warningVisible: false,
        signingOut: false,
        checkTimer: null,
        authListenerBound: false,

        isPublicPage: function() {
            const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
            return path === '' || path === 'index.html' || path === 'verified.html' ||
                path === 'reset-password.html' || path === 'offline.html' || path === '404.html' ||
                path === 'privacy.html' || path === 'terms.html' || path === 'cookies.html' ||
                path === 'data-rights.html';
        },

        isIndexPage: function() {
            const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
            return path === '' || path === 'index.html';
        },

        getAuthClient: function() {
            if (window.supabaseClient) return window.supabaseClient;
            if (window.MyUBAuth && window.MyUBAuth.getClient) {
                try {
                    return window.MyUBAuth.getClient();
                } catch (e) {
                    return null;
                }
            }
            return null;
        },

        isAuthenticated: async function() {
            try {
                const client = this.getAuthClient();
                if (window.MyUBAuth && window.MyUBAuth.getSessionSafe && client) {
                    const { session } = await window.MyUBAuth.getSessionSafe(client);
                    return !!(session && session.user);
                }
                if (client) {
                    const { data: { session } } = await client.auth.getSession();
                    return !!(session && session.user);
                }
                if (window.MyUBAuth && window.MyUBAuth.hasStoredAuthToken) {
                    return window.MyUBAuth.hasStoredAuthToken();
                }
            } catch (e) {
                return false;
            }
            return false;
        },

        getInactiveMs: function() {
            const lastActivity = parseInt(sessionStorage.getItem('myub_last_activity'), 10);
            if (!lastActivity) return 0;
            return Date.now() - lastActivity;
        },

        updateActivity: function() {
            this.lastActivity = Date.now();
            sessionStorage.setItem('myub_last_activity', String(this.lastActivity));
            if (this.warningVisible) {
                this.hideWarningModal();
            }
        },

        clearActivity: function() {
            sessionStorage.removeItem('myub_last_activity');
            this.lastActivity = Date.now();
            if (this.warningVisible) {
                this.hideWarningModal();
            }
        },

        ensureModal: function() {
            if (document.getElementById('myub-session-modal')) return;

            const style = document.createElement('style');
            style.id = 'myub-session-modal-styles';
            style.textContent = [
                '#myub-session-modal{position:fixed;inset:0;background:rgba(15,23,42,.72);',
                'display:none;align-items:center;justify-content:center;z-index:100000;',
                'font-family:Outfit,system-ui,sans-serif;padding:20px}',
                '#myub-session-modal.show{display:flex}',
                '#myub-session-modal .myub-session-card{background:#fff;border-radius:20px;max-width:420px;',
                'width:100%;padding:32px 28px;box-shadow:0 24px 48px rgba(0,0,0,.22);text-align:center}',
                '#myub-session-modal h2{font-family:Sora,system-ui,sans-serif;font-size:22px;color:#1a365d;',
                'margin:0 0 10px}',
                '#myub-session-modal p{color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px}',
                '#myub-session-modal .myub-session-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}',
                '#myub-session-modal button{border:none;border-radius:12px;padding:12px 20px;font-size:15px;',
                'font-weight:600;cursor:pointer;min-width:140px}',
                '#myub-session-modal .myub-session-extend{background:#1a365d;color:#fff}',
                '#myub-session-modal .myub-session-signout{background:#f1f5f9;color:#334155}'
            ].join('');
            document.head.appendChild(style);

            const overlay = document.createElement('div');
            overlay.id = 'myub-session-modal';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'myub-session-modal-title');
            overlay.innerHTML =
                '<div class="myub-session-card">' +
                    '<h2 id="myub-session-modal-title">Are you still with us?</h2>' +
                    '<p>Your session has been idle for a while. Would you like to extend your session or sign out?</p>' +
                    '<div class="myub-session-actions">' +
                        '<button type="button" class="myub-session-extend">Extend session</button>' +
                        '<button type="button" class="myub-session-signout">Sign out</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(overlay);

            const self = this;
            overlay.querySelector('.myub-session-extend').addEventListener('click', function() {
                self.extendSession();
            });
            overlay.querySelector('.myub-session-signout').addEventListener('click', function() {
                self.signOutUser();
            });
        },

        showWarningModal: function() {
            if (this.warningVisible || this.signingOut) return;
            this.ensureModal();
            const modal = document.getElementById('myub-session-modal');
            if (!modal) return;
            modal.classList.add('show');
            this.warningVisible = true;
        },

        hideWarningModal: function() {
            const modal = document.getElementById('myub-session-modal');
            if (modal) modal.classList.remove('show');
            this.warningVisible = false;
        },

        extendSession: function() {
            this.updateActivity();
            this.hideWarningModal();
        },

        signOutUser: function() {
            if (this.signingOut) return;
            this.signingOut = true;
            this.hideWarningModal();
            this.clearActivity();

            const redirectIfNeeded = () => {
                if (!this.isIndexPage()) {
                    window.location.href = 'index.html';
                }
            };

            const client = this.getAuthClient();
            if (client) {
                client.auth.signOut()
                    .then(redirectIfNeeded)
                    .catch(redirectIfNeeded)
                    .finally(() => { this.signingOut = false; });
            } else {
                redirectIfNeeded();
                this.signingOut = false;
            }
        },

        onUserActivity: function() {
            if (!this.isMonitoringEnabled) return;
            this.updateActivity();
        },

        bindAuthListener: function() {
            const client = this.getAuthClient();
            if (this.authListenerBound || !client) return;
            this.authListenerBound = true;
            const self = this;
            client.auth.onAuthStateChange(function(event) {
                if (event === 'SIGNED_IN') {
                    self.updateActivity();
                    self.startMonitoring();
                } else if (event === 'SIGNED_OUT') {
                    self.stopMonitoring();
                    self.clearActivity();
                }
            });
        },

        startMonitoring: function() {
            this.isMonitoringEnabled = true;
            if (!sessionStorage.getItem('myub_last_activity')) {
                this.updateActivity();
            }
            if (!this.checkTimer) {
                const self = this;
                this.checkTimer = setInterval(function() {
                    self.evaluateSession();
                }, this.checkIntervalMs);
            }
        },

        stopMonitoring: function() {
            this.isMonitoringEnabled = false;
            this.hideWarningModal();
            if (this.checkTimer) {
                clearInterval(this.checkTimer);
                this.checkTimer = null;
            }
        },

        evaluateSession: async function() {
            if (this.signingOut) return;

            const authed = await this.isAuthenticated();
            if (!authed) {
                this.stopMonitoring();
                if (this.isPublicPage()) {
                    this.clearActivity();
                }
                return;
            }

            this.startMonitoring();
            const inactiveMs = this.getInactiveMs();

            if (inactiveMs >= this.timeoutMs) {
                console.warn('Security: Session timeout, logging out');
                this.signOutUser();
                return;
            }

            if (inactiveMs >= (this.timeoutMs - this.warningBeforeMs)) {
                this.showWarningModal();
            }
        },

        init: function() {
            const self = this;
            this.isMonitoringEnabled = false;

            ['click', 'keypress', 'scroll', 'touchstart'].forEach(function(event) {
                document.addEventListener(event, function() {
                    self.onUserActivity();
                }, { passive: true });
            });

            const boot = async function() {
                self.bindAuthListener();
                const authed = await self.isAuthenticated();
                if (authed) {
                    self.startMonitoring();
                    await self.evaluateSession();
                } else if (self.isPublicPage()) {
                    self.clearActivity();
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', boot);
            } else {
                boot();
            }

            let clientWaitAttempts = 0;
            const clientWait = setInterval(function() {
                if (self.getAuthClient()) {
                    clearInterval(clientWait);
                    self.bindAuthListener();
                    self.evaluateSession();
                } else if (++clientWaitAttempts > 40) {
                    clearInterval(clientWait);
                }
            }, 250);
        }
    };

    // =============================================
    // 9. CONTENT SECURITY
    // =============================================
    
    // Block inline script execution attempts via innerHTML
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalInnerHTML && originalInnerHTML.set) {
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                // Log potential XSS attempts
                if (typeof value === 'string' && 
                    (value.includes('<script') || 
                     value.includes('javascript:') ||
                     value.includes('onerror=') ||
                     value.includes('onload='))) {
                    console.warn('Security: Potentially dangerous HTML detected');
                }
                return originalInnerHTML.set.call(this, value);
            },
            get: originalInnerHTML.get
        });
    }

    // =============================================
    // 10. SECURE FETCH WRAPPER
    // =============================================
    
    MyUBSecurity.secureFetch = async function(url, options = {}) {
        // Validate URL
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL');
        }
        
        // Block requests to unexpected domains
        const allowedDomains = [
            'weuxtwmaqmbhskjpjdyi.supabase.co',
            'cdn.jsdelivr.net',
            'fonts.googleapis.com',
            'fonts.gstatic.com',
            'cdn.onesignal.com',
            'cdnjs.cloudflare.com',
            'unpkg.com'
        ];
        
        try {
            const urlObj = new URL(url, window.location.origin);
            const isAllowed = allowedDomains.some(domain => urlObj.hostname.endsWith(domain)) ||
                              urlObj.hostname === window.location.hostname;
            
            if (!isAllowed && !url.startsWith('/')) {
                console.warn('Security: Blocked request to unauthorized domain:', urlObj.hostname);
                throw new Error('Unauthorized domain');
            }
        } catch (e) {
            if (e.message === 'Unauthorized domain') throw e;
            // Relative URLs are okay
        }
        
        // Add CSRF token for POST/PUT/DELETE
        if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
            options.headers = options.headers || {};
            options.headers['X-CSRF-Token'] = MyUBSecurity.csrfToken;
        }
        
        return fetch(url, options);
    };

    // =============================================
    // 11. SQL INJECTION PREVENTION (for dynamic queries)
    // =============================================
    
    MyUBSecurity.sanitizeForQuery = function(value) {
        if (typeof value !== 'string') return value;
        
        // Remove or escape potentially dangerous SQL characters
        // Note: Primary SQL injection prevention should be server-side/RLS
        return value
            .replace(/'/g, "''")
            .replace(/;/g, '')
            .replace(/--/g, '')
            .replace(/\/\*/g, '')
            .replace(/\*\//g, '');
    };

    // =============================================
    // 12. CONSOLE PROTECTION (Production)
    // =============================================
    
    MyUBSecurity.protectConsole = function() {
        // Warn users about console usage (like Facebook does)
        console.log('%cStop!', 'color: red; font-size: 50px; font-weight: bold;');
        console.log('%cThis is a browser feature intended for developers.', 'font-size: 16px;');
        console.log('%cIf someone told you to paste something here, it\'s likely a scam.', 'font-size: 16px; color: red;');
    };

    // =============================================
    // 13. INITIALIZATION
    // =============================================
    
    // Initialize session security
    MyUBSecurity.session.init();

    // Load BDPA consent / cookie banner (once)
    (function loadConsentScript() {
        if (document.querySelector('script[data-myub-consent]')) return;
        var s = document.createElement('script');
        s.src = 'myub-consent.js?v=1';
        s.defer = true;
        s.setAttribute('data-myub-consent', '1');
        (document.head || document.documentElement).appendChild(s);
    })();
    
    // Protect console in production
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        MyUBSecurity.protectConsole();
    }
    
    // Log security module loaded
    console.log('MyUB Security Module v1.0.0 loaded');

    // =============================================
    // 14. EXPORT FOR GLOBAL ACCESS
    // =============================================
    
    window.MyUBSecurity = MyUBSecurity;

})();

/**
 * SECURITY RECOMMENDATIONS FOR SERVER-SIDE (Supabase):
 * 
 * 1. Enable Row Level Security (RLS) on ALL tables
 * 2. Never expose service_role key in client-side code
 * 3. Use proper RLS policies:
 *    - Users can only read/write their own data
 *    - Admin functions should use Supabase Edge Functions
 * 
 * 4. Add these Supabase settings:
 *    - Enable email confirmation
 *    - Set strong password requirements
 *    - Enable MFA for admin accounts
 * 
 * 5. Add server-side rate limiting via Supabase Edge Functions
 * 
 * 6. Regular security audits and dependency updates
 */
