"""Local UI smoke test. This uses stubbed PDF operations; it does not certify PDF output."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'\s*<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
html=html.replace('<link rel="stylesheet" href="./src/style.css">','<style>'+(root/'src/style.css').read_text()+'</style>')
html=html.replace('<script type="module" src="./src/main.js"></script>','')
source=(root/'src/main.js').read_text()
source=re.sub(r'^import \* as core from .*?;\s*','const core=window.mockCore;\n',source,count=1)
source=re.sub(r'^import \{openPreview,renderPage,exportPngsAsZip\} from .*?;\s*','const {openPreview,renderPage,exportPngsAsZip}=window.mockPreview;\n',source,count=1,flags=re.M)
mock="""
window.mockCore={
 FILE_LIMIT:60000000,
 makeBlank:async ()=>new Uint8Array([37,80,68,70,45,49,46,55]),
 createTextPdf:async ()=>new Uint8Array([37,80,68,70,45,49,46,55]),
 safeName:(n)=>String(n).replace(/[^a-z0-9 _-]/gi,'')+'.pdf',
 readPdfFile:async f=>new Uint8Array([37,80,68,70,45,49,46,55]),
 describe:async()=>({pageCount:2}),
 listFields:async()=>[],
 mergePdfs:async()=>new Uint8Array([37,80,68,70,45,49,46,55]),
 photosToPdf:async()=>new Uint8Array([37,80,68,70,45,49,46,55])
};
window.mockPreview={openPreview:async()=>({doc:{numPages:2},close(){}}),renderPage:async()=>{},exportPngsAsZip:async()=>new Blob(['test'])};
"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    page.set_default_timeout(2500)
    page.set_content(html)
    page.add_script_tag(content=mock)
    page.add_script_tag(content=source)
    assert page.locator('.tool-card').count()==14
    assert page.evaluate('document.documentElement.scrollWidth')<=390
    page.locator('[data-mode="blank"]').click()
    assert page.locator('#workspace').is_visible()
    assert page.locator('#blankCount').input_value()=='1'
    page.locator('#blankCount').fill('3')
    page.locator('#runAction').click()
    page.wait_for_timeout(100)
    assert page.locator('#resultPanel').is_visible(),page.locator('#status').inner_text()
    assert 'Blank-pages.pdf' in page.locator('#resultTitle').inner_text()
    page.locator('#closeWorkspace').click()
    assert page.locator('#workspace').is_hidden()
    page.locator('[data-mode="text"]').click()
    page.locator('#documentText').fill('Local text PDF generator smoke test.')
    page.locator('#runAction').click()
    page.wait_for_timeout(100)
    assert page.locator('#resultPanel').is_visible()
    page.locator('#closeWorkspace').click()
    page.locator('[data-mode="sign"]').click()
    assert page.locator('#signCanvas').is_visible()
    page.locator('#workspaceHelp').click()
    assert page.locator('#helpSheet').is_visible()
    page.locator('#closeHelp').click()
    browser.close()
print('PASS: 14 tool cards, iPhone viewport, blank/text workflows (mock), modal, signature canvas, help')
