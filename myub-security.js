/**
 * MyUB Security Utilities
 * Version: 1.0.0
 * 
 * This file provides security utilities to protect against common web vulnerabilities
 * based on OWASP Top 10:2025 recommendations.
 * 
 * Include this file BEFORE any other scripts in your HTML files:
 * <script src="myub-security.js"></script>
 */

(function(window) {
    'use strict';

    const MyUBSecurity = {
        // Configuration
        config: {
            isDev: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
            allowedOrigins: ['https://www.myub.online', 'https://myub.online'],
            maxInputLength: {
                message: 5000,
                name: 50,
                bio: 500,
                title: 200,
                general: 1000
            }
        },

        /**
         * Initialize security features
         */
        init() {
            this.setupCSP();
            this.sanitizeURLParams();
            this.setupSecureConsole();
            this.preventClickjacking();
            console.log('[MyUB Security] Initialized');
        },

        // ==========================================
        // INPUT VALIDATION & SANITIZATION
        // ==========================================

        /**
         * Escape HTML to prevent XSS
         * @param {string} text - Raw text input
         * @returns {string} - Escaped HTML-safe text
         */
        escapeHtml(text) {
            if (text === null || text === undefined) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        },

        /**
         * Sanitize text input with length limit
         * @param {string} text - Raw text input
         * @param {number} maxLength - Maximum allowed length
         * @returns {string} - Sanitized text
         */
        sanitizeText(text, maxLength = 1000) {
            if (!text) return '';
            return String(text)
                .trim()
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
                .slice(0, maxLength);
        },

        /**
         * Sanitize message content
         * @param {string} content - Message content
         * @returns {string} - Sanitized message
         */
        sanitizeMessage(content) {
            return this.sanitizeText(content, this.config.maxInputLength.message);
        },

        /**
         * Validate UUID format
         * @param {string} id - UUID string to validate
         * @returns {boolean} - True if valid UUID
         */
        isValidUUID(id) {
            if (!id) return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        },

        /**
         * Sanitize UUID - returns null if invalid
         * @param {string} id - UUID to sanitize
         * @returns {string|null} - Valid UUID or null
         */
        sanitizeUUID(id) {
            if (this.isValidUUID(id)) {
                return id.toLowerCase();
            }
            console.warn('[MyUB Security] Invalid UUID detected:', id?.substring(0, 10) + '...');
            return null;
        },

        /**
         * Validate student ID format
         * @param {string} studentId - Student ID to validate
         * @returns {object} - Validation result {valid, error}
         */
        validateStudentId(studentId) {
            if (!studentId) {
                return { valid: false, error: 'Student ID is required' };
            }
            
            const cleaned = String(studentId).replace(/\D/g, '');
            
            if (cleaned.length !== 9) {
                return { valid: false, error: 'Student ID must be 9 digits' };
            }
            
            const year = parseInt(cleaned.substring(0, 4));
            const currentYear = new Date().getFullYear();
            
            if (year < 2010) {
                return { valid: false, error: 'Invalid year in Student ID' };
            }
            
            if (year > currentYear) {
                return { valid: false, error: 'Year cannot be in the future' };
            }
            
            return { valid: true, value: cleaned };
        },

        /**
         * Validate email format
         * @param {string} email - Email to validate
         * @returns {boolean} - True if valid email format
         */
        isValidEmail(email) {
            if (!email) return false;
            // RFC 5322 compliant email regex (simplified)
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            return emailRegex.test(email) && email.length <= 254;
        },

        /**
         * Validate name field
         * @param {string} name - Name to validate
         * @param {string} fieldName - Field name for error messages
         * @returns {object} - Validation result {valid, error, value}
         */
        validateName(name, fieldName = 'Name') {
            if (!name || !name.trim()) {
                return { valid: false, error: `${fieldName} is required` };
            }
            
            const trimmed = name.trim();
            
            if (trimmed.length < 2) {
                return { valid: false, error: `${fieldName} must be at least 2 characters` };
            }
            
            if (trimmed.length > 50) {
                return { valid: false, error: `${fieldName} must be less than 50 characters` };
            }
            
            if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
                return { valid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
            }
            
            if (this.containsProfanity(trimmed)) {
                return { valid: false, error: `${fieldName} contains inappropriate language` };
            }
            
            return { valid: true, value: trimmed };
        },

        // ==========================================
        // PASSWORD VALIDATION
        // ==========================================

        /**
         * Validate password strength
         * @param {string} password - Password to validate
         * @returns {object} - Validation result {valid, errors, strength}
         */
        validatePassword(password) {
            const errors = [];
            let strength = 0;
            
            if (!password) {
                return { valid: false, errors: ['Password is required'], strength: 0 };
            }
            
            if (password.length < 8) {
                errors.push('Must be at least 8 characters');
            } else {
                strength++;
            }
            
            if (password.length > 128) {
                errors.push('Must be less than 128 characters');
            }
            
            if (/[A-Z]/.test(password)) {
                strength++;
            } else {
                errors.push('Must contain at least one uppercase letter');
            }
            
            if (/[a-z]/.test(password)) {
                strength++;
            } else {
                errors.push('Must contain at least one lowercase letter');
            }
            
            if (/[0-9]/.test(password)) {
                strength++;
            } else {
                errors.push('Must contain at least one number');
            }
            
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                strength++;
            }
            
            // Check for common patterns
            const commonPatterns = [
                'password', 'qwerty', '123456', 'letmein', 'welcome',
                'admin', 'login', 'abc123', 'iloveyou', 'monkey'
            ];
            
            const lowerPass = password.toLowerCase();
            if (commonPatterns.some(pattern => lowerPass.includes(pattern))) {
                errors.push('Password contains common patterns');
                strength = Math.max(0, strength - 2);
            }
            
            // Check for sequential characters
            if (/(.)\1{2,}/.test(password)) {
                errors.push('Password contains repeated characters');
            }
            
            return {
                valid: errors.length === 0,
                errors,
                strength: Math.min(5, strength),
                strengthLabel: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][Math.min(5, strength)]
            };
        },

        // ==========================================
        // RATE LIMITING
        // ==========================================

        rateLimits: new Map(),

        /**
         * Check rate limit for an action
         * @param {string} action - Action identifier
         * @param {number} maxAttempts - Maximum attempts allowed
         * @param {number} windowMs - Time window in milliseconds
         * @returns {object} - {allowed, remaining, retryAfter}
         */
        checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
            const key = action;
            const now = Date.now();
            const attempts = this.rateLimits.get(key) || [];
            
            // Remove expired attempts
            const validAttempts = attempts.filter(t => now - t < windowMs);
            
            if (validAttempts.length >= maxAttempts) {
                const oldestAttempt = validAttempts[0];
                const retryAfter = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
                
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter,
                    message: `Too many attempts. Please wait ${retryAfter} seconds.`
                };
            }
            
            validAttempts.push(now);
            this.rateLimits.set(key, validAttempts);
            
            return {
                allowed: true,
                remaining: maxAttempts - validAttempts.length,
                retryAfter: 0
            };
        },

        /**
         * Reset rate limit for an action
         * @param {string} action - Action identifier
         */
        resetRateLimit(action) {
            this.rateLimits.delete(action);
        },

        // ==========================================
        // PROFANITY FILTER
        // ==========================================

        profanityList: [
            'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'piss', 'dick', 
            'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'nigger', 
            'nigga', 'fag', 'faggot', 'retard', 'cunt', 'twat', 'wanker', 
            'bollocks', 'arse', 'motherfucker', 'fucker'
        ],

        /**
         * Check if text contains profanity
         * @param {string} text - Text to check
         * @returns {boolean} - True if contains profanity
         */
        containsProfanity(text) {
            if (!text) return false;
            const lower = text.toLowerCase();
            return this.profanityList.some(word => 
                new RegExp('\\b' + word + '\\b', 'i').test(lower)
            );
        },

        // ==========================================
        // URL & PARAMETER SECURITY
        // ==========================================

        /**
         * Sanitize URL parameters on page load
         */
        sanitizeURLParams() {
            const params = new URLSearchParams(window.location.search);
            const sanitized = new URLSearchParams();
            let modified = false;
            
            for (const [key, value] of params) {
                // Only allow alphanumeric keys
                if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
                    modified = true;
                    continue;
                }
                
                // Sanitize value - remove potential XSS vectors
                let cleanValue = value
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/javascript:/gi, '') // Remove javascript: protocol
                    .replace(/on\w+=/gi, ''); // Remove event handlers
                
                if (cleanValue !== value) {
                    modified = true;
                }
                
                sanitized.set(key, cleanValue);
            }
            
            // If we modified anything, update URL without reload
            if (modified && history.replaceState) {
                const newUrl = window.location.pathname + 
                    (sanitized.toString() ? '?' + sanitized.toString() : '') + 
                    window.location.hash;
                history.replaceState(null, '', newUrl);
            }
        },

        /**
         * Get sanitized URL parameter
         * @param {string} name - Parameter name
         * @returns {string|null} - Sanitized value or null
         */
        getURLParam(name) {
            const params = new URLSearchParams(window.location.search);
            const value = params.get(name);
            
            if (!value) return null;
            
            return value
                .replace(/<[^>]*>/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .trim();
        },

        // ==========================================
        // SECURE CONSOLE (Production)
        // ==========================================

        originalConsole: {},

        /**
         * Setup secure console that suppresses logs in production
         */
        setupSecureConsole() {
            if (this.config.isDev) return;
            
            this.originalConsole = {
                log: console.log,
                debug: console.debug,
                info: console.info,
                warn: console.warn
            };
            
            // Suppress non-error logs in production
            console.log = function() {};
            console.debug = function() {};
            console.info = function() {};
            
            // Keep warnings but sanitize
            console.warn = (...args) => {
                this.originalConsole.warn('[Warning]', 'Check console in development mode');
            };
        },

        /**
         * Log message (development only)
         */
        log(...args) {
            if (this.config.isDev) {
                (this.originalConsole.log || console.log).apply(console, args);
            }
        },

        // ==========================================
        // CLICKJACKING PROTECTION
        // ==========================================

        /**
         * Prevent clickjacking by breaking out of frames
         */
        preventClickjacking() {
            if (window.self !== window.top) {
                // We're in an iframe
                try {
                    if (window.top.location.hostname !== window.location.hostname) {
                        // Different origin - break out
                        window.top.location = window.self.location;
                    }
                } catch (e) {
                    // Cross-origin - definitely break out
                    window.top.location = window.self.location;
                }
            }
        },

        // ==========================================
        // CSP SETUP
        // ==========================================

        /**
         * Setup Content Security Policy via meta tag
         */
        setupCSP() {
            // Check if CSP already exists
            if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
                return;
            }
            
            const csp = document.createElement('meta');
            csp.httpEquiv = 'Content-Security-Policy';
            csp.content = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdn.onesignal.com https://*.onesignal.com https://api.onesignal.com https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https: blob:",
                "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.onesignal.com https://api.onesignal.com wss://*.peerjs.com https://*.peerjs.com",
                "frame-src 'none'",
                "object-src 'none'",
                "base-uri 'self'"
            ].join('; ');
            
            document.head.insertBefore(csp, document.head.firstChild);
        },

        // ==========================================
        // SESSION SECURITY
        // ==========================================

        /**
         * Secure storage wrapper - avoids storing sensitive data
         */
        secureStorage: {
            set(key, value, useSession = false) {
                const storage = useSession ? sessionStorage : localStorage;
                // Don't store sensitive keys
                const sensitivePatterns = ['password', 'token', 'secret', 'key', 'auth'];
                if (sensitivePatterns.some(p => key.toLowerCase().includes(p))) {
                    console.warn('[MyUB Security] Attempted to store sensitive data in storage');
                    return false;
                }
                try {
                    storage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    console.error('[MyUB Security] Storage error:', e);
                    return false;
                }
            },
            
            get(key, useSession = false) {
                const storage = useSession ? sessionStorage : localStorage;
                try {
                    const item = storage.getItem(key);
                    return item ? JSON.parse(item) : null;
                } catch (e) {
                    return null;
                }
            },
            
            remove(key, useSession = false) {
                const storage = useSession ? sessionStorage : localStorage;
                storage.removeItem(key);
            }
        },

        // ==========================================
        // ORIGIN VALIDATION
        // ==========================================

        /**
         * Validate that request comes from allowed origin
         * @returns {boolean}
         */
        validateOrigin() {
            return this.config.allowedOrigins.includes(window.location.origin) || 
                   this.config.isDev;
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MyUBSecurity.init());
    } else {
        MyUBSecurity.init();
    }

    // Export to window
    window.MyUBSecurity = MyUBSecurity;

})(window);
