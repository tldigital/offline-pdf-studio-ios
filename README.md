# Offline PDF Studio Pro — iPhone

A source project for an installable iPhone web application, designed to work without a public App Store listing. Documents are processed in Safari using local JavaScript. **This project is an application source package, not an iOS .ipa installer.** A PWA requires HTTPS hosting and a one-time internet connection to install/cache the app.

## Current release status

This is a **complete source project** with responsive UI and a browser-based PDF processing engine; it is **not yet a published or installed iPhone app**. JavaScript syntax has been checked locally. Full package installation, unit tests, production build and real-iPhone tests must pass before calling the release verified. They were not executable in the present environment because npm registry DNS access failed.

## Features implemented in source

- Preview PDFs, page navigation, merge up to 20 PDFs, reorder/rotate/delete/insert blank pages (undo/redo up to 5 operations), extract page ranges, split-to-ZIP, watermark, page numbers, overlay text/images, fill PDF text and checkbox fields, add **visual** signatures.
- Photos to PDF, text to PDF, blank pages, PDF pages to PNG ZIP.
- Uses `pdf-lib`, PDF.js and JSZip. Document files are processed in the browser; no authentication, upload endpoint, or analytics are included.

## Requirements and limitations

- Requires modern Safari on iPhone and hosting under HTTPS to install on the Home Screen. A Windows computer can build it with Node.js. No Apple developer account or App Store submission needed for the PWA.
- This is **not** certified Adobe Acrobat equivalence. Not supported: certificate-backed signatures, cryptographic redaction, editing existing paragraphs with layout preservation, password-protected PDF editing, OCR, PDF/A or PDF/UA validation, high-fidelity Office conversion.
- `pdf-lib` 1.17.1, `pdfjs-dist` 6.4.299, `jszip` 3.10.1 require an online `npm install` once when building. Built site assets are self-hosted and cache locally. No PDF is sent to a third-party service.
- Some original PDFs may have complex content unsupported by `pdf-lib`; retain your originals and check output. Tests on a physical iPhone and comprehensive security review have **not** been performed in this environment.
- Browser storage, device memory and Safari's sharing behaviour vary by iOS version; don't rely on the PWA as permanent document storage. Save completed files through iOS Files / Share.
- Some languages in Text-to-PDF are rasterised and no longer text-searchable; the interface describes this.

## Build on Windows or macOS

1. Install Node.js 22 or newer.
2. Unzip this project and open a terminal in the folder.
3. Run `BUILD_WINDOWS.bat` (which installs dependencies, runs tests and builds). Alternatively run `npm install`, `npm run check`, `npm test`, then `npm run build`.
4. Confirm that the build and unit tests pass. Upload the **contents of `dist/`** to any HTTPS static host, e.g. a GitHub Pages site or Cloudflare Pages. For GitHub Pages, deploy the `dist` folder via a GitHub Actions workflow.
5. Open the secure site URL in **Safari on your iPhone**. Tap **Share → Add to Home Screen → Add**, optionally enable **Open as Web App**.
6. Visit once with an internet connection to ensure the web app and its PDF libraries are cached. Afterwards, it may function offline.

## GitHub Pages via Actions

Push the repository to GitHub. CI will run on pushes; no site goes live automatically. Open Settings → Pages → Build and deployment → Source: GitHub Actions, then manually run the included **deploy** workflow after checking that CI builds and tests pass. Deployment is not automatically triggered on push. Do **not** upload private PDF content to your public code repository.

## Privacy design

CSP limits scripts and connections to the app's own origin, disables plugins and third-party frames, and the client has no PDF upload routes. GitHub Pages or a static host may log requests for app code and file assets, but document bytes aren't uploaded by the app. Security is a design objective, not an audited guarantee.

## IMPORTANT: Installation versus source code

Unzipping this folder on iPhone **will not** install the app. The files need to be built and hosted over HTTPS first. There is no live app URL included in this ZIP. The iPhone installation is by Safari > Share > Add to Home Screen, not the App Store. If you require a true native `.ipa` app rather than an installable website, this codebase would need to be ported or wrapped, signed with Apple's development tools, and installed via an Apple-supported development distribution route.

See `VALIDATION_REPORT.md` for the precise tests and unverified areas.
