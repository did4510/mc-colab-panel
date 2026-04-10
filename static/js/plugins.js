// =============================================
// MC COLAB PANEL — plugins.js (ENHANCED)
// Rich plugin cards with icon, stats, categories
// =============================================

function formatDownloads(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function categoryBadge(cat) {
  const colors = {
    optimization: '#22d3ee', adventure: '#818cf8', utility: '#4ade80',
    management: '#fbbf24', economy: '#fb923c', chat: '#f472b6',
    protection: '#ef4444', world: '#34d399', misc: '#94a3b8',
  };
  const color = colors[cat] || '#94a3b8';
  return `<span class="plugin-cat-badge" style="--cat-color:${color}">${cat}</span>`;
}

async function searchPlugin() {
  const q     = document.getElementById('plugin-search').value.trim();
  if (!q) return;

  const grid  = document.getElementById('plugin-results');
  const empty = document.getElementById('pluginsEmpty');

  grid.innerHTML = '<div class="plugin-loading"><div class="plugin-spinner"></div><p>Searching Modrinth...</p></div>';
  empty.style.display = 'none';

  try {
    const data = await fetch('/search_plugin?q=' + encodeURIComponent(q)).then(r => r.json());

    if (!data.length) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      empty.querySelector('p').textContent   = 'No plugins found';
      empty.querySelector('span').textContent = 'Try a different search term';
      return;
    }

    grid.innerHTML = data.map((p, i) => `
      <div class="plugin-card-rich" style="animation-delay:${i * 0.05}s">
        <div class="pcr-top">
          <div class="pcr-icon">
            ${p.icon_url
              ? `<img src="${p.icon_url}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''}
            <div class="pcr-icon-fallback" ${p.icon_url ? 'style="display:none"' : ''}>${p.name.charAt(0).toUpperCase()}</div>
          </div>
          <div class="pcr-info">
            <div class="pcr-name">${p.name}</div>
            <div class="pcr-author">by ${p.author || 'Unknown'}</div>
          </div>
          <a class="pcr-ext-link" href="${p.source_url}" target="_blank" title="View on Modrinth">
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </a>
        </div>

        <p class="pcr-desc">${p.description || 'No description available.'}</p>

        <div class="pcr-cats">
          ${(p.categories || []).slice(0, 3).map(categoryBadge).join('')}
        </div>

        <div class="pcr-meta">
          <div class="pcr-stat">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="8 17 12 21 16 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            ${formatDownloads(p.downloads)}
          </div>
          <div class="pcr-stat">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="2"/></svg>
            ${formatDownloads(p.follows)}
          </div>
          <div class="pcr-versions">
            ${(p.game_versions || []).map(v => `<span class="pcr-version-tag">${v}</span>`).join('')}
          </div>
        </div>

        <button class="plugin-install-btn" id="btn-${p.id}" onclick="installPlugin('${p.id}', this)">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><polyline points="8 17 12 21 16 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Install Plugin
        </button>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '';
    showToast('Search failed', 'error');
  }
}

async function installPlugin(id, btn) {
  btn.innerHTML = '<span class="btn-spinner"></span> Installing...';
  btn.disabled  = true;

  try {
    await fetch('/install_plugin?id=' + id);
    btn.innerHTML = '✓ Installed';
    btn.classList.add('installed');
    showToast('Plugin installed successfully!');
  } catch (e) {
    btn.innerHTML = '✗ Failed';
    btn.disabled  = false;
    showToast('Install failed', 'error');
  }
}
