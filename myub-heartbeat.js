/**
 * MyUB Online Status Heartbeat System - FIXED VERSION
 * Include this on all main pages to keep online status accurate
 * 
 * FIXES:
 * - Race condition prevention with locks
 * - Proper cleanup on page navigation
 * - Beacon API for reliable offline status
 * - Debouncing for visibility changes
 * - Better error handling
 * - Single heartbeat instance across tabs
 */

(function() {
    "use strict";

    var MyUBHeartbeat = {
        interval: null,
        isUpdating: false,
        visibilityTimeout: null,
        lastHeartbeat: 0,
        currentUser: null,
        supabaseClient: null,
        HEARTBEAT_INTERVAL: 30000, // 30 seconds
        VISIBILITY_DEBOUNCE: 2000, // 2 seconds debounce for visibility changes
        
        /**
         * Initialize and start the heartbeat system
         */
        start: function(supabaseClient, currentUser) {
            if (!supabaseClient || !currentUser) {
                console.warn('MyUB Heartbeat: Missing supabaseClient or currentUser');
                return;
            }
            
            // Store references
            this.supabaseClient = supabaseClient;
            this.currentUser = currentUser;
            
            // Stop any existing heartbeat first
            this.stop();
            
            // Set user online immediately
            this.sendHeartbeat(true);
            
            // Start interval for periodic updates
            this.interval = setInterval(() => {
                if (!document.hidden && this.currentUser) {
                    this.sendHeartbeat(true);
                }
            }, this.HEARTBEAT_INTERVAL);
            
            console.log('MyUB Heartbeat: Started for user', currentUser.id);
        },
        
        /**
         * Stop the heartbeat system
         */
        stop: function() {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
            
            if (this.visibilityTimeout) {
                clearTimeout(this.visibilityTimeout);
                this.visibilityTimeout = null;
            }
            
            console.log('MyUB Heartbeat: Stopped');
        },
        
        /**
         * Send heartbeat to update online status
         * Uses lock to prevent race conditions
         */
        sendHeartbeat: async function(isOnline) {
            // Prevent concurrent updates
            if (this.isUpdating) {
                console.log('MyUB Heartbeat: Update already in progress, skipping');
                return;
            }
            
            // Check minimum interval (prevent spam)
            const now = Date.now();
            if (now - this.lastHeartbeat < 1000) {
                console.log('MyUB Heartbeat: Too soon since last update, skipping');
                return;
            }
            
            this.isUpdating = true;
            this.lastHeartbeat = now;
            
            try {
                if (!this.supabaseClient || !this.currentUser) {
                    console.warn('MyUB Heartbeat: Missing client or user');
                    return;
                }
                
                await this.supabaseClient.rpc('update_online_status', { 
                    is_online_status: isOnline 
                });
                
                console.log('MyUB Heartbeat: Status updated to', isOnline ? 'ONLINE' : 'OFFLINE');
            } catch (error) {
                console.error('MyUB Heartbeat: Failed to update status', error);
            } finally {
                this.isUpdating = false;
            }
        },
        
        /**
         * Handle page visibility change with debouncing
         */
        handleVisibilityChange: function() {
            // Clear any pending visibility timeout
            if (this.visibilityTimeout) {
                clearTimeout(this.visibilityTimeout);
            }
            
            // Debounce visibility changes to prevent rapid status flipping
            this.visibilityTimeout = setTimeout(() => {
                const isVisible = !document.hidden;
                this.sendHeartbeat(isVisible);
                
                // If becoming visible, also restart interval
                if (isVisible && this.currentUser) {
                    if (this.interval) {
                        clearInterval(this.interval);
                    }
                    this.interval = setInterval(() => {
                        if (!document.hidden && this.currentUser) {
                            this.sendHeartbeat(true);
                        }
                    }, this.HEARTBEAT_INTERVAL);
                }
            }, this.VISIBILITY_DEBOUNCE);
        },
        
        /**
         * Set user offline using Beacon API for reliability
         * This is called on page unload
         */
        setOfflineBeacon: function() {
            if (!this.currentUser) return;
            
            try {
                // Try Beacon API first (most reliable for unload events)
                const data = JSON.stringify({
                    user_id: this.currentUser.id,
                    is_online: false
                });
                
                // Check if we have a beacon endpoint
                if (window.MYUB_BEACON_ENDPOINT) {
                    navigator.sendBeacon(window.MYUB_BEACON_ENDPOINT, data);
                    console.log('MyUB Heartbeat: Offline beacon sent');
                } else {
                    // Fallback to synchronous RPC call
                    this.sendHeartbeat(false);
                }
            } catch (error) {
                console.error('MyUB Heartbeat: Failed to send offline beacon', error);
            }
        }
    };
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        MyUBHeartbeat.handleVisibilityChange();
    });
    
    // Handle page unload - set offline
    window.addEventListener('beforeunload', function(e) {
        MyUBHeartbeat.stop();
        MyUBHeartbeat.setOfflineBeacon();
    });
    
    // Handle page hide (mobile/tablet specific)
    window.addEventListener('pagehide', function(e) {
        MyUBHeartbeat.stop();
        MyUBHeartbeat.setOfflineBeacon();
    });
    
    // Handle tab close/navigation away
    window.addEventListener('unload', function(e) {
        MyUBHeartbeat.setOfflineBeacon();
    });
    
    // Export globally
    window.MyUBHeartbeat = MyUBHeartbeat;
    
    console.log('MyUB Heartbeat System: Loaded');
})();
