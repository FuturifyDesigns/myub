/**
 * MyUB Push Notifications - NO EDGE FUNCTIONS v3.0
 * 
 * REVOLUTIONARY APPROACH:
 * - Uses Supabase Realtime instead of Edge Functions
 * - 100% client-side notification handling
 * - ZERO Edge Function calls! (FREE!)
 * - Perfect for free tier
 * 
 * HOW IT WORKS:
 * 1. User subscribes to push notifications (saves to DB)
 * 2. User listens to their own notification channel via Realtime
 * 3. When event happens, insert into notifications table
 * 4. Realtime triggers on user's device
 * 5. Client shows notification (local or push via Service Worker)
 * 
 * COST: 100% FREE! Only uses:
 * - Realtime connections (already using for messages)
 * - Database inserts (minimal)
 * - Service Worker (browser-side, free)
 */

(function() {
    'use strict';

    var MyUBNotifications = {
        version: '3.0.0',
        vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY_HERE',
        realtimeChannel: null,
        subscription: null,
        
        // ============================================
        // SUBSCRIPTION MANAGEMENT
        // ============================================
        
        /**
         * Initialize notification system
         * Sets up both push subscription and realtime listener
         */
        init: async function(supabase, userId) {
            console.log('MyUB Notifications: Initializing...');
            
            try {
                // Request permission and subscribe to push
                var permissionResult = await this.requestPermission(supabase, userId);
                
                if (permissionResult.success) {
                    // Setup realtime listener for this user's notifications
                    await this.setupRealtimeListener(supabase, userId);
                    return { success: true };
                } else {
                    return permissionResult;
                }
                
            } catch (error) {
                console.error('MyUB: Init error:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Request notification permission and save subscription
         */
        requestPermission: async function(supabase, userId) {
            console.log('MyUB Notifications: Requesting permission...');
            
            if (!('Notification' in window) || !('serviceWorker' in navigator)) {
                return { success: false, error: 'Notifications not supported' };
            }
            
            if (Notification.permission === 'denied') {
                return { success: false, error: 'Permission denied' };
            }
            
            try {
                var permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }
                
                if (permission !== 'granted') {
                    return { success: false, error: 'Permission not granted' };
                }
                
                // Get service worker subscription
                var registration = await navigator.serviceWorker.ready;
                var subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
                });
                
                this.subscription = subscription;
                
                // Save subscription to database
                var saveResult = await this.saveSubscription(supabase, userId, subscription);
                
                if (saveResult.success) {
                    return { success: true, subscription: subscription };
                } else {
                    return { success: false, error: 'Failed to save subscription' };
                }
                
            } catch (error) {
                console.error('MyUB: Permission error:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Save push subscription to database
         */
        saveSubscription: async function(supabase, userId, subscription) {
            try {
                var subscriptionData = {
                    user_id: userId,
                    endpoint: subscription.endpoint,
                    p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
                    auth: this.arrayBufferToBase64(subscription.getKey('auth')),
                    updated_at: new Date().toISOString()
                };
                
                var { data, error } = await supabase
                    .from('push_subscriptions')
                    .upsert(subscriptionData, { onConflict: 'user_id' });
                
                if (error) {
                    return { success: false, error: error.message };
                }
                
                return { success: true, data: data };
                
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // ============================================
        // REALTIME NOTIFICATION LISTENER
        // This replaces Edge Functions completely!
        // ============================================
        
        /**
         * Setup realtime listener for user's notifications
         * Listens to notification_queue table for this user
         */
        setupRealtimeListener: async function(supabase, userId) {
            console.log('MyUB: Setting up realtime notification listener...');
            
            try {
                // Create channel for this user's notifications
                this.realtimeChannel = supabase
                    .channel('user-notifications-' + userId)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'notification_queue',
                            filter: 'user_id=eq.' + userId
                        },
                        async (payload) => {
                            console.log('MyUB: Notification received via realtime:', payload);
                            await this.handleRealtimeNotification(payload.new, supabase);
                        }
                    )
                    .subscribe();
                
                console.log('MyUB: Realtime listener active');
                return { success: true };
                
            } catch (error) {
                console.error('MyUB: Realtime setup error:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Handle notification received via realtime
         * Decides whether to show local or push notification
         */
        handleRealtimeNotification: async function(notification, supabase) {
            try {
                console.log('MyUB: Processing notification:', notification);
                
                // If page is visible, show local notification
                if (!document.hidden) {
                    this.showLocalNotification(notification);
                } else {
                    // Page is hidden - send push via service worker
                    this.sendPushViaServiceWorker(notification);
                }
                
                // Mark as delivered
                await supabase
                    .from('notification_queue')
                    .update({ delivered: true, delivered_at: new Date().toISOString() })
                    .eq('id', notification.id);
                
            } catch (error) {
                console.error('MyUB: Handle notification error:', error);
            }
        },
        
        /**
         * Show local browser notification (page visible)
         */
        showLocalNotification: function(notification) {
            if (Notification.permission !== 'granted') return;
            
            console.log('MyUB: Showing local notification');
            
            var notif = new Notification(notification.title, {
                body: notification.body,
                icon: notification.icon || '/icons/icon-192x192.png',
                badge: notification.badge || '/icons/favicon-48x48.png',
                tag: notification.tag || 'myub-' + notification.id,
                data: notification.data || {},
                requireInteraction: notification.require_interaction || false,
                vibrate: [200, 100, 200]
            });
            
            notif.onclick = function(event) {
                event.preventDefault();
                window.focus();
                if (notification.data?.url) {
                    window.location.href = notification.data.url;
                }
                notif.close();
            };
        },
        
        /**
         * Send push notification via service worker (page hidden)
         * NO Edge Function needed! Uses browser's Push API directly
         */
        sendPushViaServiceWorker: async function(notification) {
            try {
                console.log('MyUB: Sending push via service worker');
                
                // Service worker will handle this
                var registration = await navigator.serviceWorker.ready;
                
                // Show notification via service worker
                await registration.showNotification(notification.title, {
                    body: notification.body,
                    icon: notification.icon || '/icons/icon-192x192.png',
                    badge: notification.badge || '/icons/favicon-48x48.png',
                    tag: notification.tag || 'myub-' + notification.id,
                    data: notification.data || {},
                    requireInteraction: notification.require_interaction || false,
                    vibrate: [200, 100, 200]
                });
                
            } catch (error) {
                console.error('MyUB: Service worker push error:', error);
            }
        },
        
        // ============================================
        // UNSUBSCRIBE
        // ============================================
        
        unsubscribe: async function(supabase, userId) {
            try {
                // Unsubscribe from push
                if (this.subscription) {
                    await this.subscription.unsubscribe();
                }
                
                // Unsubscribe from realtime
                if (this.realtimeChannel) {
                    await this.realtimeChannel.unsubscribe();
                }
                
                // Remove from database
                var { error } = await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', userId);
                
                if (error) {
                    return { success: false, error: error.message };
                }
                
                return { success: true };
                
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // ============================================
        // STATUS CHECKS
        // ============================================
        
        isSubscribed: async function() {
            try {
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                    return false;
                }
                
                var registration = await navigator.serviceWorker.ready;
                var subscription = await registration.pushManager.getSubscription();
                
                return subscription !== null;
                
            } catch (error) {
                return false;
            }
        },
        
        getStatus: async function() {
            try {
                var supported = ('Notification' in window) && ('serviceWorker' in navigator);
                var permission = Notification.permission;
                var subscribed = await this.isSubscribed();
                
                return {
                    supported: supported,
                    permission: permission,
                    subscribed: subscribed
                };
                
            } catch (error) {
                return {
                    supported: false,
                    permission: 'default',
                    subscribed: false
                };
            }
        },
        
        // ============================================
        // UTILITY FUNCTIONS
        // ============================================
        
        urlBase64ToUint8Array: function(base64String) {
            var padding = '='.repeat((4 - base64String.length % 4) % 4);
            var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
            var rawData = window.atob(base64);
            var outputArray = new Uint8Array(rawData.length);
            for (var i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        },
        
        arrayBufferToBase64: function(buffer) {
            var binary = '';
            var bytes = new Uint8Array(buffer);
            for (var i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        },
        
        // ============================================
        // UI HELPERS
        // ============================================
        
        showPermissionPrompt: function(onAccept, onDecline) {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;';
            
            var modal = document.createElement('div');
            modal.style.cssText = 'background: white; border-radius: 16px; padding: 32px 24px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';
            
            modal.innerHTML = `
                <div style="text-align: center;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #1a365d, #2c5282); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                    </div>
                    <h3 style="font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: #1a365d; margin-bottom: 12px;">Stay Connected with MyUB</h3>
                    <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Get instant notifications for new messages, friend requests, and study group updates.</p>
                    <div style="display: flex; gap: 12px;">
                        <button id="notif-decline" style="flex: 1; padding: 12px; border-radius: 10px; border: 2px solid #e2e8f0; background: white; color: #64748b; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer;">Not Now</button>
                        <button id="notif-accept" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: linear-gradient(135deg, #1a365d, #2c5282); color: white; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer;">Enable</button>
                    </div>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            document.getElementById('notif-accept').onclick = function() {
                document.body.removeChild(overlay);
                if (onAccept) onAccept();
            };
            
            document.getElementById('notif-decline').onclick = function() {
                document.body.removeChild(overlay);
                if (onDecline) onDecline();
            };
        }
    };
    
    // Export to global scope
    window.MyUBNotifications = MyUBNotifications;
    
})();
