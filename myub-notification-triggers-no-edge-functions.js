/**
 * MyUB Notification Triggers - NO EDGE FUNCTIONS v3.0
 */

(function() {
    "use strict";

    var MyUBNotificationTriggers = {
        
        onNewMessage: async function(supabase, senderId, senderName, messageText, conversationId) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                if (senderId === currentUserId) {
                    return { success: true, skipped: "own-message" };
                }
                
                if (!document.hidden && this.isUserActive()) {
                    console.log("MyUB: User active, skipping notification");
                    return { success: true, skipped: "user-active" };
                }
                
                var preview = messageText.length > 50 ? messageText.substring(0, 50) + "..." : messageText;
                
                var result = await supabase
                    .from("notification_queue")
                    .insert({
                        user_id: currentUserId,
                        type: "message",
                        title: senderName,
                        body: preview,
                        icon: "/icons/icon-192x192.png",
                        badge: "/icons/favicon-48x48.png",
                        tag: "message-" + conversationId,
                        data: {
                            type: "message",
                            senderId: senderId,
                            conversationId: conversationId,
                            url: "/messages.html?conversation=" + conversationId
                        },
                        require_interaction: false,
                        delivered: false
                    });
                
                if (result.error) {
                    console.error("MyUB: Insert notification error:", result.error);
                    return { success: false, error: result.error.message };
                }
                
                console.log("MyUB: Notification queued successfully");
                return { success: true, method: "database" };
                
            } catch (error) {
                console.error("Error triggering message notification:", error);
                return { success: false, error: error.message };
            }
        },
        
        onFriendRequest: async function(supabase, senderId, senderName, senderAvatar) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var result = await supabase
                    .from("notification_queue")
                    .insert({
                        user_id: currentUserId,
                        type: "friend_request",
                        title: "New Friend Request",
                        body: senderName + " wants to be your friend",
                        icon: senderAvatar || "/icons/icon-192x192.png",
                        badge: "/icons/favicon-48x48.png",
                        tag: "friend-request-" + senderId,
                        data: {
                            type: "friend_request",
                            senderId: senderId,
                            url: "/friends.html?tab=requests"
                        },
                        require_interaction: true,
                        delivered: false
                    });
                
                if (result.error) {
                    console.error("MyUB: Insert notification error:", result.error);
                    return { success: false, error: result.error.message };
                }
                
                return { success: true, method: "database" };
                
            } catch (error) {
                console.error("Error triggering friend request notification:", error);
                return { success: false, error: error.message };
            }
        },
        
        onFriendRequestAccepted: async function(supabase, accepterId, accepterName, accepterAvatar) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var result = await supabase
                    .from("notification_queue")
                    .insert({
                        user_id: currentUserId,
                        type: "friend_request_accepted",
                        title: "Friend Request Accepted",
                        body: accepterName + " accepted your friend request",
                        icon: accepterAvatar || "/icons/icon-192x192.png",
                        badge: "/icons/favicon-48x48.png",
                        tag: "friend-accepted-" + accepterId,
                        data: {
                            type: "friend_request_accepted",
                            accepterId: accepterId,
                            url: "/friends.html"
                        },
                        require_interaction: false,
                        delivered: false
                    });
                
                if (result.error) {
                    return { success: false, error: result.error.message };
                }
                
                return { success: true, method: "database" };
                
            } catch (error) {
                console.error("Error triggering friend accepted notification:", error);
                return { success: false, error: error.message };
            }
        },
        
        onStudyGroupInvite: async function(supabase, groupId, groupName, inviterName) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var result = await supabase
                    .from("notification_queue")
                    .insert({
                        user_id: currentUserId,
                        type: "study_group",
                        title: "Study Group Invitation",
                        body: inviterName + " invited you to join \"" + groupName + "\"",
                        icon: "/icons/icon-192x192.png",
                        badge: "/icons/favicon-48x48.png",
                        tag: "study-group-" + groupId,
                        data: {
                            type: "study_group",
                            groupId: groupId,
                            url: "/study-groups.html?group=" + groupId
                        },
                        require_interaction: true,
                        delivered: false
                    });
                
                if (result.error) {
                    return { success: false, error: result.error.message };
                }
                
                return { success: true, method: "database" };
                
            } catch (error) {
                console.error("Error triggering study group notification:", error);
                return { success: false, error: error.message };
            }
        },
        
        onIncomingCall: async function(supabase, callerId, callerName, callType, callId) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                if (callerId === currentUserId) {
                    return { success: true, skipped: "own-call" };
                }
                
                var result = await supabase
                    .from("notification_queue")
                    .insert({
                        user_id: currentUserId,
                        type: "call",
                        title: "Incoming " + (callType === "video" ? "Video" : "Voice") + " Call",
                        body: callerName + " is calling you",
                        icon: "/icons/icon-192x192.png",
                        badge: "/icons/favicon-48x48.png",
                        tag: "call-" + callId,
                        data: {
                            type: "call",
                            callerId: callerId,
                            callType: callType,
                            callId: callId,
                            url: "/messages.html?call=" + callId
                        },
                        require_interaction: true,
                        delivered: false
                    });
                
                if (result.error) {
                    return { success: false, error: result.error.message };
                }
                
                return { success: true, method: "database" };
                
            } catch (error) {
                console.error("Error triggering call notification:", error);
                return { success: false, error: error.message };
            }
        },
        
        onAnnouncement: async function(supabase, title, message, url) {
            try {
                var currentUserId = await this.getCurrentUserId(supabase);
                
                var result = await supabase
                    .from("notification_queue")
                    .insert({
                        user_id: currentUserId,
                        type: "announcement",
                        title: title,
                        body: message,
                        icon: "/icons/icon-192x192.png",
                        badge: "/icons/favicon-48x48.png",
                        tag: "announcement-" + Date.now(),
                        data: {
                            type: "announcement",
                            url: url || "/dashboard.html"
                        },
                        require_interaction: false,
                        delivered: false
                    });
                
                if (result.error) {
                    return { success: false, error: result.error.message };
                }
                
                return { success: true, method: "database" };
                
            } catch (error) {
                console.error("Error triggering announcement notification:", error);
                return { success: false, error: error.message };
            }
        },
        
        getCurrentUserId: async function(supabase) {
            try {
                var result = await supabase.auth.getUser();
                return result.data.user ? result.data.user.id : null;
            } catch (error) {
                console.error("Error getting current user:", error);
                return null;
            }
        },
        
        isUserActive: function() {
            var lastActivity = window.lastUserActivity || Date.now();
            var idleTime = Date.now() - lastActivity;
            return idleTime < 30000;
        }
    };
    
    window.lastUserActivity = Date.now();
    
    ["mousedown", "keydown", "scroll", "touchstart"].forEach(function(eventType) {
        document.addEventListener(eventType, function() {
            window.lastUserActivity = Date.now();
        }, true);
    });
    
    window.MyUBNotificationTriggers = MyUBNotificationTriggers;
    
})();
