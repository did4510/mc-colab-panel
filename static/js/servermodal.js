// =============================================
// MC COLAB PANEL — servermodal.js
// Server selection + Google Drive status
// =============================================

let serverConfig = { version: '1.21.1', type: 'paper', versions: [], types: [] };

async function loadServerInfo() {
  try {
    const info = await fetch('/server_info').then(r => r.json());
    serverConfig.version  = info.version;
    serverConfig.type     = info.type;
    serverConfig.versions = info.available_versions || [];
    serverConfig.types    = info.available_types    || [];

    // Update sidebar badge name
    updateSidebarServerName();

    // Drive status in sidebar
    const miniDot   = document.getElementById('driveMiniDot');
    const miniLabel = document.getElementById('driveMiniLabel');
    if (info.drive_mounted) {
      miniDot.style.color = 'var(--green)';
      miniLabel.textContent = 'Drive: ' + (info.base_dir || '').replace('/content/drive/MyDrive/', '~/');
    } else {
      miniDot.style.color = 'var(--yellow)';
      miniLabel.textContent = 'Local storage (Drive not mounted)';
    }

    // Drive status in modal
    const driveIcon  = document.getElementById('driveIcon');
    const driveLabel = document.getElementById('driveLabel');
    const drivePath  = document.getElementById('drivePath');
    if (info.drive_mounted) {
      driveIcon.textContent  = '✅';
      driveLabel.textContent = 'Google Drive connected';
      drivePath.textContent  = info.base_dir || '';
    } else {
      driveIcon.textContent  = '💾';
      driveLabel.textContent = 'Using local storage';
      drivePath.textContent  = info.base_dir || '';
    }

    // Render version buttons
    renderVersionGrid();
  } catch (e) {
    console.warn('Server info error:', e);
  }
}

function updateSidebarServerName() {
  const el = document.getElementById('sscName');
  if (el) {
    const typeName = serverConfig.type.charAt(0).toUpperCase() + serverConfig.type.slice(1);
    el.textContent = typeName + ' ' + serverConfig.version;
  }
}

function renderVersionGrid() {
  const grid = document.getElementById('versionGrid');
  if (!grid) return;
  grid.innerHTML = serverConfig.versions.map(v => `
    <button class="version-btn ${v === serverConfig.version ? 'active' : ''}"
            data-version="${v}" onclick="selectVersion(this)">
      ${v}
    </button>
  `).join('');
}

function selectType(btn) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  serverConfig.type = btn.dataset.type;
}

function selectVersion(btn) {
  document.querySelectorAll('.version-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  serverConfig.version = btn.dataset.version;
}

function openServerModal() {
  document.getElementById('serverModal').classList.add('open');
  // Sync type buttons
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === serverConfig.type);
  });
  renderVersionGrid();
}

function closeServerModal() {
  document.getElementById('serverModal').classList.remove('open');
}

async function applyServerConfig() {
  try {
    const res = await fetch('/set_server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: serverConfig.version, type: serverConfig.type })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    updateSidebarServerName();
    closeServerModal();
    showToast('Server config updated: ' + serverConfig.type + ' ' + serverConfig.version);
  } catch (e) {
    showToast('Failed to update config', 'error');
  }
}

// Close modal on overlay click
document.getElementById('serverModal').addEventListener('click', function(e) {
  if (e.target === this) closeServerModal();
});

// Load on init
loadServerInfo();
