# Free Music Player

A simple browser-based music player that searches free music from [Jamendo](https://www.jamendo.com/) (Creative Commons licensed) and lets you save tracks to local playlists.

## Features

- **Search** -- find music by keyword or browse by genre tags (Rock, Jazz, Electronic, etc.)
- **Play** -- stream tracks directly in the browser with full playback controls
- **Playlists** -- create, manage, and delete playlists stored in localStorage
- **Keyboard shortcuts** -- Space to play/pause, Ctrl+Arrow to skip tracks
- **Responsive** -- works on desktop and mobile

## Usage

Open `index.html` in any modern browser. No build step, no server required.

The app uses the [Jamendo API](https://developer.jamendo.com/) to search and stream free music. All tracks are Creative Commons licensed.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App structure and layout |
| `style.css` | Dark theme styling |
| `app.js` | Search, playback, and playlist logic |
