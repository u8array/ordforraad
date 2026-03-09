# libs/ – Third‑party libraries

This extension vendors the runtime libraries it needs for Anki export.

Why vendor them?
- Manifest V3 + Chrome Web Store policies generally require shipping all executable code inside the extension package (no “download code from a CDN and execute it”).
- The popup loads these libraries via local `<script src="../../libs/...">` tags.
- Offline / first-run reliability: no network dependency.

Files in this folder are expected to be committed to the repo.

---

## What is used at runtime

- `libs/sql-wasm.js` (sql.js loader; provides global `initSqlJs`)
- `libs/sql-wasm.wasm` (WASM binary used by sql.js)
- `libs/jszip.min.js` (provides global `JSZip`)

The popup includes these scripts in [src/popup/popup.html](src/popup/popup.html).

---

## Pinned upstream versions

| Library | Version | Upstream URL |
|---|---:|---|
| sql.js (sql-wasm build) | 1.14.0 | `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/sql-wasm.*` |
| JSZip | 3.10.1 | `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` |

Tip: JSZip’s version is also in the header comment of `libs/jszip.min.js`.

---

## Updating the vendored libs

1. Download the new upstream files:
   - sql.js: `sql-wasm.js` and `sql-wasm.wasm`
   - JSZip: `jszip.min.js`
2. Replace the corresponding files in `libs/`.
3. Update the table above (version + URLs).
4. Smoke test:
   - Load the unpacked extension and open the popup.
   - Create 1–2 cards and run Anki export (ensures WASM + ZIP work).

Note: If sql.js changes the WASM filename/path expectations, ensure the popup still finds `sql-wasm.wasm` (sql.js uses `locateFile` / relative paths).

---

## Loading the extension (Chrome)

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the project root (`ordforråd/`)
4. Start LM Studio, load a model, and ensure the server is running on port 1234
5. Right‑click a word → **”Add to Ordforråd”**
