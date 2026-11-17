// Free Music Player -- full-length free music from Internet Archive
// No API key needed. Tracks are Creative Commons / public domain.

const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_META = 'https://archive.org/metadata';
const IA_DOWNLOAD = 'https://archive.org/download';

// ---- State ----
let playlists = loadPlaylists();
let currentPlaylistId = null;
let currentQueue = [];
let currentQueueIndex = -1;
let currentTrack = null;
let isPlaying = false;
let lastSearchQuery = '';
let searchPage = 1;
let hasMoreResults = false;
let isLoadingMore = false;
let sortOrder = 'downloads+desc';
let repeatMode = 'none';
let playlistViewMode = localStorage.getItem('playlist_view_mode') || 'grid';
let pendingTrackForNewPlaylist = null;
let isOnline = navigator.onLine;
let activeDownloads = new Map();

// ---- DOM Elements ----
const audio = document.getElementById('audioPlayer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const resultCount = document.getElementById('resultCount');
const loadingIndicator = document.getElementById('loadingIndicator');
const playlistList = document.getElementById('playlistList');
const playlistTracks = document.getElementById('playlistTracks');
const playlistTrackList = document.getElementById('playlistTrackList');
const currentPlaylistName = document.getElementById('currentPlaylistName');
const backToPlaylists = document.getElementById('backToPlaylists');
const playAllBtn = document.getElementById('playAllBtn');
const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');
const nowPlaying = document.getElementById('nowPlaying');
const npImage = document.getElementById('npImage');
const npTitle = document.getElementById('npTitle');
const npArtist = document.getElementById('npArtist');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const volumeBar = document.getElementById('volumeBar');
const volumeIcon = document.getElementById('volumeIcon');
const playlistModal = document.getElementById('playlistModal');
const playlistNameInput = document.getElementById('playlistNameInput');
const createPlaylistBtn = document.getElementById('createPlaylistBtn');
const cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');
const addToPlaylistModal = document.getElementById('addToPlaylistModal');
const playlistSelectList = document.getElementById('playlistSelectList');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const archiveImportModal = document.getElementById('archiveImportModal');
const archiveIdInput = document.getElementById('archiveIdInput');
const archiveImportStatus = document.getElementById('archiveImportStatus');
const cancelArchiveImportBtn = document.getElementById('cancelArchiveImportBtn');
const doArchiveImportBtn = document.getElementById('doArchiveImportBtn');
const importFromArchiveBtn = document.getElementById('importFromArchiveBtn');

// ---- Initialization ----
function init() {
    renderPlaylists(); setupEventListeners(); audio.volume = 0.8;
    applyViewMode(playlistViewMode); registerServiceWorker(); updateOnlineStatus(); openDB();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function updateOnlineStatus() {
    isOnline = navigator.onLine;
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) indicator.classList.toggle('hidden', isOnline);
}

function setupEventListeners() {
    searchBtn.addEventListener('click', () => { const q = searchInput.value.trim(); if (q) searchTracks(q); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const q = searchInput.value.trim(); if (q) searchTracks(q); } });
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);
    progressBar.addEventListener('input', () => { if (audio.duration) audio.currentTime = (progressBar.value / 100) * audio.duration; });
    volumeBar.addEventListener('input', () => { audio.volume = volumeBar.value / 100; updateVolumeIcon(); });
    volumeIcon.addEventListener('click', toggleMute);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', () => { totalTimeEl.textContent = formatTime(audio.duration); });
    audio.addEventListener('ended', handleTrackEnded);
    audio.addEventListener('error', () => { showToast('Track unavailable. Trying next...'); setTimeout(playNext, 1000); });
    newPlaylistBtn.addEventListener('click', () => { pendingTrackForNewPlaylist = null; showModal(playlistModal); });
    cancelPlaylistBtn.addEventListener('click', () => { pendingTrackForNewPlaylist = null; hideModal(playlistModal); });
    createPlaylistBtn.addEventListener('click', createPlaylist);
    playlistNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createPlaylist(); });
    cancelAddBtn.addEventListener('click', () => hideModal(addToPlaylistModal));
    backToPlaylists.addEventListener('click', showPlaylistList);
    playAllBtn.addEventListener('click', playAllPlaylistTracks);
    deletePlaylistBtn.addEventListener('click', deleteCurrentPlaylist);
    currentPlaylistName.addEventListener('click', startEditPlaylistName);
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAllPlaylistTracks);
    document.getElementById('listViewBtn').addEventListener('click', () => setViewMode('list'));
    document.getElementById('gridViewBtn').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('exportBtn').addEventListener('click', syncExportPlaylists);
    const importDropdown = document.getElementById('importDropdown');
    document.getElementById('importBtn').addEventListener('click', (e) => { e.stopPropagation(); importDropdown.classList.toggle('hidden'); });
    document.getElementById('importFromDriveBtn').addEventListener('click', () => { importDropdown.classList.add('hidden'); syncImportPlaylists(); });
    importFromArchiveBtn.addEventListener('click', () => { importDropdown.classList.add('hidden'); archiveIdInput.value = ''; archiveImportStatus.classList.add('hidden'); showModal(archiveImportModal); });
    document.addEventListener('click', () => importDropdown.classList.add('hidden'));
    cancelArchiveImportBtn.addEventListener('click', () => hideModal(archiveImportModal));
    doArchiveImportBtn.addEventListener('click', importFromArchive);
    archiveIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') importFromArchive(); });
    confirmCancelBtn.addEventListener('click', () => hideModal(confirmModal));
    [playlistModal, addToPlaylistModal, confirmModal, archiveImportModal].forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(modal); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
        if (e.code === 'ArrowRight' && e.ctrlKey) playNext();
        if (e.code === 'ArrowLeft' && e.ctrlKey) playPrevious();
    });
    window.addEventListener('online', () => { isOnline = true; updateOnlineStatus(); });
    window.addEventListener('offline', () => { isOnline = false; updateOnlineStatus(); });
    const storageInfoBtn = document.getElementById('storageInfoBtn');
    if (storageInfoBtn) storageInfoBtn.addEventListener('click', showStorageInfo);
}

