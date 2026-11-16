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
let sortOrder = 'downloads+desc'; // 'downloads+desc', 'date+desc', 'titleSorter+asc'
let repeatMode = 'none'; // 'none', 'all', 'one'

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

// ---- Initialization ----
function init() {
    renderPlaylists();
    setupEventListeners();
    audio.volume = 0.8;
    searchTracks('rock');
}

function setupEventListeners() {
    searchBtn.addEventListener('click', () => {
        const q = searchInput.value.trim();
        if (q) {
            document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
            searchTracks(q);
        }
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim();
            if (q) {
                document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
                searchTracks(q);
            }
        }
    });

    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            if (tag.classList.contains('active')) {
                // Deactivate -- clear filter
                tag.classList.remove('active');
                searchInput.value = '';
            } else {
                document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                searchInput.value = tag.dataset.tag;
                searchTracks(tag.dataset.tag);
            }
        });
    });

    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sortOrder = btn.dataset.sort;
            const q = searchInput.value.trim() || lastSearchQuery;
            if (q) searchTracks(q);
        });
    });

    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);

    progressBar.addEventListener('input', () => {
        if (audio.duration) audio.currentTime = (progressBar.value / 100) * audio.duration;
    });

    volumeBar.addEventListener('input', () => {
        audio.volume = volumeBar.value / 100;
        updateVolumeIcon();
    });
    volumeIcon.addEventListener('click', toggleMute);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', () => {
        totalTimeEl.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('ended', handleTrackEnded);
    audio.addEventListener('error', () => {
        showToast('Track unavailable. Trying next...');
        setTimeout(playNext, 1000);
    });

    newPlaylistBtn.addEventListener('click', () => showModal(playlistModal));
    cancelPlaylistBtn.addEventListener('click', () => hideModal(playlistModal));
    createPlaylistBtn.addEventListener('click', createPlaylist);
    playlistNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createPlaylist(); });
    cancelAddBtn.addEventListener('click', () => hideModal(addToPlaylistModal));

    backToPlaylists.addEventListener('click', showPlaylistList);
    playAllBtn.addEventListener('click', playAllPlaylistTracks);
    deletePlaylistBtn.addEventListener('click', deleteCurrentPlaylist);

    [playlistModal, addToPlaylistModal].forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(modal); });
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
        if (e.code === 'ArrowRight' && e.ctrlKey) playNext();
        if (e.code === 'ArrowLeft' && e.ctrlKey) playPrevious();
    });
}

