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

  async function pickAndUpload(opts) {
    const file = await pickFile();
    const title = opts.title || prompt('Title for this upload:', file.name.replace(/\.[^.]+$/, ''));
    if (!title) throw new Error('cancelled');
    return uploadFile({ ...opts, file, title });
  }

  async function reportNote(noteId, reason) {
    const { error } = await supabaseClient
      .from('note_file_reports')
      .insert({ note_file_id: noteId, reporter_id: currentUser.id, reason });
    if (error) throw error;
  }

  // Public download URL — assumes R2 bucket is fronted by a public custom domain
  // (e.g. files.myub.app). Configure in Cloudflare R2 settings.
  function publicUrl(r2Key) {
    return `https://files.myub.online/${r2Key}`;
  }

  window.MyUBUpload = { pickAndUpload, uploadFile, reportNote, publicUrl, MAX_BYTES, ALLOWED };
})();