// ---- Search ----
async function searchTracks(query) {
    if (!isOnline) { showToast('You are offline. Search requires internet.'); return; }
    lastSearchQuery = query; searchPage = 1;
    showLoading(true); searchResults.innerHTML = ''; resultCount.textContent = '';
    try {
        const tracks = await searchArchive(query, 1);
        showLoading(false);
        if (tracks.length > 0) {
            currentQueue = tracks; await renderSearchResults(tracks);
            resultCount.textContent = tracks.length + ' tracks';
            if (hasMoreResults) addLoadMoreButton();
        } else {
            searchResults.innerHTML = '<div class="empty-state"><span class="empty-icon">--</span><p>No tracks found.</p></div>';
        }
    } catch (err) {
        showLoading(false);
        searchResults.innerHTML = '<div class="error-state"><span class="error-icon">!</span><p>Search failed. Check your connection.</p></div>';
    }
}

async function loadMoreTracks() {
    if (isLoadingMore || !lastSearchQuery) return;
    isLoadingMore = true;
    const oldBtn = searchResults.querySelector('.load-more-btn');
    if (oldBtn) oldBtn.textContent = 'Loading...';
    try {
        searchPage++;
        const newTracks = await searchArchive(lastSearchQuery, searchPage);
        if (oldBtn) oldBtn.remove();
        if (newTracks.length > 0) {
            const offlineIds = await getAllOfflineTrackIds();
            currentQueue.push(...newTracks);
            newTracks.forEach((track, idx) => {
                const globalIdx = currentQueue.length - newTracks.length + idx;
                searchResults.appendChild(createTrackElement(track, globalIdx, 'search', offlineIds.has(track.id)));
            });
            resultCount.textContent = currentQueue.length + ' tracks';
            if (hasMoreResults) addLoadMoreButton();
        }
    } catch { showToast('Failed to load more tracks'); if (oldBtn) oldBtn.textContent = 'Load More'; }
    isLoadingMore = false;
}

function addLoadMoreButton() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary load-more-btn';
    btn.textContent = 'Load More'; btn.style.width = '100%'; btn.style.marginTop = '12px';
    btn.addEventListener('click', loadMoreTracks);
    searchResults.appendChild(btn);
}