// ---- Search ----
async function searchTracks(query) {
    lastSearchQuery = query;
    searchPage = 1;
    showLoading(true);
    searchResults.innerHTML = '';
    resultCount.textContent = '';

    try {
        const tracks = await searchArchive(query, 1);
        showLoading(false);

        if (tracks.length > 0) {
            currentQueue = tracks;
            renderSearchResults(tracks);
            resultCount.textContent = `${tracks.length} tracks`;
            if (hasMoreResults) addLoadMoreButton();
        } else {
            searchResults.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">—</span>
                    <p>No tracks found. Try a different search term.</p>
                </div>`;
        }
    } catch (err) {
        showLoading(false);
        searchResults.innerHTML = `
            <div class="error-state">
                <span class="error-icon">!</span>
                <p>Search failed. Check your connection and try again.</p>
            </div>`;
    }
}

async function loadMoreTracks() {
    if (isLoadingMore || !lastSearchQuery) return;
    isLoadingMore = true;

    // Remove old load more button
    const oldBtn = searchResults.querySelector('.load-more-btn');
    if (oldBtn) oldBtn.textContent = 'Loading...';

    try {
        searchPage++;
        const newTracks = await searchArchive(lastSearchQuery, searchPage);

        // Remove load more button
        if (oldBtn) oldBtn.remove();

        if (newTracks.length > 0) {
            currentQueue.push(...newTracks);
            newTracks.forEach((track, idx) => {
                const globalIdx = currentQueue.length - newTracks.length + idx;
                searchResults.appendChild(createTrackElement(track, globalIdx, 'search'));
            });
            resultCount.textContent = `${currentQueue.length} tracks`;
            if (hasMoreResults) addLoadMoreButton();
        }
    } catch {
        showToast('Failed to load more tracks');
        if (oldBtn) oldBtn.textContent = 'Load More';
    }

    isLoadingMore = false;
}

function addLoadMoreButton() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary load-more-btn';
    btn.textContent = 'Load More';
    btn.style.width = '100%';
    btn.style.marginTop = '12px';
    btn.addEventListener('click', loadMoreTracks);
    searchResults.appendChild(btn);
}

// ---- Internet Archive API ----
const ITEMS_PER_PAGE = 10;

async function searchArchive(query, page) {
    // Use quoted phrase for multi-word queries to get exact matches
    const quoted = query.includes(' ') ? `"${query}"` : query;
    // Search in music-specific collections, exclude podcasts/speeches/audiobooks
    const searchQuery = `mediatype:audio AND NOT subject:(podcast OR lecture OR sermon OR audiobook OR speech) AND (creator:(${quoted}) OR title:(${quoted}) OR subject:(${quoted}))`;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const url = `${IA_SEARCH}?q=${encodeURIComponent(searchQuery)}&fl[]=identifier,title,creator,downloads,num_favorites&sort[]=${sortOrder}&rows=${ITEMS_PER_PAGE}&start=${start}&output=json`;

    const response = await fetch(url);
    const data = await response.json();

    const totalFound = data.response?.numFound || 0;
    hasMoreResults = (start + ITEMS_PER_PAGE) < totalFound;

    if (!data.response?.docs?.length) return [];

    // Fetch files for each item in parallel
    const items = data.response.docs;
    const results = await Promise.allSettled(
        items.map(item => fetchArchiveItemTracks(item))
    );

    const allTracks = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allTracks.push(...result.value);
        }
    }

    // Sort by relevance: prioritize tracks where query appears in title or artist
    const queryLower = query.toLowerCase();
    allTracks.sort((a, b) => {
        const scoreA = relevanceScore(a, queryLower);
        const scoreB = relevanceScore(b, queryLower);
        if (scoreB !== scoreA) return scoreB - scoreA;
        // Secondary sort: downloads
        return (b.downloads || 0) - (a.downloads || 0);
    });

    return allTracks;
}

function relevanceScore(track, queryLower) {
    let score = 0;
    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const album = (track.album || '').toLowerCase();

    // Exact match in artist name (highest priority)
    if (artist === queryLower) score += 100;
    else if (artist.includes(queryLower)) score += 60;

    // Exact match in title
    if (title === queryLower) score += 80;
    else if (title.includes(queryLower)) score += 40;

    // Match in album
    if (album.includes(queryLower)) score += 30;

    // Penalize "Unknown Artist"
    if (artist === 'unknown artist' || artist === 'unknown') score -= 20;

    // Penalize very long tracks (likely lectures/podcasts that slipped through)
    if (track.duration > 1800) score -= 15; // > 30 min

    return score;
}

async function fetchArchiveItemTracks(item) {
    try {
        const response = await fetch(`${IA_META}/${item.identifier}`);
        const meta = await response.json();

        if (!meta.files) return [];

        // Find all audio files (browser-compatible formats)
        const allAudio = meta.files.filter(f => {
            const name = (f.name || '').toLowerCase();
            const duration = f.length ? parseFloat(f.length) : 0;
            return (name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a')) &&
                   f.source !== 'metadata' &&
                   !name.includes('_spectrogram') &&
                   !name.includes('_sample') &&
                   duration >= 30; // Skip very short files (samples, intros, metadata)
        });

        if (allAudio.length === 0) return [];

        // Deduplicate: group by base filename, prefer MP3
        const byBase = new Map();
        for (const f of allAudio) {
            const base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
            const existing = byBase.get(base);
            if (!existing || f.name.toLowerCase().endsWith('.mp3')) {
                byBase.set(base, f);
            }
        }
        // Limit tracks per item to avoid flooding results from compilation albums
        let audioFiles = [...byBase.values()];
        if (audioFiles.length > 25) audioFiles = audioFiles.slice(0, 25);

        const thumbnail = `https://archive.org/services/img/${item.identifier}`;
        const creator = item.creator || meta.metadata?.creator || 'Unknown Artist';
        const albumTitle = item.title || meta.metadata?.title || '';

        return audioFiles.map((f, idx) => {
            let trackTitle = f.title || f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

            return {
                id: `ia_${item.identifier}_${idx}`,
                title: trackTitle,
                artist: Array.isArray(creator) ? creator[0] : String(creator),
                album: Array.isArray(albumTitle) ? albumTitle[0] : String(albumTitle),
                duration: f.length ? parseFloat(f.length) : 0,
                image: thumbnail,
                audioUrl: `${IA_DOWNLOAD}/${item.identifier}/${encodeURIComponent(f.name)}`,
                source: 'archive',
                downloads: item.downloads || 0,
                previewNote: 'Full track'
            };
        });
    } catch {
        return [];
    }
}

// ---- Rendering ----
function renderSearchResults(tracks) {
    searchResults.innerHTML = '';
    tracks.forEach((track, index) => {
        searchResults.appendChild(createTrackElement(track, index, 'search'));
    });
}

function createTrackElement(track, index, context) {
    const div = document.createElement('div');
    div.className = 'track-item';
    if (currentTrack && currentTrack.id === track.id) div.classList.add('playing');

    const durationStr = track.duration ? formatTime(track.duration) : '';

    const albumDisplay = track.album && track.album.length > 40 ? track.album.substring(0, 40) + '…' : track.album;

    div.innerHTML = `
        <img class="track-image" src="${track.image || placeholderImage()}" alt="${escapeHtml(track.title)}" loading="lazy" onerror="this.src='${placeholderImage()}'">
        <div class="track-info">
            <div class="track-title" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</div>
            <div class="track-artist" title="${escapeHtml(track.artist)}${track.album ? ' — ' + escapeHtml(track.album) : ''}">${escapeHtml(track.artist)}${albumDisplay ? ' — ' + escapeHtml(albumDisplay) : ''}</div>
            <div class="track-duration">${durationStr}${track.downloads ? ' · ' + formatNumber(track.downloads) + ' plays' : ''} <span class="full-track-badge">Full track</span></div>
        </div>
        <div class="track-actions">
            <button class="track-action-btn play-btn" title="Play">►</button>
            ${context === 'search' ? `<button class="track-action-btn add-btn" title="Add to playlist">+</button>` : ''}
            ${context === 'playlist' ? `<button class="track-action-btn remove-btn" title="Remove">✕</button>` : ''}
        </div>
    `;

    div.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        setQueueAndPlay(context, index, track);
    });
    div.addEventListener('dblclick', () => setQueueAndPlay(context, index, track));

    if (context === 'search') {
        div.querySelector('.add-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showAddToPlaylistModal(track);
        });
    }
    if (context === 'playlist') {
        div.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeTrackFromPlaylist(currentPlaylistId, track.id);
        });
    }

    return div;
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
function playTrack(track) {
    if (!track.audioUrl) { showToast('No audio available'); return; }
    currentTrack = track;
    audio.src = track.audioUrl;
    audio.play().then(() => {
        isPlaying = true;
        updateNowPlaying();
        updatePlayingHighlight();
    }).catch(() => {
        isPlaying = false;
        updateNowPlaying();
        showToast('Click play to start');
    });
}

