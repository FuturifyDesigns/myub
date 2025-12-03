const SUPABASE_URL = 'https://weuxtwmaqmbhskjpjdyi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndldXh0d21hcW1iaHNranBqZHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTYzMTcsImV4cCI6MjA4MDMzMjMxN30.J-0Nd0MY6-g_ltbBNHwOulqZuQfb8mKIRgx0dAaJ76o';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null, conversations = [], currentConversation = null, currentChatUser = null;
let messages = [], notifications = [], friends = [], blockedUsers = [], blockedByUsers = [];
let selectedMessages = new Set(), isSelectionMode = false, confirmCallback = null, forwardToUsers = new Set();

async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;
    if (localStorage.getItem('myub_darkMode') === 'true') document.body.classList.add('dark-mode');
    await updateOnlineStatus(true);
    await Promise.all([loadConversations(), loadFriends(), loadBlockedUsers(), loadNotifications()]);
    subscribeToRealtime();
    startHeartbeat();
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    if (userId) await openConversation(userId);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.addEventListener('click', handleOutsideClick);
    document.getElementById('messageInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

async function updateOnlineStatus(isOnline) { await supabase.from('profiles').update({ is_online: isOnline, last_seen: new Date().toISOString() }).eq('id', currentUser.id); }
function startHeartbeat() { setInterval(() => updateOnlineStatus(true), 30000); window.addEventListener('beforeunload', () => updateOnlineStatus(false)); }

async function loadConversations() {
    const { data: sentMsgs } = await supabase.from('messages').select('receiver_id, content, created_at, is_read').eq('sender_id', currentUser.id).is('group_id', null).order('created_at', { ascending: false });
    const { data: receivedMsgs } = await supabase.from('messages').select('sender_id, content, created_at, is_read').eq('receiver_id', currentUser.id).is('group_id', null).order('created_at', { ascending: false });
    const convMap = new Map();
    (sentMsgs || []).forEach(msg => { const oderId = msg.receiver_id; if (!convMap.has(oderId) || new Date(msg.created_at) > new Date(convMap.get(oderId).lastMessageTime)) convMap.set(oderId, { oderId, lastMessage: msg.content, lastMessageTime: msg.created_at, unreadCount: convMap.get(oderId)?.unreadCount || 0 }); });
    (receivedMsgs || []).forEach(msg => { const oderId = msg.sender_id; const existing = convMap.get(oderId); const unreadCount = (existing?.unreadCount || 0) + (msg.is_read ? 0 : 1); if (!existing || new Date(msg.created_at) > new Date(existing.lastMessageTime)) convMap.set(oderId, { oderId, lastMessage: msg.content, lastMessageTime: msg.created_at, unreadCount }); else existing.unreadCount = unreadCount; });
    const userIds = Array.from(convMap.keys());
    if (userIds.length > 0) { const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, full_name, avatar_url, is_online, last_seen').in('id', userIds); conversations = Array.from(convMap.values()).map(conv => { const profile = profiles?.find(p => p.id === conv.oderId); return { ...conv, user: profile }; }).filter(c => c.user).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)); }
    else conversations = [];
    renderConversations(); updateUnreadBadge();
}

async function loadFriends() {
    const { data: f1 } = await supabase.from('friendships').select('friend_id').eq('user_id', currentUser.id);
    const { data: f2 } = await supabase.from('friendships').select('user_id').eq('friend_id', currentUser.id);
    const friendIds = [...(f1||[]).map(f => f.friend_id), ...(f2||[]).map(f => f.user_id)];
    if (friendIds.length > 0) { const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, full_name, avatar_url, is_online').in('id', friendIds); friends = profiles || []; }
    else friends = [];
}

async function loadBlockedUsers() {
    const { data: blocked } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', currentUser.id);
    blockedUsers = (blocked || []).map(b => b.blocked_id);
    const { data: blockedBy } = await supabase.from('blocked_users').select('blocker_id').eq('blocked_id', currentUser.id);
    blockedByUsers = (blockedBy || []).map(b => b.blocker_id);
}

async function loadMessages(userId) {
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).is('group_id', null).eq('is_deleted', false).order('created_at', { ascending: true });
    messages = data || []; renderMessages();
    await supabase.from('messages').update({ is_read: true }).eq('sender_id', userId).eq('receiver_id', currentUser.id).eq('is_read', false);
    const conv = conversations.find(c => c.oderId === userId); if (conv) conv.unreadCount = 0;
    renderConversations(); updateUnreadBadge();
}

function renderConversations() {
    const container = document.getElementById('conversationsList');
    const searchQuery = document.getElementById('convSearch').value.toLowerCase();
    const filtered = conversations.filter(c => { if (!c.user) return false; const name = (c.user.full_name || `${c.user.first_name} ${c.user.last_name}`).toLowerCase(); return name.includes(searchQuery); });
    if (filtered.length === 0) { container.innerHTML = `<div class="conversations-empty"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><h3>${searchQuery ? 'No conversations found' : 'No messages yet'}</h3><p>${searchQuery ? 'Try a different search' : 'Start chatting with friends!'}</p></div>`; return; }
    container.innerHTML = filtered.map(conv => { const user = conv.user; const name = user.full_name || `${user.first_name} ${user.last_name}`; const initials = getInitials(name); const isActive = currentChatUser?.id === user.id; const timeStr = formatConvTime(conv.lastMessageTime); return `<div class="conversation-item ${isActive ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}" onclick="openConversation('${user.id}')"><div class="conv-avatar">${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : initials}<div class="conv-online ${user.is_online ? '' : 'offline'}"></div></div><div class="conv-info"><div class="conv-name">${escapeHtml(name)}</div><div class="conv-preview">${escapeHtml(truncate(conv.lastMessage, 35))}</div></div><div class="conv-meta"><div class="conv-time">${timeStr}</div>${conv.unreadCount > 0 ? `<div class="conv-unread-badge">${conv.unreadCount}</div>` : ''}</div></div>`; }).join('');
}

function renderMessages() {
    const container = document.getElementById('chatMessages');
    if (messages.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400);">No messages yet. Say hello! 👋</div>'; return; }
    let html = '', lastDate = null;
    messages.forEach(msg => {
        const msgDate = new Date(msg.created_at).toDateString();
        if (msgDate !== lastDate) { html += `<div class="chat-date-divider"><span>${formatDateDivider(msg.created_at)}</span></div>`; lastDate = msgDate; }
        const isSent = msg.sender_id === currentUser.id, isSelected = selectedMessages.has(msg.id), time = formatMessageTime(msg.created_at);
        html += `<div class="message-wrapper ${isSent ? 'sent' : 'received'}" data-id="${msg.id}"><div class="message-select ${isSelectionMode ? 'show' : ''} ${isSelected ? 'checked' : ''}" onclick="toggleMessageSelect('${msg.id}')"></div>${!isSent ? `<div class="message-avatar">${currentChatUser?.avatar_url ? `<img src="${currentChatUser.avatar_url}">` : getInitials(currentChatUser?.full_name || currentChatUser?.first_name || 'U')}</div>` : ''}<div class="message-bubble ${isSelected ? 'selected' : ''}" onclick="handleMessageClick(event, '${msg.id}')">${!isSent ? `<div class="message-sender">${escapeHtml(currentChatUser?.first_name || 'User')}</div>` : ''}<div class="message-text">${escapeHtml(msg.content)}</div><div class="message-meta"><span class="message-time">${time}</span>${isSent ? `<span class="message-status">${msg.is_read ? '✓✓' : '✓'}</span>` : ''}</div></div></div>`;
    });
    container.innerHTML = html; container.scrollTop = container.scrollHeight;
}

function filterConversations() { renderConversations(); }

async function openConversation(userId) {
    const { data: user } = await supabase.from('profiles').select('id, first_name, last_name, full_name, avatar_url, is_online, last_seen').eq('id', userId).single();
    if (!user) { showToast('User not found', 'error'); return; }
    currentChatUser = user; currentConversation = userId;
    const name = user.full_name || `${user.first_name} ${user.last_name}`;
    document.getElementById('chatUserName').textContent = name;
    const avatarEl = document.getElementById('chatAvatar');
    avatarEl.innerHTML = user.avatar_url ? `<img src="${user.avatar_url}" alt=""><div class="online-dot ${user.is_online ? '' : 'offline'}"></div>` : `<span>${getInitials(name)}</span><div class="online-dot ${user.is_online ? '' : 'offline'}"></div>`;
    const statusEl = document.getElementById('chatUserStatus');
    statusEl.textContent = user.is_online ? 'Online' : (user.last_seen ? `Last seen ${formatTimeAgo(user.last_seen)}` : 'Offline');
    statusEl.className = 'chat-user-status' + (user.is_online ? '' : ' offline');
    const isBlocked = blockedUsers.includes(userId), isBlockedBy = blockedByUsers.includes(userId);
    if (isBlocked || isBlockedBy) { document.getElementById('chatBlocked').style.display = 'block'; document.getElementById('blockedMessage').textContent = isBlocked ? 'You blocked this user.' : 'You cannot message this user.'; document.getElementById('chatInputArea').style.display = 'none'; }
    else { document.getElementById('chatBlocked').style.display = 'none'; document.getElementById('chatInputArea').style.display = 'flex'; }
    document.getElementById('chatEmpty').style.display = 'none'; document.getElementById('chatHeader').style.display = 'flex'; document.getElementById('chatMessages').style.display = 'flex';
    document.getElementById('conversationsPanel').classList.add('hidden'); document.getElementById('chatPanel').classList.add('show');
    await loadMessages(userId); renderConversations(); exitSelectionMode();
}

function backToConversations() { document.getElementById('conversationsPanel').classList.remove('hidden'); document.getElementById('chatPanel').classList.remove('show'); currentConversation = null; currentChatUser = null; }

async function sendMessage() {
    const input = document.getElementById('messageInput'), content = input.value.trim();
    if (!content || !currentConversation) return;
    if (blockedUsers.includes(currentConversation) || blockedByUsers.includes(currentConversation)) { showToast('Cannot message this user', 'error'); return; }
    try {
        const { data, error } = await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: currentConversation, content, message_type: 'text' }).select().single();
        if (error) throw error;
        input.value = ''; input.style.height = 'auto'; document.getElementById('sendBtn').disabled = true;
        messages.push(data); renderMessages(); await loadConversations();
        await supabase.from('notifications').insert({ user_id: currentConversation, type: 'message', title: 'New Message', body: content.substring(0, 50) });
    } catch (e) { showToast('Failed to send', 'error'); }
}

