// =============================================
// MC COLAB PANEL — console.js (Pterodactyl-style)
// =============================================

let lastLogIndex = 0;
let updateInProgress = false;

// ── Status bar ──────────────────────────────
function setStatus(state, version, type) {
  const dot   = document.getElementById('pteroIndicator');
  const label = document.getElementById('pteroStatusLabel');
  const ver   = document.getElementById('pteroVersion');
  const typ   = document.getElementById('pteroType');
  if (!dot) return;
  dot.className   = 'ptero-indicator ' + state;
  label.className = 'ptero-status-label ' + state;
  if      (state === 'online')   label.textContent = 'Running';
  else if (state === 'starting') label.textContent = 'Starting';
  else                           label.textContent = 'Offline';
  if (ver && version) ver.textContent = 'v' + version;
  if (typ && type)    typ.textContent = type;
}

// ── Placeholder ──────────────────────────────
function setPlaceholder(msg) {
  const el = document.getElementById('console-output');
  if (el.querySelector('.log-entry')) return;
  let ph = el.querySelector('.ptero-placeholder');
  if (!ph) { ph = document.createElement('div'); ph.className = 'ptero-placeholder'; el.appendChild(ph); }
  ph.textContent = msg;
}
function clearPlaceholder() {
  const ph = document.getElementById('console-output').querySelector('.ptero-placeholder');
  if (ph) ph.remove();
}

// ── Log classification ───────────────────────
// Returns CSS class name based on line content
function classifyLine(text) {
  // Errors — highest priority
  if (/SEVERE|FATAL|\[ERROR\]|\/ERROR\]|ERROR:/i.test(text))  return 'log-error';
  if (/Exception|Caused by:|at [a-z][\w.]+\(/i.test(text))   return 'log-error';

  // Warnings
  if (/\[WARN\]|\/WARN\]|WARN:|\bWARN\b/i.test(text))        return 'log-warn';

  // Player events
  if (/joined the game/i.test(text))                          return 'log-join';
  if (/left the game/i.test(text))                            return 'log-leave';

  // Chat — <PlayerName> message
  if (/<[A-Za-z0-9_]{1,16}>/.test(text))                     return 'log-chat';

  // Server lifecycle
  if (/Done \([\d.]+s\)|For help, type/i.test(text))          return 'log-done';
  if (/Starting minecraft server|Starting server/i.test(text))return 'log-done';
  if (/Stopping( the)? server|Saving worlds/i.test(text))     return 'log-warn';

  // Plugin lines — [PluginName] prefix
  if (/\[INFO\].*\[[A-Z][A-Za-z0-9_\-]+\]/.test(text) ||
      /\/INFO\].*\[[A-Z][A-Za-z0-9_\-]+\]/.test(text))       return 'log-plugin';

  return ''; // default grey
}

// ── Clear ────────────────────────────────────
function clearConsole() {
  document.getElementById('console-output').innerHTML = '';
  lastLogIndex = 0;
}

// ── Main poll loop ───────────────────────────
async function updateConsole() {
  if (updateInProgress) return;
  updateInProgress = true;
  try {
    const [logsRes, statsRes] = await Promise.all([
      fetch('/logs-stream?since=' + lastLogIndex),
      fetch('/stats')
    ]);
    if (!logsRes.ok || !statsRes.ok) return;

    const data  = await logsRes.json();
    const stats = await statsRes.json();
    const el    = document.getElementById('console-output');

    const state = stats.starting ? 'starting' : stats.running ? 'online' : '';
    setStatus(state, stats.version, stats.type);

    if (data.new_count > 0) {
      clearPlaceholder();
      const frag = document.createDocumentFragment();
      data.logs.forEach(line => {
        if (!line.trim()) return;
        const div = document.createElement('div');
        const cls = classifyLine(line);
        div.className = 'log-entry' + (cls ? ' ' + cls : '');
        div.textContent = line;
        frag.appendChild(div);
      });
      el.appendChild(frag);
      lastLogIndex = data.total;
      el.scrollTop = el.scrollHeight;
    } else if (!el.querySelector('.log-entry')) {
      if (stats.starting)     setPlaceholder('Server is starting up…');
      else if (stats.running) setPlaceholder('Waiting for server output…');
      else                    setPlaceholder('Server is offline — start the server to stream logs');
    }
  } catch (e) {
    console.error('Console error:', e);
  } finally {
    updateInProgress = false;
  }
}

// ── Send command ─────────────────────────────
function sendCmd() {
  const input = document.getElementById('cmd');
  const cmd   = input.value.trim();
  if (!cmd) return;
  fetch('/cmd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'cmd=' + encodeURIComponent(cmd)
  });
  input.value = '';
  showToast('Command sent: ' + cmd);
}

document.addEventListener('click', e => {
  if (e.target.closest('[onclick*="console"]'))
    setTimeout(() => document.getElementById('cmd')?.focus(), 120);
});

updateConsole();
setInterval(updateConsole, 500);