// ---- Rendering ----
async function renderSearchResults(tracks) {
    searchResults.innerHTML = '';
    const offlineIds = await getAllOfflineTrackIds();
    tracks.forEach((track, index) => {
        searchResults.appendChild(createTrackElement(track, index, 'search', offlineIds.has(track.id)));
    });
}

function createTrackElement(track, index, context, isOffline) {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.dataset.trackId = track.id;
    if (currentTrack && currentTrack.id === track.id) div.classList.add('playing');
    const durationStr = track.duration ? formatTime(track.duration) : '';
    const albumDisplay = track.album && track.album.length > 40 ? track.album.substring(0, 40) + '...' : track.album;
    const offlineBadge = isOffline ? '<span class="offline-badge">Offline</span>' : '';
    div.innerHTML = '<img class="track-image" src="' + (track.image || placeholderImage()) + '" alt="' + escapeHtml(track.title) + '" loading="lazy" onerror="this.src=\'' + placeholderImage() + '\'">'
        + '<div class="track-info">'
        + '<div class="track-title" title="' + escapeHtml(track.title) + '">' + escapeHtml(track.title) + '</div>'
        + '<div class="track-artist" title="' + escapeHtml(track.artist) + (track.album ? ' -- ' + escapeHtml(track.album) : '') + '">' + escapeHtml(track.artist) + (albumDisplay ? ' -- ' + escapeHtml(albumDisplay) : '') + '</div>'
        + '<div class="track-duration">' + durationStr + (track.downloads ? ' Â· ' + formatNumber(track.downloads) + ' plays' : '') + ' <span class="full-track-badge">Full track</span> ' + offlineBadge + '</div>'
        + '</div>'
        + '<div class="track-actions">'
        + '<button class="track-action-btn play-btn" title="Play">â–º</button>'
        + (context === 'search' ? '<button class="track-action-btn add-btn" title="Add to playlist">+</button>' : '')
        + (context === 'playlist' ? '<button class="track-action-btn remove-btn" title="Remove">âœ•</button>' : '')
        + '<button class="track-action-btn dl-offline-btn' + (isOffline ? ' dl-offline-saved' : '') + '" title="' + (isOffline ? 'Remove offline copy' : 'Save for offline') + '">' + (isOffline ? 'âœ“' : 'â†“') + '</button>'
        + '<button class="track-action-btn dl-device-btn" title="Download to device">ðŸ’¾</button>'
        + '</div>';
    div.querySelector('.play-btn').addEventListener('click', (e) => { e.stopPropagation(); setQueueAndPlay(context, index, track); });
    div.addEventListener('dblclick', () => setQueueAndPlay(context, index, track));
    if (context === 'search') div.querySelector('.add-btn').addEventListener('click', (e) => { e.stopPropagation(); showAddToPlaylistModal(track); });
    if (context === 'playlist') div.querySelector('.remove-btn').addEventListener('click', (e) => { e.stopPropagation(); removeTrackFromPlaylist(currentPlaylistId, track.id); });
    div.querySelector('.dl-offline-btn').addEventListener('click', (e) => { e.stopPropagation(); handleOfflineToggle(track, div); });
    div.querySelector('.dl-device-btn').addEventListener('click', (e) => { e.stopPropagation(); downloadTrackToDevice(track); });
    return div;
}

async function handleOfflineToggle(track, trackEl) {
    const offline = await isTrackOffline(track.id);
    if (offline) {
        await removeOfflineAudio(track.id);
        updateTrackOfflineUI(trackEl, false);
        showToast('Offline copy removed');
    } else {
        if (!isOnline) { showToast('Cannot download while offline'); return; }
        if (activeDownloads.has(track.id)) { showToast('Already downloading'); return; }
        const btn = trackEl.querySelector('.dl-offline-btn');
        btn.textContent = '...'; btn.disabled = true;
        let progressEl = trackEl.querySelector('.dl-progress-bar');
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.className = 'dl-progress-bar';
            progressEl.innerHTML = '<div class="dl-progress-fill"></div>';
            trackEl.appendChild(progressEl);
        }
        progressEl.style.display = 'block';
        const fillEl = progressEl.querySelector('.dl-progress-fill');
        try {
            await downloadTrackForOffline(track, (p) => { fillEl.style.width = (p * 100) + '%'; });
            updateTrackOfflineUI(trackEl, true);
            showToast('"' + track.title + '" saved for offline');
        } catch (err) {
            showToast(err.name === 'AbortError' ? 'Download cancelled' : 'Download failed');
        } finally {
            btn.disabled = false; progressEl.style.display = 'none';
            const nowOff = await isTrackOffline(track.id);
            updateTrackOfflineUI(trackEl, nowOff);
        }
    }
}