function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; document.getElementById('sendBtn').disabled = !el.value.trim(); }

function enterSelectionMode() { isSelectionMode = true; selectedMessages.clear(); document.getElementById('selectionHeader').classList.add('show'); document.getElementById('chatHeader').style.display = 'none'; updateSelectionCount(); renderMessages(); }
function exitSelectionMode() { isSelectionMode = false; selectedMessages.clear(); document.getElementById('selectionHeader').classList.remove('show'); if (currentChatUser) document.getElementById('chatHeader').style.display = 'flex'; renderMessages(); }
function toggleMessageSelect(msgId) { if (selectedMessages.has(msgId)) selectedMessages.delete(msgId); else selectedMessages.add(msgId); updateSelectionCount(); renderMessages(); }
function handleMessageClick(event, msgId) { if (isSelectionMode) { event.stopPropagation(); toggleMessageSelect(msgId); } }
function updateSelectionCount() { document.getElementById('selectionCount').textContent = `${selectedMessages.size} selected`; }

function deleteSelectedMessages() {
    if (selectedMessages.size === 0) { showToast('No messages selected', 'error'); return; }
    document.getElementById('confirmTitle').textContent = 'Delete Messages';
    document.getElementById('confirmMessage').textContent = `Delete ${selectedMessages.size} message(s)?`;
    confirmCallback = async () => { await supabase.from('messages').update({ is_deleted: true }).in('id', Array.from(selectedMessages)).eq('sender_id', currentUser.id); showToast('Messages deleted'); closeConfirmModal(); exitSelectionMode(); await loadMessages(currentConversation); };
    document.getElementById('confirmModal').classList.add('show');
}

