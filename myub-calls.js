// =============================================
// MyUB Voice & Video Call Handler
// Include this file on ALL pages to enable incoming call notifications
// =============================================

(function() {
    'use strict';

    // =============================================
    // CONFIGURATION & STATE
    // =============================================
    let peer = null;
    let currentUser = null;
    let supabaseClient = null;
    let currentCall = null;
    let localStream = null;
    let isVideoCall = false;
    let isMuted = false;
    let isVideoOff = false;
    let callTimer = null;
    let callSeconds = 0;
    let incomingCallData = null;
    let callRingtone = null;
    let isInitialized = false;

    // =============================================
    // STYLES - Injected into page
    // =============================================
    const callStyles = `
        /* Incoming Call Toast - Shows on any page */
        .myub-incoming-call-toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
            border-radius: 16px;
            padding: 20px;
            display: none;
            align-items: center;
            gap: 16px;
            z-index: 99999;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            animation: myubSlideIn 0.3s ease;
            max-width: 380px;
            width: calc(100% - 40px);
        }
        .myub-incoming-call-toast.show { display: flex; }
        
        @keyframes myubSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes myubPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
            50% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
        }
        
        .myub-call-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2c5282 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Sora', 'Outfit', sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: #fff;
            flex-shrink: 0;
            overflow: hidden;
            animation: myubPulse 1.5s ease-in-out infinite;
        }
        .myub-call-avatar img { width: 100%; height: 100%; object-fit: cover; }
        
        .myub-call-info { flex: 1; min-width: 0; }
        .myub-call-name {
            font-family: 'Sora', 'Outfit', sans-serif;
            font-size: 16px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .myub-call-type {
            font-size: 13px;
            color: rgba(255,255,255,0.7);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .myub-call-type svg { width: 14px; height: 14px; }
        
        .myub-call-actions { display: flex; gap: 10px; flex-shrink: 0; }
        .myub-call-btn {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .myub-call-btn svg { width: 22px; height: 22px; color: #fff; }
        .myub-call-btn.accept { background: #22c55e; }
        .myub-call-btn.accept:hover { background: #16a34a; transform: scale(1.1); }
        .myub-call-btn.decline { background: #c41e3a; }
        .myub-call-btn.decline:hover { background: #a91b32; transform: scale(1.1); }
        
        /* Full Call Modal */
        .myub-call-modal {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.9);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            padding: 20px;
        }
        .myub-call-modal.show { display: flex; }
        
        .myub-call-modal-content {
            background: linear-gradient(135deg, #0f2744 0%, #1a365d 100%);
            border-radius: 24px;
            width: 100%;
            max-width: 420px;
            padding: 32px;
            text-align: center;
            animation: myubModalIn 0.3s ease;
        }
        @keyframes myubModalIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        
        .myub-modal-avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2c5282 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-family: 'Sora', 'Outfit', sans-serif;
            font-size: 42px;
            font-weight: 700;
            color: #fff;
            overflow: hidden;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
        }
        .myub-modal-avatar.ringing { animation: myubPulse 1.5s ease-in-out infinite; }
        .myub-modal-avatar img { width: 100%; height: 100%; object-fit: cover; }
        
        .myub-modal-name {
            font-family: 'Sora', 'Outfit', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 8px;
        }
        .myub-modal-status {
            font-size: 15px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 32px;
        }
        .myub-modal-status.connected { color: #22c55e; }
        
        .myub-modal-timer {
            font-family: 'Sora', 'Outfit', sans-serif;
            font-size: 18px;
            color: #fff;
            margin-bottom: 24px;
            display: none;
        }
        .myub-modal-timer.show { display: block; }
        
        /* Video Container */
        .myub-video-container {
            display: none;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        }
        .myub-video-container.show { display: flex; }
        
        .myub-remote-video-wrap {
            position: relative;
            width: 100%;
            aspect-ratio: 4/3;
            background: #000;
            border-radius: 16px;
            overflow: hidden;
        }
        .myub-remote-video { width: 100%; height: 100%; object-fit: cover; }
        .myub-video-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1e293b;
        }
        .myub-video-placeholder svg { width: 48px; height: 48px; color: #64748b; }
        
        .myub-local-video-wrap {
            position: absolute;
            bottom: 12px;
            right: 12px;
            width: 100px;
            height: 75px;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid rgba(255,255,255,0.3);
        }
        .myub-local-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        
        .myub-modal-actions {
            display: flex;
            justify-content: center;
            gap: 20px;
        }
        .myub-modal-btn {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .myub-modal-btn svg { width: 28px; height: 28px; color: #fff; }
        .myub-modal-btn.mute { background: rgba(255,255,255,0.2); }
        .myub-modal-btn.mute:hover { background: rgba(255,255,255,0.3); }
        .myub-modal-btn.mute.active { background: #c41e3a; }
        .myub-modal-btn.video-toggle { background: rgba(255,255,255,0.2); display: none; }
        .myub-modal-btn.video-toggle:hover { background: rgba(255,255,255,0.3); }
        .myub-modal-btn.video-toggle.active { background: #c41e3a; }
        .myub-modal-btn.video-toggle.show { display: flex; }
        .myub-modal-btn.end { background: #c41e3a; }
        .myub-modal-btn.end:hover { background: #a91b32; transform: scale(1.1); }
        .myub-modal-btn.accept { background: #22c55e; }
        .myub-modal-btn.accept:hover { background: #16a34a; transform: scale(1.1); }
        .myub-modal-btn.decline { background: #c41e3a; }
        .myub-modal-btn.decline:hover { background: #a91b32; transform: scale(1.1); }
        
        /* Mobile Responsive */
        @media (max-width: 480px) {
            .myub-incoming-call-toast {
                top: 10px;
                right: 10px;
                left: 10px;
                width: auto;
                max-width: none;
                padding: 16px;
                gap: 12px;
            }
            .myub-call-avatar { width: 48px; height: 48px; font-size: 16px; }
            .myub-call-name { font-size: 14px; }
            .myub-call-type { font-size: 12px; }
            .myub-call-btn { width: 44px; height: 44px; }
            .myub-call-btn svg { width: 20px; height: 20px; }
            
            .myub-call-modal-content { padding: 24px 20px; }
            .myub-modal-avatar { width: 100px; height: 100px; font-size: 36px; }
            .myub-modal-name { font-size: 20px; }
            .myub-modal-btn { width: 56px; height: 56px; }
            .myub-modal-btn svg { width: 24px; height: 24px; }
            .myub-modal-actions { gap: 16px; }
        }
    `;

    // =============================================
    // HTML TEMPLATES
    // =============================================
    const callToastHTML = `
        <div class="myub-incoming-call-toast" id="myubIncomingCallToast">
            <div class="myub-call-avatar" id="myubToastAvatar">
                <span id="myubToastAvatarText">--</span>
            </div>
            <div class="myub-call-info">
                <div class="myub-call-name" id="myubToastName">User Name</div>
                <div class="myub-call-type" id="myubToastType">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <span>Incoming voice call</span>
                </div>
            </div>
            <div class="myub-call-actions">
                <button class="myub-call-btn decline" onclick="MyUBCalls.declineCall()" title="Decline">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
                <button class="myub-call-btn accept" onclick="MyUBCalls.acceptCall()" title="Accept">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    const callModalHTML = `
        <div class="myub-call-modal" id="myubCallModal">
            <div class="myub-call-modal-content">
                <div class="myub-video-container" id="myubVideoContainer">
                    <div class="myub-remote-video-wrap">
                        <video class="myub-remote-video" id="myubRemoteVideo" autoplay playsinline></video>
                        <div class="myub-video-placeholder" id="myubVideoPlaceholder">
                            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                        </div>
                        <div class="myub-local-video-wrap">
                            <video class="myub-local-video" id="myubLocalVideo" autoplay playsinline muted></video>
                        </div>
                    </div>
                </div>
                <div class="myub-modal-avatar" id="myubModalAvatar">
                    <span id="myubModalAvatarText">--</span>
                </div>
                <div class="myub-modal-name" id="myubModalName">User Name</div>
                <div class="myub-modal-status" id="myubModalStatus">Calling...</div>
                <div class="myub-modal-timer" id="myubModalTimer">00:00</div>
                <div class="myub-modal-actions" id="myubOutgoingActions">
                    <button class="myub-modal-btn mute" id="myubMuteBtn" onclick="MyUBCalls.toggleMute()" title="Mute">
                        <svg id="myubMuteIcon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                        </svg>
                        <svg id="myubMuteIconOff" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:none;">
                            <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                            <path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
                        </svg>
                    </button>
                    <button class="myub-modal-btn video-toggle" id="myubVideoToggleBtn" onclick="MyUBCalls.toggleVideo()" title="Toggle Video">
                        <svg id="myubVideoIcon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        <svg id="myubVideoIconOff" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:none;">
                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            <path d="M3 3l18 18"/>
                        </svg>
                    </button>
                    <button class="myub-modal-btn end" onclick="MyUBCalls.endCall()" title="End Call">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
                        </svg>
                    </button>
                </div>
                <div class="myub-modal-actions" id="myubIncomingActions" style="display:none;">
                    <button class="myub-modal-btn decline" onclick="MyUBCalls.declineCall()" title="Decline">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
                        </svg>
                    </button>
                    <button class="myub-modal-btn accept" onclick="MyUBCalls.acceptCall()" title="Accept">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================
    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function injectStyles() {
        if (document.getElementById('myub-call-styles')) return;
        const style = document.createElement('style');
        style.id = 'myub-call-styles';
        style.textContent = callStyles;
        document.head.appendChild(style);
    }

    function injectHTML() {
        if (document.getElementById('myubIncomingCallToast')) return;
        const container = document.createElement('div');
        container.innerHTML = callToastHTML + callModalHTML;
        document.body.appendChild(container);
    }

    // =============================================
    // PEERJS INITIALIZATION
    // =============================================
    function initPeerJS() {
        if (!currentUser || peer) return;
        
        const peerId = 'myub_' + currentUser.id.replace(/-/g, '_');
        peer = new Peer(peerId, {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('[MyUB Calls] PeerJS connected:', id);
        });

        peer.on('call', (call) => {
            currentCall = call;
        });

        peer.on('error', (err) => {
            console.error('[MyUB Calls] PeerJS error:', err);
            if (err.type === 'peer-unavailable') {
                showToast('User is not available for calls', 'error');
                endCall();
            }
        });

        peer.on('disconnected', () => {
            console.log('[MyUB Calls] Reconnecting...');
            peer.reconnect();
        });
    }

    // =============================================
    // CALL SIGNAL SUBSCRIPTION
    // =============================================
    function subscribeToCallSignals() {
        if (!currentUser || !supabaseClient) return;

        supabaseClient.channel('myub_call_signals_' + currentUser.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'call_signals',
                filter: 'receiver_id=eq.' + currentUser.id
            }, async (payload) => {
                const signal = payload.new;
                
                if (signal.signal_type === 'call_request' && !currentCall) {
                    const { data: caller } = await supabaseClient.from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', signal.caller_id)
                        .single();

                    if (caller) {
                        incomingCallData = {
                            callerId: signal.caller_id,
                            callerName: caller.full_name || 'Unknown',
                            callerAvatar: caller.avatar_url,
                            isVideo: signal.is_video,
                            signalId: signal.id
                        };
                        showIncomingCallToast(incomingCallData);
                    }
                } else if (signal.signal_type === 'call_declined' || signal.signal_type === 'call_ended') {
                    if (currentCall) {
                        showToast('Call ended', 'info');
                        endCall();
                    }
                }
            })
            .subscribe();
    }

    // =============================================
    // INCOMING CALL UI
    // =============================================
    function showIncomingCallToast(data) {
        playRingtone();
        
        const toast = document.getElementById('myubIncomingCallToast');
        const avatar = document.getElementById('myubToastAvatar');
        const name = document.getElementById('myubToastName');
        const type = document.getElementById('myubToastType');

        if (data.callerAvatar) {
            avatar.innerHTML = `<img src="${data.callerAvatar}" alt="">`;
        } else {
            avatar.innerHTML = `<span>${getInitials(data.callerName)}</span>`;
        }

        name.textContent = data.callerName;
        type.innerHTML = data.isVideo
            ? `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg><span>Incoming video call</span>`
            : `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg><span>Incoming voice call</span>`;

        toast.classList.add('show');

        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (incomingCallData && toast.classList.contains('show')) {
                declineCall();
            }
        }, 30000);
    }

    function hideIncomingCallToast() {
        const toast = document.getElementById('myubIncomingCallToast');
        if (toast) toast.classList.remove('show');
    }

    // =============================================
    // CALL MODAL UI
    // =============================================
    function showCallModal(isIncoming) {
        const modal = document.getElementById('myubCallModal');
        const avatar = document.getElementById('myubModalAvatar');
        const name = document.getElementById('myubModalName');
        const status = document.getElementById('myubModalStatus');
        const videoContainer = document.getElementById('myubVideoContainer');
        const videoToggle = document.getElementById('myubVideoToggleBtn');
        const outgoingActions = document.getElementById('myubOutgoingActions');
        const incomingActions = document.getElementById('myubIncomingActions');

        const data = incomingCallData;
        if (!data) return;

        if (data.callerAvatar) {
            avatar.innerHTML = `<img src="${data.callerAvatar}" alt="">`;
        } else {
            avatar.innerHTML = `<span>${getInitials(data.callerName)}</span>`;
        }

        name.textContent = data.callerName;
        status.textContent = isIncoming ? (data.isVideo ? 'Incoming video call...' : 'Incoming voice call...') : 'Calling...';
        status.classList.remove('connected');
        avatar.classList.toggle('ringing', isIncoming);

        videoContainer.classList.toggle('show', data.isVideo);
        avatar.style.display = data.isVideo ? 'none' : 'flex';
        videoToggle.classList.toggle('show', data.isVideo);

        outgoingActions.style.display = isIncoming ? 'none' : 'flex';
        incomingActions.style.display = isIncoming ? 'flex' : 'none';

        document.getElementById('myubModalTimer').classList.remove('show');
        
        isMuted = false;
        isVideoOff = false;
        updateMuteUI();
        updateVideoUI();

        modal.classList.add('show');
    }

    function hideCallModal() {
        const modal = document.getElementById('myubCallModal');
        if (modal) modal.classList.remove('show');
    }

    // =============================================
    // CALL FUNCTIONS
    // =============================================
    async function acceptCall() {
        stopRingtone();
        hideIncomingCallToast();

        if (!incomingCallData) return;

        try {
            const constraints = {
                audio: true,
                video: incomingCallData.isVideo ? { width: 640, height: 480 } : false
            };

            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            isVideoCall = incomingCallData.isVideo;

            if (isVideoCall) {
                document.getElementById('myubLocalVideo').srcObject = localStream;
            }

            if (currentCall) {
                currentCall.answer(localStream);
                setupCallHandlers(currentCall);
            }

            showCallModal(false);
            document.getElementById('myubModalAvatar').classList.remove('ringing');
            document.getElementById('myubModalStatus').textContent = 'Connected';
            document.getElementById('myubModalStatus').classList.add('connected');
            document.getElementById('myubOutgoingActions').style.display = 'flex';
            document.getElementById('myubIncomingActions').style.display = 'none';

            startCallTimer();

            await supabaseClient.from('call_signals').insert({
                caller_id: currentUser.id,
                receiver_id: incomingCallData.callerId,
                signal_type: 'call_accepted',
                is_video: incomingCallData.isVideo
            });

        } catch (err) {
            console.error('[MyUB Calls] Error accepting call:', err);
            showToast('Failed to accept call: ' + err.message, 'error');
            declineCall();
        }
    }

    async function declineCall() {
        stopRingtone();
        hideIncomingCallToast();
        hideCallModal();

        if (incomingCallData) {
            await supabaseClient.from('call_signals').insert({
                caller_id: currentUser.id,
                receiver_id: incomingCallData.callerId,
                signal_type: 'call_declined',
                is_video: incomingCallData.isVideo || false
            });
        }

        cleanupCall();
        incomingCallData = null;
    }

    async function endCall() {
        stopRingtone();

        if (incomingCallData) {
            await supabaseClient.from('call_signals').insert({
                caller_id: currentUser.id,
                receiver_id: incomingCallData.callerId,
                signal_type: 'call_ended',
                is_video: isVideoCall
            });
        }

        cleanupCall();
        hideCallModal();
        hideIncomingCallToast();
    }

    function setupCallHandlers(call) {
        call.on('stream', (remoteStream) => {
            const remoteVideo = document.getElementById('myubRemoteVideo');
            remoteVideo.srcObject = remoteStream;
            document.getElementById('myubVideoPlaceholder').style.display = 'none';

            document.getElementById('myubModalAvatar').classList.remove('ringing');
            document.getElementById('myubModalStatus').textContent = 'Connected';
            document.getElementById('myubModalStatus').classList.add('connected');

            startCallTimer();
        });

        call.on('close', () => {
            showToast('Call ended', 'info');
            endCall();
        });

        call.on('error', (err) => {
            console.error('[MyUB Calls] Call error:', err);
            showToast('Call error', 'error');
            endCall();
        });
    }

    function cleanupCall() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        if (currentCall) {
            currentCall.close();
            currentCall = null;
        }

        stopCallTimer();

        const localVideo = document.getElementById('myubLocalVideo');
        const remoteVideo = document.getElementById('myubRemoteVideo');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        const placeholder = document.getElementById('myubVideoPlaceholder');
        if (placeholder) placeholder.style.display = 'flex';

        incomingCallData = null;
        isMuted = false;
        isVideoOff = false;
    }

    // =============================================
    // CALL CONTROLS
    // =============================================
    function toggleMute() {
        if (!localStream) return;
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        updateMuteUI();
    }

    function updateMuteUI() {
        const btn = document.getElementById('myubMuteBtn');
        const iconOn = document.getElementById('myubMuteIcon');
        const iconOff = document.getElementById('myubMuteIconOff');
        if (btn) btn.classList.toggle('active', isMuted);
        if (iconOn) iconOn.style.display = isMuted ? 'none' : 'block';
        if (iconOff) iconOff.style.display = isMuted ? 'block' : 'none';
    }

    function toggleVideo() {
        if (!localStream) return;
        isVideoOff = !isVideoOff;
        localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
        updateVideoUI();
    }

    function updateVideoUI() {
        const btn = document.getElementById('myubVideoToggleBtn');
        const iconOn = document.getElementById('myubVideoIcon');
        const iconOff = document.getElementById('myubVideoIconOff');
        if (btn) btn.classList.toggle('active', isVideoOff);
        if (iconOn) iconOn.style.display = isVideoOff ? 'none' : 'block';
        if (iconOff) iconOff.style.display = isVideoOff ? 'block' : 'none';
    }

    // =============================================
    // TIMER
    // =============================================
    function startCallTimer() {
        callSeconds = 0;
        const timer = document.getElementById('myubModalTimer');
        if (timer) timer.classList.add('show');
        updateTimerDisplay();
        callTimer = setInterval(() => {
            callSeconds++;
            updateTimerDisplay();
        }, 1000);
    }

    function stopCallTimer() {
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
        callSeconds = 0;
    }

    function updateTimerDisplay() {
        const timer = document.getElementById('myubModalTimer');
        if (timer) {
            const m = Math.floor(callSeconds / 60);
            const s = callSeconds % 60;
            timer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }
    }

    // =============================================
    // RINGTONE
    // =============================================
    function playRingtone() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            osc.type = 'sine';
            gain.gain.value = 0.1;
            osc.start();

            callRingtone = {
                ctx: ctx,
                osc: osc,
                gain: gain,
                interval: setInterval(() => {
                    gain.gain.value = gain.gain.value > 0 ? 0 : 0.1;
                }, 500)
            };

            setTimeout(() => {
                if (callRingtone) stopRingtone();
            }, 30000);
        } catch (e) {
            console.log('[MyUB Calls] Ringtone error:', e);
        }
    }

    function stopRingtone() {
        if (callRingtone) {
            try {
                clearInterval(callRingtone.interval);
                callRingtone.osc.stop();
                callRingtone.ctx.close();
            } catch (e) {}
            callRingtone = null;
        }
    }

    // =============================================
    // TOAST NOTIFICATION
    // =============================================
    function showToast(message, type) {
        // Try to use existing toast system
        const existingToast = document.getElementById('toast') || document.querySelector('.toast');
        if (existingToast) {
            existingToast.textContent = message;
            existingToast.className = 'toast ' + (type || 'info') + ' show';
            setTimeout(() => existingToast.classList.remove('show'), 3000);
            return;
        }

        // Create simple toast if none exists
        let toast = document.getElementById('myub-call-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'myub-call-toast';
            toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;z-index:99999;opacity:0;transition:opacity 0.3s;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 3000);
    }

    // =============================================
    // PUBLIC API & INITIALIZATION
    // =============================================
    function init(supabase) {
        if (isInitialized) return;

        supabaseClient = supabase;

        // Wait for user session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                currentUser = session.user;
                injectStyles();
                injectHTML();

                // Load PeerJS if not already loaded
                if (typeof Peer === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
                    script.onload = () => {
                        initPeerJS();
                        subscribeToCallSignals();
                    };
                    document.head.appendChild(script);
                } else {
                    initPeerJS();
                    subscribeToCallSignals();
                }

                isInitialized = true;
                console.log('[MyUB Calls] Initialized for user:', currentUser.id);
            }
        });
    }

    // Start a call (to be used from messages page)
    async function startCall(targetUser, withVideo) {
        if (!targetUser || !peer || !supabaseClient) return;

        isVideoCall = withVideo;
        incomingCallData = {
            callerId: targetUser.id,
            callerName: targetUser.full_name || targetUser.name || 'User',
            callerAvatar: targetUser.avatar_url,
            isVideo: withVideo
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: withVideo ? { width: 640, height: 480 } : false
            });

            showCallModal(false);

            if (withVideo) {
                document.getElementById('myubLocalVideo').srcObject = localStream;
            }

            await supabaseClient.from('call_signals').insert({
                caller_id: currentUser.id,
                receiver_id: targetUser.id,
                signal_type: 'call_request',
                is_video: withVideo
            });

            const targetPeerId = 'myub_' + targetUser.id.replace(/-/g, '_');
            currentCall = peer.call(targetPeerId, localStream);

            if (currentCall) {
                setupCallHandlers(currentCall);
            } else {
                showToast('Failed to connect', 'error');
                cleanupCall();
                hideCallModal();
            }

        } catch (err) {
            console.error('[MyUB Calls] Start call error:', err);
            if (err.name === 'NotAllowedError') {
                showToast('Please allow microphone' + (withVideo ? ' and camera' : '') + ' access', 'error');
            } else {
                showToast('Failed to start call', 'error');
            }
            cleanupCall();
            hideCallModal();
        }
    }

    // Expose public API
    window.MyUBCalls = {
        init: init,
        startCall: startCall,
        acceptCall: acceptCall,
        declineCall: declineCall,
        endCall: endCall,
        toggleMute: toggleMute,
        toggleVideo: toggleVideo
    };

})();
