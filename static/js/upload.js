// =============================================
// 🚀 UPDATED PANEL LOGIC (WITH ANIMATION)
// =============================================

let dots = 0

async function startServer() {
  document.getElementById('startBtn').disabled = true;
  await fetch('/start');
  showToast('Server starting...', 'start');
  setTimeout(() => document.getElementById('startBtn').disabled = false, 3000);
}

async function stopServer() {
  document.getElementById('stopBtn').disabled = true;
  await fetch('/stop');
  showToast('Server stopping...', 'stop');
  setTimeout(() => document.getElementById('stopBtn').disabled = false, 3000);
}

async function updateStats() {
  try {
    const s = await fetch('/stats').then(r => r.json());

    // =========================
    // 🎯 STATUS LOGIC (UPDATED)
    // =========================
    let statusText = "Offline"
    let online = false

    if (s.starting) {
      dots = (dots + 1) % 4
      statusText = "Starting" + ".".repeat(dots)
    } 
    else if (s.running) {
      statusText = "Online"
      online = true
    }

    // Badge
    const dot = document.getElementById('badgeDot');
    const badgeStatus = document.getElementById('badgeStatus');

    if (online) {
      dot.classList.add('online');
      badgeStatus.textContent = 'Online';
    } else if (s.starting) {
      dot.classList.remove('online');
      badgeStatus.textContent = statusText;
    } else {
      dot.classList.remove('online');
      badgeStatus.textContent = 'Offline';
    }

    // Status bar
    document.getElementById('statusValue').textContent = statusText;
    document.getElementById('statusFill').style.width = online ? '100%' : '20%';
    document.getElementById('statusFill').style.background =
      online ? 'var(--green)' : s.starting ? 'var(--yellow)' : 'var(--red)';

    // =========================
    // 🌐 IP (FIXED)
    // =========================
    document.getElementById('ipValue').textContent = s.ip || 'Loading...';

    // =========================
    // RAM
    // =========================
    const ram = s.ram?.length ? s.ram[s.ram.length - 1] : 0;
    document.getElementById('ramValue').textContent = ram.toFixed(2) + ' GB';
    document.getElementById('ramFill').style.width = Math.min((ram / 8) * 100, 100) + '%';

    // =========================
    // TPS
    // =========================
    const tps = s.tps?.length ? s.tps[s.tps.length - 1] : 20;
    document.getElementById('tpsValue').textContent = tps.toFixed(1);
    document.getElementById('tpsFill').style.width = Math.min((tps / 20) * 100, 100) + '%';

  } catch (e) {
    console.error('Stats error:', e);
  }
}

setInterval(updateStats, 2000);
updateStats();