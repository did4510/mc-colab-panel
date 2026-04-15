// =============================================
// MC COLAB PANEL — upload.js
// Drag-and-drop + click-to-upload
// =============================================

function handleDrop(e) {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length) uploadFiles(files);
}

async function uploadFiles(files) {
  const box = document.getElementById('upload-box');
  box.style.borderColor = 'var(--accent)';
  box.style.background  = 'rgba(34,211,238,0.06)';

  let successCount = 0;
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('path', currentPath); // Send the current directory path
    try {
      await fetch('/upload', { method: 'POST', body: fd });
      successCount++;
    } catch (e) {
      showToast('Upload failed: ' + file.name, 'error');
    }
  }

  box.style.borderColor = '';
  box.style.background  = '';

  if (successCount > 0) {
    showToast(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
    loadFiles();
  }
}

// Click to upload
document.getElementById('upload-box').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = e => uploadFiles(e.target.files);
  input.click();
});
