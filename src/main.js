import * as core from './pdf-core.js';
import {openPreview,renderPage,exportPngsAsZip} from './pdf-preview.js';

const $=id=>document.getElementById(id);
const TOOL={
  organise:['Organise pages','Reorder, rotate, remove or insert pages. Changes are saved as a new PDF.'],
  merge:['Merge PDFs','Select two or more PDFs, then arrange them before combining.'],
  split:['Split or extract PDF','Export chosen pages or split every page into a ZIP archive.'],
  sign:['Sign PDF','Draw a visual signature and choose where to place it. Not a certified electronic signature.'],
  photos:['Photos to PDF','Select photos from Files or Photos. Choose a page size and image fit.'],
  text:['Text to PDF','Create a multipage document from text. Non-Latin text is rasterised when needed.'],
  blank:['Create blank PDF','Choose a page size and the number of blank pages.'],
  watermark:['Add watermark','Place a translucent watermark on every page.'],
  number:['Add page numbers','Add page numbers at the top or bottom.'],
  annotate:['Add text','Stamp new text on a page without changing the original layout.'],
  stamp:['Add image','Place a PNG or JPEG image on a document page.'],
  forms:['Fill PDF forms','Edit standard text, checkbox, dropdown and radio fields.'],
  export:['PDF to PNG','Export document pages as PNG images in a ZIP file.'],
  view:['View PDF','Preview pages directly on this device.']
};
const state={mode:'view',files:[],image:null,bytes:null,history:[],redo:[],page:0,preview:null,result:null,busy:false,signature:false,signatureCtx:null,signatureDrawing:false,zoom:1,renderRequest:0,renderQueue:Promise.resolve()};
const input=(id,label,{type='text',value='',min,max,step,placeholder,accept}={})=>`<label class="field"><span>${label}</span><input id="${id}" type="${type}" value="${value}" ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''} ${step!==undefined?`step="${step}"`:''} ${placeholder?`placeholder="${placeholder}"`:''} ${accept?`accept="${accept}"`:''}></label>`;
const select=(id,label,entries)=>`<label class="field"><span>${label}</span><select id="${id}">${entries.map(([val,title])=>`<option value="${val}">${title}</option>`).join('')}</select></label>`;
const pagesSelect=()=>input('pageNo','Page number',{type:'number',value:'1',min:1});
const sizes=()=>select('paperSize','Paper size',[['A4','A4'],['Letter','US Letter'],['A3','A3']]);
function errorMessage(err){return String(err?.message||err||'Unexpected error').replace(/^Error: /,'');}
function status(msg,success=false){$('status').hidden=!msg;$('status').textContent=msg||'';$('status').classList.toggle('positive',success);}
function fmt(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';}
function fieldValue(id){return $(id)?.value||'';}
function fileResult(blob,name){state.result={blob,name};$('resultPanel').hidden=false;$('resultTitle').textContent=name;$('resultMeta').textContent=`${fmt(blob.size)} · processed on your device`;$('shareButton').textContent='Save / share';}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function share(){if(!state.result)return;const {blob,name}=state.result;try{const file=new File([blob],name,{type:blob.type});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:name});return;}}catch(err){if(err.name==='AbortError')return;}download(blob,name);status('File saved or sent to Safari Downloads. Check Files → Downloads.',true);}
function resetResults(){state.result=null;$('resultPanel').hidden=true;status('');}
function closePreview(){state.renderRequest++;if(state.preview){state.preview.close();state.preview=null;}}
function clearEditor(){$('workspace').classList.remove('viewer-active');closePreview();state.files=[];state.image=null;state.bytes=null;state.history=[];state.redo=[];state.page=0;state.zoom=1;state.signature=false;resetResults();$('filePicker').value='';$('fileStack').replaceChildren();$('selectedInfo').hidden=true;$('editorView').hidden=true;$('utilityButtons').hidden=true;}
function getForms(mode){switch(mode){
case 'organise':return `<p class="note">Use the controls below to modify your document. Each operation can be undone before saving.</p><div class="control-row"><button id="moveUp" class="mini-btn">↑ Move up</button><button id="moveDown" class="mini-btn">↓ Move down</button><button id="rotateLeft" class="mini-btn">↺ Rotate</button><button id="rotateRight" class="mini-btn">↻ Rotate</button></div><div class="control-row"><button id="deletePage" class="mini-btn warning">Remove page</button><button id="insertPage" class="mini-btn">＋ Blank page</button></div>`;
case 'merge':return `<p class="note">Select 2–20 PDFs. Use the arrows in the file list to arrange their merge order.</p>`;
case 'split':return `${select('splitMethod','Export style',[['extract','Extract selected pages to PDF'],['zip','Split every page into ZIP']])}${input('pageRange','Pages to extract (e.g. 1,3-5)',{value:'1'})}`;
case 'sign':return `<label class="field"><span>Draw your signature</span><canvas id="signCanvas" width="660" height="220" class="sign-pad" aria-label="Signature drawing area"></canvas></label><button id="clearSign" class="mini-btn">Clear signature</button>${pagesSelect()}${select('signPosition','Position',[['bottom-right','Bottom right'],['bottom-left','Bottom left'],['top-right','Top right'],['top-left','Top left']])}${input('signWidth','Width in PDF points',{type:'number',value:175,min:45,max:450})}<p class="note caution">This is a visual signature only, not an identity-verified or cryptographic digital signature.</p>`;
case 'photos':return `${sizes()}${select('photoFit','Image placement',[['contain','Fit with margins'],['cover','Fill page (may crop)']])}`;
case 'text':return `${input('documentTitle','Document title',{value:'My Document'})}<label class="field"><span>Your text</span><textarea id="documentText" rows="9" placeholder="Write or paste your text here"></textarea></label>${sizes()}${input('fontSize','Font size',{type:'number',value:12,min:8,max:24})}`;
case 'blank':return `${sizes()}${input('blankCount','Number of pages',{type:'number',value:1,min:1,max:100})}`;
case 'watermark':return `${input('watermarkText','Watermark text',{value:'CONFIDENTIAL'})}${input('watermarkOpacity','Opacity (0.05–0.7)',{type:'number',value:0.18,min:0.05,max:0.7,step:0.05})}`;
case 'number':return `${input('numberPrefix','Prefix (optional)',{value:''})}${input('numberStart','Start numbering at',{type:'number',value:1,min:1,max:9999})}${select('numberPosition','Position',[['bottom','Bottom'],['top','Top']])}`;
case 'annotate':return `${pagesSelect()}<label class="field"><span>Text to add</span><textarea id="stampText" rows="3" maxlength="250" placeholder="Type your note"></textarea></label>${input('stampSize','Font size',{type:'number',value:16,min:6,max:80})}${input('stampX','Distance from left (points)',{type:'number',value:42,min:0})}${input('stampY','Distance from bottom (points)',{type:'number',value:64,min:0})}`;
case 'stamp':return `${pagesSelect()}<label class="field"><span>Select PNG or JPEG image</span><input id="stampImage" type="file" accept="image/png,image/jpeg"></label>${select('stampPosition','Position',[['bottom-right','Bottom right'],['bottom-left','Bottom left'],['top-right','Top right'],['top-left','Top left']])}${input('stampWidth','Image width (points)',{type:'number',value:175,min:25,max:600})}`;
case 'forms':return `<div id="formFields"><p class="note">Open a fillable PDF and available fields will appear here.</p></div><label class="tick-label"><input id="flattenFields" type="checkbox"> Flatten completed form (cannot edit fields later)</label>`;
case 'export':return `<p class="note">Exports up to 30 pages at high resolution. The PNG images are placed into a ZIP archive.</p>`;
case 'view':return `<p class="note">Use the page navigation above to browse your PDF. Original file stays unchanged.</p>`;
}}
function show(mode){if(!TOOL[mode])return;state.mode=mode;clearEditor();$('workspaceTitle').textContent=TOOL[mode][0];$('workspaceSubtitle').textContent=TOOL[mode][1];$('formArea').innerHTML=getForms(mode);$('workspace').hidden=false;$('workspaceScrim').hidden=false;document.body.classList.add('panel-open');$('workspace').classList.toggle('viewer-workspace',mode==='view');
 const noPdf=['blank','text','photos'].includes(mode);$('fileInputArea').hidden=noPdf;$('editorView').hidden=true;
 $('filePicker').accept=mode==='photos'?'image/*':'.pdf,application/pdf';$('filePicker').multiple=['photos','merge'].includes(mode);
 $('uploadTitle').textContent=mode==='photos'?'Select photos':mode==='merge'?'Select multiple PDFs':'Select a PDF';$('uploadDetails').textContent='Files are processed locally in your browser';
 $('runAction').textContent=mode==='view'?'Close viewer':mode==='organise'?'Save edited PDF':({merge:'Merge PDFs →',split:'Split PDF →',sign:'Sign & save →',photos:'Create PDF →',text:'Create PDF →',blank:'Create PDF →',watermark:'Apply watermark →',number:'Add page numbers →',annotate:'Add text →',stamp:'Stamp image →',forms:'Fill form →',export:'Export PNGs →'})[mode]||'Create file →';
 $('runAction').disabled=false;
 if(mode==='photos')$('fileInputArea').hidden=false;
 if(mode==='sign')requestAnimationFrame(setupSignature);
 if(mode==='organise')bindOrganise();
 if(mode==='forms') $('formFields').textContent='Choose a PDF to inspect its form fields.';
}
function hide(){clearEditor();$('workspace').hidden=true;$('workspaceScrim').hidden=true;$('helpSheet').hidden=true;document.body.classList.remove('panel-open');}
function setupSignature(){const canvas=$('signCanvas');if(!canvas)return;const ctx=canvas.getContext('2d');state.signatureCtx=ctx;ctx.strokeStyle='#162f3a';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';canvas.style.touchAction='none';const pos=(e)=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);state.signatureDrawing=true;const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+0.1,y+0.1);ctx.stroke();state.signature=true;};canvas.onpointermove=e=>{if(!state.signatureDrawing)return;const [x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke();};canvas.onpointerup=canvas.onpointercancel=()=>{state.signatureDrawing=false};$('clearSign').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);state.signature=false;};}
function parseRange(input,max){const selected=[];for(const part of input.replace(/\s/g,'').split(',')){if(!part)continue;const m=part.match(/^(\d+)(?:-(\d+))?$/);if(!m)throw Error('Use page numbers separated by commas, for example 1,3-5.');const a=Number(m[1]),b=Number(m[2]||m[1]);if(a<1||b<a||b>max)throw Error('Page range is outside this PDF.');for(let i=a;i<=b;i++)selected.push(i-1);}if(!selected.length)throw Error('Choose at least one page.');return selected;}
async function fileChosen(){resetResults();const picked=[...$('filePicker').files];if(!picked.length)return;
 try{if(state.mode==='photos'){state.files=picked.filter(f=>f.type.startsWith('image/'));if(state.files.length!==picked.length)throw Error('Choose image files only.');if(state.files.length>50)throw Error('Limit is 50 images.');}
 else {if(picked.length>20)throw Error('Limit is 20 PDF files.');for(const f of picked){if(f.size>core.FILE_LIMIT)throw Error(`File too large: ${f.name}`);}state.files=picked;state.bytes=await core.readPdfFile(picked[0]);}
 drawFiles();if(state.mode==='view'){$('fileInputArea').hidden=true;$('viewerFilename').textContent=picked[0].name;state.zoom=1;}if(!['photos','merge','text','blank'].includes(state.mode)&&state.bytes){state.page=0;await refreshPreview();}
 if(state.mode==='forms'&&state.bytes)await showFields();if(state.mode==='split'&&state.bytes) {const d=await core.describe(state.bytes);$('pageRange').value=`1-${d.pageCount}`;}
 }catch(e){if(state.mode==='view'){$('workspace').classList.remove('viewer-active');$('fileInputArea').hidden=false;}status(errorMessage(e));}}
function drawFiles(){$('fileStack').replaceChildren();state.files.forEach((file,i)=>{const row=document.createElement('div');row.className='file-entry';const name=document.createElement('div');name.className='file-title';const title=document.createElement('b');title.textContent=file.name;const small=document.createElement('small');small.textContent=fmt(file.size);name.append(title,small);const actions=document.createElement('div');actions.className='list-actions';if(['merge','photos'].includes(state.mode)){[['↑',i>0,-1],['↓',i<state.files.length-1,1]].forEach(([label,enabled,delta])=>{const b=document.createElement('button');b.textContent=label;b.disabled=!enabled;b.title=`Move ${delta===-1?'earlier':'later'}`;b.onclick=()=>{[state.files[i],state.files[i+delta]]=[state.files[i+delta],state.files[i]];drawFiles();};actions.append(b);});}row.append(name,actions);$('fileStack').append(row);});$('selectedInfo').hidden=!state.files.length;$('selectedInfo').textContent=`${state.files.length} file${state.files.length===1?'':'s'} selected`;
}
async function refreshPreview(){
  if(!state.bytes)return;
  closePreview();
  try {
    const {doc,close}=await openPreview(state.bytes);
    state.preview={doc,close};
    $('editorView').hidden=false;
    if(state.mode==='view') $('workspace').classList.add('viewer-active');
    await drawPreview();
  } catch(e) {
    $('editorView').hidden=true;
    $('workspace').classList.remove('viewer-active');
    if(state.mode==='view') $('fileInputArea').hidden=false;
    status('Cannot open preview: '+errorMessage(e)+' Try another PDF, or open the original in the Files app.');
  }
}
function showPreviewError(message){
  const placeholder=$('previewPlaceholder');
  placeholder.textContent='Could not render this page: '+message+' — Try “Open in iPhone PDF viewer” below.';
  placeholder.hidden=false;
  $('pdfCanvas').hidden=true;
}
async function drawPreview(){
  const p=state.preview;
  if(!p)return;
  state.page=Math.max(0,Math.min(state.page,p.doc.numPages-1));
  $('pagePosition').textContent=`${state.page+1} / ${p.doc.numPages}`;
  if($('pageNo'))$('pageNo').value=String(state.page+1);
  $('prevPage').disabled=state.page===0;
  $('nextPage').disabled=state.page===p.doc.numPages-1;
  $('zoomLevel').textContent=Math.round(state.zoom*100)+'%';
  const ticket=++state.renderRequest;
  const chosenPage=state.page;
  const chosenZoom=state.zoom;
  $('previewPlaceholder').textContent='Rendering page…';
  $('previewPlaceholder').hidden=false;
  // Serialise renders: PDF.js cannot render two pages simultaneously onto one canvas.
  const next=state.renderQueue.catch(()=>{}).then(async()=>{
    if(ticket!==state.renderRequest||p!==state.preview)return;
    try {
      const box=$('previewBox');
      await renderPage(p.doc,chosenPage,$('pdfCanvas'),{
        cssWidth:Math.max(200,box.clientWidth-24),zoom:chosenZoom,
        pixelRatio:window.devicePixelRatio||1
      });
      if(ticket!==state.renderRequest||p!==state.preview)return;
      $('pdfCanvas').hidden=false;
      $('previewPlaceholder').hidden=true;
    }catch(e){
      if(ticket===state.renderRequest&&p===state.preview)showPreviewError(errorMessage(e));
    }
  });
  state.renderQueue=next;
  return next;
}
function openNativePdf(){
  if(!state.bytes)return;
  // No upload: iOS Safari/Files displays a Blob URL created on the device.
  const blob=new Blob([state.bytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const tab=window.open(url,'_blank');
  if(!tab){download(blob,state.files[0]?.name||'Document.pdf');status('Saved the PDF to Downloads. Open it from Files.',true);}
  setTimeout(()=>URL.revokeObjectURL(url),120000);
}
function setZoom(value){state.zoom=Math.max(0.65,Math.min(3,Math.round(value*100)/100));void drawPreview();}
function pageIndex(){const v=Number(fieldValue('pageNo'))-1;const count=state.preview?.doc.numPages||0;if(!Number.isInteger(v)||v<0||v>=count)throw Error(`Enter a page between 1 and ${count}.`);return v;}
async function historyAction(fn){if(!state.bytes)throw Error('Choose a PDF first.');const original=state.bytes;const updated=await fn(original);state.history.push(original);if(state.history.length>5)state.history.shift();state.bytes=updated;state.redo=[];resetResults();await refreshPreview();$('utilityButtons').hidden=false;}
function bindOrganise(){const actions={rotateLeft:()=>core.rotatePage(state.bytes,state.page,-90),rotateRight:()=>core.rotatePage(state.bytes,state.page,90),insertPage:()=>core.insertBlank(state.bytes,state.page),deletePage:async()=>{const d=await core.describe(state.bytes);if(d.pageCount<2)throw Error('Cannot delete the only page.');return core.reorderPages(state.bytes,Array.from({length:d.pageCount},(_,i)=>i).filter(i=>i!==state.page));},moveUp:async()=>{const d=await core.describe(state.bytes);if(state.page===0)throw Error('Already the first page.');const inds=Array.from({length:d.pageCount},(_,i)=>i);[inds[state.page-1],inds[state.page]]=[inds[state.page],inds[state.page-1]];state.page--;return core.reorderPages(state.bytes,inds);},moveDown:async()=>{const d=await core.describe(state.bytes);if(state.page===d.pageCount-1)throw Error('Already the last page.');const inds=Array.from({length:d.pageCount},(_,i)=>i);[inds[state.page+1],inds[state.page]]=[inds[state.page],inds[state.page+1]];state.page++;return core.reorderPages(state.bytes,inds);}};for(const [key,func] of Object.entries(actions)){$(key).onclick=async()=>{try{await historyAction(func);status('Change applied. Select Save edited PDF when ready.',true);}catch(e){status(errorMessage(e));}};}}
async function showFields(){const infos=await core.listFields(state.bytes);const target=$('formFields');target.replaceChildren();if(!infos.length){target.textContent='No interactive form fields were found in this PDF.';return;}for(const info of infos){const wrapper=document.createElement('label');wrapper.className='field';const cap=document.createElement('span');cap.textContent=info.name;let el;if(info.type==='PDFCheckBox'){el=document.createElement('input');el.type='checkbox';}else{el=document.createElement('input');el.type='text';el.value=info.value||'';el.placeholder=info.type==='PDFTextField'?'Enter a value':`Choose a valid ${info.type} option`; }el.dataset.field=info.name;el.dataset.kind=info.type;wrapper.append(cap,el);target.append(wrapper);}}
async function processAction(){if(state.busy)return;if(state.mode==='view'){hide();return;}state.busy=true;$('runAction').disabled=true;const action=$('runAction').textContent;$('runAction').textContent='Working…';resetResults();
 try{await new Promise(r=>setTimeout(r,20));let result,name='Document.pdf',isZip=false;const mode=state.mode;if(!['blank','text','photos'].includes(mode)&&!state.bytes)throw Error('Choose a PDF file first.');
 switch(mode){
  case 'organise':result=state.bytes;name='Edited.pdf';break;
  case 'merge':{const inputs=[];for(const file of state.files)inputs.push(await core.readPdfFile(file));result=await core.mergePdfs(inputs);name='Merged.pdf';break;}
  case 'split':{const d=await core.describe(state.bytes);if(fieldValue('splitMethod')==='zip'){result=await core.splitZip(state.bytes,(n,t)=>status(`Splitting ${n} of ${t} pages…`));name='Split-pages.zip';isZip=true;}else {result=await core.extractPages(state.bytes,parseRange(fieldValue('pageRange'),d.pageCount));name='Extracted-pages.pdf';}break;}
  case 'sign':if(!state.signature)throw Error('Draw your signature first.');result=await core.signPdf(state.bytes,pageIndex(),$('signCanvas').toDataURL('image/png'),{position:fieldValue('signPosition'),width:Number(fieldValue('signWidth'))});name='Signed.pdf';break;
  case 'photos':result=await core.photosToPdf(state.files,{paper:fieldValue('paperSize'),fit:fieldValue('photoFit')},(n,t)=>status(`Converting ${n} of ${t} images…`));name='Photos.pdf';break;
  case 'text':result=await core.createTextPdf(fieldValue('documentTitle'),fieldValue('documentText'),{paper:fieldValue('paperSize'),fontSize:Number(fieldValue('fontSize'))});name=core.safeName(fieldValue('documentTitle'));break;
  case 'blank':result=await core.makeBlank(fieldValue('paperSize'),Number(fieldValue('blankCount')));name='Blank-pages.pdf';break;
  case 'watermark':result=await core.addWatermark(state.bytes,fieldValue('watermarkText'),{opacity:Number(fieldValue('watermarkOpacity'))});name='Watermarked.pdf';break;
  case 'number':result=await core.addPageNumbers(state.bytes,{prefix:fieldValue('numberPrefix'),start:Number(fieldValue('numberStart')),position:fieldValue('numberPosition')});name='Numbered.pdf';break;
  case 'annotate':result=await core.addText(state.bytes,pageIndex(),fieldValue('stampText'),{x:Number(fieldValue('stampX')),y:Number(fieldValue('stampY')),size:Number(fieldValue('stampSize'))});name='Annotated.pdf';break;
  case 'stamp':{const file=$('stampImage')?.files?.[0];if(!file)throw Error('Choose a PNG or JPEG image.');if(!['image/png','image/jpeg'].includes(file.type))throw Error('Choose PNG or JPEG.');if(file.size>20*1024*1024)throw Error('Maximum stamp image size is 20 MB.');result=await core.addImage(state.bytes,pageIndex(),new Uint8Array(await file.arrayBuffer()),{width:Number(fieldValue('stampWidth')),position:fieldValue('stampPosition')});name='Image-stamped.pdf';break;}
  case 'forms':{const values={};document.querySelectorAll('[data-field]').forEach(el=>{values[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;});result=await core.fillFields(state.bytes,values,{flatten:$('flattenFields').checked});name='Filled-form.pdf';break;}
  case 'export':result=await exportPngsAsZip(state.bytes,core.JSZip,(n,t)=>status(`Rendering ${n} of ${t} pages…`));name='PDF-images.zip';isZip=true;break;
  default:throw Error('Unknown action');
 }
 const blob=result instanceof Blob?result:new Blob([result],{type:isZip?'application/zip':'application/pdf'});fileResult(blob,name);status('Created locally. Tap Save / share to keep your file.',true);
 }catch(e){status('Could not complete: '+errorMessage(e));}finally{state.busy=false;$('runAction').disabled=false;$('runAction').textContent=action;}}

$('toolGrid').addEventListener('click',e=>{const button=e.target.closest('[data-mode]');if(button)show(button.dataset.mode);});$('quickOpen').onclick=()=>show('view');$('chooseFiles').onclick=()=>$('filePicker').click();$('filePicker').onchange=fileChosen;$('closeWorkspace').onclick=hide;$('workspaceScrim').onclick=hide;$('runAction').onclick=processAction;$('shareButton').onclick=share;$('resetTool').onclick=()=>show(state.mode);$('prevPage').onclick=()=>{state.page--;void drawPreview()};$('nextPage').onclick=()=>{state.page++;void drawPreview()};$('zoomOut').onclick=()=>setZoom(state.zoom/1.25);$('zoomIn').onclick=()=>setZoom(state.zoom*1.25);$('zoomFit').onclick=()=>setZoom(1);$('nativeViewer').onclick=openNativePdf;$('viewerChangeFile').onclick=()=>{$('filePicker').value='';$('filePicker').click()};
$('undoButton').onclick=async()=>{if(!state.history.length)return;state.redo.push(state.bytes);state.bytes=state.history.pop();await refreshPreview();};$('redoButton').onclick=async()=>{if(!state.redo.length)return;state.history.push(state.bytes);state.bytes=state.redo.pop();await refreshPreview();};
for(const btn of ['helpBtn','workspaceHelp'])$(btn).onclick=()=>{$('helpSheet').hidden=false;};for(const btn of ['closeHelp','helpDone'])$(btn).onclick=()=>{$('helpSheet').hidden=true;};
window.addEventListener('online',()=>{$('offlineText').textContent='No files leave your device'});window.addEventListener('offline',()=>{$('offlineText').textContent='Offline mode · device processing'});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

// Pinch gesture is handled inside the scrollable PDF viewing surface only.
let pinchStartDistance=0, pinchStartZoom=1;
$('previewBox').addEventListener('touchstart', e=>{
  if(state.mode!=='view'||e.touches.length!==2)return;
  pinchStartDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  pinchStartZoom=state.zoom;
},{passive:true});
$('previewBox').addEventListener('touchend', e=>{
  if(e.touches.length<2&&pinchStartDistance){pinchStartDistance=0;}
},{passive:true});
$('previewBox').addEventListener('touchmove', e=>{
  if(state.mode!=='view'||e.touches.length!==2||!pinchStartDistance)return;
  const distance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  // Only redraw when the fingers are released: avoids repeat rendering while gesturing.
  const value=Math.max(.65,Math.min(3,pinchStartZoom*(distance/pinchStartDistance)));
  $('zoomLevel').textContent=Math.round(value*100)+'%';
  state.pendingPinchZoom=value;
},{passive:true});
$('previewBox').addEventListener('touchend', e=>{
  if(e.touches.length===0&&state.pendingPinchZoom){const zoom=state.pendingPinchZoom;state.pendingPinchZoom=null;setZoom(zoom);}
},{passive:true});
