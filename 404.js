(function(){
  // Segna la scoperta (stesso sito = stessa memoria del browser): il sito principale sblocca l'obiettivo
  try{
    if(!localStorage.getItem('fra:found404')){
      localStorage.setItem('fra:found404','1');
      document.getElementById('found').hidden=false;
    }
  }catch(e){}
  var h=document.getElementById('n');
  function move(x,y){
    document.body.style.setProperty('--x',x+'px');
    document.body.style.setProperty('--y',y+'px');
    var r=h.getBoundingClientRect();
    h.style.setProperty('--hx',(x-r.left)+'px');
    h.style.setProperty('--hy',(y-r.top)+'px');
  }
  var queued=false,px=0,py=0;
  window.addEventListener('pointermove',function(e){
    px=e.clientX;py=e.clientY;
    if(queued)return;queued=true;
    requestAnimationFrame(function(){queued=false;move(px,py);});
  },{passive:true});
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    // senza mouse l'alone gira piano da solo, finché non muovi il puntatore
    var moved=false;
    window.addEventListener('pointermove',function(){moved=true;},{once:true});
    (function drift(t){
      if(moved)return;
      var w=innerWidth,hh=innerHeight;
      move(w*(.5+.28*Math.sin(t/1900)),hh*(.4+.2*Math.sin(t/1300+1)));
      requestAnimationFrame(drift);
    })(0);
  }
})();
