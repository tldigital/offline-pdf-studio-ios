import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
test('Safari-compatible PDF renderer and worker are used together',()=>{
  const source=read('src/pdf-preview.js');
  assert.match(source,/pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(source,/new URL\('pdf\.worker\.js', document\.baseURI\)/);
  assert.match(source,/page\.render\(\{canvas, viewport,/);
});
test('reader provides usable mobile controls and native fallback',()=>{
  const html=read('index.html');
  const main=read('src/main.js');
  for(const id of ['zoomIn','zoomOut','zoomFit','nativeViewer','viewerChangeFile']){
    assert.ok(html.includes(`id="${id}"`),`Missing viewer button ${id}`);
    assert.ok(main.includes(`$('${id}')`),`Missing viewer handler ${id}`);
  }
  assert.match(main,/state\.renderQueue/);
  assert.match(main,/Could not render this page:/);
});
test('reader can occupy the entire mobile viewport',()=>{
  const css=read('src/style.css');
  assert.match(css,/\.viewer-workspace\.viewer-active \.pdf-preview/);
  assert.match(css,/max-height:none/);
});

test('Pages build bundles the matching PDF worker and prevents stale viewer resources',()=>{
  const source=read('scripts/postbuild.mjs');
  assert.match(source,/copyFile\(workerSource, workerOutput\)/);
  assert.match(source,/pdf\.worker\.min\.mjs/);
  assert.match(source,/dist\/pdf\.worker\.js/);
  assert.match(source,/assets\.includes\('\.\/pdf\.worker\.js'\)/);
  assert.match(source,/networkFirst=req\.mode==='navigate'/);
});
test('failed PDF.js setup retains a native iPhone viewer escape route',()=>{
  const source=read('src/main.js');
  assert.match(source,/Keep the native viewer button accessible/);
  assert.match(source,/\$\('editorView'\)\.hidden=false/);
  assert.match(source,/Open in iPhone PDF viewer/);
});
