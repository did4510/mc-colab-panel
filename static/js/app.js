function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function startServer(){ await fetch('/start'); }
async function stopServer(){ await fetch('/stop'); }

async function update(){
 let s = await fetch('/stats').then(r=>r.json());

 document.getElementById('ip').innerText = "IP: "+s.ip;
 document.getElementById('status').innerText = s.running ? "Online":"Offline";
}
setInterval(update,2000);
