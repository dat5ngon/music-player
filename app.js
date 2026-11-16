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
let playlistViewMode = localStorage.getItem('playlist_view_mode') || 'grid'; // 'list' or 'grid'
let pendingTrackForNewPlaylist = null; // track to auto-add after creating a new playlist

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

const exportModal = document.getElementById('exportModal');
const exportSelectList = document.getElementById('exportSelectList');
const exportSelectAll = document.getElementById('exportSelectAll');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const doExportBtn = document.getElementById('doExportBtn');
const importFileInput = document.getElementById('importFileInput');

const archiveImportModal = document.getElementById('archiveImportModal');
const archiveIdInput = document.getElementById('archiveIdInput');
const archiveImportStatus = document.getElementById('archiveImportStatus');
const cancelArchiveImportBtn = document.getElementById('cancelArchiveImportBtn');
const doArchiveImportBtn = document.getElementById('doArchiveImportBtn');
const importFromArchiveBtn = document.getElementById('importFromArchiveBtn');

// ---- Initialization ----
function init() {
    renderPlaylists();
    setupEventListeners();
    audio.volume = 0.8;
    applyViewMode(playlistViewMode);
}

function setupEventListeners() {
    searchBtn.addEventListener('click', () => {
        const q = searchInput.value.trim();
        if (q) searchTracks(q);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim();
            if (q) searchTracks(q);
        }
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

    newPlaylistBtn.addEventListener('click', () => { pendingTrackForNewPlaylist = null; showModal(playlistModal); });
    cancelPlaylistBtn.addEventListener('click', () => { pendingTrackForNewPlaylist = null; hideModal(playlistModal); });
    createPlaylistBtn.addEventListener('click', createPlaylist);
    playlistNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createPlaylist(); });
    cancelAddBtn.addEventListener('click', () => hideModal(addToPlaylistModal));

    backToPlaylists.addEventListener('click', showPlaylistList);
    playAllBtn.addEventListener('click', playAllPlaylistTracks);
    deletePlaylistBtn.addEventListener('click', deleteCurrentPlaylist);
    currentPlaylistName.addEventListener('click', startEditPlaylistName);

    // View toggle
    document.getElementById('listViewBtn').addEventListener('click', () => setViewMode('list'));
    document.getElementById('gridViewBtn').addEventListener('click', () => setViewMode('grid'));

    // Import / Export
    document.getElementById('exportBtn').addEventListener('click', showExportModal);
    cancelExportBtn.addEventListener('click', () => hideModal(exportModal));
    doExportBtn.addEventListener('click', doExportSelected);
    exportSelectAll.addEventListener('change', toggleExportSelectAll);
    importFileInput.addEventListener('change', handleImportFile);

    // Import dropdown
    const importDropdown = document.getElementById('importDropdown');
    document.getElementById('importBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        importDropdown.classList.toggle('hidden');
    });
    document.getElementById('importFileBtn').addEventListener('click', () => {
        importDropdown.classList.add('hidden');
        importFileInput.click();
    });
    importFromArchiveBtn.addEventListener('click', () => {
        importDropdown.classList.add('hidden');
        archiveIdInput.value = '';
        archiveImportStatus.classList.add('hidden');
        showModal(archiveImportModal);
    });
    // Close dropdown on outside click
    document.addEventListener('click', () => importDropdown.classList.add('hidden'));

    // Archive import modal
    cancelArchiveImportBtn.addEventListener('click', () => hideModal(archiveImportModal));
    doArchiveImportBtn.addEventListener('click', importFromArchive);
    archiveIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') importFromArchive(); });

    confirmCancelBtn.addEventListener('click', () => hideModal(confirmModal));

    [playlistModal, addToPlaylistModal, confirmModal, exportModal, archiveImportModal].forEach(modal => {
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

        // Get cover image from first track (if any)
        const coverUrl = pl.tracks.length > 0 && pl.tracks[0].image
            ? pl.tracks[0].image
            : placeholderImage();

        div.innerHTML = `
            <div class="playlist-item-info">
                <div class="playlist-cover-wrap">
                    <img class="playlist-cover" src="${coverUrl}" alt="${escapeHtml(pl.name)}" loading="lazy" onerror="this.src='${placeholderImage()}'">
                </div>
                <span class="playlist-icon">♪</span>
                <div class="playlist-item-text">
                    <div class="playlist-name">${escapeHtml(pl.name)}</div>
                    <div class="playlist-count">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}</div>
                </div>
            </div>`;
        div.addEventListener('click', () => openPlaylist(pl.id));
        playlistList.appendChild(div);
    });
}

function setViewMode(mode) {
    playlistViewMode = mode;
    localStorage.setItem('playlist_view_mode', mode);
    applyViewMode(mode);
}

