import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseText,findSnippet,searchDocument,tapToPdfPoint} from '../src/viewer-utils.js';

test('PDF text extraction normalises readable text',()=>{
 assert.equal(normaliseText([{str:'hello'},{str:'world'}]),'hello world');
 assert.equal(normaliseText('  hello\n   world '),'hello world');
});
test('search snippets are case-insensitive and safely bounded',()=>{
 assert.match(findSnippet('A document with a Confidential attachment.','confidential'),/Confidential/);
 assert.equal(findSnippet('abcdef','z'),null);
});
test('searches matching pages without uploading PDF content',async()=>{
 const texts=['introduction','private contract and number','memo CONTRACT terms'];
 const doc={numPages:texts.length,async getPage(n){return {async getTextContent(){return {items:[{str:texts[n-1]}]}}}}};
 const res=await searchDocument(doc,'contract');
 assert.deepEqual(res.map(x=>x.page),[1,2]);
});
test('supports cancellation and rejects empty queries',async()=>{
 const doc={numPages:5,async getPage(){throw Error('should not read cancelled page')}};
 assert.deepEqual(await searchDocument(doc,'contract',{cancelled:()=>true}),[]);
 await assert.rejects(()=>searchDocument(doc,'a'),/at least two/);
});
test('tap placement correctly maps CSS pixels to PDF points',()=>{
 const viewport={width:200,height:400,convertToPdfPoint(x,y){return [x,400-y]}};
 assert.deepEqual(tapToPdfPoint(viewport,{left:20,top:30,width:100,height:200},70,130),{x:100,y:200,relativeX:.5,relativeY:.5});
});
