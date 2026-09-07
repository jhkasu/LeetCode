// Generic stepper. A page defines `config` and calls Stepper.init(config).
// config = { lines:[...code lines], rows:[{id,label,tags:[{text,cls}],kind:'list'|'dict'|'lol', ptr:bool}],
//            steps:[{line,msg,state:{rowId:value},reads:[[rowId,idx]],writes:[[rowId,idx]],ptr:idx}] }
var Stepper=(function(){
  // entries: [rowId, idx] or [rowId, from, toExclusive]
  function has(list,key,idx){for(var q=0;q<(list||[]).length;q++){var e=list[q];if(e[0]!==key)continue;
    if(e.length===3){if(idx>=e[1]&&idx<e[2])return true;}else if(e[1]===idx)return true;}return false;}
  // pointers: s.ptrs = [[rowId, idx, label]]  (legacy s.ptr -> rows with ptr:true, label 'i')
  function ptrLabel(row,s,j){var out=[];
    if(row.ptr&&s.ptr===j)out.push('i');
    (s.ptrs||[]).forEach(function(p){if(p[0]===row.id&&p[1]===j)out.push(p[2]);});
    return out.length?out.join(' ')+'↓':'';}
  function showPtr(row,cfg){return row.ptr||cfg.steps.some(function(s){return (s.ptrs||[]).some(function(p){return p[0]===row.id;});});}
  function esc(v){return v===null||v===undefined?'·':String(v);}
  function tags(t){return (t||[]).map(function(x){return '<span class="tag '+(x.cls||'')+'">'+x.text+'</span>'+(x.after?' '+x.after:'');}).join('');}
  function renderList(row,s){var arr=s.state[row.id]||[],h='';
    if(typeof arr==='string')arr=arr.split('');
    for(var j=0;j<=arr.length;j++){
      if(j===arr.length){ // one slot past the end so a pointer at len(s) is visible
        var pl=row.showPtr?ptrLabel(row,s,j):'';if(!pl)break;
        h+='<span class="slot"><span class="ptr">'+pl+'</span><span class="idx">'+j+'</span><span class="cell" style="border-style:dashed;opacity:.5">end</span></span>';break;}
      var cls='cell';if(has(s.writes,row.id,j))cls+=' w';else if(has(s.reads,row.id,j))cls+=' r';
      var p=row.showPtr?'<span class="ptr">'+ptrLabel(row,s,j)+'</span>':'';
      h+='<span class="slot">'+p+'<span class="idx">'+j+'</span><span class="'+cls+'">'+esc(arr[j])+'</span></span>';}
    return '<span class="outer">'+(h||'<span class="empty" style="color:var(--muted);padding:6px 2px">[ ]</span>')+'</span>';}
  function renderLol(row,s){var arr=s.state[row.id]||[],h='';
    for(var j=0;j<arr.length;j++){var wr=has(s.writes,row.id,j),rd=has(s.reads,row.id,j);
      var inner=arr[j].length?arr[j].map(function(v){var c='cell';if(wr&&v===s.val)c+=' w';else if(rd&&v===s.val)c+=' r';return '<span class="'+c+'">'+esc(v)+'</span>';}).join(''):'<span class="empty">[ ]</span>';
      h+='<span class="slot"><span class="idx">'+j+'</span><span class="inner'+(wr?' w':'')+(rd&&!wr?' r':'')+'">'+inner+'</span></span>';}
    return '<span class="outer">'+h+'</span>';}
  function renderDict(row,s){var d=s.state[row.id]||{},ks=Object.keys(d);
    if(!ks.length)return '<span class="dict">{ }</span>';
    return '<span class="dict">{ '+ks.map(function(k){var c='kv';if(has(s.writes,row.id,+k))c+=' w';else if(has(s.reads,row.id,+k))c+=' r';return '<span class="'+c+'">'+k+': '+d[k]+'</span>';}).join(', ')+' }</span>';}
  // grid: state = 2D array. step.grid = {cur:[r,c], row:r, col:c, box:[br,bc]} highlights.
  function renderGrid(row,s){var g=s.state[row.id]||[],hl=(s.grid&&s.grid[row.id])||{},h='<table class="grid">';
    for(var r=0;r<g.length;r++){h+='<tr>';for(var c=0;c<g[r].length;c++){var cls=[];
      if(hl.row===r)cls.push('hrow');if(hl.col===c)cls.push('hcol');
      if(hl.box&&Math.floor(r/3)===hl.box[0]&&Math.floor(c/3)===hl.box[1])cls.push('hbox');
      if(hl.cur&&hl.cur[0]===r&&hl.cur[1]===c)cls.push(hl.bad?'bad':'cur');
      h+='<td class="'+cls.join(' ')+'">'+(g[r][c]==='.'?'<span class="dot">·</span>':g[r][c])+'</td>';}h+='</tr>';}
    return h+'</table>';}
  // sets: state = {key: [values]}. reads/writes use [rowId, keyString]
  function renderSets(row,s){var d=s.state[row.id]||{},ks=Object.keys(d);
    if(!ks.length)return '<span class="dict">{ }</span>';
    return '<span class="dict sets">{ '+ks.map(function(k){var c='kv';if(has(s.writes,row.id,k))c+=' w';else if(has(s.reads,row.id,k))c+=' r';
      return '<span class="'+c+'">'+k+': {'+d[k].join(', ')+'}</span>';}).join(',  ')+' }</span>';}
  function init(cfg,rootId){
    var cur=0,root=document.getElementById(rootId||'viz'),uid=(rootId||'viz')+'-';
    var html='<pre class="code" id="'+uid+'code"></pre><div class="rows">';
    cfg.rows.forEach(function(r){html+='<div class="row"><div class="lbl">'+r.label+tags(r.tags)+'</div><div class="mono" id="'+uid+'row-'+r.id+'"></div></div>';});
    html+='</div><div class="controls"><button id="'+uid+'prev">← Prev</button><button id="'+uid+'next">Next →</button><span class="msg"><span class="n" id="'+uid+'n"></span><span id="'+uid+'msg"></span></span></div>';
    html+='<div class="legend"><span>↓ = pointer / loop index</span><span><span class="cell r">green</span> = value being read</span><span><span class="cell w">orange</span> = value being written</span></div>';
    root.innerHTML=html;
    cfg.rows.forEach(function(r){r.showPtr=showPtr(r,cfg);});
    function $(x){return document.getElementById(uid+x);}
    function render(){var s=cfg.steps[cur];
      $('code').innerHTML=cfg.lines.map(function(l,k){return '<span class="'+(k===s.line?'on':'')+'">'+(l||' ')+'</span>';}).join('');
      cfg.rows.forEach(function(r){var el=$('row-'+r.id);
        el.innerHTML=r.render?r.render(s):r.kind==='dict'?renderDict(r,s):r.kind==='lol'?renderLol(r,s):r.kind==='grid'?renderGrid(r,s):r.kind==='sets'?renderSets(r,s):renderList(r,s);});
      $('n').textContent=(cur+1)+' / '+cfg.steps.length;
      $('msg').textContent=s.msg;
      $('prev').disabled=cur===0;$('next').disabled=cur===cfg.steps.length-1;}
    $('prev').onclick=function(){if(cur>0){cur--;render();}};
    $('next').onclick=function(){if(cur<cfg.steps.length-1){cur++;render();}};
    if(!cfg.noKeys)document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')$('next').click();if(e.key==='ArrowLeft')$('prev').click();});
    render();}
  return {init:init};
})();
