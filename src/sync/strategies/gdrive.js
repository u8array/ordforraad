/**
 * Google Drive strategy – stores cards in appDataFolder.
 *
 * appDataFolder is hidden from the user's Drive UI and only
 * accessible by this extension (scope: drive.appdata).
 */

const FILES_URL  = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_NAME  = 'ordforrad-cards.json';

// ── Auth ──────────────────────────────────────────────────────────────────────

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

// ── File lookup ───────────────────────────────────────────────────────────────

async function findFileId(token) {
  const url = `${FILES_URL}?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id)`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Loads cards from Drive. Returns [] if no file exists yet. */
export async function load() {
  const token  = await getToken(false);
  const fileId = await findFileId(token);
  if (!fileId) return [];
  const res = await fetch(`${FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive read failed: ${res.status}`);
  return res.json();
}

/** Saves cards to Drive (creates or overwrites the file). */
export async function save(cards) {
  const token    = await getToken(false);
  const fileId   = await findFileId(token);
  const metadata = JSON.stringify(
    fileId ? {} : { name: FILE_NAME, parents: ['appDataFolder'] }
  );
  const body = new FormData();
  body.append('metadata', new Blob([metadata], { type: 'application/json' }));
  body.append('media',    new Blob([JSON.stringify(cards)], { type: 'application/json' }));

  const url    = fileId ? `${UPLOAD_URL}/${fileId}?uploadType=multipart` : `${UPLOAD_URL}?uploadType=multipart`;
  const method = fileId ? 'PATCH' : 'POST';
  const res    = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body });
  if (!res.ok) throw new Error(`Drive write failed: ${res.status}`);
}

/** Opens the OAuth consent screen (interactive). */
export async function connect() {
  await getToken(true);
}

/** Revokes and removes the cached token. */
export async function disconnect() {
  const token = await getToken(false).catch(() => null);
  if (!token) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' });
  await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
}
