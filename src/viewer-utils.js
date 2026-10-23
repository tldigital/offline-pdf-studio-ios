/** Browser-independent PDF viewer helpers. No document contents are persisted. */
export function normaliseText(parts) {
  const joined = (Array.isArray(parts) ? parts.map(x => typeof x === 'string' ? x : String(x?.str ?? '')).join(' ') : String(parts || ''));
  return joined.replace(/\s+/g, ' ').trim();
}
export function findSnippet(source, query, radius=48) {
  const raw=normaliseText(source), q=normaliseText(query);
  if(!q)return null;
  const offset=raw.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());
  if(offset<0)return null;
  const start=Math.max(0, offset-radius), end=Math.min(raw.length,offset+q.length+radius);
  return `${start?'…':''}${raw.slice(start,end)}${end<raw.length?'…':''}`;
}
/** One result per matching page. Avoids retaining full extracted PDF text in the UI. */
export async function searchDocument(doc, query, {maxResults=80, cancelled=()=>false, onProgress=()=>{}}={}) {
  const q=normaliseText(query);
  if(q.length<2)throw new Error('Enter at least two characters to search.');
  if(q.length>100)throw new Error('Search is limited to 100 characters.');
  if(!doc || !Number.isInteger(doc.numPages))throw new Error('Open a PDF before searching.');
  const results=[];
  for(let i=0;i<doc.numPages;i++) {
    if(cancelled())break;
    const page=await doc.getPage(i+1);
    const content=await page.getTextContent();
    const sentence=normaliseText(content.items||[]);
    const snippet=findSnippet(sentence,q);
    if(snippet!==null)results.push({page:i,snippet});
    if(i%8===0 || i===doc.numPages-1)onProgress(i+1,doc.numPages);
    if(results.length>=maxResults)break;
  }
  return results;
}
/** Map a tap in CSS canvas coordinates to PDF points (origin at bottom left). */
export function tapToPdfPoint(viewport, rect, clientX, clientY) {
  if(!viewport?.convertToPdfPoint||!rect||rect.width<=0||rect.height<=0)throw new Error('Page is not ready for placement.');
  const x=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(clientY-rect.top)/rect.height));
  const [pdfX,pdfY]=viewport.convertToPdfPoint(x*viewport.width,y*viewport.height);
  if(!Number.isFinite(pdfX)||!Number.isFinite(pdfY))throw new Error('Could not calculate PDF placement.');
  return {x:pdfX,y:pdfY,relativeX:x,relativeY:y};
}
