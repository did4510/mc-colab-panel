async function updateConsole(){
 let html = await fetch('/logs').then(r=>r.text());
 let el = document.getElementById('console-output');

 el.innerHTML = html;
 el.scrollTop = el.scrollHeight;
}
setInterval(updateConsole,1000);

function sendCmd(){
 let c=document.getElementById('cmd').value;

 fetch('/cmd',{
  method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:'cmd='+c
 });
}