function clearConversation() {
    document.getElementById('confirmTitle').textContent = 'Clear Chat';
    document.getElementById('confirmMessage').textContent = 'Clear all messages?';
    confirmCallback = async () => { await supabase.from('messages').update({ is_deleted: true }).or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentConversation}),and(sender_id.eq.${currentConversation},receiver_id.eq.${currentUser.id})`); showToast('Chat cleared'); closeConfirmModal(); closeChatMenu(); await loadMessages(currentConversation); await loadConversations(); };
    document.getElementById('confirmModal').classList.add('show');
}

function deleteConversation() {
    document.getElementById('confirmTitle').textContent = 'Delete Conversation';
    document.getElementById('confirmMessage').textContent = 'Delete entire conversation?';
    confirmCallback = async () => { await supabase.from('messages').delete().or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentConversation}),and(sender_id.eq.${currentConversation},receiver_id.eq.${currentUser.id})`); showToast('Conversation deleted'); closeConfirmModal(); closeChatMenu(); backToConversations(); await loadConversations(); };
    document.getElementById('confirmModal').classList.add('show');
}

function openForwardModal() { if (selectedMessages.size === 0) { showToast('No messages selected', 'error'); return; } forwardToUsers.clear(); renderForwardUserList(); document.getElementById('forwardModal').classList.add('show'); }
function closeForwardModal() { document.getElementById('forwardModal').classList.remove('show'); forwardToUsers.clear(); }
function renderForwardUserList() {
    const container = document.getElementById('forwardUserList');
    if (friends.length === 0) { container.innerHTML = '<p style="text-align:center;color:var(--gray-500);padding:20px;">No friends to forward to</p>'; return; }
    container.innerHTML = friends.filter(f => f.id !== currentConversation).map(f => { const name = f.full_name || `${f.first_name} ${f.last_name}`; const isSelected = forwardToUsers.has(f.id); return `<div class="forward-user-item ${isSelected ? 'selected' : ''}" onclick="toggleForwardUser('${f.id}')"><div class="forward-user-avatar">${f.avatar_url ? `<img src="${f.avatar_url}">` : getInitials(name)}</div><div class="forward-user-name">${escapeHtml(name)}</div><div class="forward-check"></div></div>`; }).join('');
}
function toggleForwardUser(userId) { if (forwardToUsers.has(userId)) forwardToUsers.delete(userId); else forwardToUsers.add(userId); renderForwardUserList(); document.getElementById('forwardBtn').disabled = forwardToUsers.size === 0; }
async function forwardMessages() {
    if (forwardToUsers.size === 0 || selectedMessages.size === 0) return;
    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id)), inserts = [];
    forwardToUsers.forEach(userId => { selectedMsgs.forEach(msg => { inserts.push({ sender_id: currentUser.id, receiver_id: userId, content: `[Forwarded] ${msg.content}`, message_type: 'text' }); }); });
    await supabase.from('messages').insert(inserts);
    showToast(`Forwarded to ${forwardToUsers.size} user(s)`, 'success'); closeForwardModal(); exitSelectionMode(); await loadConversations();
}