function updateTrackOfflineUI(trackEl, isOffline) {
    const btn = trackEl.querySelector('.dl-offline-btn');
    if (btn) {
        btn.textContent = isOffline ? 'âœ“' : 'â†“';
        btn.title = isOffline ? 'Remove offline copy' : 'Save for offline';
        btn.classList.toggle('dl-offline-saved', isOffline);
    }
    const durationEl = trackEl.querySelector('.track-duration');
    if (durationEl) {
        const existing = durationEl.querySelector('.offline-badge');
        if (isOffline && !existing) {
            const badge = document.createElement('span');
            badge.className = 'offline-badge'; badge.textContent = 'Offline';
            durationEl.appendChild(badge);
        } else if (!isOffline && existing) existing.remove();
    }
}

async function downloadAllPlaylistTracks() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl || pl.tracks.length === 0) { showToast('No tracks to download'); return; }
    if (!isOnline) { showToast('Cannot download while offline'); return; }
    const offlineIds = await getAllOfflineTrackIds();
    const toDownload = pl.tracks.filter(t => !offlineIds.has(t.id));
    if (toDownload.length === 0) { showToast('All tracks already saved offline'); return; }
    showToast('Downloading ' + toDownload.length + ' track' + (toDownload.length !== 1 ? 's' : '') + '...');
    let done = 0, failed = 0;
    for (const track of toDownload) {
        try { await downloadTrackForOffline(track, null); done++; } catch { failed++; }
        const dlBtn = document.getElementById('downloadAllBtn');
        if (dlBtn) dlBtn.textContent = 'â†“ ' + done + '/' + toDownload.length;
    }
    const dlBtn = document.getElementById('downloadAllBtn');
    if (dlBtn) dlBtn.textContent = 'â†“ Offline';
    if (currentPlaylistId) {
        const plNow = playlists.find(p => p.id === currentPlaylistId);
        if (plNow) await renderPlaylistTracksAsync(plNow);
    }
    showToast(done + ' downloaded' + (failed > 0 ? ', ' + failed + ' failed' : ''));
}

async function showStorageInfo() {
    try {
        const info = await getOfflineStorageInfo();
        const sizeMB = (info.totalSize / (1024 * 1024)).toFixed(1);
        showConfirmDialog('Offline Storage',
            info.count + ' track' + (info.count !== 1 ? 's' : '') + ' saved offline (' + sizeMB + ' MB). Clear all offline tracks?',
            async () => {
                const database = await openDB();
                const tx = database.transaction([STORE_AUDIO, STORE_META], 'readwrite');
                tx.objectStore(STORE_AUDIO).clear(); tx.objectStore(STORE_META).clear();
                tx.oncomplete = () => {
                    showToast('All offline tracks cleared');
                    if (currentPlaylistId) {
                        const pl = playlists.find(p => p.id === currentPlaylistId);
                        if (pl) renderPlaylistTracksAsync(pl);
                    }
                };
            }, 'Clear All');
    } catch { showToast('Could not read storage info'); }
}

function setQueueAndPlay(context, index, track) {
    if (context === 'playlist') currentQueue = getAllTracksFromPlaylist();
    currentQueueIndex = index;
    playTrack(track);
}

function getAllTracksFromPlaylist() {
    if (!currentPlaylistId) return [];
    const pl = playlists.find(p => p.id === currentPlaylistId);
    return pl ? [...pl.tracks] : [];
}

function placeholderImage() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%2316213e' width='48' height='48'/%3E%3Ctext x='24' y='30' text-anchor='middle' fill='%236c6c80' font-size='20'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";
}

