// =============================================
// MC COLAB PANEL — charts.js
// =============================================

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 500, easing: 'easeInOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(13,18,36,0.9)',
      borderColor: 'rgba(34,211,238,0.3)',
      borderWidth: 1,
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      padding: 10,
      cornerRadius: 8,
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#475569', font: { family: "'JetBrains Mono'", size: 10 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#475569', font: { family: "'JetBrains Mono'", size: 10 } }
    }
  }
};

const ramChart = new Chart(document.getElementById('ramChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'RAM (GB)',
      data: [],
      borderColor: '#fbbf24',
      backgroundColor: 'rgba(251,191,36,0.08)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#fbbf24',
      tension: 0.4,
      fill: true,
    }]
  },
  options: { ...chartDefaults }
});

const tpsChart = new Chart(document.getElementById('tpsChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'TPS',
      data: [],
      borderColor: '#4ade80',
      backgroundColor: 'rgba(74,222,128,0.08)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#4ade80',
      tension: 0.4,
      fill: true,
    }]
  },
  options: {
    ...chartDefaults,
    scales: {
      ...chartDefaults.scales,
      y: { ...chartDefaults.scales.y, min: 0, max: 20 }
    }
  }
});

async function updateCharts() {
  try {
    const s = await fetch('/stats').then(r => r.json());

    const labels = (s.ram || []).map((_, i) => i);

    ramChart.data.labels = labels;
    ramChart.data.datasets[0].data = s.ram || [];
    ramChart.update();

    tpsChart.data.labels = (s.tps || []).map((_, i) => i);
    tpsChart.data.datasets[0].data = s.tps || [];
    // Dynamic color based on TPS health
    const lastTps = s.tps && s.tps.length ? s.tps[s.tps.length - 1] : 20;
    tpsChart.data.datasets[0].borderColor = lastTps >= 18 ? '#4ade80' : lastTps >= 14 ? '#fbbf24' : '#f87171';
    tpsChart.update();
  } catch (e) {
    console.error('Charts error:', e);
  }
}

setInterval(updateCharts, 3000);
updateCharts();
