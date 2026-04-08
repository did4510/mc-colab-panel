// =============================================
// MC COLAB PANEL — editor.js
// =============================================

let editor, currentFile = '';

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

async function loadFiles() {
  try {
    const files = await fetch('/files_json').then(r => r.json());
    const list = document.getElementById('file-list');

    list.innerHTML = files.map(f => `
      <div class="file-item" onclick="openFile('${f}')">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/>
        </svg>
        ${f}
      </div>
    `).join('');
  } catch (e) {
    console.error('Files error:', e);
  }
}

async function openFile(name) {
  currentFile = name;
  document.getElementById('editorFilename').textContent = name;

  try {
    const content = await fetch('/file?name=' + encodeURIComponent(name)).then(r => r.text());

    const ext = name.split('.').pop().toLowerCase();
    const langMap = {
      js: 'javascript', ts: 'typescript', py: 'python',
      json: 'json', yml: 'yaml', yaml: 'yaml',
      xml: 'xml', html: 'html', css: 'css',
      sh: 'shell', md: 'markdown', txt: 'plaintext',
      properties: 'plaintext', conf: 'plaintext', cfg: 'plaintext',
    };

    const lang = langMap[ext] || 'plaintext';
    if (editor) {
      editor.setValue(content);
      monaco.editor.setModelLanguage(editor.getModel(), lang);
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
