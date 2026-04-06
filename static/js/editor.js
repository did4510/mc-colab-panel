let editor,currentFile="";

require.config({ paths:{ vs:'https://unpkg.com/monaco-editor@0.45.0/min/vs'} });

require(["vs/editor/editor.main"], function(){
 editor = monaco.editor.create(document.getElementById("editor"), {
  value:"// open file",
  language:"javascript",
  theme:"vs-dark"
 });
});

async function openFile(name){
 currentFile=name;
 let content = await fetch('/file?name='+name).then(r=>r.text());
 editor.setValue(content);
}

async function saveFile(){
 await fetch('/save_file',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({name:currentFile,content:editor.getValue()})
 });
 alert("Saved");
}
