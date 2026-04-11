// MyUB — Notes upload module
// Drop into notes.html (or past-papers.html). Requires `supabaseClient` and `currentUser` in scope.
// Usage: window.MyUBUpload.pickAndUpload({ kind: 'note', courseCode: 'CSI201' }).then(row => ...)

(function () {
  const WORKER_URL = 'https://myub-uploads.futurifydesigns.workers.dev';
  const ALLOWED = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  const MAX_BYTES = 10 * 1024 * 1024;

  function pickFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = Object.values(ALLOWED).join(',');
      input.onchange = () => input.files[0] ? resolve(input.files[0]) : reject(new Error('no file'));
      input.click();
    });
  }

  async function uploadFile({ file, kind, title, description, courseCode }) {
    if (!ALLOWED[file.type]) throw new Error('Unsupported file type. Use PDF, JPG, PNG, or DOCX.');
    if (file.size > MAX_BYTES) throw new Error(`File too large. Max ${MAX_BYTES / 1024 / 1024} MB.`);
    if (!title || title.length > 200) throw new Error('Title required (max 200 chars).');

    // 1. Quota precheck
    const { data: profile, error: pErr } = await supabaseClient
      .from('profiles')
      .select('storage_used_bytes, storage_quota_bytes')
      .eq('id', currentUser.id)
      .single();
    if (pErr) throw pErr;
    if (profile.storage_used_bytes + file.size > profile.storage_quota_bytes) {
      throw new Error('Storage quota exceeded. Delete old uploads to free space.');
    }

    // 2. Get presigned URL from worker
    const { data: { session } } = await supabaseClient.auth.getSession();
    const presignRes = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        kind,
      }),
    });
    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to get upload URL');
    }
    const { uploadUrl, key } = await presignRes.json();

    // 3. Upload bytes directly to R2
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error(`R2 upload failed (${putRes.status})`);

    // 4. Insert metadata row (trigger enforces quota server-side too)
    const { data: row, error: insErr } = await supabaseClient
      .from('note_files')
      .insert({
        uploader_id: currentUser.id,
        title,
        description: description || null,
        course_code: courseCode || null,
        kind,
        r2_key: key,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();
    if (insErr) {
      // Best-effort: row insert failed, but the file is in R2. Weekly cleanup job will sweep it.
      throw new Error(`Upload saved but metadata failed: ${insErr.message}`);
    }
    return row;
  }

  // Must be called synchronously from a click handler — no awaits before this!
  function openPicker(opts) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = Object.values(ALLOWED).join(',');
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return reject(new Error('no file'));
        try {
          // If caller provided an afterPick hook, run it now (file pick is a fresh user activation,
          // so prompts/dialogs are allowed here). It can return extra fields or false to cancel.
          let extra = {};
          if (typeof opts.afterPick === 'function') {
            const r = await opts.afterPick(file);
            if (r === false) return reject(new Error('cancelled'));
            if (r && typeof r === 'object') extra = r;
          }
          const merged = { ...opts, ...extra };
          const title = merged.title || prompt('Title for this upload:', file.name.replace(/\.[^.]+$/, ''));
          if (!title) return reject(new Error('cancelled'));
          const row = await uploadFile({ ...merged, file, title });
          resolve(row);
        } catch (e) { reject(e); }
      };
      input.click();
    });
  }
  // Back-compat alias
  const pickAndUpload = openPicker;

  async function reportNote(noteId, reason) {
    const { error } = await supabaseClient
      .from('note_file_reports')
      .insert({ note_file_id: noteId, reporter_id: currentUser.id, reason });
    if (error) throw error;
  }

  // Hard delete: removes the R2 object AND the DB row. Used for personal notes
  // and for admin "permanently delete" actions. Calls the worker DELETE endpoint
  // because browsers can't delete from R2 directly.
  async function hardDelete(noteFileId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(`${WORKER_URL}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ noteFileId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (${res.status})`);
    }
    return true;
  }

  // Soft delete: marks status as 'pending_review' so the row leaves the public
  // feed but the file stays in R2 and the row stays in DB for admin review.
  // RLS only lets the uploader run this on their own rows.
  async function softDelete(noteFileId) {
    const { error } = await supabaseClient
      .from('note_files')
      .update({
        status: 'pending_review',
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser.id,
      })
      .eq('id', noteFileId)
      .eq('uploader_id', currentUser.id);
    if (error) throw error;
    return true;
  }

  // Admin only: restore a soft-deleted row back to active.
  async function adminRestore(noteFileId) {
    const { error } = await supabaseClient
      .from('note_files')
      .update({ status: 'active', deleted_at: null, deleted_by: null })
      .eq('id', noteFileId);
    if (error) throw error;
    return true;
  }

  // Public download URL — assumes R2 bucket is fronted by a public custom domain
  // (e.g. files.myub.app). Configure in Cloudflare R2 settings.
  function publicUrl(r2Key) {
    return `https://files.myub.online/${r2Key}`;
  }

  window.MyUBUpload = { pickAndUpload, uploadFile, reportNote, hardDelete, softDelete, adminRestore, publicUrl, MAX_BYTES, ALLOWED };

  // ==========================================================================
  // MyUBModals — themed in-app dialogs (replaces native prompt/confirm/alert)
  // and an inline file viewer for PDFs and images.
  // Lazily injects its own DOM + CSS on first use, so no HTML changes needed.
  // ==========================================================================
  const MODAL_CSS = `
  .myub-modal-backdrop{position:fixed;inset:0;background:rgba(5,15,28,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;transition:opacity .2s ease;padding:20px;}
  .myub-modal-backdrop.show{opacity:1;}
  .myub-modal{background:linear-gradient(180deg,rgba(26,54,93,.95),rgba(15,39,68,.98));border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.04) inset;color:#fff;width:100%;max-width:440px;padding:24px;transform:translateY(8px) scale(.98);transition:transform .25s cubic-bezier(.19,1,.22,1);font-family:inherit;}
  .myub-modal-backdrop.show .myub-modal{transform:translateY(0) scale(1);}
  .myub-modal h3{margin:0 0 6px;font-size:18px;font-weight:600;color:#fff;}
  .myub-modal p{margin:0 0 16px;font-size:14px;color:rgba(255,255,255,.72);line-height:1.5;}
  .myub-modal input[type="text"]{width:100%;padding:11px 14px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;}
  .myub-modal input[type="text"]:focus{border-color:#e63956;box-shadow:0 0 0 3px rgba(230,57,86,.18);}
  .myub-modal-actions{display:flex;gap:10px;margin-top:18px;justify-content:flex-end;}
  .myub-btn{padding:9px 18px;border-radius:9px;font-size:14px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:transform .1s,background .15s,border-color .15s;font-family:inherit;}
  .myub-btn:active{transform:scale(.97);}
  .myub-btn-cancel{background:transparent;color:rgba(255,255,255,.72);border-color:rgba(255,255,255,.14);}
  .myub-btn-cancel:hover{background:rgba(255,255,255,.06);color:#fff;}
  .myub-btn-primary{background:#c41e3a;color:#fff;border-color:#c41e3a;}
  .myub-btn-primary:hover{background:#e63956;border-color:#e63956;}
  .myub-btn-danger{background:#9a1730;color:#fff;border-color:#9a1730;}
  .myub-btn-danger:hover{background:#c41e3a;border-color:#c41e3a;}
  .myub-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:linear-gradient(180deg,rgba(26,54,93,.98),rgba(15,39,68,.98));color:#fff;padding:12px 20px;border-radius:10px;border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.4);font-size:14px;z-index:100000;opacity:0;transition:opacity .25s,transform .25s cubic-bezier(.19,1,.22,1);max-width:90vw;}
  .myub-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
  .myub-toast.success{border-color:rgba(74,222,128,.5);}
  .myub-toast.error{border-color:rgba(230,57,86,.6);}
  .myub-viewer{background:#050f1c;border:1px solid rgba(255,255,255,.14);border-radius:16px;width:100%;max-width:1100px;height:88vh;display:flex;flex-direction:column;overflow:hidden;color:#fff;}
  .myub-viewer-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.09);gap:12px;flex-shrink:0;}
  .myub-viewer-title{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
  .myub-viewer-meta{font-size:12px;color:rgba(255,255,255,.5);font-weight:400;margin-top:2px;}
  .myub-viewer-body{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;background:#050f1c;min-height:0;}
  .myub-viewer-body iframe{width:100%;height:100%;border:0;background:#fff;}
  .myub-viewer-body img{max-width:100%;max-height:100%;object-fit:contain;}
  .myub-viewer-body .myub-noprev{padding:40px;text-align:center;color:rgba(255,255,255,.6);}
  .myub-viewer-body .myub-noprev svg{width:48px;height:48px;margin-bottom:12px;opacity:.5;}
  `;
  let modalStylesInjected = false;
  function ensureModalStyles() {
    if (modalStylesInjected) return;
    const s = document.createElement('style');
    s.textContent = MODAL_CSS;
    document.head.appendChild(s);
    modalStylesInjected = true;
  }
  function buildModal(innerHTML) {
    ensureModalStyles();
    const backdrop = document.createElement('div');
    backdrop.className = 'myub-modal-backdrop';
    backdrop.innerHTML = `<div class="myub-modal">${innerHTML}</div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));
    return backdrop;
  }
  function closeModal(backdrop) {
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 200);
  }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function modalAlert({ title = 'Notice', message = '', okLabel = 'OK' } = {}) {
    return new Promise(resolve => {
      const m = buildModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="myub-modal-actions"><button class="myub-btn myub-btn-primary" data-ok>${esc(okLabel)}</button></div>`);
      const done = () => { closeModal(m); resolve(); };
      m.querySelector('[data-ok]').addEventListener('click', done);
      m.addEventListener('click', e => { if (e.target === m) done(); });
    });
  }
  function modalConfirm({ title = 'Are you sure?', message = '', okLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
    return new Promise(resolve => {
      const okClass = danger ? 'myub-btn-danger' : 'myub-btn-primary';
      const m = buildModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="myub-modal-actions"><button class="myub-btn myub-btn-cancel" data-cancel>${esc(cancelLabel)}</button><button class="myub-btn ${okClass}" data-ok>${esc(okLabel)}</button></div>`);
      const finish = (val) => { closeModal(m); resolve(val); };
      m.querySelector('[data-ok]').addEventListener('click', () => finish(true));
      m.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
      m.addEventListener('click', e => { if (e.target === m) finish(false); });
    });
  }
  function modalPrompt({ title = 'Enter a value', message = '', placeholder = '', defaultValue = '', okLabel = 'OK', cancelLabel = 'Cancel', required = false } = {}) {
    return new Promise(resolve => {
      const m = buildModal(`<h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ''}<input type="text" placeholder="${esc(placeholder)}" value="${esc(defaultValue)}"><div class="myub-modal-actions"><button class="myub-btn myub-btn-cancel" data-cancel>${esc(cancelLabel)}</button><button class="myub-btn myub-btn-primary" data-ok>${esc(okLabel)}</button></div>`);
      const input = m.querySelector('input');
      setTimeout(() => { input.focus(); input.select(); }, 50);
      const finish = (val) => { closeModal(m); resolve(val); };
      const submit = () => {
        const v = input.value.trim();
        if (required && !v) { input.style.borderColor = '#e63956'; input.focus(); return; }
        finish(v);
      };
      m.querySelector('[data-ok]').addEventListener('click', submit);
      m.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      });
      m.addEventListener('click', e => { if (e.target === m) finish(null); });
    });
  }
  function modalToast(message, type = 'info', ms = 2600) {
    ensureModalStyles();
    const t = document.createElement('div');
    t.className = `myub-toast ${type}`;
    t.textContent = message;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
  }
  // Inline file viewer. Accepts a file row from note_files (or any object with
  // r2_key, mime_type, title, file_size). PDFs render in an <iframe>, images in
  // an <img>, everything else falls back to a Download CTA.
  function modalViewer(file) {
    ensureModalStyles();
    const url = publicUrl(file.r2_key);
    const sizeKb = file.file_size ? `${(file.file_size/1024).toFixed(0)} KB` : '';
    let bodyHTML;
    if (file.mime_type === 'application/pdf') {
      bodyHTML = `<iframe src="${esc(url)}#toolbar=1" title="${esc(file.title)}"></iframe>`;
    } else if (file.mime_type && file.mime_type.startsWith('image/')) {
      bodyHTML = `<img src="${esc(url)}" alt="${esc(file.title)}">`;
    } else {
      bodyHTML = `<div class="myub-noprev"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><div>This file type can't be previewed in the browser.</div><a href="${esc(url)}" target="_blank" rel="noopener" class="myub-btn myub-btn-primary" style="display:inline-block;text-decoration:none;margin-top:14px;">Download to view</a></div>`;
    }
    const backdrop = document.createElement('div');
    backdrop.className = 'myub-modal-backdrop';
    backdrop.innerHTML = `
      <div class="myub-viewer">
        <div class="myub-viewer-header">
          <div style="flex:1;min-width:0;">
            <div class="myub-viewer-title">${esc(file.title)}</div>
            <div class="myub-viewer-meta">${esc(sizeKb)}${file.course_code ? ' · ' + esc(file.course_code) : ''}</div>
          </div>
          <a href="${esc(url)}" target="_blank" rel="noopener" class="myub-btn myub-btn-cancel" style="text-decoration:none;">Open in new tab</a>
          <button class="myub-btn myub-btn-cancel" data-close>Close</button>
        </div>
        <div class="myub-viewer-body">${bodyHTML}</div>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));
    const close = () => closeModal(backdrop);
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function onEsc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onEsc); } });
  }
  window.MyUBModals = { alert: modalAlert, confirm: modalConfirm, prompt: modalPrompt, toast: modalToast, viewer: modalViewer };
})();
