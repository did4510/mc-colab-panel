async function searchPlugin(){
 let q=document.getElementById("plugin-search").value;

 let data = await fetch('/search_plugin?q='+q).then(r=>r.json());

 document.getElementById("plugin-results").innerHTML =
 data.map(p=>`
   <div>
     ${p.name}
     <button onclick="install('${p.id}')">Install</button>
   </div>
 `).join('');
}

async function install(id){
 await fetch('/install_plugin?id='+id);
 alert("Installed");
}