function togglePlayPause() {
    if (!currentTrack) return;
    if (isPlaying) { audio.pause(); isPlaying = false; }
    else { audio.play().catch(() => {}); isPlaying = true; }
    updateNowPlaying();
}

function handleTrackEnded() {
    if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
    }
    if (repeatMode === 'all') {
        currentQueueIndex = (currentQueueIndex + 1) % currentQueue.length;
        playTrack(currentQueue[currentQueueIndex]);
        return;
    }
    // repeatMode === 'none': stop at end of queue
    if (currentQueueIndex < currentQueue.length - 1) {
        currentQueueIndex++;
        playTrack(currentQueue[currentQueueIndex]);
    } else {
        isPlaying = false;
        updateNowPlaying();
    }
}

function playNext() {
    if (currentQueue.length === 0) return;
    currentQueueIndex = (currentQueueIndex + 1) % currentQueue.length;
    playTrack(currentQueue[currentQueueIndex]);
}

function toggleRepeat() {
    const btn = document.getElementById('repeatBtn');
    if (repeatMode === 'none') {
        repeatMode = 'all';
        btn.textContent = '↻';
        btn.classList.add('active');
        btn.title = 'Repeat: All';
        showToast('Repeat: All tracks');
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
        btn.textContent = '↻¹';
        btn.classList.add('active');
        btn.title = 'Repeat: One';
        showToast('Repeat: Current track');
    } else {
        repeatMode = 'none';
        btn.textContent = '↻';
        btn.classList.remove('active');
        btn.title = 'Repeat: Off';
        showToast('Repeat: Off');
    }
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
    playPauseBtn.textContent = isPlaying ? '❚❚' : '►';
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
        const t = el.querySelector('.track-title');
        if (t && t.textContent === currentTrack.title) el.classList.add('playing');
    });
}

