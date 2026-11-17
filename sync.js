// ---- Google Drive Sync (via SafePlace iframe + postMessage) ----
const SAFE_PLACE_ORIGIN = 'https://dat5ngon.github.io';
const SAFE_PLACE_APP = 'music-player';
const SAFE_PLACE_FILE = 'playlists.json';
const safePlaceFrame = document.getElementById('safePlaceFrame');
const exportBtn = document.getElementById('exportBtn');
const syncStatus = document.getElementById('syncStatus');

function safePlaceRequest(action, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
        if (!safePlaceFrame.contentWindow) { reject(new Error('Safe Place iframe not available.')); return; }
        const id = 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const timeout = setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('Safe Place not responding.')); }, 10000);
        function handler(event) {
            if (event.origin !== SAFE_PLACE_ORIGIN) return;
            const msg = event.data;
            if (!msg || msg.type !== 'safeplace-response' || msg.id !== id) return;
            clearTimeout(timeout); window.removeEventListener('message', handler);
            if (msg.ok) resolve(msg); else reject(new Error(msg.error || 'Unknown error'));
        }
        window.addEventListener('message', handler);
        safePlaceFrame.contentWindow.postMessage(Object.assign({ type: 'safeplace-request', id: id, action: action }, params), SAFE_PLACE_ORIGIN);
    });
}

async function checkSafePlaceAuth() { try { await safePlaceRequest('ping'); return true; } catch { return false; } }

function handleSyncError(err) {
    setSyncStatus('');
    const msg = err.message || '';
    if (msg.includes('not authenticated') || msg.includes('Not authenticated'))
        showConfirmDialog('Sign in Required', 'Sign in to Safe Place first.', () => window.open('https://dat5ngon.github.io/safe-place/', '_blank'), 'Open Safe Place');
    else if (msg.includes('not responding'))
        showConfirmDialog('Connection Issue', 'Could not connect to Safe Place.', () => window.open('https://dat5ngon.github.io/safe-place/', '_blank'), 'Open Safe Place');
    else showConfirmDialog('Sync Error', msg || 'An unknown error occurred.', () => {}, 'OK');
}

async function syncExportPlaylists() {
    if (playlists.length === 0) { showToast('No playlists to export'); return; }
    try {
        setSyncStatus('Checking sign-in...'); exportBtn.disabled = true;
        if (!(await checkSafePlaceAuth())) {
            setSyncStatus(''); showConfirmDialog('Sign in Required', 'Sign in to Safe Place first.', () => window.open('https://dat5ngon.github.io/safe-place/', '_blank'), 'Open Safe Place');
            exportBtn.disabled = false; return;
        }
        setSyncStatus('Backing up...');
        await safePlaceRequest('save', { app: SAFE_PLACE_APP, filename: SAFE_PLACE_FILE, data: playlists });
        setSyncStatus('Backed up ' + playlists.length + ' playlist' + (playlists.length !== 1 ? 's' : ''));
        showToast('Playlists backed up to Google Drive');
    } catch (err) { handleSyncError(err); } finally { exportBtn.disabled = false; }
}

async function syncImportPlaylists() {
    try {
        setSyncStatus('Checking sign-in...');
        if (!(await checkSafePlaceAuth())) {
            setSyncStatus(''); showConfirmDialog('Sign in Required', 'Sign in to Safe Place first.', () => window.open('https://dat5ngon.github.io/safe-place/', '_blank'), 'Open Safe Place');
            return;
        }
        setSyncStatus('Restoring...');
        const result = await safePlaceRequest('load', { app: SAFE_PLACE_APP, filename: SAFE_PLACE_FILE });
        if (!result.data) { setSyncStatus(''); showToast('No playlists found on Google Drive'); return; }
        const imported = result.data;
        if (!Array.isArray(imported)) { setSyncStatus(''); showConfirmDialog('Sync Error', 'Invalid backup data.', () => {}, 'OK'); return; }
        const existingIds = new Set(playlists.map(p => p.id));
        let added = 0, updated = 0;
        for (const pl of imported) {
            if (!pl.id || !pl.name) continue;
            if (existingIds.has(pl.id)) {
                const local = playlists.find(p => p.id === pl.id);
                if (local) { local.tracks = pl.tracks || []; local.name = pl.name; updated++; }
            } else { playlists.push(pl); added++; }
        }
        savePlaylists(); renderPlaylists();
        const parts = [];
        if (added > 0) parts.push(added + ' new');
        if (updated > 0) parts.push(updated + ' updated');
        const summary = parts.length > 0 ? parts.join(', ') : 'No changes';
        setSyncStatus('Restored: ' + summary); showToast('Restore complete: ' + summary);
    } catch (err) { handleSyncError(err); }
}

function setSyncStatus(msg, isError) {
    syncStatus.textContent = msg;
    syncStatus.className = 'sync-status' + (isError ? ' sync-error' : '');
    if (msg && !isError) setTimeout(() => { if (syncStatus.textContent === msg) syncStatus.textContent = ''; }, 4000);
}
