# Validation and security status — 22 October 2026

## Checks completed in this environment
- `npm run check`: **PASS** (syntax of main app, PDF core and PDF.js integration).
- `node --check tests/pdf-core.test.mjs`: **PASS**.
- HTML ID uniqueness and PWA manifest/package JSON: **PASS**.
- Responsive dashboard static-rendered at 390px and 1240px: **PASS**, 14 tool cards, no horizontal overflow.
- Browser UI smoke with isolated/mock PDF engine: **PASS**, navigation to blank/text/sign tools, basic workflow state, share result UI, Help dialog.

## Checks NOT completed
- `npm install`, `npm test` (real PDF engine), `npm run build`: **NOT EXECUTED SUCCESSFULLY**, because this environment cannot resolve npm registry/download dependencies.
- iPhone Safari real-device, touch memory stress, offline installation, arbitrary malicious PDF fuzzing, high-security PDF validation: **NOT TESTED**.
- Side-by-side professional output parity with Adobe Acrobat: **NOT TESTED**.

## Security features in source
- PDF bytes remain in JavaScript memory; no upload endpoint, telemetry or account implementation.
- Strict Content Security Policy: self-origin only scripts/connect (and controlled workers).
- PDF.js rendering disables eval and PDF scripting; pinned recent PDF.js version.
- Cache only app files, not user PDFs. App does not persist document bytes in browser storage.
- File caps (60 MB PDF; 20 input PDFs; 400 output pages) plus lower limits on image and ZIP export.
- Files selected by the user remain local; exports use the iOS share sheet or download.

## Important limits
Local processing is a privacy feature, not a complete security audit. Host HTTPS securely, keep dependencies updated, review the built bundle, test with sample files, and keep originals. Avoid sensitive files until real-device tests and dependency security checks pass.
