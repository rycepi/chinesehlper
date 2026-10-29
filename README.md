# Chinese Helper (Chrome/Edge extension)

A Yomitan-style hover dictionary for Chinese built with React + Vite. Hover to get pinyin/definitions, translate passages, and save words to flashcards.

## Features
- Hover lookup: find the word under your cursor and show pinyin + definitions.
- Paragraph translation: paste text in the popup or click translate in the hover card (LibreTranslate-compatible API by default).
- Flashcards: save terms with one click; manage them from the action popup.
- Dictionary import: load full CEDICT text files from the Options page; ships with a small sample.

## Quick start (Chrome/Edge)
1. Install deps: `npm install`
2. Build: `npm run build` (outputs to `dist/`).
3. Open `chrome://extensions` (or Edge extensions), enable Developer Mode.
4. Click **Load unpacked** and select the `dist/` folder.
5. Visit any page with Chinese text, hover to see the popup. Toggle on/off with `Alt+Z`.


## Translation API
- API key, if set, is passed as `api_key` in the POST body.

## Files of interest
- Manifest: [public/manifest.json](public/manifest.json)
- Content script: [src/content/main.jsx](src/content/main.jsx)
- Popup UI: [src/popup/App.jsx](src/popup/App.jsx)
- Options UI: [src/options/App.jsx](src/options/App.jsx)
- Dictionary utilities: [src/shared/dict.js](src/shared/dict.js)
- Background worker: [src/background/index.js](src/background/index.js)

## Controls
- `Shift+Z`: toggle hover lookup on/off.
- Hover over Chinese text: popup appears with definitions, translate + add-card buttons.
- Context menu on selected text: "Add to flashcards".

## Caveats
- Chrome storage quotas limit how much of CEDICT can be stored; a self-hosted dictionary API is recommended for very large datasets.
- Translation depends on external services; failures fall back to a stub message.

## Development notes
- Build with Vite (`npm run build`); outputs stable filenames for MV3.
- Background runs as an ES module service worker (`background.js`).