// ---- Playback ----
async function playTrack(track) {
    if (!track.audioUrl) { showToast('No audio available'); return; }
    currentTrack = track;
    try {
        const cached = await getOfflineAudio(track.id);
        if (cached && cached.blob) {
            const blobUrl = URL.createObjectURL(cached.blob);
            if (audio._blobUrl) URL.revokeObjectURL(audio._blobUrl);
            audio._blobUrl = blobUrl;
            audio.src = blobUrl;
        } else {
            if (audio._blobUrl) { URL.revokeObjectURL(audio._blobUrl); audio._blobUrl = null; }
            audio.src = track.audioUrl;
        }
    } catch {
        audio.src = track.audioUrl;
    }
    audio.play().then(() => { isPlaying = true; updateNowPlaying(); updatePlayingHighlight(); })
        .catch(() => { isPlaying = false; updateNowPlaying(); showToast('Click play to start'); });
}

function togglePlayPause() {
    if (!currentTrack) return;
    if (isPlaying) { audio.pause(); isPlaying = false; }
    else { audio.play().catch(() => {}); isPlaying = true; }
    updateNowPlaying();
}

function handleTrackEnded() {
    if (repeatMode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    if (repeatMode === 'all') { currentQueueIndex = (currentQueueIndex + 1) % currentQueue.length; playTrack(currentQueue[currentQueueIndex]); return; }
    if (currentQueueIndex < currentQueue.length - 1) { currentQueueIndex++; playTrack(currentQueue[currentQueueIndex]); }
    else { isPlaying = false; updateNowPlaying(); }
}

function playNext() {
    if (currentQueue.length === 0) return;
    currentQueueIndex = (currentQueueIndex + 1) % currentQueue.length;
    playTrack(currentQueue[currentQueueIndex]);
}

function toggleRepeat() {
    const btn = document.getElementById('repeatBtn');
    if (repeatMode === 'none') { repeatMode = 'all'; btn.textContent = 'â†»'; btn.classList.add('active'); btn.title = 'Repeat: All'; showToast('Repeat: All tracks'); }
    else if (repeatMode === 'all') { repeatMode = 'one'; btn.textContent = 'â†»Â¹'; btn.classList.add('active'); btn.title = 'Repeat: One'; showToast('Repeat: Current track'); }
    else { repeatMode = 'none'; btn.textContent = 'â†»'; btn.classList.remove('active'); btn.title = 'Repeat: Off'; showToast('Repeat: Off'); }
}

function playPrevious() {
    if (currentQueue.length === 0) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    currentQueueIndex = (currentQueueIndex - 1 + currentQueue.length) % currentQueue.length;
    playTrack(currentQueue[currentQueueIndex]);
}

function updateNowPlaying() {
    if (!currentTrack) { nowPlaying.classList.add('hidden'); return; }
    nowPlaying.classList.remove('hidden');
    npTitle.textContent = currentTrack.title;
    npArtist.textContent = currentTrack.artist;
    npImage.src = currentTrack.image || placeholderImage();
    npImage.alt = currentTrack.title;
    playPauseBtn.textContent = isPlaying ? 'âšâš' : 'â–º';
}

function updateProgress() {
    if (!audio.duration) return;
    progressBar.value = (audio.currentTime / audio.duration) * 100;
    currentTimeEl.textContent = formatTime(audio.currentTime);
}

function updatePlayingHighlight() {
    document.querySelectorAll('.track-item').forEach(el => el.classList.remove('playing'));
    if (!currentTrack) return;
    document.querySelectorAll('.track-item').forEach(el => {
        if (el.dataset.trackId === currentTrack.id) el.classList.add('playing');
    });
}

function toggleMute() {
    if (audio.volume > 0) { audio._prevVolume = audio.volume; audio.volume = 0; volumeBar.value = 0; }
    else { audio.volume = audio._prevVolume || 0.8; volumeBar.value = audio.volume * 100; }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    volumeIcon.textContent = audio.volume === 0 ? 'â—‹' : audio.volume < 0.5 ? 'â—Ž' : 'â—‰';
}

// ---- Playlists ----
function loadPlaylists() {
    try { return JSON.parse(localStorage.getItem('music_playlists') || '[]'); } catch { return []; }
}

function savePlaylists() { localStorage.setItem('music_playlists', JSON.stringify(playlists)); }

function renderPlaylists() {
    playlistList.innerHTML = '';
    if (playlists.length === 0) {
        playlistList.innerHTML = '<div class="empty-state"><span class="empty-icon">--</span><p>No playlists yet. Create one!</p></div>';
        return;
    }
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        const coverUrl = pl.tracks.length > 0 && pl.tracks[0].image ? pl.tracks[0].image : placeholderImage();
        div.innerHTML = '<div class="playlist-item-info">'
            + '<div class="playlist-cover-wrap"><img class="playlist-cover" src="' + coverUrl + '" alt="' + escapeHtml(pl.name) + '" loading="lazy" onerror="this.src=\'' + placeholderImage() + '\'"></div>'
            + '<span class="playlist-icon">â™ª</span>'
            + '<div class="playlist-item-text"><div class="playlist-name">' + escapeHtml(pl.name) + '</div>'
            + '<div class="playlist-count">' + pl.tracks.length + ' track' + (pl.tracks.length !== 1 ? 's' : '') + '</div></div></div>';
        div.addEventListener('click', () => openPlaylist(pl.id));
        playlistList.appendChild(div);
    });
}

