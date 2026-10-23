import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
test('Safari-compatible PDF renderer and worker are used together',()=>{
  const source=read('src/pdf-preview.js');
  assert.match(source,/pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(source,/pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs\?url/);
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
