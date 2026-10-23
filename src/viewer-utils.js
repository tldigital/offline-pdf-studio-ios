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

/** Turn a phrase into character offsets across PDF.js text runs. These map
 * to DOM Range positions, so hits can be painted over the actual PDF page.
 * A space may be encoded as a separate run (or omitted at a run boundary).
 */
export function locateTextMatches(parts,query,{limit=80}={}){
  if(!Array.isArray(parts)||!query?.trim())return [];
  const words=query.trim().split(/\s+/u);
  const escaped=words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const expression=new RegExp(escaped.join('\\s*'),'giu');
  const joined=parts.map(v=>String(v||'')).join('');
  const boundaries=[0];
  for(const item of parts)boundaries.push(boundaries.at(-1)+String(item||'').length);
  const nodeFor=(index,atEnd=false)=>{
    for(let i=0;i<parts.length;i++){
      if(index<boundaries[i+1] || (atEnd&&index===boundaries[i+1]))return {node:i,offset:index-boundaries[i]};
    }
    return {node:Math.max(0,parts.length-1),offset:String(parts.at(-1)||'').length};
  };
  const found=[];
  for(const hit of joined.matchAll(expression)){
    if(!hit[0].length)continue;
    found.push({start:nodeFor(hit.index),end:nodeFor(hit.index+hit[0].length,true)});
    if(found.length>=limit)break;
  }
  return found;
}
