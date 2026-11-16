# Music Player -- Project Instructions

## Overview

Free Music Player is a static web app (HTML/CSS/JS) that plays full-length Creative Commons music from the Internet Archive. Playlists are stored in `localStorage` and can be synced to Google Drive via the SafePlace storage pattern.

## Architecture

```
index.html   -- search UI, playlist panel, now-playing bar, modals
style.css    -- dark theme with gold accents (Outfit + Oswald fonts)
app.js       -- Internet Archive API, playback, playlists, Google Drive sync
```

### Key concepts

- **Internet Archive API** -- searches `archive.org` for audio items, fetches metadata, streams MP3/OGG/M4A files directly.
- **Playlists** -- stored in `localStorage` under key `music_playlists`. Each playlist has `id`, `name`, `tracks[]`, `createdAt`.
- **Google Drive sync** -- uses an embedded `SafePlaceStorage` class (copied from the `safe-place` project). Playlists are exported/imported as `playlists.json` in `SafePlace/music-player/` on Google Drive.
- **No build tools** -- vanilla HTML/CSS/JS. No npm, no bundlers.

### Google Cloud setup

- **Client ID**: `805871064081-6uh6ghboi12sd4p5vn26cmalfh48lgaj.apps.googleusercontent.com` (shared with safe-place project)
- **Authorized JS origins**: `http://localhost:3001`, `http://127.0.0.1:3001`, `https://dat5ngon.github.io`
- **Scope**: `drive.file` -- can only access files the app created

## Development

### Local server

```bash
cd C:\01.Projects\music-player
python -m http.server 3001 --bind 127.0.0.1
```

Open `http://localhost:3001`.

### Deployment

Hosted on GitHub Pages from the `main` branch root.

```bash
git add -A && git commit -m "description" && git push
```

GitHub Pages URL: `https://dat5ngon.github.io/music-player/`

### Repository

- **Personal GitHub**: `dat5ngon/music-player`
- **Branch**: `main`

## Coding guidelines

1. **No build tools** -- keep it vanilla HTML/CSS/JS.
2. **No frameworks** -- DOM manipulation only.
3. **Google API via fetch** -- use `Authorization: Bearer` header directly, no gapi client library.
4. **SafePlaceStorage class** -- keep in sync with the safe-place project's API. Only include methods actually used (getOrCreateFolder, getAppFolder, findFile, uploadData, downloadJSON, deleteFile).
5. **Theme**: dark background (`#0a0a0a`), gold accent (`#d4a853`), Outfit body font, Oswald display font.
