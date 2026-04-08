// =============================================
// MC COLAB PANEL — upload.js
// =============================================

async function handleDrop(e) {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (!files.length) return;

  const zone = document.getElementById('upload-box');
  zone.style.borderColor = 'var(--accent)';

  for (const file of files) {
    const form = new FormData();
    form.append('file', file);

    try {
      await fetch('/upload', { method: 'POST', body: form });
      showToast('Uploaded: ' + file.name);
    } catch (err) {
      showToast('Upload failed: ' + file.name, 'error');
    }
  }

  zone.style.borderColor = '';
  loadFiles();
}
