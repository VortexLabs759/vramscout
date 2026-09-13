const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const els={req:$('#requirement'),parse:$('#parse'),rules:$('#rules'),drop:$('#drop'),file:$('#file'),summary:$('#summary'),workspace:$('#workspace'),before:$('#before'),after:$('#after'),beforeStats:$('#beforeStats'),afterStats:$('#afterStats'),targetKB:$('#targetKB'),format:$('#format'),width:$('#width'),height:$('#height'),ratio:$('#ratio'),fix:$('#fix'),progress:$('#progress'),checklist:$('#checklist'),download:$('#download'),reset:$('#reset')};
let currentFile=null,currentImage=null,outputBlob=null,outputMeta=null,parsed={};
const fmtName=t=>t==='image/jpeg'?'JPG':t==='image/png'?'PNG':t==='image/webp'?'WebP':(t||'').replace('image/','').toUpperCase();
const humanBytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(n/1024<10?1:0)} KB`:`${(n/1048576).toFixed(2)} MB`;
function parseRequirements(text){
  const t=(text||'').replace(/,/g,'.');
  const out={};
  const sizeRe=/(?:max(?:imum)?|maximal|höchstens|unter|under|not exceed|nicht (?:größer|groesser) als|bis zu|<=|≤)?[^\d]{0,18}(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib)/ig;
  const sizes=[...t.matchAll(sizeRe)].map(m=>({n:parseFloat(m[1]),u:m[2].toLowerCase()}));
  if(sizes.length){const s=sizes[0];out.maxKB=Math.round(s.n*(s.u.startsWith('m')?1024:1));}
  const dim=t.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})\s*(?:px|pixel|pixels)?/i);
  if(dim){out.width=+dim[1];out.height=+dim[2];const around=t.slice(Math.max(0,dim.index-35),dim.index+dim[0].length+10).toLowerCase();out.dimensionMode=/(min|minimum|mindestens|at least)/.test(around)?'min':'exact';}
  if(/\b(jpe?g)\b/i.test(t))out.format='image/jpeg';
  else if(/\bpng\b/i.test(t))out.format='image/png';
  else if(/\bwebp\b/i.test(t))out.format='image/webp';
  return out;
}
function showRules(){
  const tags=[];
  if(parsed.maxKB)tags.push(`max. ${parsed.maxKB} KB`);
  if(parsed.width&&parsed.height)tags.push(`${parsed.dimensionMode==='min'?'mind.':'genau'} ${parsed.width}×${parsed.height} px`);
  if(parsed.format)tags.push(fmtName(parsed.format));
  els.rules.innerHTML=tags.length?`<div class="rule-tags">${tags.map(x=>`<b>${x}</b>`).join('')}</div>`:'Keine eindeutigen Regeln erkannt. Du kannst die Felder unten trotzdem manuell setzen.';
  if(parsed.maxKB)els.targetKB.value=parsed.maxKB;
  if(parsed.width)els.width.value=parsed.width;
  if(parsed.height)els.height.value=parsed.height;
  if(parsed.format)els.format.value=parsed.format;
  if(currentFile)renderChecklist(null);
}
els.parse.addEventListener('click',()=>{parsed=parseRequirements(els.req.value);showRules();});
$$('[data-example]').forEach(b=>b.addEventListener('click',()=>{els.req.value=b.dataset.example;parsed=parseRequirements(els.req.value);showRules();}));
$$('[data-mode]').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>{if(a.dataset.mode==='size')els.targetKB.focus();if(a.dataset.mode==='dimensions')els.width.focus();if(a.dataset.mode==='format')els.format.focus();},300)));
function chooseFile(){els.file.click()}
els.drop.addEventListener('click',chooseFile);els.drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseFile()}});
['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{e.preventDefault();els.drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{e.preventDefault();els.drop.classList.remove('drag')}));
els.drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f)});els.file.addEventListener('change',()=>{if(els.file.files[0])loadFile(els.file.files[0])});
async function loadFile(file){
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){alert('Aktuell unterstützt der Fixer JPG, PNG und WebP. PDF kommt separat.');return;}
  currentFile=file;outputBlob=null;outputMeta=null;els.download.disabled=true;els.after.removeAttribute('src');els.afterStats.innerHTML='';
  const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{currentImage=img;els.before.src=url;els.workspace.classList.remove('hidden');els.summary.classList.remove('hidden');els.summary.textContent=`${file.name} · ${humanBytes(file.size)} · ${img.naturalWidth}×${img.naturalHeight} · ${fmtName(file.type)}`;els.beforeStats.innerHTML=statsHTML(file.size,img.naturalWidth,img.naturalHeight,file.type);if(!Object.keys(parsed).length&&els.req.value.trim()){parsed=parseRequirements(els.req.value);showRules()}renderChecklist(null);els.workspace.scrollIntoView({behavior:'smooth',block:'start'});};img.onerror=()=>alert('Das Bild konnte nicht gelesen werden.');img.src=url;
}
function statsHTML(size,w,h,type){return `<div><dt>Größe</dt><dd><b>${humanBytes(size)}</b></dd></div><div><dt>Maße</dt><dd><b>${w}×${h}</b></dd></div><div><dt>Format</dt><dd><b>${fmtName(type)}</b></dd></div><div><dt>Status</dt><dd><b>${size?'gemessen':'—'}</b></dd></div>`;}
function canvasBlob(canvas,type,quality){return new Promise(res=>canvas.toBlob(res,type,quality));}
function drawToCanvas(img,w,h,keepRatio=true){
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{alpha:typeSupportsAlpha(els.format.value)});x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
  if(els.format.value==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,w,h)}
  if(!keepRatio){x.drawImage(img,0,0,w,h);return c}
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/scale,sh=h/scale,sx=(img.naturalWidth-sw)/2,sy=(img.naturalHeight-sh)/2;x.drawImage(img,sx,sy,sw,sh,0,0,w,h);return c;
}
function typeSupportsAlpha(t){return t==='image/png'||t==='image/webp'}
async function encodeUnderTarget(canvas,type,targetBytes){
  if(!targetBytes)return await canvasBlob(canvas,type,type==='image/png'?undefined:.92);
  let work=canvas;
  if(type==='image/png'){
    for(let i=0;i<10;i++){const b=await canvasBlob(work,type);if(b&&b.size<=targetBytes)return {blob:b,canvas:work};const n=document.createElement('canvas');n.width=Math.max(1,Math.round(work.width*.9));n.height=Math.max(1,Math.round(work.height*.9));n.getContext('2d').drawImage(work,0,0,n.width,n.height);work=n;}return {blob:await canvasBlob(work,type),canvas:work};
  }
  for(let shrink=0;shrink<12;shrink++){
    let low=.12,high=.95,best=null;
    for(let i=0;i<9;i++){const q=(low+high)/2,b=await canvasBlob(work,type,q);if(!b)break;if(b.size<=targetBytes){best=b;low=q}else high=q;}
    if(best)return {blob:best,canvas:work};
    const min=await canvasBlob(work,type,.1);if(min&&min.size<=targetBytes)return {blob:min,canvas:work};
    const n=document.createElement('canvas');n.width=Math.max(1,Math.round(work.width*.9));n.height=Math.max(1,Math.round(work.height*.9));n.getContext('2d').drawImage(work,0,0,n.width,n.height);work=n;
  }
  return {blob:await canvasBlob(work,type,.1),canvas:work};
}
async function fixImage(){
  if(!currentImage)return;els.fix.disabled=true;els.progress.classList.remove('hidden');els.download.disabled=true;
  await new Promise(r=>setTimeout(r,80));
  try{
    const type=els.format.value;
    const reqW=+els.width.value||0,reqH=+els.height.value||0;
    let w=reqW||currentImage.naturalWidth,h=reqH||currentImage.naturalHeight;
    if(reqW&&!reqH)h=Math.round(currentImage.naturalHeight*(reqW/currentImage.naturalWidth));
    if(reqH&&!reqW)w=Math.round(currentImage.naturalWidth*(reqH/currentImage.naturalHeight));
    const canvas=drawToCanvas(currentImage,w,h,els.ratio.checked);
    const target=+els.targetKB.value>0?+els.targetKB.value*1024:0;
    const result=await encodeUnderTarget(canvas,type,target);
    outputBlob=result.blob;outputMeta={w:result.canvas.width,h:result.canvas.height,type};
    const url=URL.createObjectURL(outputBlob);els.after.src=url;els.afterStats.innerHTML=statsHTML(outputBlob.size,outputMeta.w,outputMeta.h,type);renderChecklist(outputMeta);els.download.disabled=false;
  }catch(err){console.error(err);alert('Die Datei konnte nicht verarbeitet werden. Bitte versuche ein anderes Bild.');}
  finally{els.fix.disabled=false;els.progress.classList.add('hidden');}
}
els.fix.addEventListener('click',fixImage);
function activeRules(){return {maxKB:+els.targetKB.value||parsed.maxKB||0,width:+els.width.value||parsed.width||0,height:+els.height.value||parsed.height||0,format:els.format.value||parsed.format||''};}
function renderChecklist(out){
  if(!currentFile){els.checklist.innerHTML='<p>Wähle zuerst eine Datei.</p>';return}
  const r=activeRules(),base=out?{size:outputBlob.size,w:out.w,h:out.h,type:out.type}:{size:currentFile.size,w:currentImage.naturalWidth,h:currentImage.naturalHeight,type:currentFile.type};
  const items=[];
  if(r.maxKB){const ok=base.size<=r.maxKB*1024;items.push(['Dateigröße',`${humanBytes(base.size)} / max. ${r.maxKB} KB`,ok]);}
  if(r.width&&r.height){let ok;if(parsed.dimensionMode==='min'&&!out)ok=base.w>=r.width&&base.h>=r.height;else ok=base.w===r.width&&base.h===r.height;items.push(['Bildmaße',`${base.w}×${base.h} / ${parsed.dimensionMode==='min'&&!out?'mind.':'Ziel'} ${r.width}×${r.height}`,ok]);}
  if(r.format){const ok=base.type===r.format;items.push(['Format',`${fmtName(base.type)} / ${fmtName(r.format)}`,ok]);}
  if(!items.length){els.checklist.innerHTML='<p>Keine Vorgaben gesetzt. Trage Zielgröße, Maße oder Format ein.</p>';return}
  els.checklist.innerHTML=items.map(([n,v,ok])=>`<div class="check-item"><span><b>${n}</b><br>${v}</span><b class="${ok?'good':'bad'}">${ok?'✓ passt':'✕ ändern'}</b></div>`).join('');
}
['input','change'].forEach(ev=>[els.targetKB,els.format,els.width,els.height].forEach(x=>x.addEventListener(ev,()=>renderChecklist(outputMeta))));
els.download.addEventListener('click',()=>{if(!outputBlob)return;const ext=els.format.value==='image/jpeg'?'jpg':els.format.value==='image/png'?'png':'webp';const a=document.createElement('a');a.href=URL.createObjectURL(outputBlob);const base=(currentFile.name.replace(/\.[^.]+$/,'')||'file').replace(/[^a-z0-9_-]+/gi,'-');a.download=`${base}-fileok.${ext}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);});
els.reset.addEventListener('click',()=>{currentFile=null;currentImage=null;outputBlob=null;outputMeta=null;els.file.value='';els.summary.classList.add('hidden');els.workspace.classList.add('hidden');els.before.removeAttribute('src');els.after.removeAttribute('src');els.download.disabled=true;window.scrollTo({top:els.drop.getBoundingClientRect().top+scrollY-100,behavior:'smooth'});});