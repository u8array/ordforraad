# libs/ – Externe Bibliotheken

## Kein manueller Download nötig

sql.js und JSZip werden **automatisch** beim ersten Installieren der Extension
von jsDelivr heruntergeladen und in `chrome.storage.local` gecacht.

Ablauf:
1. Extension in Chrome laden → `chrome.runtime.onInstalled` feuert
2. `background.js` → `libManager.install()` → Fetch von CDN → Storage
3. Beim ersten Popup-Öffnen: `libManager.ensureLoaded()` liest aus Storage
   und injiziert die Bibliotheken als Blob-URLs

Falls der CDN-Download beim Install fehlschlägt (kein Internet), holt
`ensureLoaded()` die Bibliotheken beim nächsten Popup-Öffnen nach.

---

## CDN-Versionen (pinned)

| Bibliothek | Version | URL |
|---|---|---|
| sql.js     | 1.12.0  | `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.*` |
| JSZip      | 3.10.1  | `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` |

Version hochbumpen: `LIB_VERSION` in `src/setup/libManager.js` ändern
→ erzwingt Re-Download beim nächsten `onInstalled` (Extension-Update).

---

## Extension laden (Chrome)

1. `chrome://extensions/` öffnen
2. "Entwicklermodus" aktivieren
3. "Entpackte Erweiterung laden" → Projektroot auswählen (`ordforråd/`)
4. LM Studio starten, Modell `gemma-3-27b-it` laden (Server: Port 1234)
5. Rechtsklick auf ein dänisches Wort → **"📖 Zu Ordforråd hinzufügen"**
