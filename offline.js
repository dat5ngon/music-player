// ---- IndexedDB for offline audio ----
const DB_NAME = 'music_player_offline';
const DB_VERSION = 1;
const STORE_AUDIO = 'audio_files';
const STORE_META = 'audio_meta';
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) { resolve(db); return; }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_AUDIO)) database.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
            if (!database.objectStoreNames.contains(STORE_META)) database.createObjectStore(STORE_META, { keyPath: 'id' });
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
        request.onerror = () => reject(request.error);
    });
}

async function saveAudioOffline(trackId, blob, track) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_AUDIO, STORE_META], 'readwrite');
        tx.objectStore(STORE_AUDIO).put({ id: trackId, blob, savedAt: Date.now() });
        tx.objectStore(STORE_META).put({
            id: trackId, title: track.title, artist: track.artist, album: track.album,
            duration: track.duration, image: track.image, audioUrl: track.audioUrl,
            source: track.source, size: blob.size, savedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getOfflineAudio(trackId) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_AUDIO, 'readonly');
        const request = tx.objectStore(STORE_AUDIO).get(trackId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

async function isTrackOffline(trackId) { return !!(await getOfflineAudio(trackId)); }

async function getAllOfflineTrackIds() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, 'readonly');
        const request = tx.objectStore(STORE_META).getAllKeys();
        request.onsuccess = () => resolve(new Set(request.result || []));
        request.onerror = () => reject(request.error);
    });
}

async function removeOfflineAudio(trackId) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_AUDIO, STORE_META], 'readwrite');
        tx.objectStore(STORE_AUDIO).delete(trackId);
        tx.objectStore(STORE_META).delete(trackId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getOfflineStorageInfo() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, 'readonly');
        const request = tx.objectStore(STORE_META).getAll();
        request.onsuccess = () => {
            const items = request.result || [];
            const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
            resolve({ count: items.length, totalSize });
        };
        request.onerror = () => reject(request.error);
    });
}

async function downloadTrackForOffline(track, progressCallback) {
    if (!track.audioUrl) throw new Error('No audio URL');
    const controller = new AbortController();
    activeDownloads.set(track.id, controller);
    try {
        const response = await fetch(track.audioUrl, { signal: controller.signal });
        if (!response.ok) throw new Error('Download failed');
        const total = parseInt(response.headers.get('content-length') || '0', 10);
        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (progressCallback && total > 0) progressCallback(loaded / total);
        }
        const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mpeg' });
        await saveAudioOffline(track.id, blob, track);
        return blob;
    } finally { activeDownloads.delete(track.id); }
}

function cancelDownload(trackId) {
    const controller = activeDownloads.get(trackId);
    if (controller) { controller.abort(); activeDownloads.delete(trackId); }
}

async function downloadTrackToDevice(track) {
    if (!track.audioUrl) { showToast('No audio URL'); return; }
    showToast('Preparing download...');
    try {
        const cached = await getOfflineAudio(track.id);
        let blob = cached ? cached.blob : null;
        if (!blob) {
            const response = await fetch(track.audioUrl);
            if (!response.ok) throw new Error('Download failed');
            blob = await response.blob();
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = track.audioUrl.match(/\.(mp3|ogg|m4a)/i)?.[1] || 'mp3';
        a.download = ((track.artist || 'Unknown') + ' - ' + (track.title || 'Track') + '.' + ext).replace(/[<>:"/\\|?*]/g, '_');
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Download started');
    } catch (err) {
        if (err.name !== 'AbortError') showToast('Download failed');
    }
}

