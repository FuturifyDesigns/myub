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
})();
