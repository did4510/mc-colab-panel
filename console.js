// =============================================
// MC COLAB PANEL — console.js
// =============================================

async function updateConsole() {
  try {
    const html = await fetch('/logs').then(r => r.text());
    const el = document.getElementById('console-output');
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  } catch (e) {
    console.error('Console error:', e);
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

setInterval(updateConsole, 1200);
