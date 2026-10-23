import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {
 makeBlank,openPdf,describe,mergePdfs,reorderPages,rotatePage,insertBlank,
 addWatermark,addPageNumbers,addText,fillFields,listFields,extractPages,
 createTextPdf,safeName,pdfHeader,splitZip,addImage,signPdf
} from '../src/pdf-core.js';

test('creates a valid A4 PDF with 3 pages',async()=>{
 const bytes=await makeBlank('A4',3),d=await openPdf(bytes);
 assert.equal(d.getPageCount(),3);assert(Math.abs(d.getPage(0).getWidth()-595.28)<1);
 assert(pdfHeader(bytes));
});
test('rejects invalid blank page counts',async()=>{await assert.rejects(()=>makeBlank('A4',0));await assert.rejects(()=>makeBlank('A4',101));});
test('merges and extracts PDFs without rasterising pages',async()=>{
 const a=await makeBlank('Letter',2),b=await makeBlank('A3',1);
 const m=await mergePdfs([a,b]);assert.equal((await describe(m)).pageCount,3);
 const out=await extractPages(m,[2,0]);const d=await openPdf(out);assert.equal(d.getPageCount(),2);assert(d.getPages()[0].getWidth()>800);
});
test('rotates and inserts blank pages',async()=>{let pdf=await makeBlank('Letter',2);pdf=await rotatePage(pdf,0,90);pdf=await insertBlank(pdf,0,'A4');const d=await openPdf(pdf);assert.equal(d.getPageCount(),3);assert.equal(d.getPage(0).getRotation().angle,90);});
test('reorders pages to a different paper size sequence',async()=>{const a=await makeBlank('Letter',1),b=await makeBlank('A4',1),merged=await mergePdfs([a,b]);const re=await reorderPages(merged,[1,0]);const d=await openPdf(re);assert(Math.abs(d.getPage(0).getWidth()-595.28)<1);});
test('adds watermark, page numbering and annotations',async()=>{let b=await makeBlank('A4',2);b=await addWatermark(b,'DRAFT');b=await addPageNumbers(b,{start:3,prefix:'Page '});b=await addText(b,0,'Approved',{size:15});assert.equal((await describe(b)).pageCount,2);});
test('fills interactive PDF form fields',async()=>{const d=await PDFDocument.create();d.addPage([612,792]);const f=d.getForm();f.createTextField('Full Name').addToPage(d.getPage(0));f.createCheckBox('I Agree').addToPage(d.getPage(0));const src=new Uint8Array(await d.save());assert.equal((await listFields(src)).length,2);const out=await fillFields(src,{'Full Name':'Jane Doe','I Agree':true});const result=await openPdf(out);assert.equal(result.getForm().getTextField('Full Name').getText(),'Jane Doe');assert.equal(result.getForm().getCheckBox('I Agree').isChecked(),true);});
test('creates searchable text PDFs',async()=>{const b=await createTextPdf('Work summary','The quick brown fox jumps over the lazy dog.',{fontSize:12,paper:'A4'});assert.equal((await describe(b)).pageCount,1);});
test('splits all PDF pages to ZIP',async()=>{const src=await makeBlank('A4',3);const blob=await splitZip(src);assert(blob.size>300);});
test('handles malicious names and bad headers safely',async()=>{assert.equal(safeName('../../<script>.pdf'),'script.pdf');await assert.rejects(()=>openPdf(new Uint8Array([1,2,3])),/not a PDF/i);});
test('cannot merge a single PDF',async()=>{const one=await makeBlank('A4',1);await assert.rejects(()=>mergePdfs([one]));});

test('signature at page-tap coordinates saves a valid PDF',async()=>{
 const bytes=await makeBlank('A4',2);
 // A small, valid PNG fixture; the sign tool accepts a drawn canvas PNG.
 const {readFileSync}=await import('node:fs');
 const png=readFileSync(new URL('../public/icons/icon-192.png',import.meta.url));
 const signed=await signPdf(bytes,1,'data:image/png;base64,'+png.toString('base64'),{x:200,y:300,width:85});
 assert.equal((await openPdf(signed)).getPageCount(),2);
 assert(signed.length>bytes.length);
});
