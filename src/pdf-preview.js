import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const MAX_PREVIEW_PIXELS = 6_000_000;
export async function openPreview(bytes) {
  // isEvalSupported:false reduces attack surface with untrusted PDF files.
  const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(bytes),isEvalSupported:false, enableScripting:false, useSystemFonts:true});
  const doc = await loadingTask.promise;
  return { doc, close: () => { void loadingTask.destroy(); } };
}
export async function renderPage(doc, pageIndex, canvas, scale = 1.4) {
  if (!doc || pageIndex < 0 || pageIndex >= doc.numPages) throw Error('Page is out of range.');
  const page = await doc.getPage(pageIndex + 1);
  const viewportBase = page.getViewport({scale:1});
  const maxScale = Math.sqrt(MAX_PREVIEW_PIXELS/(viewportBase.width*viewportBase.height));
  const safeScale = Math.min(scale, maxScale);
  const viewport = page.getViewport({scale:safeScale});
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', {alpha:false});
  try {await page.render({canvasContext:ctx,viewport,background:'#fff'}).promise;}
  finally {page.cleanup();}
  return {width:canvas.width,height:canvas.height};
}
export async function exportPngsAsZip(bytes, zipClass, progress = () => {}) {
  const {doc,close}=await openPreview(bytes);
  try {
    if (doc.numPages > 30) throw Error('PNG export is limited to 30 pages for iPhone memory safety.');
    const zip = new zipClass();
    const canvas = document.createElement('canvas');
    for (let i=0;i<doc.numPages;i++) {
      await renderPage(doc,i,canvas,2.2);
      const blob = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG creation failed.')),'image/png'));
      zip.file(`page-${String(i+1).padStart(3,'0')}.png`,await blob.arrayBuffer());
      progress(i+1,doc.numPages);
    }
    canvas.width=canvas.height=1;
    return await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
  } finally {close();}
}
