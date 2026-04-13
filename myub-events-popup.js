/*!
 * MyUB Events Popup — shared across all pages
 * ------------------------------------------
 * Shows a popup for approved upcoming events the user hasn't seen yet.
 * Requirements on host page:
 *   - window.supabaseClient must exist (or will be waited for)
 *   - User must be logged in
 * localStorage keys used:
 *   myub_events_popup_seen   -> JSON array of event IDs the user has dismissed
 *   myub_events_popup_off    -> '1' if user clicked "Don't show again"
 * Drop-in:  <script src="myub-events-popup.js" defer></script>
 */
(function(){
    if (window.__myubEventsPopupLoaded) return;
    window.__myubEventsPopupLoaded = true;

    const SEEN_KEY = 'myub_events_popup_seen';
    const OFF_KEY  = 'myub_events_popup_off';
    const R2_BASE  = 'https://files.myub.online/';

    const CAT_ICON = {
        academic: 'graduation-cap',
        social:   'party-popper',
        sports:   'trophy',
        club:     'users',
        cultural: 'globe',
        other:    'sparkles'
    };
    const CAT_COLOR = {
        academic: '#3b82f6',
        social:   '#ec4899',
        sports:   '#10b981',
        club:     '#8b5cf6',
        cultural: '#f97316',
        other:    '#06b6d4'
    };

    function esc(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function getSeen(){ try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch(_){ return new Set(); } }
    function addSeen(id){ try { const s = getSeen(); s.add(id); localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200))); } catch(_){} }
    function isOff(){ try { return localStorage.getItem(OFF_KEY) === '1'; } catch(_) { return false; } }
    function turnOff(){ try { localStorage.setItem(OFF_KEY, '1'); } catch(_){} }

    function fmtDateLabel(startsAt){
        const d = new Date(startsAt);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const tmr = new Date(now); tmr.setDate(tmr.getDate()+1);
        const isTmr = d.toDateString() === tmr.toDateString();
        const time = d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
        if (sameDay) return `Today, ${time}`;
        if (isTmr) return `Tomorrow, ${time}`;
        const diffDays = Math.round((d - now) / 86400000);
        if (diffDays < 7 && diffDays > 0) return `${d.toLocaleDateString([], { weekday:'long' })}, ${time}`;
        return `${d.toLocaleDateString([], { month:'short', day:'numeric' })}, ${time}`;
    }

    function ensureLucide(){
        if (window.lucide) return Promise.resolve();
        return new Promise(resolve => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
            s.onload = resolve;
            s.onerror = resolve;
            document.head.appendChild(s);
        });
    }

    function injectStyles(){
        if (document.getElementById('myub-events-popup-styles')) return;
        const css = `
        .mup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 99998; display: none; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(6px); animation: mupFade .25s ease-out; }
        .mup-overlay.visible { display: flex; }
        .mup-modal { background: #1a1d2e; color: #e5e7eb; border: 1px solid rgba(255,255,255,.08); border-radius: 16px; max-width: 480px; width: 100%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(0,0,0,.5); animation: mupSlide .3s cubic-bezier(.16,1,.3,1); }
        @keyframes mupFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mupSlide { from { opacity: 0; transform: translateY(24px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .mup-cover { position: relative; width: 100%; aspect-ratio: 16/9; background: linear-gradient(135deg, #1e293b, #0f172a); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .mup-cover img { width: 100%; height: 100%; object-fit: cover; }
        .mup-cover-fallback { display: flex; align-items: center; justify-content: center; width: 84px; height: 84px; border-radius: 20px; }
        .mup-cover-fallback svg { width: 48px; height: 48px; color: #fff; }
        .mup-cat-badge { position: absolute; top: 12px; left: 12px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #fff; }
        .mup-close { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; line-height: 1; }
        .mup-close:hover { background: rgba(0,0,0,.8); }
        .mup-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .mup-nav:hover:not(:disabled) { background: rgba(0,0,0,.8); }
        .mup-nav:disabled { opacity: .25; cursor: not-allowed; }
        .mup-prev { left: 12px; } .mup-next { right: 12px; }
        .mup-nav svg { width: 20px; height: 20px; }
        .mup-body { padding: 20px 22px 16px; overflow-y: auto; }
        .mup-title { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 8px; line-height: 1.25; }
        .mup-meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; color: #9ca3af; font-size: 13px; }
        .mup-meta-row { display: flex; align-items: center; gap: 8px; }
        .mup-meta-row svg { width: 14px; height: 14px; flex-shrink: 0; color: #6b7280; }
        .mup-desc { color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .mup-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 0 22px 14px; }
        .mup-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: #e5e7eb; font-weight: 600; font-size: 13px; cursor: pointer; transition: all .15s; }
        .mup-btn:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.22); }
        .mup-btn svg { width: 15px; height: 15px; }
        .mup-btn-going { background: rgba(16,185,129,.15); border-color: rgba(16,185,129,.4); color: #6ee7b7; }
        .mup-btn-going:hover { background: rgba(16,185,129,.25); }
        .mup-btn-going.active { background: #10b981; color: #fff; }
        .mup-btn-not { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.3); color: #fca5a5; }
        .mup-btn-not:hover { background: rgba(239,68,68,.18); }
        .mup-btn-not.active { background: #ef4444; color: #fff; }
        .mup-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 22px 16px; border-top: 1px solid rgba(255,255,255,.06); color: #6b7280; font-size: 12px; }
        .mup-dotdots { display: flex; gap: 5px; }
        .mup-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.15); }
        .mup-dot.active { background: #6366f1; }
        .mup-dismiss { color: #6b7280; background: transparent; border: none; cursor: pointer; font-size: 12px; text-decoration: underline; }
        .mup-dismiss:hover { color: #9ca3af; }
        @media (max-width: 500px) { .mup-actions { grid-template-columns: 1fr 1fr; } .mup-actions .mup-btn-view { grid-column: span 2; } }
        `;
        const style = document.createElement('style');
        style.id = 'myub-events-popup-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildModal(){
        const overlay = document.createElement('div');
        overlay.className = 'mup-overlay';
        overlay.id = 'mupOverlay';
        overlay.innerHTML = `
            <div class="mup-modal" role="dialog" aria-modal="true" aria-labelledby="mupTitle">
                <div class="mup-cover" id="mupCover"></div>
                <div class="mup-body">
                    <h3 class="mup-title" id="mupTitle">—</h3>
                    <div class="mup-meta" id="mupMeta"></div>
                    <div class="mup-desc" id="mupDesc"></div>
                </div>
                <div class="mup-actions">
                    <button class="mup-btn mup-btn-going" id="mupGoing" type="button">
                        <i data-lucide="check"></i> Going
                    </button>
                    <button class="mup-btn mup-btn-not" id="mupNot" type="button">
                        <i data-lucide="x"></i> Not Going
                    </button>
                    <button class="mup-btn mup-btn-view" id="mupView" type="button">
                        <i data-lucide="arrow-right"></i> Details
                    </button>
                </div>
                <div class="mup-footer">
                    <div class="mup-dotdots" id="mupDots"></div>
                    <button class="mup-dismiss" id="mupDismiss" type="button">Don't show again</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    let state = { events: [], index: 0, overlay: null, userId: null, rsvps: {} };

    function render(){
        const ev = state.events[state.index];
        if (!ev) return;
        const cover = document.getElementById('mupCover');
        const coverUrl = ev.cover_r2_key ? (R2_BASE + ev.cover_r2_key) : null;
        const color = CAT_COLOR[ev.category] || CAT_COLOR.other;
        const icon = CAT_ICON[ev.category] || CAT_ICON.other;
        const fallbackHtml = `<div class="mup-cover-fallback" style="background:${color}"><i data-lucide="${icon}"></i></div>`;
        cover.innerHTML = `
            ${coverUrl
                ? `<img id="mupCoverImg" src="${esc(coverUrl)}" alt="">`
                : fallbackHtml
            }
            <span class="mup-cat-badge" style="background:${color}">${esc(ev.category)}</span>
            <button class="mup-close" id="mupClose" aria-label="Close" type="button">×</button>
            ${state.events.length > 1 ? `
                <button class="mup-nav mup-prev" id="mupPrev" aria-label="Previous" type="button" ${state.index===0?'disabled':''}>
                    <i data-lucide="chevron-left"></i>
                </button>
                <button class="mup-nav mup-next" id="mupNext" aria-label="Next" type="button" ${state.index===state.events.length-1?'disabled':''}>
                    <i data-lucide="chevron-right"></i>
                </button>
            ` : ''}
        `;
        document.getElementById('mupTitle').textContent = ev.title;
        document.getElementById('mupMeta').innerHTML = `
            <div class="mup-meta-row"><i data-lucide="calendar"></i> ${esc(fmtDateLabel(ev.starts_at))}</div>
            ${ev.location ? `<div class="mup-meta-row"><i data-lucide="map-pin"></i> ${esc(ev.location)}</div>` : ''}
        `;
        document.getElementById('mupDesc').innerHTML = ev.description ? esc(ev.description) : '<em style="color:#6b7280">No description provided.</em>';

        const myStatus = state.rsvps[ev.id];
        document.getElementById('mupGoing').classList.toggle('active', myStatus === 'going');
        document.getElementById('mupNot').classList.toggle('active', myStatus === 'not_going');

        const dots = document.getElementById('mupDots');
        if (state.events.length > 1){
            dots.innerHTML = state.events.map((_, i) => `<div class="mup-dot ${i===state.index?'active':''}"></div>`).join('');
        } else {
            dots.innerHTML = '';
        }

        if (window.lucide) lucide.createIcons();

        // Wire cover image fallback on error (cleaner than inline onerror)
        const coverImg = document.getElementById('mupCoverImg');
        if (coverImg){
            coverImg.addEventListener('error', () => {
                coverImg.outerHTML = fallbackHtml;
                if (window.lucide) lucide.createIcons();
            });
        }

        document.getElementById('mupClose').onclick = closePopup;
        document.getElementById('mupView').onclick = () => {
            addSeen(ev.id);
            window.location.href = 'events.html#' + ev.id;
        };
        document.getElementById('mupGoing').onclick = () => setRsvp(ev, 'going');
        document.getElementById('mupNot').onclick = () => setRsvp(ev, 'not_going');
        if (state.events.length > 1){
            document.getElementById('mupPrev').onclick = () => { if (state.index>0){ addSeen(state.events[state.index].id); state.index--; render(); } };
            document.getElementById('mupNext').onclick = () => { if (state.index<state.events.length-1){ addSeen(state.events[state.index].id); state.index++; render(); } };
        }
    }

    async function setRsvp(ev, status){
        if (!state.userId) return;
        try {
            const { error } = await supabaseClient.from('event_rsvps').upsert({
                event_id: ev.id,
                user_id: state.userId,
                status: status
            }, { onConflict: 'event_id,user_id' });
            if (!error){
                state.rsvps[ev.id] = status;
                render();
                setTimeout(() => {
                    addSeen(ev.id);
                    if (state.index < state.events.length - 1){
                        state.index++;
                        render();
                    } else {
                        closePopup();
                    }
                }, 600);
            }
        } catch(_){}
    }

    function closePopup(){
        const ev = state.events[state.index];
        if (ev) addSeen(ev.id);
        if (state.overlay) state.overlay.classList.remove('visible');
    }

    async function start(){
        if (isOff()) return;

        let client = null, session = null;
        for (let i = 0; i < 40; i++){
            if (window.supabaseClient){
                try {
                    const { data } = await window.supabaseClient.auth.getSession();
                    if (data && data.session && data.session.user){
                        client = window.supabaseClient;
                        session = data.session;
                        break;
                    }
                } catch(_){}
            }
            await new Promise(r => setTimeout(r, 500));
        }
        if (!client || !session) return;
        state.userId = session.user.id;

        const now = new Date().toISOString();
        const { data: events, error } = await client
            .from('events')
            .select('id,title,description,category,starts_at,location,cover_r2_key')
            .eq('status', 'approved')
            .gte('starts_at', now)
            .order('starts_at')
            .limit(10);
        if (error || !events || !events.length) return;

        const seen = getSeen();
        const fresh = events.filter(e => !seen.has(e.id));
        if (!fresh.length) return;

        state.events = fresh;

        try {
            const ids = fresh.map(e => e.id);
            const { data: rsvps } = await client
                .from('event_rsvps')
                .select('event_id,status')
                .eq('user_id', state.userId)
                .in('event_id', ids);
            if (rsvps) for (const r of rsvps) state.rsvps[r.event_id] = r.status;
        } catch(_){}

        injectStyles();
        await ensureLucide();
        state.overlay = document.getElementById('mupOverlay') || buildModal();

        document.getElementById('mupDismiss').onclick = () => {
            if (confirm("Hide event popups permanently? You can still view events from the Events page.")) {
                turnOff();
                closePopup();
            }
        };
        state.overlay.addEventListener('click', (e) => { if (e.target === state.overlay) closePopup(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.overlay.classList.contains('visible')) closePopup(); });

        render();
        state.overlay.classList.add('visible');
    }

    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
