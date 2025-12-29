/**
 * MyUB Online Status Heartbeat System
 * Include this on all main pages to keep online status accurate
 */

(function() {
    "use strict";

    var MyUBHeartbeat = {
        interval: null,
        
        start: function(supabaseClient, currentUser) {
            if (!supabaseClient || !currentUser) {
                console.warn('MyUB Heartbeat: Missing supabaseClient or currentUser');
                return;
            }
            
            // Update immediately
            this.sendHeartbeat(supabaseClient);
            
            // Then update every 30 seconds
            this.interval = setInterval(function() {
                if (!document.hidden) {
                    MyUBHeartbeat.sendHeartbeat(supabaseClient);
                }
            }, 30000); // 30 seconds
            
            console.log('MyUB Heartbeat: Started');
        },
        
        stop: function() {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
                console.log('MyUB Heartbeat: Stopped');
            }
        },
        
        sendHeartbeat: async function(supabaseClient) {
            try {
                await supabaseClient.rpc('update_online_status', { is_online_status: true });
                console.log('MyUB Heartbeat: Sent');
            } catch (error) {
                console.error('MyUB Heartbeat: Failed', error);
            }
        }
    };
    
    // Handle page visibility
    document.addEventListener('visibilitychange', async function() {
        if (window.supabaseClient && window.currentUser) {
            await window.supabaseClient.rpc('update_online_status', { 
                is_online_status: !document.hidden 
            });
        }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', function() {
        MyUBHeartbeat.stop();
    });
    
    // Export globally
    window.MyUBHeartbeat = MyUBHeartbeat;
})();
