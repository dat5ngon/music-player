# Free Music Player

A browser-based music player that streams full-length free music from the [Internet Archive](https://archive.org/) (Creative Commons / public domain) and lets you manage playlists with Google Drive backup.

## Features

- **Search** — find music by artist, song, or keyword from Internet Archive's audio collection
- **Play** — stream full-length MP3/OGG/M4A tracks directly in the browser
- **Playlists** — create, rename, delete, and manage playlists (stored in localStorage)
- **Grid / List view** — toggle between grid and list layout for playlists
- **Import from Internet Archive** — import tracks by item URL, identifier, or user profile (`@username`)
- **Google Drive backup** — export/import playlists to Google Drive via [SafePlace](https://dat5ngon.github.io/safe-place/) (hidden iframe + postMessage)
- **Offline playback** — download tracks to IndexedDB for offline listening within the browser; app shell cached via Service Worker
- **Download to device** — save MP3 files directly to your device for use with any music player app
- **Keyboard shortcuts** — Space to play/pause, Ctrl+Arrow to skip tracks
- **Repeat modes** — off, repeat all, repeat one
- **Responsive** — works on desktop and mobile (including Android car screens)

## Usage

Open `index.html` in any modern browser. No build step, no server required.

**Google Drive sync**: Sign in at [Safe Place](https://dat5ngon.github.io/safe-place/) first, then use the Export/Import buttons in the music player to backup or restore playlists.

Live: [https://dat5ngon.github.io/music-player/](https://dat5ngon.github.io/music-player/)

## Files

| File | Purpose |
|------|---------|
| `index.html` | App structure — panels, modals, now-playing bar, hidden SafePlace iframe |
| `style.css` | Dark theme styling (Outfit + Oswald fonts, gold accents) |
| `offline.js` | IndexedDB storage, download for offline, download to device |
| `archive.js` | Internet Archive API — search, fetch tracks, relevance scoring |
| `sync.js` | Google Drive sync via SafePlace iframe + postMessage |
| `app.js` | State, DOM, init, search UI, rendering, playback, playlists, UI helpers |
| `sw.js` | Service Worker — caches app shell for offline loading |
| `CLAUDE.md` | AI assistant project instructions |
