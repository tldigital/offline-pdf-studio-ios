import {readdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Copy the PDF.js worker from the exact version used by the main renderer.
// Keeping it as .js makes GitHub Pages serve it with a recognised JS MIME type.
const workerSource = new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url);
const workerOutput = new URL('../dist/pdf.worker.js', import.meta.url);
await copyFile(workerSource, workerOutput);
if ((await stat(workerOutput)).size < 100_000) throw Error('PDF.js worker was not copied correctly.');

async function allAssets(folder='dist',prefix='') {
  const out=[];
  for (const entry of await readdir(folder,{withFileTypes:true})) {
    const path=folder+'/'+entry.name, relative=prefix+entry.name;
    if (entry.isDirectory()) out.push(...await allAssets(path,relative+'/'));
    else if (entry.isFile() && !relative.endsWith('.map') && relative !== 'sw.js' && relative !== '_headers') out.push('./'+relative);
  }
  return out;
}
const assets=['./',...await allAssets()];
if (!assets.includes('./pdf.worker.js')) throw Error('PDF worker missing from offline asset list.');
const h=createHash('sha256');
for (const asset of assets.slice(1)) {h.update(asset);h.update(await readFile('dist/'+asset.slice(2)));}
const version=h.digest('hex').slice(0,12);
// Network-first for navigations and the stable worker path, to avoid serving
// obsolete copies after a Pages release. Cache remains available offline.
const sw = `const CACHE='offline-pdf-studio-pro-${version}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('offline-pdf-studio-pro-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  const networkFirst=req.mode==='navigate'||url.pathname.endsWith('/pdf.worker.js');
  if(networkFirst){
    e.respondWith(fetch(req).then(response=>{
      if(response.ok) e.waitUntil(caches.open(CACHE).then(c=>c.put(req,response.clone())).catch(()=>{}));
      return response;
    }).catch(async()=>{
      const cached=await caches.match(req);
      if(cached)return cached;
      if(req.mode==='navigate'){
        const offlinePage=await caches.match('./');
        if(offlinePage)return offlinePage;
      }
      throw Error('Requested offline resource is not cached.');
    }));
    return;
  }
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});`;
await writeFile('dist/sw.js',sw);
console.log(`Generated offline service worker with ${assets.length} local assets, including the PDF.js worker (${version}).`);