function setViewMode(mode) { playlistViewMode = mode; localStorage.setItem('playlist_view_mode', mode); applyViewMode(mode); }

function applyViewMode(mode) {
    const listBtn = document.getElementById('listViewBtn');
    const gridBtn = document.getElementById('gridViewBtn');
    if (mode === 'grid') { playlistList.classList.add('grid-view'); gridBtn.classList.add('active'); listBtn.classList.remove('active'); }
    else { playlistList.classList.remove('grid-view'); listBtn.classList.add('active'); gridBtn.classList.remove('active'); }
}

function createPlaylist() {
    const name = playlistNameInput.value.trim();
    if (!name) { showToast('Enter a playlist name'); return; }
    const newPl = { id: 'pl_' + Date.now(), name, tracks: [], createdAt: new Date().toISOString() };
    if (pendingTrackForNewPlaylist) { newPl.tracks.push({ ...pendingTrackForNewPlaylist }); pendingTrackForNewPlaylist = null; }
    playlists.push(newPl); savePlaylists(); renderPlaylists(); hideModal(playlistModal); playlistNameInput.value = '';
    showToast(newPl.tracks.length > 0 ? 'Created "' + name + '" with 1 track' : 'Playlist "' + name + '" created');
}

function openPlaylist(id) {
    currentPlaylistId = id;
    const pl = playlists.find(p => p.id === id);
    if (!pl) return;
    currentPlaylistName.textContent = pl.name;
    playlistList.classList.add('hidden');
    playlistTracks.classList.remove('hidden');
    renderPlaylistTracksAsync(pl);
}

function renderPlaylistTracks(pl) {
    playlistTrackList.innerHTML = '';
    if (pl.tracks.length === 0) { playlistTrackList.innerHTML = '<div class="empty-state"><span class="empty-icon">â™ª</span><p>No tracks yet. Search and add some!</p></div>'; return; }
    pl.tracks.forEach((track, index) => { playlistTrackList.appendChild(createTrackElement(track, index, 'playlist', false)); });
}

async function renderPlaylistTracksAsync(pl) {
    playlistTrackList.innerHTML = '';
    if (pl.tracks.length === 0) { playlistTrackList.innerHTML = '<div class="empty-state"><span class="empty-icon">â™ª</span><p>No tracks yet. Search and add some!</p></div>'; return; }
    const offlineIds = await getAllOfflineTrackIds();
    pl.tracks.forEach((track, index) => { playlistTrackList.appendChild(createTrackElement(track, index, 'playlist', offlineIds.has(track.id))); });
}

function startEditPlaylistName() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl) return;
    const h3 = currentPlaylistName;
    const oldName = pl.name;
    const input = document.createElement('input');
    input.type = 'text'; input.value = oldName; input.maxLength = 50; input.className = 'playlist-name-edit';
    h3.textContent = ''; h3.appendChild(input); input.focus(); input.select();
    function commitEdit() {
        const newName = input.value.trim();
        if (newName && newName !== oldName) { pl.name = newName; savePlaylists(); showToast('Playlist renamed'); }
        h3.textContent = pl.name;
    }
    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } if (e.key === 'Escape') { input.value = oldName; input.blur(); } });
}

function showPlaylistList() {
    currentPlaylistId = null;
    playlistTracks.classList.add('hidden'); playlistList.classList.remove('hidden');
    renderPlaylists();
}

