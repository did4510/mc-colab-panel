// =============================================
// MC COLAB PANEL — app.js
// =============================================

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

    // IP
    document.getElementById('ipValue').textContent = s.ip || 'N/A';

    // Status
    const online = s.running;
    document.getElementById('statusValue').textContent = online ? 'Online' : 'Offline';
    document.getElementById('statusFill').style.width = online ? '100%' : '0%';
    document.getElementById('statusFill').style.background = online ? 'var(--green)' : 'var(--red)';

    // Badge
    const dot = document.getElementById('badgeDot');
    const badgeStatus = document.getElementById('badgeStatus');
    if (online) {
      dot.classList.add('online');
      badgeStatus.textContent = 'Online';
    } else {
      dot.classList.remove('online');
      badgeStatus.textContent = 'Offline';
    }

    // RAM
    const ram = s.ram && s.ram.length ? s.ram[s.ram.length - 1] : 0;
    document.getElementById('ramValue').textContent = ram.toFixed(2) + ' GB';
    const ramPct = Math.min((ram / 8) * 100, 100);
    document.getElementById('ramFill').style.width = ramPct + '%';

    // TPS
    const tps = s.tps && s.tps.length ? s.tps[s.tps.length - 1] : 20;
    document.getElementById('tpsValue').textContent = tps.toFixed(1);
    const tpsPct = Math.min((tps / 20) * 100, 100);
    document.getElementById('tpsFill').style.width = tpsPct + '%';
    document.getElementById('tpsFill').style.background = tps >= 18 ? 'var(--green)' : tps >= 15 ? 'var(--yellow)' : 'var(--red)';

  } catch (e) {
    console.error('Stats error:', e);
  }
}

async function updatePlayers() {
  try {
    const players = await fetch('/players').then(r => r.json());
    const list = document.getElementById('player-list');
    const empty = document.getElementById('playersEmpty');
    const counter = document.getElementById('onlineCount');
    const statCount = document.getElementById('playerCount');

    counter.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} online`;
    if (statCount) {
      statCount.textContent = players.length;
      document.getElementById('playerFill').style.width = Math.min(players.length * 10, 100) + '%';
    }

    if (!players.length) {
      list.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = players.map((p, i) => `
      <div class="player-card" style="animation-delay:${i * 0.06}s">
        <div class="player-avatar">${p.charAt(0).toUpperCase()}</div>
        <div>
          <div class="player-name">${p}</div>
          <div class="player-sub">● Online</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Players error:', e);
  }
}

setInterval(updateStats, 2500);
updateStats();
setInterval(updatePlayers, 5000);
