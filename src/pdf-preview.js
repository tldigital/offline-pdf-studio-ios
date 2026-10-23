// The PDF.js legacy build is required for reliable rendering in Safari on iOS 18.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const MAX_PREVIEW_PIXELS = 6_000_000;
export async function openPreview(bytes) {
  // isEvalSupported:false reduces attack surface with untrusted PDF files.
  const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(bytes),isEvalSupported:false, enableScripting:false, useSystemFonts:true});
  const doc = await loadingTask.promise;
  return { doc, close: () => { void loadingTask.destroy(); } };
}
// The same renderer powers the visible viewer and full-resolution image export.
// In the viewer choose a CSS width first, then render at device-pixel resolution.
export async function renderPage(doc, pageIndex, canvas, options = 1.4) {
  if (!doc || pageIndex < 0 || pageIndex >= doc.numPages) throw Error('Page is out of range.');
  const page = await doc.getPage(pageIndex + 1);
  try {
    const unit = page.getViewport({scale: 1});
    const width = unit.width;
    const height = unit.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw Error('Invalid PDF page dimensions.');
    const settings = typeof options === 'number' ? {scale: options} : options;
    const mobileView = Number.isFinite(settings.cssWidth) && settings.cssWidth > 0;
    const requestedCssScale = mobileView ? (settings.cssWidth / width) * (settings.zoom || 1) : (settings.scale || 1.4);
    const ratio = mobileView ? Math.min(2, Math.max(1, Number(settings.pixelRatio) || window.devicePixelRatio || 1)) : 1;
    const maxScale = Math.sqrt(MAX_PREVIEW_PIXELS / (width * height));
    const renderScale = Math.max(0.1, Math.min(requestedCssScale * ratio, maxScale));
    const viewport = page.getViewport({scale: renderScale});
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    // Keep the physical pixel count capped without shrinking the displayed page.
    const cssScale = mobileView ? requestedCssScale : renderScale;
    canvas.style.width = `${Math.round(width * cssScale)}px`;
    canvas.style.height = `${Math.round(height * cssScale)}px`;
    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) throw Error('The browser could not start the PDF canvas.');
    // PDF.js 6 recommends passing the canvas explicitly (canvasContext is legacy).
    await page.render({canvas, viewport, background: '#ffffff'}).promise;
    return {width: canvas.width, height: canvas.height};
  } finally {page.cleanup();}
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
