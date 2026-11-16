# Music Player — Project Instructions

## Overview

Free Music Player is a static web app (HTML/CSS/JS) that plays full-length Creative Commons music from the Internet Archive. Playlists are stored in `localStorage` and can be backed up to Google Drive via the SafePlace iframe + postMessage API.

## Architecture

```
index.html   -- search UI, playlist panel, now-playing bar, modals, hidden SafePlace iframe
style.css    -- dark theme with gold accents (Outfit + Oswald fonts)
app.js       -- Internet Archive API, playback, playlists, Google Drive sync
```

### Key concepts

- **Internet Archive API** — searches `archive.org` for audio items, fetches metadata, streams MP3/OGG/M4A files directly.
- **Playlists** — stored in `localStorage` under key `music_playlists`. Each playlist has `id`, `name`, `tracks[]`, `createdAt`.
- **Google Drive sync** — uses a hidden iframe embedding `https://dat5ngon.github.io/safe-place/`. Communication is via `postMessage` (request/response pattern with unique IDs). No OAuth or Google API scripts in the music player itself — the user must be signed into SafePlace separately.
- **No build tools** — vanilla HTML/CSS/JS. No npm, no bundlers.

### SafePlace postMessage protocol

The music player sends requests to the SafePlace iframe and receives responses:

```js
// Request:  { type: 'safeplace-request', id, action, ...params }
// Response: { type: 'safeplace-response', id, ok, ...data }

// Actions:
//   save  — { app: 'music-player', filename: 'playlists.json', data: [...] }
//   load  — { app: 'music-player', filename: 'playlists.json' }
//   ping  — check if user is authenticated
```

Data is stored on Google Drive at `SafePlace/music-player/playlists.json`.

### Import sources

1. **Google Drive** — restore playlists from SafePlace backup (merge: add new, update existing by ID)
2. **Internet Archive** — import by item URL, identifier, or user profile (`@username`)

### Export

- **Google Drive** — backs up all playlists to SafePlace

## Development

### Local server

```bash
cd C:\01.Projects\music-player
python -m http.server 3001 --bind 127.0.0.1
```

Open `http://localhost:3001`.

**Note**: Google Drive sync only works when both apps are on the same origin (`https://dat5ngon.github.io`). For local testing, you'd need both safe-place and music-player served from the same local origin.

### Deployment

Hosted on GitHub Pages from the `main` branch root.

```bash
git add -A && git commit -m "description" && git push
```

GitHub Pages URL: `https://dat5ngon.github.io/music-player/`

### Repository

- **Personal GitHub**: `dat5ngon/music-player`
- **Branch**: `main`
- **Related project**: `dat5ngon/safe-place` (provides Google Drive storage API)

## Coding guidelines

1. **No build tools** — keep it vanilla HTML/CSS/JS.
2. **No frameworks** — DOM manipulation only.
3. **No OAuth in music player** — all Google Drive operations go through SafePlace iframe via postMessage.
4. **SafePlace dependency** — the music player relies on SafePlace's postMessage API. If SafePlace's API changes, update `safePlaceRequest()` and the sync functions in `app.js`.
5. **Theme**: dark background (`#0a0a0a`), gold accent (`#d4a853`), Outfit body font, Oswald display font.