function reportSelectedMessages() { if (selectedMessages.size === 0) { showToast('No messages selected', 'error'); return; } document.getElementById('reportReason').value = ''; document.getElementById('reportDescription').value = ''; document.getElementById('reportModal').classList.add('show'); }
function closeReportModal() { document.getElementById('reportModal').classList.remove('show'); }
async function submitReport() {
    const reason = document.getElementById('reportReason').value, description = document.getElementById('reportDescription').value;
    if (!reason) { showToast('Please select a reason', 'error'); return; }
    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id)), messageContent = selectedMsgs.map(m => m.content).join('\n---\n');
    await supabase.from('user_reports').insert({ reporter_id: currentUser.id, reported_id: currentConversation, report_type: 'message', reason, description: `${description}\n\n--- Reported Messages ---\n${messageContent}` });
    showToast('Report submitted', 'success'); closeReportModal(); exitSelectionMode();
}

async function loadNotifications() { const { data } = await supabase.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(10); notifications = data || []; renderNotifications(); }
function renderNotifications() {
    const list = document.getElementById('notifList'), badge = document.getElementById('notifBadge'), unread = notifications.filter(n => !n.is_read).length;
    if (unread > 0) { badge.textContent = unread > 9 ? '9+' : unread; badge.style.display = 'flex'; } else badge.style.display = 'none';
    if (notifications.length === 0) { list.innerHTML = '<div class="notif-empty"><p>No notifications</p></div>'; return; }
    list.innerHTML = notifications.map(n => { const iconClass = n.type.includes('friend') ? 'friend' : 'message'; return `<div class="notif-dropdown-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}','${n.type}')"><div class="notif-icon ${iconClass}"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div><div class="notif-content"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.body || '')}</p><div class="time">${formatTimeAgo(n.created_at)}</div></div></div>`; }).join('');
}
async function handleNotifClick(id, type) { await supabase.from('notifications').update({ is_read: true }).eq('id', id); const n = notifications.find(x => x.id === id); if (n) n.is_read = true; renderNotifications(); if (type === 'friend_request') window.location.href = 'friends.html'; document.getElementById('notificationDropdown').classList.remove('show'); }
async function markAllNotificationsRead() { await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id); notifications.forEach(n => n.is_read = true); renderNotifications(); }