function applyViewMode(mode) {
    const listBtn = document.getElementById('listViewBtn');
    const gridBtn = document.getElementById('gridViewBtn');

    if (mode === 'grid') {
        playlistList.classList.add('grid-view');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else {
        playlistList.classList.remove('grid-view');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
    }
}

function createPlaylist() {
    const name = playlistNameInput.value.trim();
    if (!name) { showToast('Enter a playlist name'); return; }
    const newPl = { id: 'pl_' + Date.now(), name, tracks: [], createdAt: new Date().toISOString() };

    // Auto-add pending track if coming from "Add to Playlist > Create new"
    if (pendingTrackForNewPlaylist) {
        newPl.tracks.push({ ...pendingTrackForNewPlaylist });
        pendingTrackForNewPlaylist = null;
    }

    playlists.push(newPl);
    savePlaylists(); renderPlaylists(); hideModal(playlistModal);
    playlistNameInput.value = '';
    showToast(newPl.tracks.length > 0 ? `Created "${name}" with 1 track` : `Playlist "${name}" created`);
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

function startEditPlaylistName() {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (!pl) return;

    const h3 = currentPlaylistName;
    const oldName = pl.name;

    // Replace h3 content with an input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.maxLength = 50;
    input.className = 'playlist-name-edit';
    h3.textContent = '';
    h3.appendChild(input);
    input.focus();
    input.select();

    function commitEdit() {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            pl.name = newName;
            savePlaylists();
            showToast('Playlist renamed');
        }
        h3.textContent = pl.name;
    }

    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = oldName; input.blur(); }
    });
}

function showPlaylistList() {
    currentPlaylistId = null;
    playlistTracks.classList.add('hidden');
    playlistList.classList.remove('hidden');
    renderPlaylists();
}

function showAddToPlaylistModal(track) {
    playlistSelectList.innerHTML = '';

    // "Create new playlist" option at top
    const createDiv = document.createElement('div');
    createDiv.className = 'playlist-select-item playlist-select-create';
    createDiv.innerHTML = `<span class="playlist-icon">+</span><span>Create new playlist</span>`;
    createDiv.addEventListener('click', () => {
        hideModal(addToPlaylistModal);
        // Show create playlist modal, then auto-add the track after creation
        pendingTrackForNewPlaylist = track;
        showModal(playlistModal);
    });
    playlistSelectList.appendChild(createDiv);

    // Existing playlists
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-select-item';
        const exists = pl.tracks.some(t => t.id === track.id);
        div.innerHTML = `<span class="playlist-icon">♪</span><span>${escapeHtml(pl.name)} (${pl.tracks.length})${exists ? ' ✓' : ''}</span>`;
        if (!exists) div.addEventListener('click', () => { addTrackToPlaylist(pl.id, track); hideModal(addToPlaylistModal); });
        else { div.style.opacity = '0.5'; div.style.cursor = 'default'; }
        playlistSelectList.appendChild(div);
    });

    const modalTitle = addToPlaylistModal.querySelector('h3');
    modalTitle.textContent = 'Add to Playlist';
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
    if (!pl) return;
    showConfirmDialog(
        'Delete Playlist',
        `Are you sure you want to delete "${pl.name}"? This cannot be undone.`,
        () => {
            playlists = playlists.filter(p => p.id !== currentPlaylistId);
            savePlaylists(); showPlaylistList();
            showToast('Playlist deleted');
        }
    );
}

function showConfirmDialog(title, message, onConfirm, okLabel) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    showModal(confirmModal);
    // Remove old listeners by cloning
    const newOkBtn = confirmOkBtn.cloneNode(true);
    confirmOkBtn.parentNode.replaceChild(newOkBtn, confirmOkBtn);
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okLabel || 'Delete';
    // Apply danger style only for delete, primary for others
    if (okLabel && okLabel !== 'Delete') {
        okBtn.className = 'btn btn-primary';
    } else {
        okBtn.className = 'btn btn-danger';
    }
    okBtn.addEventListener('click', () => {
        hideModal(confirmModal);
        onConfirm();
    });
}

// ---- Import / Export ----
function showExportModal() {
    if (playlists.length === 0) { showToast('No playlists to export'); return; }
    exportSelectList.innerHTML = '';
    exportSelectAll.checked = true;
    playlists.forEach(pl => {
        const label = document.createElement('label');
        label.className = 'checkbox-label export-item';
        label.innerHTML = `
            <input type="checkbox" class="export-checkbox" data-id="${pl.id}" checked>
            <span>${escapeHtml(pl.name)} (${pl.tracks.length} tracks)</span>`;
        label.querySelector('.export-checkbox').addEventListener('change', updateExportSelectAll);
        exportSelectList.appendChild(label);
    });
    showModal(exportModal);
}