function toggleMute() {
    if (audio.volume > 0) {
        audio._prevVolume = audio.volume;
        audio.volume = 0; volumeBar.value = 0;
    } else {
        audio.volume = audio._prevVolume || 0.8;
        volumeBar.value = audio.volume * 100;
    }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const v = audio.volume;
    volumeIcon.textContent = v === 0 ? '○' : v < 0.5 ? '◎' : '◉';
}

// ---- Playlists ----
function loadPlaylists() {
    try { return JSON.parse(localStorage.getItem('music_playlists') || '[]'); }
    catch { return []; }
}

function savePlaylists() {
    localStorage.setItem('music_playlists', JSON.stringify(playlists));
}

function renderPlaylists() {
    playlistList.innerHTML = '';
    if (playlists.length === 0) {
        playlistList.innerHTML = '<div class="empty-state"><span class="empty-icon">—</span><p>No playlists yet. Create one!</p></div>';
        return;
    }
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.innerHTML = `<div class="playlist-item-info"><span class="playlist-icon">♪</span><div><div class="playlist-name">${escapeHtml(pl.name)}</div><div class="playlist-count">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}</div></div></div>`;
        div.addEventListener('click', () => openPlaylist(pl.id));
        playlistList.appendChild(div);
    });
}

function createPlaylist() {
    const name = playlistNameInput.value.trim();
    if (!name) { showToast('Enter a playlist name'); return; }
    playlists.push({ id: 'pl_' + Date.now(), name, tracks: [], createdAt: new Date().toISOString() });
    savePlaylists(); renderPlaylists(); hideModal(playlistModal);
    playlistNameInput.value = '';
    showToast(`Playlist "${name}" created`);
}

function openPlaylist(id) {
    currentPlaylistId = id;
    const pl = playlists.find(p => p.id === id);
    if (!pl) return;
    currentPlaylistName.textContent = pl.name;
    playlistList.classList.add('hidden');
    playlistTracks.classList.remove('hidden');
    renderPlaylistTracks(pl);
}

function renderPlaylistTracks(pl) {
    playlistTrackList.innerHTML = '';
    if (pl.tracks.length === 0) {
        playlistTrackList.innerHTML = '<div class="empty-state"><span class="empty-icon">♪</span><p>No tracks yet. Search and add some!</p></div>';
        return;
    }
    pl.tracks.forEach((track, index) => {
        playlistTrackList.appendChild(createTrackElement(track, index, 'playlist'));
    });
}

function showPlaylistList() {
    currentPlaylistId = null;
    playlistTracks.classList.add('hidden');
    playlistList.classList.remove('hidden');
    renderPlaylists();
}

function showAddToPlaylistModal(track) {
    if (playlists.length === 0) { showToast('Create a playlist first'); showModal(playlistModal); return; }
    playlistSelectList.innerHTML = '';
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-select-item';
        const exists = pl.tracks.some(t => t.id === track.id);
        div.innerHTML = `<span class="playlist-icon">♪</span><span>${escapeHtml(pl.name)} (${pl.tracks.length})${exists ? ' ✓' : ''}</span>`;
        if (!exists) div.addEventListener('click', () => { addTrackToPlaylist(pl.id, track); hideModal(addToPlaylistModal); });
        else { div.style.opacity = '0.5'; div.style.cursor = 'default'; }
        playlistSelectList.appendChild(div);
    });
    showModal(addToPlaylistModal);
}

function addTrackToPlaylist(pid, track) {
    const pl = playlists.find(p => p.id === pid);
    if (!pl || pl.tracks.some(t => t.id === track.id)) { showToast('Already in playlist'); return; }
    pl.tracks.push({ ...track });
    savePlaylists();
    showToast(`Added to "${pl.name}"`);
    if (currentPlaylistId === pid) renderPlaylistTracks(pl);
}