function subscribeToRealtime() {
    supabase.channel('messages-channel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, async (payload) => {
        const msg = payload.new;
        if (currentConversation === msg.sender_id) { messages.push(msg); renderMessages(); await supabase.from('messages').update({ is_read: true }).eq('id', msg.id); }
        await loadConversations();
    }).subscribe();
    supabase.channel('message-reads').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUser.id}` }, (payload) => { const msgIdx = messages.findIndex(m => m.id === payload.new.id); if (msgIdx !== -1) { messages[msgIdx].is_read = payload.new.is_read; renderMessages(); } }).subscribe();
    supabase.channel('online-status-messages').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (currentChatUser && currentChatUser.id === payload.new.id) { currentChatUser.is_online = payload.new.is_online; currentChatUser.last_seen = payload.new.last_seen; const statusEl = document.getElementById('chatUserStatus'); statusEl.textContent = payload.new.is_online ? 'Online' : `Last seen ${formatTimeAgo(payload.new.last_seen)}`; statusEl.className = 'chat-user-status' + (payload.new.is_online ? '' : ' offline'); }
        const conv = conversations.find(c => c.oderId === payload.new.id); if (conv && conv.user) { conv.user.is_online = payload.new.is_online; conv.user.last_seen = payload.new.last_seen; renderConversations(); }
    }).subscribe();
    supabase.channel('notifications-messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => { notifications.unshift(payload.new); renderNotifications(); }).subscribe();
}

function updateUnreadBadge() { const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0); const badge = document.getElementById('sidebarMsgBadge'); if (totalUnread > 0) { badge.textContent = totalUnread > 99 ? '99+' : totalUnread; badge.style.display = 'inline'; } else badge.style.display = 'none'; }
function viewUserProfile() { if (currentChatUser) window.location.href = `profile.html?user=${currentChatUser.id}`; closeChatMenu(); }
function toggleChatMenu(event) { event.stopPropagation(); document.getElementById('chatMenu').classList.toggle('show'); }
function closeChatMenu() { document.getElementById('chatMenu').classList.remove('show'); }
function handleOutsideClick(e) { if (!e.target.closest('.notification-wrapper')) document.getElementById('notificationDropdown').classList.remove('show'); if (!e.target.closest('.chat-header-actions')) closeChatMenu(); }
function closeConfirmModal() { document.getElementById('confirmModal').classList.remove('show'); confirmCallback = null; }
function confirmAction() { if (confirmCallback) confirmCallback(); }
function toggleNotifications(event) { event.stopPropagation(); document.getElementById('notificationDropdown').classList.toggle('show'); }
function getInitials(name) { if (!name) return '??'; return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function truncate(str, len) { if (!str) return ''; return str.length > len ? str.substring(0, len) + '...' : str; }
function formatTimeAgo(dateStr) { const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000); if (seconds < 60) return 'Just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`; return new Date(dateStr).toLocaleDateString(); }
function formatConvTime(dateStr) { const date = new Date(dateStr), now = new Date(), diff = now - date; if (diff < 86400000 && date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' }); return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); }
function formatMessageTime(dateStr) { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formatDateDivider(dateStr) { const date = new Date(dateStr), now = new Date(), yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); if (date.toDateString() === now.toDateString()) return 'Today'; if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'; return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); }
function showToast(msg, type = '') { const t = document.getElementById('toast'); document.getElementById('toastMessage').textContent = msg; t.className = 'toast' + (type ? ` ${type}` : ''); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
async function handleLogout() { await updateOnlineStatus(false); await supabase.auth.signOut(); window.location.href = 'index.html'; }

init();
