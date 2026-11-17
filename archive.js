// ---- Internet Archive API ----
const ITEMS_PER_PAGE = 10;

async function searchArchive(query, page) {
    const quoted = query.includes(' ') ? '"' + query + '"' : query;
    const searchQuery = 'mediatype:audio AND NOT subject:(podcast OR lecture OR sermon OR audiobook OR speech) AND (creator:(' + quoted + ') OR title:(' + quoted + ') OR subject:(' + quoted + '))';
    const start = (page - 1) * ITEMS_PER_PAGE;
    const url = IA_SEARCH + '?q=' + encodeURIComponent(searchQuery) + '&fl[]=identifier,title,creator,downloads,num_favorites&sort[]=' + sortOrder + '&rows=' + ITEMS_PER_PAGE + '&start=' + start + '&output=json';
    const response = await fetch(url);
    const data = await response.json();
    const totalFound = data.response?.numFound || 0;
    hasMoreResults = (start + ITEMS_PER_PAGE) < totalFound;
    if (!data.response?.docs?.length) return [];
    const items = data.response.docs;
    const results = await Promise.allSettled(items.map(item => fetchArchiveItemTracks(item)));
    const allTracks = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.length > 0) allTracks.push(...result.value);
    }
    const queryLower = query.toLowerCase();
    allTracks.sort((a, b) => {
        const diff = relevanceScore(b, queryLower) - relevanceScore(a, queryLower);
        return diff !== 0 ? diff : (b.downloads || 0) - (a.downloads || 0);
    });
    return allTracks;
}

function relevanceScore(track, queryLower) {
    let score = 0;
    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const album = (track.album || '').toLowerCase();
    if (artist === queryLower) score += 100; else if (artist.includes(queryLower)) score += 60;
    if (title === queryLower) score += 80; else if (title.includes(queryLower)) score += 40;
    if (album.includes(queryLower)) score += 30;
    if (artist === 'unknown artist' || artist === 'unknown') score -= 20;
    if (track.duration > 1800) score -= 15;
    return score;
}

async function fetchArchiveItemTracks(item) {
    try {
        const response = await fetch(IA_META + '/' + item.identifier);
        const meta = await response.json();
        if (!meta.files) return [];
        const allAudio = meta.files.filter(f => {
            const name = (f.name || '').toLowerCase();
            const duration = f.length ? parseFloat(f.length) : 0;
            return (name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a')) &&
                   f.source !== 'metadata' && !name.includes('_spectrogram') && !name.includes('_sample') && duration >= 30;
        });
        if (allAudio.length === 0) return [];
        const byBase = new Map();
        for (const f of allAudio) {
            const base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
            if (!byBase.has(base) || f.name.toLowerCase().endsWith('.mp3')) byBase.set(base, f);
        }
        let audioFiles = [...byBase.values()];
        if (audioFiles.length > 25) audioFiles = audioFiles.slice(0, 25);
        const thumbnail = 'https://archive.org/services/img/' + item.identifier;
        const creator = item.creator || meta.metadata?.creator || 'Unknown Artist';
        const albumTitle = item.title || meta.metadata?.title || '';
        return audioFiles.map((f, idx) => ({
            id: 'ia_' + item.identifier + '_' + idx,
            title: f.title || f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            artist: Array.isArray(creator) ? creator[0] : String(creator),
            album: Array.isArray(albumTitle) ? albumTitle[0] : String(albumTitle),
            duration: f.length ? parseFloat(f.length) : 0,
            image: thumbnail,
            audioUrl: IA_DOWNLOAD + '/' + item.identifier + '/' + encodeURIComponent(f.name),
            source: 'archive', downloads: item.downloads || 0, previewNote: 'Full track'
        }));
    } catch { return []; }
}

