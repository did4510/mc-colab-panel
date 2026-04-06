const ramChart = new Chart(document.getElementById('ramChart'), {
 type:'line',
 data:{labels:[],datasets:[{label:'RAM',data:[]}]}
});

const tpsChart = new Chart(document.getElementById('tpsChart'), {
 type:'line',
 data:{labels:[],datasets:[{label:'TPS',data:[]}]}
});

async function updateCharts(){
 let s = await fetch('/stats').then(r=>r.json());

 ramChart.data.labels = s.ram.map((_,i)=>i);
 ramChart.data.datasets[0].data = s.ram;
 ramChart.update();

 tpsChart.data.labels = s.tps.map((_,i)=>i);
 tpsChart.data.datasets[0].data = s.tps;
 tpsChart.update();
}
setInterval(updateCharts,3000);
