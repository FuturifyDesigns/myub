/**
 * MyUB Notification Triggers - NO EDGE FUNCTIONS v3.0
 * 
 * REVOLUTIONARY APPROACH:
 * - Inserts notification into database instead of calling Edge Function
 * - Supabase Realtime delivers to user's device
 * - 100% FREE! Zero Edge Function calls!
 * 
 * HOW IT WORKS:
 * 1. Event happens (new message, friend request, etc.)
 * 2. Insert notification into notification_queue table
 * 3. Supabase Realtime instantly delivers to user
 * 4. User's browser shows notification
 * 
 * NO BACKEND NEEDED!
 */

(function() {
    'use strict;

    var MyUBNotificationTriggers = {
        
        /**
         * NEW MESSAGE - Database approach
         */
        onNewMessage: async function(supabase, senderId, senderName, messageText, conversationId) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                // Don't notify for own messages
                if (senderId === currentUserId) {
                    return { success: true, skipped: 'own-message' };
                }
                
                // Check if should notify
                if (!document.hidden && this.isUserActive()) {
                    console.log('MyUB: User active, skipping notification');
                    return { success: true, skipped: 'user-active' };
                }
                
                var preview = messageText.length > 50 
                    ? messageText.substring(0, 50) + '...' 
                    : messageText;
                
                // Insert notification into database
                // Realtime will deliver it to the recipient!
                var { data, error } = await supabase
                    .from('notification_queue')
                    .insert({
                        user_id: currentUserId,
                        type: 'message',
                        title: senderName,
                        body: preview,
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/favicon-48x48.png',
                        tag: 'message-' + conversationId,
                        data: {
                            type: 'message',
                            senderId: senderId,
                            conversationId: conversationId,
                            url: '/messages.html?conversation=' + conversationId
                        },
                        require_interaction: false,
                        delivered: false
                    });
                
                if (error) {
                    console.error('MyUB: Insert notification error:', error);
                    return { success: false, error: error.message };
                }
                
                console.log('MyUB: Notification queued successfully');
                return { success: true, method: 'database' };
                
            } catch (error) {
                console.error('Error triggering message notification:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * FRIEND REQUEST - Database approach
         */
        onFriendRequest: async function(supabase, senderId, senderName, senderAvatar) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var { data, error } = await supabase
                    .from('notification_queue')
                    .insert({
                        user_id: currentUserId,
                        type: 'friend_request',
                        title: 'New Friend Request',
                        body: senderName + ' wants to be your friend',
                        icon: senderAvatar || '/icons/icon-192x192.png',
                        badge: '/icons/favicon-48x48.png',
                        tag: 'friend-request-' + senderId,
                        data: {
                            type: 'friend_request',
                            senderId: senderId,
                            url: '/friends.html?tab=requests'
                        },
                        require_interaction: true,
                        delivered: false
                    });
                
                if (error) {
                    console.error('MyUB: Insert notification error:', error);
                    return { success: false, error: error.message };
                }
                
                return { success: true, method: 'database' };
                
            } catch (error) {
                console.error('Error triggering friend request notification:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * FRIEND REQUEST ACCEPTED - Database approach
         */
        onFriendRequestAccepted: async function(supabase, accepterId, accepterName, accepterAvatar) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var { data, error } = await supabase
                    .from('notification_queue')
                    .insert({
                        user_id: currentUserId,
                        type: 'friend_request_accepted',
                        title: 'Friend Request Accepted',
                        body: accepterName + ' accepted your friend request',
                        icon: accepterAvatar || '/icons/icon-192x192.png',
                        badge: '/icons/favicon-48x48.png',
                        tag: 'friend-accepted-' + accepterId,
                        data: {
                            type: 'friend_request_accepted',
                            accepterId: accepterId,
                            url: '/friends.html'
                        },
                        require_interaction: false,
                        delivered: false
                    });
                
                if (error) {
                    return { success: false, error: error.message };
                }
                
                return { success: true, method: 'database' };
                
            } catch (error) {
                console.error('Error triggering friend accepted notification:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * STUDY GROUP INVITE - Database approach
         */
        onStudyGroupInvite: async function(supabase, groupId, groupName, inviterName) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var { data, error } = await supabase
                    .from('notification_queue')
                    .insert({
                        user_id: currentUserId,
                        type: 'study_group',
                        title: 'Study Group Invitation',
                        body: inviterName + ' invited you to join "' + groupName + '"',
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/favicon-48x48.png',
                        tag: 'study-group-' + groupId,
                        data: {
                            type: 'study_group',
                            groupId: groupId,
                            url: '/study-groups.html?group=' + groupId
                        },
                        require_interaction: true,
                        delivered: false
                    });
                
                if (error) {
                    return { success: false, error: error.message };
                }
                
                return { success: true, method: 'database' };
                
            } catch (error) {
                console.error('Error triggering study group notification:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * INCOMING CALL - Database approach
         */
        onIncomingCall: async function(supabase, callerId, callerName, callType, callId) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                // Don't notify for own calls
                if (callerId === currentUserId) {
                    return { success: true, skipped: 'own-call' };
                }
                
                var { data, error } = await supabase
                    .from('notification_queue')
                    .insert({
                        user_id: currentUserId,
                        type: 'call',
                        title: 'Incoming ' + (callType === 'video' ? 'Video' : 'Voice') + ' Call',
                        body: callerName + ' is calling you',
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/favicon-48x48.png',
                        tag: 'call-' + callId,
                        data: {
                            type: 'call',
                            callerId: callerId,
                            callType: callType,
                            callId: callId,
                            url: '/messages.html?call=' + callId
                        },
                        require_interaction: true,
                        delivered: false
                    });
                
                if (error) {
                    return { success: false, error: error.message };
                }
                
                return { success: true, method: 'database' };
                
            } catch (error) {
                console.error('Error triggering call notification:', error);
                return { success: false, error: error.message };
            }
        },
        
        /**
         * SYSTEM ANNOUNCEMENT - Database approach
         */
        onAnnouncement: async function(supabase, title, message, url) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var { data, error } = await supabase
                    .from('notification_queue')
                    .insert({
                        user_id: currentUserId,
                        type: 'announcement',
                        title: title,
                        body: message,
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/favicon-48x48.png',
                        tag: 'announcement-' + Date.now(),
                        data: {
                            type: 'announcement',
                            url: url || '/dashboard.html'
                        },
                        require_interaction: false,
                        delivered: false
                    });
                
                if (error) {
                    return { success: false, error: error.message };
                }
                
                return { success: true, method: 'database' };
                
            } catch (error) {
                console.error('Error triggering announcement notification:', error);
                return { success: false, error: error.message };
            }
        },
        
        // ============================================
        // HELPER FUNCTIONS
        // ============================================
        
        /**
         * Get current user ID
         */
        getCurrentUserId: async function(supabase) {
            try {
                var { data: { user } } = await supabase.auth.getUser();
                return user?.id || null;
            } catch (error) {
                console.error('Error getting current user:', error);
                return null;
            }
        },
        
        /**
         * Check if user is actively using the page
         */
        isUserActive: function() {
            var lastActivity = window.lastUserActivity || Date.now();
            var idleTime = Date.now() - lastActivity;
            return idleTime < 30000; // Active if interacted in last 30 seconds
        }
    };
    
    // Track user activity
    window.lastUserActivity = Date.now();
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(function(eventType) {
        document.addEventListener(eventType, function() {
            window.lastUserActivity = Date.now();
        }, true);
    });
    
    // Export to global scope
    window.MyUBNotificationTriggers = MyUBNotificationTriggers;
    
})();
