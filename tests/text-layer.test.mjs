import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {locateTextMatches} from '../src/viewer-utils.js';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/pdf-preview.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('finds an Adobe-like phrase split between PDF text spans',()=>{
 const spans=['Our Benefits ', 'Additional', ' ', 'Role', ' Information'];
 const hits=locateTextMatches(spans,'additional role');
 assert.equal(hits.length,1);
 assert.deepEqual(hits[0],{start:{node:1,offset:0},end:{node:3,offset:4}});
});
test('accepts spaces absent at item boundaries',()=>{
 const hits=locateTextMatches(['Additional','Role'],'additional role');
 assert.deepEqual(hits[0],{start:{node:0,offset:0},end:{node:1,offset:4}});
});
test('finds all occurrences, caps highlights and matches case-insensitively',()=>{
 assert.equal(locateTextMatches(['role role ROLE'],'role').length,3);
 assert.equal(locateTextMatches(['role role ROLE'],'role',{limit:2}).length,2);
 assert.equal(locateTextMatches(['A.+B'],'A.+B').length,1);
 assert.equal(locateTextMatches(['AaaB'],'A.+B').length,0);
});
test('empty query and invalid input do not highlight anything',()=>{
 assert.deepEqual(locateTextMatches(['abc'],'   '),[]);
 assert.deepEqual(locateTextMatches(null,'abc'),[]);
});
test('viewer layers selectable text above the unchanged PDF canvas',()=>{
 assert.match(html,/id="pdfTextLayer" class="textLayer pdf-text-layer"/);
 assert.match(html,/id="pdfSearchHighlights"/);
 assert.match(main,/await renderTextOverlay\(p.doc,chosenPage,\$\('pdfTextLayer'\),canvas\)/);
 assert.match(preview,/pdfjsLib\.TextLayer/);
 assert.match(preview,/pdfjs-dist\/web\/pdf_viewer\.css/);
 assert.match(style,/-webkit-user-select:text/);
 assert.match(style,/\.pdf-search-highlights\{[^}]*pointer-events:none/);
 assert.match(main,/state\.searchTerm=query/);
 assert.match(main,/state\.scrollToHit=true/);
 assert.match(main,/highlightSearchOnPage\(\)/);
 assert.match(main,/state\.preview\.doc\.getPage\(state\.page \+ 1\)/);
});
