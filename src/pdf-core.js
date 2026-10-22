/** Offline PDF Studio Pro — all document bytes stay inside the browser. */
import { PDFDocument, StandardFonts, rgb, degrees, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import JSZip from 'jszip';
export { JSZip };

export const FILE_LIMIT = 60 * 1024 * 1024;
export const MAX_PAGES = 400;
export const SIZES = Object.freeze({A4:[595.28,841.89], Letter:[612,792], A3:[841.89,1190.55]});
const fromUnit=(n)=>Math.round(n*100)/100;
const textRGB=(hex)=>{const h=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))throw Error('Invalid colour.');return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);};
export function safeName(name,extension='pdf') {return ((name||'Document').trim().replace(/\.pdf$/i,'').replace(/[^\p{L}\p{N} _.-]/gu,'').replace(/^[.\s]+|[.\s]+$/g,'').slice(0,85)||'Document')+'.'+extension;}
export function assertSize(bytes) {if(!bytes?.length)throw Error('Please choose a file.');if(bytes.length>FILE_LIMIT)throw Error('PDF exceeds the 60 MB per-file safety limit.');}
export function pdfHeader(bytes){ const portion=new TextDecoder('latin1').decode(bytes.subarray(0,1024)); return portion.includes('%PDF-'); }
export async function readPdfFile(file) {
  if(!file || !/\.pdf$/i.test(file.name) && file.type!=='application/pdf')throw Error('Please choose a PDF document.');
  if(file.size>FILE_LIMIT)throw Error('Maximum file size is 60 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());assertSize(bytes);
  if(!pdfHeader(bytes))throw Error('The file does not contain a valid PDF header.');
  await openPdf(bytes);return bytes;
}
export async function openPdf(bytes) {
  assertSize(bytes);
  if (!pdfHeader(bytes)) throw Error('This is not a PDF file.');
  try {const doc=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});if(doc.getPageCount()>MAX_PAGES)throw Error('PDF has too many pages (limit 400).');return doc;}
  catch(e){const message=String(e?.message||e);if(/encrypt|password/i.test(message))throw Error('Password-protected PDFs are not supported in this edition. Unlock them in a trusted PDF application first.');throw e;}
}
export async function savePdf(doc){if(!doc.getPageCount())throw Error('A PDF must contain at least one page.');if(doc.getPageCount()>MAX_PAGES)throw Error('Maximum 400 pages.');return new Uint8Array(await doc.save({useObjectStreams:true}));}
export async function describe(bytes){const doc=await openPdf(bytes);return {pageCount:doc.getPageCount(),size:bytes.length,title:doc.getTitle()||''};}
export async function makeBlank(size='A4',count=1){const n=Number(count);if(!Number.isInteger(n)||n<1||n>100)throw Error('Choose 1–100 blank pages.');const doc=await PDFDocument.create();for(let i=0;i<n;i++)doc.addPage(SIZES[size]||SIZES.A4);return savePdf(doc);}
export async function mergePdfs(sourceBytes){if(sourceBytes.length<2)throw Error('Choose at least two PDF files.');if(sourceBytes.length>20)throw Error('Maximum 20 PDF files at a time.');const out=await PDFDocument.create();for(const source of sourceBytes){const doc=await openPdf(source);if(out.getPageCount()+doc.getPageCount()>MAX_PAGES)throw Error('Merged document exceeds 400 pages.');const pages=await out.copyPages(doc,doc.getPageIndices());pages.forEach(p=>out.addPage(p));}return savePdf(out);}
export async function reorderPages(bytes,order){const src=await openPdf(bytes);if(!Array.isArray(order)||order.length<1||order.length>MAX_PAGES)throw Error('No pages selected.');if(order.some(i=>!Number.isInteger(i)||i<0||i>=src.getPageCount()))throw Error('Page order is invalid.');const doc=await PDFDocument.create();const pages=await doc.copyPages(src,order);pages.forEach(p=>doc.addPage(p));return savePdf(doc);}
export async function extractPages(bytes,indices){return reorderPages(bytes,indices);}
export async function splitZip(bytes, progress=()=>{}){const src=await openPdf(bytes);if(src.getPageCount()>100)throw Error('Split-to-ZIP is limited to 100 pages to avoid running out of memory on iPhone.');const zip=new JSZip();for(let i=0;i<src.getPageCount();i++){const doc=await PDFDocument.create();const [p]=await doc.copyPages(src,[i]);doc.addPage(p);zip.file(`page-${String(i+1).padStart(3,'0')}.pdf`,await savePdf(doc));progress(i+1,src.getPageCount());}return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});}
export async function rotatePage(bytes,index,turn=90){const doc=await openPdf(bytes);const p=doc.getPages()[index];if(!p)throw Error('Page was not found.');p.setRotation(degrees((((p.getRotation().angle+turn)%360)+360)%360));return savePdf(doc);}
export async function insertBlank(bytes,afterIndex,size='A4'){const doc=await openPdf(bytes);if(doc.getPageCount()>=MAX_PAGES)throw Error('Maximum 400 pages.');const at=Math.max(0,Math.min(doc.getPageCount(),afterIndex+1));doc.insertPage(at,SIZES[size]||SIZES.A4);return savePdf(doc);}
export async function addWatermark(bytes,text,{opacity=.18,colour='#516274'}={}){if(!text.trim()||text.length>90)throw Error('Enter a watermark (up to 90 characters).');const doc=await openPdf(bytes);const font=await doc.embedFont(StandardFonts.HelveticaBold);const color=textRGB(colour);for(const page of doc.getPages()){const {width,height}=page.getSize();const fontSize=Math.max(22,Math.min(64,width/9));const safe=winAnsi(text)?text:'WATERMARK';const tw=font.widthOfTextAtSize(safe,fontSize);page.drawText(safe,{x:Math.max(8,(width-tw)/2),y:height/2,rotate:degrees(30),size:fontSize,font,color,opacity:Math.min(.7,Math.max(.05,Number(opacity)))});}return savePdf(doc);}
export async function addPageNumbers(bytes,{prefix='',start=1,position='bottom'}={}){const doc=await openPdf(bytes);const font=await doc.embedFont(StandardFonts.Helvetica);doc.getPages().forEach((page,i)=>{const {width,height}=page.getSize(),str=`${prefix}${i+Number(start)}`,sz=10;const txt=winAnsi(str)?str:String(i+Number(start));page.drawText(txt,{x:(width-font.widthOfTextAtSize(txt,sz))/2,y:position==='top'?height-28:23,size:sz,font,color:rgb(.28,.33,.37)});});return savePdf(doc);}
export async function addText(bytes,pageIndex,text,{x=42,y=56,size=15,colour='#103340'}={}){if(!text.trim()||text.length>250)throw Error('Enter up to 250 characters of text.');const doc=await openPdf(bytes);const page=doc.getPages()[pageIndex];if(!page)throw Error('Selected page not found.');const font=await doc.embedFont(StandardFonts.Helvetica);if(!winAnsi(text))throw Error('For this text-stamp tool, use Latin characters.');page.drawText(text,{x:Number(x),y:Math.min(page.getHeight()-30,Math.max(10,Number(y))),size:Number(size),font,color:textRGB(colour),maxWidth:page.getWidth()-60});return savePdf(doc);}
export async function addImage(bytes,pageIndex,imageBytes,{width=180,position='bottom-right'}={}){
 const doc=await openPdf(bytes),page=doc.getPages()[pageIndex];if(!page)throw Error('Selected page not found.');
 let image;try{image=await doc.embedPng(imageBytes);}catch{try{image=await doc.embedJpg(imageBytes);}catch{throw Error('Only PNG and JPEG images can be stamped.');}}
 const margin=24;const targetW=Math.max(20,Math.min(Number(width)||180,page.getWidth()*.8));
 const scale=Math.min(targetW/image.width,(page.getHeight()-margin*2)/image.height);
 const w=image.width*scale,h=image.height*scale;
 const x=position.endsWith('left')?margin:page.getWidth()-w-margin;
 const y=position.startsWith('top')?page.getHeight()-h-margin:margin;
 page.drawImage(image,{x:Math.max(0,x),y:Math.max(0,y),width:w,height:h});return savePdf(doc);
}
export function dataURLBytes(data){if(!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(data))throw Error('Invalid signature format.');const raw=atob(data.split(',')[1]);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export async function signPdf(bytes,pageIndex,signatureDataUrl,opts={}){return addImage(bytes,pageIndex,dataURLBytes(signatureDataUrl),{width:Number(opts.width)||170,position:opts.position||'bottom-right'});}
export function getFieldInfo(doc){return doc.getForm().getFields().map(f=>({name:f.getName(),type:f instanceof PDFTextField?'PDFTextField':f instanceof PDFCheckBox?'PDFCheckBox':f instanceof PDFDropdown?'PDFDropdown':f instanceof PDFRadioGroup?'PDFRadioGroup':'Unsupported',value:f instanceof PDFTextField?f.getText()||'':null}));}
export async function listFields(bytes){const d=await openPdf(bytes);return getFieldInfo(d);}
export async function fillFields(bytes,values,{flatten=false}={}){const doc=await openPdf(bytes);const form=doc.getForm(),fields=form.getFields();for(const field of fields){const name=field.getName();if(!Object.prototype.hasOwnProperty.call(values,name))continue;const val=values[name];if(field instanceof PDFTextField){if(!winAnsi(String(val)))throw Error(`The field "${name}" contains unsupported script characters.`);field.setText(String(val));}else if(field instanceof PDFCheckBox){Boolean(val)?field.check():field.uncheck();}else if(field instanceof PDFDropdown){if(val)field.select(String(val));}else if(field instanceof PDFRadioGroup){if(val)field.select(String(val));}}
 if(flatten){form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));form.flatten();}
 return savePdf(doc);
}
export function winAnsi(str){const allowed=/^[\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]*$/;return allowed.test(str);}
export async function createTextPdf(title,text,{fontSize=12,paper='A4'}={}){
 if(!text.trim())throw Error('Enter document text.');if(text.length>150000)throw Error('Maximum 150,000 characters.');
 const size=SIZES[paper]||SIZES.A4;const doc=await PDFDocument.create();doc.setTitle((title||'Document').slice(0,100));
 if(!winAnsi(title+'\n'+text))return rasterTextPdf(doc,title,text,size,fontSize);
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),margin=48,lineHeight=fontSize*1.55;
 let page=doc.addPage(size), y=size[1]-margin;
 function print(line,isTitle=false){const f=isTitle?bold:font,fs=isTitle?20:Number(fontSize);page.drawText(line||' ',{x:margin,y,size:fs,font:f,color:rgb(.11,.19,.23)});y-=isTitle?31:lineHeight;}
 for(const line of wrapPdf(title||'Document',bold,20,size[0]-margin*2))print(line,true);y-=14;
 for(const para of text.replace(/\r/g,'').split('\n')){const wrapped=para?wrapPdf(para,font,Number(fontSize),size[0]-margin*2):[''];for(const line of wrapped){if(y<margin+lineHeight){page=doc.addPage(size);y=size[1]-margin;}print(line);}}
 return savePdf(doc);
}
function wrapPdf(text,font,size,maxWidth){const out=[];for(const paragraph of String(text).split('\n')){const words=paragraph.split(/\s+/);let s='';for(let word of words){if(!word)continue;while(word.length && font.widthOfTextAtSize(word,size)>maxWidth){let i=1;while(i<word.length && font.widthOfTextAtSize(word.slice(0,i+1),size)<maxWidth)i++;if(s){out.push(s);s='';}out.push(word.slice(0,i));word=word.slice(i);}if(!word)continue;const candidate=s?s+' '+word:word;if(font.widthOfTextAtSize(candidate,size)>maxWidth){if(s)out.push(s);s=word;}else s=candidate;}out.push(s);}return out;}
async function rasterTextPdf(doc,title,text,size,fontSize){
 const scale=2.5,margin=48,maxWidth=size[0]-margin*2;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(size[0]*scale);canvas.height=Math.ceil(size[1]*scale);
 const ctx=canvas.getContext('2d',{alpha:false});ctx.scale(scale,scale);
 const rows=[];
 function fit(str,font,step){ctx.font=font;for(const line of String(str).split('\n')){let wordLine='';for(const word of line.split(' ')){const temp=wordLine?wordLine+' '+word:word;if(ctx.measureText(temp).width>maxWidth&&wordLine){rows.push({line:wordLine,font,step});wordLine=word;}else wordLine=temp;}rows.push({line:wordLine,font,step});}}
 fit(title||'Document','700 20px system-ui',31);rows.push({line:'',font:'12px system-ui',step:15});fit(text,`${Number(fontSize)||12}px system-ui`,(Number(fontSize)||12)*1.6);
 function prep(){ctx.fillStyle='#fff';ctx.fillRect(0,0,size[0],size[1]);ctx.fillStyle='#142a34';ctx.textBaseline='alphabetic';}
 prep();let y=margin+20;let made=0;
 async function finish(){const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image encoding failed')),'image/jpeg',.95));const jpg=await doc.embedJpg(await blob.arrayBuffer());doc.addPage(size).drawImage(jpg,{x:0,y:0,width:size[0],height:size[1]});made++;if(made>100)throw Error('Document exceeds 100 pages.');}
 for(const row of rows){if(y+row.step>size[1]-margin){await finish();prep();y=margin+20;}ctx.font=row.font;ctx.fillText(row.line,margin,y,maxWidth);y+=row.step;}await finish();return savePdf(doc);
}
export async function imageFileJpeg(file){
 if(!file?.type.startsWith('image/'))throw Error('Select image files.');if(file.size>28*1024*1024)throw Error('Image too large (28 MB maximum).');
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('This image could not be decoded by Safari.'));i.src=url;});
  const size=Math.min(1,3800/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*size));canvas.height=Math.max(1,Math.round(image.naturalHeight*size));const c=canvas.getContext('2d',{alpha:false});c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Cannot convert image.')),'image/jpeg',.94));return {bytes:new Uint8Array(await blob.arrayBuffer()),w:canvas.width,h:canvas.height};
 } finally{URL.revokeObjectURL(url);}
}
export async function photosToPdf(files,{paper='A4',fit='contain'}={},progress=()=>{}){
 if(!files.length)throw Error('Choose at least one photo.');if(files.length>50)throw Error('Maximum 50 photos per PDF.');const doc=await PDFDocument.create();const [pw,ph]=SIZES[paper]||SIZES.A4;
 for(let i=0;i<files.length;i++){const {bytes}=await imageFileJpeg(files[i]);const image=await doc.embedJpg(bytes);const page=doc.addPage([pw,ph]);const pad=fit==='cover'?0:24;const scale=(fit==='cover'?Math.max:Math.min)((pw-pad*2)/image.width,(ph-pad*2)/image.height);const w=image.width*scale,h=image.height*scale;page.drawImage(image,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});progress(i+1,files.length);}
 return savePdf(doc);
}
