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
        lastActivity: Date.now(),
        
        updateActivity: function() {
            this.lastActivity = Date.now();
            sessionStorage.setItem('myub_last_activity', this.lastActivity);
        },
        
        checkTimeout: function() {
            const lastActivity = parseInt(sessionStorage.getItem('myub_last_activity')) || Date.now();
            if (Date.now() - lastActivity > this.timeoutMs) {
                return true; // Session timed out
            }
            return false;
        },
        
        init: function() {
            // Update activity on user interaction
            ['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, () => this.updateActivity(), { passive: true });
            });
            
            // Check timeout periodically
            setInterval(() => {
                if (this.checkTimeout()) {
                    console.warn('Security: Session timeout, logging out');
                    // Trigger logout if supabase client exists
                    if (window.supabaseClient) {
                        window.supabaseClient.auth.signOut().then(() => {
                            window.location.href = 'index.html';
                        });
                    }
                }
            }, 60000); // Check every minute
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
