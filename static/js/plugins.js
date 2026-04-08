// =============================================
// MC COLAB PANEL — plugins.js
// =============================================

async function searchPlugin() {
  const q = document.getElementById('plugin-search').value.trim();
  if (!q) return;

  const grid = document.getElementById('plugin-results');
  const empty = document.getElementById('pluginsEmpty');

  grid.innerHTML = '<div class="empty-state"><div class="empty-emoji">⏳</div><p>Searching...</p></div>';
  empty.style.display = 'none';

  try {
    const data = await fetch('/search_plugin?q=' + encodeURIComponent(q)).then(r => r.json());

    if (!data.length) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      empty.querySelector('p').textContent = 'No plugins found';
      empty.querySelector('span').textContent = 'Try a different search term';
      return;
    }

    grid.innerHTML = data.map((p, i) => `
      <div class="plugin-card" style="animation-delay:${i * 0.07}s">
        <div class="plugin-name">${p.name}</div>
        <div class="plugin-id">ID: ${p.id}</div>
        <button class="plugin-install-btn" id="btn-${p.id}" onclick="installPlugin('${p.id}', this)">
          ↓ Install Plugin
        </button>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '';
    showToast('Search failed', 'error');
  }
}

async function installPlugin(id, btn) {
  btn.textContent = 'Installing...';
  btn.disabled = true;

  try {
    await fetch('/install_plugin?id=' + id);
    btn.textContent = '✓ Installed';
    btn.classList.add('installed');
    showToast('Plugin installed!');
  } catch (e) {
    btn.textContent = '✗ Failed';
    btn.disabled = false;
    showToast('Install failed', 'error');
  }
}