function removeTrackFromPlaylist(pid, tid) {
    const pl = playlists.find(p => p.id === pid);
    if (!pl) return;
    pl.tracks = pl.tracks.filter(t => t.id !== tid);
    savePlaylists(); renderPlaylistTracks(pl);
    showToast('Track removed');
}

function deleteCurrentPlaylist() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl || !confirm(`Delete playlist "${pl.name}"?`)) return;
    playlists = playlists.filter(p => p.id !== currentPlaylistId);
    savePlaylists(); showPlaylistList();
    showToast('Playlist deleted');
}

function playAllPlaylistTracks() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl || pl.tracks.length === 0) { showToast('No tracks to play'); return; }
    currentQueue = [...pl.tracks];
    currentQueueIndex = 0;
    playTrack(currentQueue[0]);
}

// ---- UI Helpers ----
function showLoading(show) {
    loadingIndicator.classList.toggle('hidden', !show);
    searchResults.classList.toggle('hidden', show);
}

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
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

let toastTimeout;
function showToast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- SafePlaceStorage (Google Drive wrapper, from safe-place project) ----
class SafePlaceStorage {
    constructor(accessToken, rootFolderId) {
        this.accessToken = accessToken;
        this.rootFolderId = rootFolderId;
    }

    async _api(path, options = {}) {
        const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3${path}`;
        const res = await fetch(url, {
            ...options,
            headers: { 'Authorization': `Bearer ${this.accessToken}`, ...options.headers },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Drive API error: ${res.status}`);
        }
        return res;
    }

    async getOrCreateFolder(name, parentId) {
        parentId = parentId || this.rootFolderId;
        const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const res = await this._api(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
        const data = await res.json();
        if (data.files && data.files.length > 0) return data.files[0];

        const createRes = await this._api('/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
        });
        return createRes.json();
    }

    async getAppFolder(appName) {
        return this.getOrCreateFolder(appName, this.rootFolderId);
    }

    async findFile(name, folderId) {
        folderId = folderId || this.rootFolderId;
        const query = `name='${name}' and '${folderId}' in parents and trashed=false`;
        const res = await this._api(`/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime,mimeType)`);
        const data = await res.json();
        return data.files && data.files.length > 0 ? data.files[0] : null;
    }

    async uploadData(name, data, mimeType, folderId) {
        folderId = folderId || this.rootFolderId;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name, parents: [folderId] })], { type: 'application/json' }));
        form.append('file', new Blob([data], { type: mimeType }));
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
            body: form,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Upload failed: ${res.status}`);
        }
        return res.json();
    }

    async downloadJSON(fileId) {
        const res = await this._api(`/files/${fileId}?alt=media`);
        return res.json();
    }

    async deleteFile(fileId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
        });
    }
}

// ---- Google Drive Sync ----
const SAFE_PLACE_CLIENT_ID = '805871064081-6uh6ghboi12sd4p5vn26cmalfh48lgaj.apps.googleusercontent.com';
const SAFE_PLACE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const SAFE_PLACE_APP_NAME = 'music-player';
const SAFE_PLACE_FILE_NAME = 'playlists.json';

let syncTokenClient = null;
let syncStorage = null; // SafePlaceStorage instance
let syncAppFolderId = null;

const syncSignInBtn = document.getElementById('syncSignInBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const syncSignOutBtn = document.getElementById('syncSignOutBtn');
const syncStatus = document.getElementById('syncStatus');

function initSyncAuth() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        setTimeout(initSyncAuth, 300);
        return;
    }
    syncTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: SAFE_PLACE_CLIENT_ID,
        scope: SAFE_PLACE_SCOPES,
        callback: handleSyncAuthResponse,
    });
    syncSignInBtn.disabled = false;
}

async function handleSyncAuthResponse(response) {
    if (response.error) {
        setSyncStatus('Sign-in failed', true);
        return;
    }

    try {
        setSyncStatus('Connecting...');

        // Create storage instance and find/create root folder
        syncStorage = new SafePlaceStorage(response.access_token, null);
        const rootFolder = await syncStorage.getOrCreateFolder('SafePlace', 'root');
        syncStorage.rootFolderId = rootFolder.id;

        // Get app-specific folder
        const appFolder = await syncStorage.getAppFolder(SAFE_PLACE_APP_NAME);
        syncAppFolderId = appFolder.id;

        // Show sync buttons, hide sign-in
        syncSignInBtn.classList.add('hidden');
        exportBtn.classList.remove('hidden');
        importBtn.classList.remove('hidden');
        syncSignOutBtn.classList.remove('hidden');
        setSyncStatus('Connected');
    } catch (err) {
        setSyncStatus('Connection failed: ' + err.message, true);
    }
}

function handleSyncSignIn() {
    if (!syncTokenClient) {
        setSyncStatus('Google API loading...', true);
        return;
    }
    syncTokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSyncSignOut() {
    if (syncStorage && syncStorage.accessToken) {
        google.accounts.oauth2.revoke(syncStorage.accessToken);
    }
    syncStorage = null;
    syncAppFolderId = null;

    syncSignInBtn.classList.remove('hidden');
    exportBtn.classList.add('hidden');
    importBtn.classList.add('hidden');
    syncSignOutBtn.classList.add('hidden');
    setSyncStatus('');
}

async function exportPlaylists() {
    if (!syncStorage || !syncAppFolderId) {
        setSyncStatus('Not connected', true);
        return;
    }

    try {
        setSyncStatus('Exporting...');
        exportBtn.disabled = true;

        const data = JSON.stringify(playlists, null, 2);

        // Check if file already exists -- delete it first to avoid duplicates
        const existing = await syncStorage.findFile(SAFE_PLACE_FILE_NAME, syncAppFolderId);
        if (existing) {
            await syncStorage.deleteFile(existing.id);
        }

        await syncStorage.uploadData(
            SAFE_PLACE_FILE_NAME,
            data,
            'application/json',
            syncAppFolderId
        );

        setSyncStatus(`Exported ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`);
        showToast('Playlists exported to Google Drive');
    } catch (err) {
        setSyncStatus('Export failed: ' + err.message, true);
    } finally {
        exportBtn.disabled = false;
    }
}

async function importPlaylists() {
    if (!syncStorage || !syncAppFolderId) {
        setSyncStatus('Not connected', true);
        return;
    }

    try {
        setSyncStatus('Importing...');
        importBtn.disabled = true;

        const file = await syncStorage.findFile(SAFE_PLACE_FILE_NAME, syncAppFolderId);
        if (!file) {
            setSyncStatus('No backup found on Drive');
            showToast('No playlists found on Google Drive');
            return;
        }

        const imported = await syncStorage.downloadJSON(file.id);
        if (!Array.isArray(imported)) {
            setSyncStatus('Invalid backup data', true);
            return;
        }

        // Merge: add imported playlists that don't exist locally (by id)
        const existingIds = new Set(playlists.map(p => p.id));
        let added = 0;
        let updated = 0;

        for (const pl of imported) {
            if (!pl.id || !pl.name) continue;
            if (existingIds.has(pl.id)) {
                // Update existing playlist tracks
                const local = playlists.find(p => p.id === pl.id);
                if (local) {
                    local.tracks = pl.tracks || [];
                    local.name = pl.name;
                    updated++;
                }
            } else {
                playlists.push(pl);
                added++;
            }
        }

        savePlaylists();
        renderPlaylists();

        const msg = [];
        if (added > 0) msg.push(`${added} new`);
        if (updated > 0) msg.push(`${updated} updated`);
        const summary = msg.length > 0 ? msg.join(', ') : 'No changes';

        setSyncStatus(`Imported: ${summary}`);
        showToast(`Import complete: ${summary}`);
    } catch (err) {
        setSyncStatus('Import failed: ' + err.message, true);
    } finally {
        importBtn.disabled = false;
    }
}

function setSyncStatus(msg, isError) {
    syncStatus.textContent = msg;
    syncStatus.className = 'sync-status' + (isError ? ' sync-error' : '');
    if (msg && !isError) {
        // Auto-clear success messages after 4s
        setTimeout(() => {
            if (syncStatus.textContent === msg) syncStatus.textContent = '';
        }, 4000);
    }
}

function setupSyncListeners() {
    syncSignInBtn.addEventListener('click', handleSyncSignIn);
    syncSignOutBtn.addEventListener('click', handleSyncSignOut);
    exportBtn.addEventListener('click', exportPlaylists);
    importBtn.addEventListener('click', importPlaylists);
    initSyncAuth();
}

// ---- Start ----
init();
setupSyncListeners();
