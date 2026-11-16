# Free Music Player

A browser-based music player that streams full-length free music from the [Internet Archive](https://archive.org/) (Creative Commons / public domain) and lets you manage playlists with Google Drive backup.

## Features

- **Search** — find music by artist, song, or keyword from Internet Archive's audio collection
- **Play** — stream full-length MP3/OGG/M4A tracks directly in the browser
- **Playlists** — create, rename, delete, and manage playlists (stored in localStorage)
- **Grid / List view** — toggle between grid and list layout for playlists
- **Import from Internet Archive** — import tracks by item URL, identifier, or user profile (`@username`)
- **Google Drive backup** — export/import playlists to Google Drive via [SafePlace](https://dat5ngon.github.io/safe-place/) (hidden iframe + postMessage)
- **Keyboard shortcuts** — Space to play/pause, Ctrl+Arrow to skip tracks
- **Repeat modes** — off, repeat all, repeat one
- **Responsive** — works on desktop and mobile

## Usage

Open `index.html` in any modern browser. No build step, no server required.

**Google Drive sync**: Sign in at [Safe Place](https://dat5ngon.github.io/safe-place/) first, then use the Export/Import buttons in the music player to backup or restore playlists.

Live: [https://dat5ngon.github.io/music-player/](https://dat5ngon.github.io/music-player/)

## Files

| File | Purpose |
|------|---------|
| `index.html` | App structure — panels, modals, now-playing bar, hidden SafePlace iframe |
| `style.css` | Dark theme styling (Outfit + Oswald fonts, gold accents) |
| `app.js` | Internet Archive search, playback, playlists, Google Drive sync via postMessage |
| `CLAUDE.md` | AI assistant project instructions |
