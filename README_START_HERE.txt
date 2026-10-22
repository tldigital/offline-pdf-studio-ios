OFFLINE PDF STUDIO PRO — IPHONE INSTALLABLE APP
==========================================
THIS IS A SOURCE RELEASE, NOT YET AN INSTALLED IPHONE APP.

What has been created:
- Professional iPhone-sized PDF Studio interface and source code for 14 PDF tasks.
- Code for local PDF processing with pdf-lib, PDF.js and JSZip.
- Local-only document design: no uploading, accounts or analytics.
- Offline service worker and iPhone Home Screen manifest.
- Automated source checks, PDF-engine tests and deployment workflow.

How to get this onto your iPhone without the App Store:
  1. On Windows, install Node.js 22 or later.
  2. Extract this ZIP completely; double-click BUILD_WINDOWS.bat.
  3. Confirm the automated tests pass and the 'dist' folder is produced.
  4. Deploy the contents of dist to an HTTPS hosting service.
     GitHub Pages automated deployment is provided in .github/workflows/deploy.yml.
  5. On your iPhone, open the HTTPS URL in Safari.
  6. Tap Share > Add to Home Screen > Open as Web App > Add.
  7. Load it once while online; app files cache for later offline use.

IMPORTANT HONEST LIMITS:
- This environment could NOT install npm dependencies or perform a completed
  production build/actual PDF-engine tests, because access to npm was blocked.
- This release is NOT certified production-safe or verified on physical iPhone.
- No live HTTPS installation URL is provided here. Publishing is still required.
- No secure redaction, document-password encryption, OCR, certificate-backed
  signatures, high-fidelity DOCX conversion or perfect Acrobat compatibility.
- A handwritten signature is a visual stamp only.
- Before handling confidential originals, validate the app on your own device.

Full instructions: README.md
