import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

async function allAssets(folder='dist',prefix='') {
  const out=[];
  for (const e of await readdir(folder,{withFileTypes:true})) {
    const path=folder+'/'+e.name,rel=prefix+e.name;
    if (e.isDirectory()) out.push(...await allAssets(path,rel+'/'));
    else if (e.isFile() && !rel.endsWith('.map') && rel !== 'sw.js' && rel !== '_headers') out.push('./'+rel);
  }
  return out;
}
const assets=['./',...await allAssets()];
const h=createHash('sha256');
for (const asset of assets.slice(1)) { h.update(asset); h.update(await readFile('dist/'+asset.slice(2))); }
const version=h.digest('hex').slice(0,12);
const sw=`const CACHE='offline-pdf-studio-pro-${version}';const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('offline-pdf-studio-pro-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin!==location.origin)return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});`;
await writeFile('dist/sw.js',sw);
console.log('Generated offline service worker with '+assets.length+' local assets.');