function showAddToPlaylistModal(track) {
    playlistSelectList.innerHTML = '';
    const createDiv = document.createElement('div');
    createDiv.className = 'playlist-select-item playlist-select-create';
    createDiv.innerHTML = '<span class="playlist-icon">+</span><span>Create new playlist</span>';
    createDiv.addEventListener('click', () => { hideModal(addToPlaylistModal); pendingTrackForNewPlaylist = track; showModal(playlistModal); });
    playlistSelectList.appendChild(createDiv);
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-select-item';
        const exists = pl.tracks.some(t => t.id === track.id);
        div.innerHTML = '<span class="playlist-icon">â™ª</span><span>' + escapeHtml(pl.name) + ' (' + pl.tracks.length + ')' + (exists ? ' âœ“' : '') + '</span>';
        if (!exists) div.addEventListener('click', () => { addTrackToPlaylist(pl.id, track); hideModal(addToPlaylistModal); });
        else { div.style.opacity = '0.5'; div.style.cursor = 'default'; }
        playlistSelectList.appendChild(div);
    });
    addToPlaylistModal.querySelector('h3').textContent = 'Add to Playlist';
    showModal(addToPlaylistModal);
}

function addTrackToPlaylist(pid, track) {
    const pl = playlists.find(p => p.id === pid);
    if (!pl || pl.tracks.some(t => t.id === track.id)) { showToast('Already in playlist'); return; }
    pl.tracks.push({ ...track }); savePlaylists();
    showToast('Added to "' + pl.name + '"'); renderPlaylists();
    if (currentPlaylistId === pid) renderPlaylistTracksAsync(pl);
}

function removeTrackFromPlaylist(pid, tid) {
    const pl = playlists.find(p => p.id === pid);
    if (!pl) return;
    pl.tracks = pl.tracks.filter(t => t.id !== tid);
    savePlaylists(); renderPlaylistTracksAsync(pl); showToast('Track removed');
}

function deleteCurrentPlaylist() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl) return;
    showConfirmDialog('Delete Playlist', 'Are you sure you want to delete "' + pl.name + '"? This cannot be undone.', () => {
        playlists = playlists.filter(p => p.id !== currentPlaylistId);
        savePlaylists(); showPlaylistList(); showToast('Playlist deleted');
    });
}

function showConfirmDialog(title, message, onConfirm, okLabel) {
    confirmTitle.textContent = title; confirmMessage.textContent = message;
    showModal(confirmModal);
    const currentOkBtn = document.getElementById('confirmOkBtn');
    const newOkBtn = currentOkBtn.cloneNode(true);
    currentOkBtn.parentNode.replaceChild(newOkBtn, currentOkBtn);
    newOkBtn.textContent = okLabel || 'Delete';
    newOkBtn.className = (okLabel && okLabel !== 'Delete') ? 'btn btn-primary' : 'btn btn-danger';
    newOkBtn.addEventListener('click', () => { hideModal(confirmModal); onConfirm(); });
}

// ---- Import from Internet Archive ----
let pendingArchiveTracks = [];

