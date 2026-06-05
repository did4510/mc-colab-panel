// =============================================
// MC COLAB PANEL — console.js
// =============================================

let lastLogIndex = 0;
let updateInProgress = false;
let serverWasOnline = false;

function clearConsole() {
  document.getElementById('console-output').innerHTML = '';
  lastLogIndex = 0;
}

function setPlaceholder(msg, color) {
  const el = document.getElementById('console-output');
  // Only show placeholder when truly empty
  if (el.querySelector('.log-entry')) return;
  let ph = el.querySelector('.console-placeholder');
  if (!ph) {
    ph = document.createElement('div');
    ph.className = 'console-placeholder';
    ph.style.cssText = 'padding:1.5rem;opacity:0.45;font-style:italic;font-size:0.85rem;';
    el.appendChild(ph);
  }
  ph.textContent = msg;
  ph.style.color = color || 'var(--muted)';
}

function clearPlaceholder() {
  const ph = document.querySelector('.console-placeholder');
  if (ph) ph.remove();
}

async function updateConsole() {
  if (updateInProgress) return;
  updateInProgress = true;

  try {
    // Fetch both logs and server status in parallel
    const [logsRes, statsRes] = await Promise.all([
      fetch(`/logs-stream?since=${lastLogIndex}`),
      fetch('/stats')
    ]);

    const data = await logsRes.json();
    const stats = await statsRes.json();
    const el = document.getElementById('console-output');
    const isOnline = stats.running || stats.starting;

    if (data.new_count > 0) {
      clearPlaceholder();
      data.logs.forEach(htmlLine => {
        if (!htmlLine.trim()) return;
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = htmlLine;
        el.appendChild(logEntry);
      });
      lastLogIndex = data.total;
      el.scrollTop = el.scrollHeight;
      serverWasOnline = true;
    } else if (data.total === 0 && !isOnline) {
      // Never had logs and server is off
      setPlaceholder('Server is offline. Start the server to see live logs.', 'var(--red)');
    } else if (data.total === 0 && stats.starting) {
      setPlaceholder('Server is starting up… logs will appear shortly.', 'var(--yellow)');
    } else if (isOnline && data.total === 0) {
      setPlaceholder('Waiting for server output…', 'var(--muted)');
    }

  } catch (e) {
    console.error('Console update error:', e);
  } finally {
    updateInProgress = false;
  }
}

function sendCmd() {
  const input = document.getElementById('cmd');
  const cmd = input.value.trim();
  if (!cmd) return;

  fetch('/cmd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'cmd=' + encodeURIComponent(cmd)
  });

  input.value = '';
  showToast('Command sent: ' + cmd);
}

// Show placeholder immediately on load
document.addEventListener('DOMContentLoaded', () => {
  setPlaceholder('Connecting…', 'var(--muted)');
});

setInterval(updateConsole, 500);
updateConsole();
