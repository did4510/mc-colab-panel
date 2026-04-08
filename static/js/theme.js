// =============================================
// MC COLAB PANEL — theme.js
// =============================================

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');

  if (icon) icon.textContent = isLight ? '☀️' : '🌙';
  if (label) label.textContent = isLight ? 'Light Mode' : 'Dark Mode';

  localStorage.setItem('mcpanel-theme', isLight ? 'light' : 'dark');
}

// Restore saved theme on load
(function () {
  const saved = localStorage.getItem('mcpanel-theme');
  if (saved === 'light') {
    document.body.classList.add('light');
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Light Mode';
  }
})();
