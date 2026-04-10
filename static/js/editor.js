// =============================================
// MC COLAB PANEL — editor.js (ENHANCED)
// File manager with rename, delete, edit, save
// =============================================

let editor, currentFile = '';
let renameTarget = '';

require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '// Open a file from the left panel to start editing',
    language: 'plaintext',
    theme: 'vs-dark',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'line',
    padding: { top: 12, bottom: 12 },
    smoothScrolling: true,
    cursorSmoothCaretAnimation: true,
  });
});

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function fileIcon(name, isDir) {
  if (isDir) return `<svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" fill="rgba(34,211,238,0.15)"/></svg>`;
  const ext = name.split('.').pop().toLowerCase();
  const colors = { json:'#fbbf24', yml:'#fbbf24', yaml:'#fbbf24', properties:'#94a3b8',
    jar:'#f472b6', txt:'#e2e8f0', log:'#94a3b8', sh:'#4ade80', py:'#60a5fa',
    js:'#fbbf24', html:'#fb923c', css:'#818cf8', xml:'#fbbf24', conf:'#94a3b8' };
  const c = colors[ext] || '#64748b';
  return `<svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="${c}" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke="${c}" stroke-width="2"/></svg>`;
}

function isEditable(name) {
  const ext = name.split('.').pop().toLowerCase();
  const editableExts = ['txt','log','json','yml','yaml','properties','conf','cfg','sh','py','js','html','css','xml','md','toml','ini'];
  return editableExts.includes(ext);
}

async function loadFiles() {
  try {
    const files = await fetch('/files_json').then(r => r.json());
    const list  = document.getElementById('file-list');

    if (!files.length) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">No files found</div>';
      return;
    }

    list.innerHTML = files.map(f => `
      <div class="file-item-row ${currentFile === f.name ? 'active' : ''}" id="fi-${CSS.escape(f.name)}">
        <div class="fi-main" onclick="${f.is_dir ? '' : `openFile('${f.name}')`}" style="${f.is_dir ? 'cursor:default;opacity:0.7' : ''}">
          <span class="fi-icon">${fileIcon(f.name, f.is_dir)}</span>
          <span class="fi-name">${f.name}</span>
          <span class="fi-size">${f.is_dir ? 'dir' : formatFileSize(f.size)}</span>
        </div>
        <div class="fi-actions">
          ${!f.is_dir && isEditable(f.name) ? `
          <button class="fi-btn fi-edit" title="Edit" onclick="openFile('${f.name}')">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>` : ''}
          <button class="fi-btn fi-rename" title="Rename" onclick="startRename('${f.name}')">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="fi-btn fi-delete" title="Delete" onclick="deleteFile('${f.name}')">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Files error:', e);
  }
}

async function openFile(name) {
  if (!isEditable(name)) {
    showToast('Cannot edit this file type', 'error');
    return;
  }
  currentFile = name;
  document.getElementById('editorFilename').textContent = name;
  // Highlight active
  document.querySelectorAll('.file-item-row').forEach(r => r.classList.remove('active'));
  const row = document.getElementById('fi-' + CSS.escape(name));
  if (row) row.classList.add('active');

  try {
    const content = await fetch('/file?name=' + encodeURIComponent(name)).then(r => r.text());
    const ext = name.split('.').pop().toLowerCase();
    const langMap = {
      js:'javascript', ts:'typescript', py:'python', json:'json',
      yml:'yaml', yaml:'yaml', xml:'xml', html:'html', css:'css',
      sh:'shell', md:'markdown', txt:'plaintext', properties:'plaintext',
      conf:'plaintext', cfg:'plaintext', toml:'plaintext', ini:'plaintext', log:'plaintext',
    };
    if (editor) {
      editor.setValue(content);
      monaco.editor.setModelLanguage(editor.getModel(), langMap[ext] || 'plaintext');
    }
    showToast('Opened: ' + name);
  } catch (e) {
    showToast('Error opening file', 'error');
  }
}

async function saveFile() {
  if (!currentFile) { showToast('No file open', 'error'); return; }
  try {
    await fetch('/save_file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: currentFile, content: editor.getValue() })
    });
    showToast('Saved: ' + currentFile);
  } catch (e) {
    showToast('Save failed', 'error');
  }
}

async function deleteFile(name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    const res = await fetch('/delete_file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      if (currentFile === name) {
        currentFile = '';
        document.getElementById('editorFilename').textContent = '— no file open —';
        if (editor) editor.setValue('// File deleted');
      }
      showToast('Deleted: ' + name);
      loadFiles();
    } else {
      showToast('Delete failed', 'error');
    }
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

function startRename(name) {
  renameTarget = name;
  const input  = document.getElementById('renameInput');
  input.value  = name;
  document.getElementById('renameModal').classList.add('open');
  setTimeout(() => { input.focus(); input.select(); }, 100);
}

async function confirmRename() {
  const newName = document.getElementById('renameInput').value.trim();
  if (!newName || newName === renameTarget) {
    document.getElementById('renameModal').classList.remove('open');
    return;
  }
  try {
    const res = await fetch('/rename_file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old: renameTarget, new: newName })
    });
    if (res.ok) {
      if (currentFile === renameTarget) {
        currentFile = newName;
        document.getElementById('editorFilename').textContent = newName;
      }
      document.getElementById('renameModal').classList.remove('open');
      showToast('Renamed to: ' + newName);
      loadFiles();
    } else {
      showToast('Rename failed', 'error');
    }
  } catch (e) {
    showToast('Rename failed', 'error');
  }
}

// Close rename modal on overlay click
document.getElementById('renameModal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('open');
});
