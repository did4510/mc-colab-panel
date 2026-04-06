const box=document.getElementById("upload-box");

box.ondragover=e=>{
 e.preventDefault();
};

box.ondrop=async e=>{
 e.preventDefault();

 let file=e.dataTransfer.files[0];
 let form=new FormData();
 form.append("file",file);

 await fetch("/upload",{method:"POST",body:form});
 alert("Uploaded");
};