async function importFromArchive() {
    let input = archiveIdInput.value.trim();
    if (!input) { showToast('Enter an Archive identifier or URL'); return; }
    const userMatch = input.match(/archive\.org\/details\/@([^/?#]+)/) || input.match(/^@(.+)$/);
    if (userMatch) { await importFromArchiveUser(userMatch[1]); return; }
    const urlMatch = input.match(/archive\.org\/details\/([^/?#]+)/);
    if (urlMatch) input = urlMatch[1];
    const identifier = input.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!identifier) { showToast('Invalid identifier'); return; }
    archiveImportStatus.classList.remove('hidden');
    archiveImportStatus.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0 auto 8px"></div><p>Fetching tracks...</p>';
    doArchiveImportBtn.disabled = true;
    try {
        const tracks = await fetchArchiveItemTracks({ identifier, title: identifier, creator: '', downloads: 0 });
        if (tracks.length === 0) { archiveImportStatus.innerHTML = '<p class="import-error">No playable audio tracks found.</p>'; doArchiveImportBtn.disabled = false; return; }
        pendingArchiveTracks = tracks; hideModal(archiveImportModal); showArchivePlaylistPicker(tracks, identifier);
    } catch { archiveImportStatus.innerHTML = '<p class="import-error">Failed to fetch item.</p>'; }
    doArchiveImportBtn.disabled = false;
}

async function importFromArchiveUser(username) {
    archiveImportStatus.classList.remove('hidden');
    archiveImportStatus.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0 auto 8px"></div><p>Fetching uploads by @' + escapeHtml(username) + '...</p>';
    doArchiveImportBtn.disabled = true;
    try {
        const url = IA_SEARCH + '?q=' + encodeURIComponent('uploader:' + username + ' AND mediatype:audio') + '&fl[]=identifier,title,creator,downloads&sort[]=addeddate+desc&rows=50&output=json';
        const response = await fetch(url);
        const data = await response.json();
        const items = data.response?.docs || [];
        if (items.length === 0) { archiveImportStatus.innerHTML = '<p class="import-error">No audio uploads found for @' + escapeHtml(username) + '.</p>'; doArchiveImportBtn.disabled = false; return; }
        archiveImportStatus.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0 auto 8px"></div><p>Found ' + items.length + ' items. Fetching tracks...</p>';
        const results = await Promise.allSettled(items.map(item => fetchArchiveItemTracks(item)));
        const allTracks = [];
        for (const r of results) { if (r.status === 'fulfilled' && r.value.length > 0) allTracks.push(...r.value); }
        if (allTracks.length === 0) { archiveImportStatus.innerHTML = '<p class="import-error">No playable tracks found.</p>'; doArchiveImportBtn.disabled = false; return; }
        pendingArchiveTracks = allTracks; hideModal(archiveImportModal); showArchivePlaylistPicker(allTracks, '@' + username);
    } catch { archiveImportStatus.innerHTML = '<p class="import-error">Failed to fetch uploads.</p>'; }
    doArchiveImportBtn.disabled = false;
}

function showArchivePlaylistPicker(tracks, identifier) {
    const label = tracks.length + ' track' + (tracks.length !== 1 ? 's' : '');
    playlistSelectList.innerHTML = '';
    const createDiv = document.createElement('div');
    createDiv.className = 'playlist-select-item playlist-select-create';
    createDiv.innerHTML = '<span class="playlist-icon">+</span><span>Create new playlist (' + label + ')</span>';
    createDiv.addEventListener('click', () => {
        hideModal(addToPlaylistModal);
        const name = identifier.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const newPl = { id: 'pl_' + Date.now(), name, tracks: [...tracks], createdAt: new Date().toISOString() };
        playlists.push(newPl); savePlaylists(); renderPlaylists(); openPlaylist(newPl.id);
        showToast('Created "' + name + '" with ' + label);
    });
    playlistSelectList.appendChild(createDiv);
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-select-item';
        div.innerHTML = '<span class="playlist-icon">â™ª</span><span>' + escapeHtml(pl.name) + ' (' + pl.tracks.length + ')</span>';
        div.addEventListener('click', () => {
            hideModal(addToPlaylistModal);
            let added = 0;
            for (const t of tracks) { if (!pl.tracks.some(x => x.id === t.id)) { pl.tracks.push({ ...t }); added++; } }
            savePlaylists(); if (currentPlaylistId === pl.id) renderPlaylistTracksAsync(pl);
            renderPlaylists(); showToast('Added ' + added + ' track' + (added !== 1 ? 's' : '') + ' to "' + pl.name + '"');
            openPlaylist(pl.id);
        });
        playlistSelectList.appendChild(div);
    });
    addToPlaylistModal.querySelector('h3').textContent = 'Add ' + label + ' to Playlist';
    showModal(addToPlaylistModal);
}

function playAllPlaylistTracks() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl || pl.tracks.length === 0) { showToast('No tracks to play'); return; }
    currentQueue = [...pl.tracks]; currentQueueIndex = 0; playTrack(currentQueue[0]);
}

// ---- UI Helpers ----
function showLoading(show) { loadingIndicator.classList.toggle('hidden', !show); searchResults.classList.toggle('hidden', show); }
function showModal(m) { m.classList.remove('hidden'); const i = m.querySelector('input'); if (i) setTimeout(() => i.focus(), 100); }
function hideModal(m) { m.classList.add('hidden'); }

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');
}

function formatSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

let toastTimeout;
function showToast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- Start ----
init();
