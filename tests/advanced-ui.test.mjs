import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('search, page jump and extracted-text controls exist and have handlers',()=>{
 const html=file('index.html'),js=file('src/main.js');
 for(const id of ['viewerSearch','viewerSearchForm','viewerJumpPage','viewerJump','viewerCopyText','viewerTextContent','viewerSearchResults'])assert.ok(html.includes('id="'+id+'"'),`missing UI ${id}`);
 for(const id of ['viewerSearchForm','viewerJump','viewerCopyText'])assert.ok(js.includes("$('"+id+"')"),`missing handler ${id}`);
});
test('signature and text stamps allow page-specific tap coordinates',()=>{
 const engine=file('src/pdf-core.js'),app=file('src/main.js');
 assert.match(engine,/x:pointX,y:pointY/);
 assert.match(engine,/x:opts.x,y:opts.y/);
 assert.match(app,/tapToPdfPoint/);
 assert.match(app,/state\.placement/);
});
test('PDF.js uses stable packaged worker',()=>{
 const preview=file('src/pdf-preview.js'),build=file('scripts/postbuild.mjs');
 assert.match(preview,/pdf\.worker\.js/);
 assert.match(build,/copyFile\(workerSource, workerOutput\)/);
});