function toggleExportSelectAll() {
    const checked = exportSelectAll.checked;
    exportSelectList.querySelectorAll('.export-checkbox').forEach(cb => cb.checked = checked);
}

function updateExportSelectAll() {
    const all = exportSelectList.querySelectorAll('.export-checkbox');
    const checkedCount = exportSelectList.querySelectorAll('.export-checkbox:checked').length;
    exportSelectAll.checked = checkedCount === all.length;
    exportSelectAll.indeterminate = checkedCount > 0 && checkedCount < all.length;
}

function doExportSelected() {
    const selectedIds = [];
    exportSelectList.querySelectorAll('.export-checkbox:checked').forEach(cb => {
        selectedIds.push(cb.dataset.id);
    });
    if (selectedIds.length === 0) { showToast('Select at least one playlist'); return; }

    const selectedPlaylists = playlists.filter(p => selectedIds.includes(p.id));
    const data = {
        playlists: selectedPlaylists.map(pl => ({
            name: pl.name,
            tracks: pl.tracks
        })),
        exportedAt: new Date().toISOString(),
        version: 2
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `playlist_backup_${yy}_${mm}_${dd}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    hideModal(exportModal);
    showToast(`Exported ${selectedPlaylists.length} playlist${selectedPlaylists.length > 1 ? 's' : ''}`);
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    importFileInput.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target.result);
            // v2 format: multiple playlists
            if (data.playlists && Array.isArray(data.playlists)) {
                importMultiplePlaylists(data.playlists);
                return;
            }
            // v1 format: single playlist
            if (data.name && Array.isArray(data.tracks)) {
                importMultiplePlaylists([data]);
                return;
            }
            showToast('Invalid playlist file');
        } catch {
            showToast('Failed to read playlist file');
        }
    };
    reader.readAsText(file);
}

function importMultiplePlaylists(playlistsData) {
    const conflicts = [];
    const newOnes = [];

    for (const pl of playlistsData) {
        if (!pl.name || !Array.isArray(pl.tracks)) continue;
        const existing = playlists.find(p => p.name.toLowerCase() === pl.name.toLowerCase());
        if (existing) {
            conflicts.push({ existing, imported: pl });
        } else {
            newOnes.push(pl);
        }
    }

    // Add non-conflicting playlists immediately
    for (const pl of newOnes) {
        playlists.push({
            id: 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: pl.name,
            tracks: pl.tracks,
            createdAt: new Date().toISOString()
        });
    }

    if (conflicts.length > 0) {
        const names = conflicts.map(c => `"${c.existing.name}"`).join(', ');
        showConfirmDialog(
            'Playlists Already Exist',
            `${conflicts.length} playlist${conflicts.length > 1 ? 's' : ''} already exist${conflicts.length === 1 ? 's' : ''}: ${names}. Overwrite with imported versions?`,
            () => {
                for (const c of conflicts) {
                    c.existing.tracks = c.imported.tracks;
                    c.existing.createdAt = new Date().toISOString();
                }
                savePlaylists();
                renderPlaylists();
                showToast(`Imported ${newOnes.length + conflicts.length} playlists (${conflicts.length} overwritten)`);
            },
            'Overwrite'
        );
        // Save the non-conflicting ones regardless
        if (newOnes.length > 0) {
            savePlaylists();
            renderPlaylists();
        }
    } else {
        savePlaylists();
        renderPlaylists();
        showToast(`Imported ${newOnes.length} playlist${newOnes.length > 1 ? 's' : ''}`);
    }
}

// ---- Import from Internet Archive ----
let pendingArchiveTracks = [];

async function importFromArchive() {
    let input = archiveIdInput.value.trim();
    if (!input) { showToast('Enter an Archive identifier or URL'); return; }

    // Detect user profile URL: archive.org/details/@username
    const userMatch = input.match(/archive\.org\/details\/@([^/?#]+)/) || input.match(/^@(.+)$/);
    if (userMatch) {
        await importFromArchiveUser(userMatch[1]);
        return;
    }

    // Extract identifier from item URL if pasted
    const urlMatch = input.match(/archive\.org\/details\/([^/?#]+)/);
    if (urlMatch) input = urlMatch[1];

    // Clean up identifier
    const identifier = input.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!identifier) { showToast('Invalid identifier'); return; }

    // Show loading state
    archiveImportStatus.classList.remove('hidden');
    archiveImportStatus.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0 auto 8px"></div><p>Fetching tracks...</p>';
    doArchiveImportBtn.disabled = true;

    try {
        const item = { identifier, title: identifier, creator: '', downloads: 0 };
        const tracks = await fetchArchiveItemTracks(item);

        if (tracks.length === 0) {
            archiveImportStatus.innerHTML = '<p class="import-error">No playable audio tracks found in this item. Make sure the item contains MP3, OGG, or M4A files.</p>';
            doArchiveImportBtn.disabled = false;
            return;
        }

        // Store tracks and show playlist picker
        pendingArchiveTracks = tracks;
        hideModal(archiveImportModal);
        showArchivePlaylistPicker(tracks, identifier);
    } catch {
        archiveImportStatus.innerHTML = '<p class="import-error">Failed to fetch item. Check the identifier and try again.</p>';
    }

    doArchiveImportBtn.disabled = false;
}

async function importFromArchiveUser(username) {
    archiveImportStatus.classList.remove('hidden');
    archiveImportStatus.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0 auto 8px"></div><p>Fetching uploads by @' + escapeHtml(username) + '...</p>';
    doArchiveImportBtn.disabled = true;

    try {
        // Search for all audio items uploaded by this user
        const searchQuery = `uploader:${username} AND mediatype:audio`;
        const url = `${IA_SEARCH}?q=${encodeURIComponent(searchQuery)}&fl[]=identifier,title,creator,downloads&sort[]=addeddate+desc&rows=50&output=json`;
        const response = await fetch(url);
        const data = await response.json();

        const items = data.response?.docs || [];
        if (items.length === 0) {
            archiveImportStatus.innerHTML = '<p class="import-error">No audio uploads found for @' + escapeHtml(username) + '.</p>';
            doArchiveImportBtn.disabled = false;
            return;
        }

        archiveImportStatus.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0 auto 8px"></div><p>Found ' + items.length + ' item' + (items.length !== 1 ? 's' : '') + '. Fetching tracks...</p>';

        // Fetch tracks from all items in parallel
        const results = await Promise.allSettled(
            items.map(item => fetchArchiveItemTracks(item))
        );

        const allTracks = [];
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allTracks.push(...result.value);
            }
        }

        if (allTracks.length === 0) {
            archiveImportStatus.innerHTML = '<p class="import-error">No playable audio tracks found in uploads by @' + escapeHtml(username) + '.</p>';
            doArchiveImportBtn.disabled = false;
            return;
        }

        pendingArchiveTracks = allTracks;
        hideModal(archiveImportModal);
        showArchivePlaylistPicker(allTracks, '@' + username);
    } catch {
        archiveImportStatus.innerHTML = '<p class="import-error">Failed to fetch uploads. Check the username and try again.</p>';
    }

    doArchiveImportBtn.disabled = false;
}

function showArchivePlaylistPicker(tracks, identifier) {
    const count = tracks.length;
    const label = `${count} track${count !== 1 ? 's' : ''}`;

    // Reuse the addToPlaylistModal but with a "Create new" option
    playlistSelectList.innerHTML = '';

    // "Create new playlist" option at top
    const createDiv = document.createElement('div');
    createDiv.className = 'playlist-select-item playlist-select-create';
    createDiv.innerHTML = `<span class="playlist-icon">+</span><span>Create new playlist (${label})</span>`;
    createDiv.addEventListener('click', () => {
        hideModal(addToPlaylistModal);
        // Create playlist named after the identifier
        const name = identifier.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const newPl = { id: 'pl_' + Date.now(), name, tracks: [...tracks], createdAt: new Date().toISOString() };
        playlists.push(newPl);
        savePlaylists();
        renderPlaylists();
        openPlaylist(newPl.id);
        showToast(`Created "${name}" with ${label}`);
    });
    playlistSelectList.appendChild(createDiv);

    // Existing playlists
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'playlist-select-item';
        div.innerHTML = `<span class="playlist-icon">♪</span><span>${escapeHtml(pl.name)} (${pl.tracks.length})</span>`;
        div.addEventListener('click', () => {
            hideModal(addToPlaylistModal);
            let added = 0;
            for (const track of tracks) {
                if (!pl.tracks.some(t => t.id === track.id)) {
                    pl.tracks.push({ ...track });
                    added++;
                }
            }
            savePlaylists();
            if (currentPlaylistId === pl.id) renderPlaylistTracks(pl);
            renderPlaylists();
            showToast(`Added ${added} track${added !== 1 ? 's' : ''} to "${pl.name}"`);
            openPlaylist(pl.id);
        });
        playlistSelectList.appendChild(div);
    });

    // Update modal title
    const modalTitle = addToPlaylistModal.querySelector('h3');
    modalTitle.textContent = `Add ${label} to Playlist`;
    showModal(addToPlaylistModal);
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

// ---- Start ----
init();
