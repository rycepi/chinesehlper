# Chinese Helper: Functionality and Architecture Study Guide

## What the app does

Chinese Helper is a Chrome/Chromium Manifest V3 extension for studying Chinese while browsing. It provides:

- Shift-held hover dictionary lookup using bundled CC-CEDICT data.
- Pinyin and definitions, with simplified/traditional display selection.
- Flashcards from dictionary entries or selected page text.
- Flashcard editing, deletion, practice, and a simple score.
- Chinese-to-English paragraph translation through a configurable API.
- Spotify lyric conversion to simplified Chinese and/or pinyin.

## Architecture

```text
Web page -> content.js -> React hover popup + Spotify lyric processor
Toolbar popup/options -> runtime messages -> background service worker
Background worker -> chrome.storage.local, context menu, dictionary fetch, translation API
```

The project uses three extension contexts:

- `src/content/`: injected into pages; can inspect page text and render the popup.
- `src/popup/`: the small toolbar UI for translation, scanning, Spotify toggles, and recent cards.
- `src/options/`: configuration, dictionary statistics/import/clear controls, and full flashcard management.
- `src/background/index.js`: privileged coordination and persistent data operations.
- `src/shared/`: dictionary parsing/indexing and pinyin formatting shared by multiple contexts.

React is used because these interfaces have changing state: popup visibility, loading, toggles, cards, edits, and practice. Vite transforms JSX and bundles each extension entry point. Manifest V3 uses a service worker instead of a permanently running background page, which is more resource-efficient and is the current Chrome extension model.

## Manifest permissions

`storage` saves settings/cards and dictionary metadata. `contextMenus` creates the selected-text flashcard command. `activeTab` and `scripting` support active-tab extension behavior. `<all_urls>` allows the content script to run on ordinary web pages. `web_accessible_resources` exposes packaged dictionary/chunk files where page-side code needs them. `action` opens `popup.html`; `options_page` opens `options.html`.

The code uses `globalThis.browser ?? chrome`, supporting browsers exposing either WebExtension namespace.

## Dictionary and lookup

`public/data/cedict_ts.u8` is parsed as CC-CEDICT lines:

```text
traditional simplified [pinyin] /definition one/definition two/
```

`src/shared/dict.js` turns each line into `{ traditional, simplified, pinyin, definitions }`, then builds an index for both script variants plus `maxLen`, the longest word length.

`loadDictionary()` first checks the in-memory index, then fetches the bundled file. A content-script fetch failure is retried through the background worker (`getBundledDictionary`), because extension-resource access can be restricted on some pages. Fewer than 10,000 parsed entries is treated as a failed load.

`lookupAtText(text, offset)` tries the longest possible substring beginning at the caret. This is essential because Chinese normally has no spaces: a phrase should be selected before one of its characters. `lookupExact()` supports clicking Chinese terms embedded in definitions.

The dictionary metadata is stored under `cedictMeta`, but the parsed entries themselves are not stored. Therefore the index is cached for the current page/content-script lifetime and rebuilt from the bundled file later. The options import changes the current in-memory index but does not serialize imported entries. Also, the failure message says “falling back to sample,” but the current code returns `null` rather than actually loading `sample_dict.json`.

## Pinyin formatting

`src/shared/pinyin.js` converts numbered pinyin such as `ni3 hao3` into `nǐ hǎo`. It splits syllables, reads tone numbers, handles neutral tone 5, handles `u:`/`ü`, and applies standard vowel-placement rules. Both capitalized and lowercase formatting are exported so normal dictionary cards and Spotify lyrics can share the same logic.

## Shift-hover flow

1. `src/content/entry.js` prepares the browser environment and imports the content bundle.
2. `main.jsx` injects a host element and mounts React inside a Shadow DOM.
3. The content script loads settings and the dictionary.
4. Mouse movement records coordinates; `requestAnimationFrame` throttles work.
5. Lookup runs only when scanning is enabled and Shift is held.
6. `document.caretPositionFromPoint()` finds the text node and character offset under the pointer.
7. The dictionary finds the longest matching word.
8. React positions the popup near the pointer.
9. Clicking outside the Shadow DOM host hides it.

The popup shows the selected script, pinyin, all matching entries, definitions, Add Card, Add All Definitions, and Close. Definition strings containing `word[pinyin]` are parsed so Chinese terms can be clicked for a new exact lookup.

Shadow DOM isolates the popup’s styles from the host site, preventing site CSS from breaking the extension UI.

## Flashcards

The service worker owns `zhCards`. Cards contain an ID, term, simplified/traditional forms, pinyin, definitions, variant, timestamp, and score. Adding checks for duplicates, puts new cards first, and trims storage to 500 cards.

Cards can be created from an individual dictionary entry, all definitions, or selected text from the context menu. The toolbar popup displays at most 50 cards; Options displays all loaded cards and can edit or delete them.

Practice randomly selects a card, reveals definitions, and applies `+1` for Correct or `-1` for Incorrect. This is only a basic score tracker, not spaced repetition: there are no due dates, intervals, or review history.

## Translation flow

The toolbar popup sends `translateParagraph` to the worker. The worker reads `translationBase` and `apiKey`, then sends:

```json
{
  "q": "Chinese text",
  "source": "zh",
  "target": "en",
  "format": "text",
  "api_key": "optional"
}
```

to `<base URL>/translate`. It accepts `translatedText` or `translation`. With no base URL it returns `Translation API not configured`; request failures return a visible stub message containing the first 80 characters. The endpoint is LibreTranslate-compatible rather than tied to one provider. Keeping the request in the worker centralizes network behavior and avoids putting API configuration in page code.

## Spotify lyrics

Spotify processing starts only on `open.spotify.com`. It locates lyrics with both `[data-test-id="lyrics-line"]` and `[data-testid="lyrics-line"]`, supporting alternate Spotify DOM versions.

Because Spotify is a single-page app, a `MutationObserver` watches for lyric nodes appearing after navigation or opening the lyrics panel. Each Chinese line is converted using longest dictionary matches. Unknown characters, punctuation, and spaces are preserved. The result can independently contain simplified text and a smaller pinyin line.

Each changed line stores its original text in a data attribute and receives a processed marker. When a setting changes, the observer stops, original lyrics are restored, the style element is removed, and processing restarts. This prevents repeated conversion from corrupting text.

The toolbar has independent Simplified and Pinyin toggles. A legacy `spotifyLyricsEnabled` setting is retained for compatibility, but the two newer settings determine the features independently.

## Settings and messaging

Default settings are:

```text
translationBase: ""
apiKey: ""
enabled: true
spotifyLyricsEnabled: true
spotifySimplifyEnabled: true
spotifyPinyinEnabled: true
displayScript: "simplified"
```

Important messages include `getSettings`, `saveSettings`, `setEnabled`, `getFlashcards`, `addFlashcard`, `updateFlashcard`, `deleteFlashcard`, `translateParagraph`, and `getBundledDictionary`. The pages message the worker instead of writing storage directly, giving the app one owner for data rules.

## Build system

- Node.js runs the JavaScript tooling.
- npm installs dependencies and runs scripts.
- React/React DOM render components.
- Vite bundles popup, options, and background entry points.
- `@vitejs/plugin-react` transforms JSX.
- `vite.config.js` emits stable `background.js`, `popup.js`, and `options.js` names.
- `vite.content.config.js` emits the injected content script as one IIFE, which is appropriate for a classic content-script declaration.
- `modulePreload: false` avoids extension cross-world preload warnings.
- `emptyOutDir: false` in the second build preserves files emitted by the first build.

Run `npm run build` to create `dist/`, then load `dist/` through the browser’s “Load unpacked” extension flow.

## Verified behavior and caveats

The current production build succeeds and emits the expected extension files. The following details are important in a quiz:

- The actual implementation requires holding **Shift**. The README’s `Alt+Z` mention is stale; there is no Alt+Z handler in the code.
- The full dictionary is bundled locally; the optional external dependency is the translation endpoint.
- Spotify logic is page-restricted even though the general content script matches all URLs.
- Scanning can be turned off from the popup and the active tab is notified immediately.
- Translation errors are visible; the app does not pretend the stub is a real translation.
- The extension has no custom backend.
- Existing worktree changes were preserved: `README.md` was already modified and `README-Ryce-X1.md` was already untracked.

## Short quiz answers

- **Why a content script?** It can inspect page text and place UI over the current page.
- **Why a service worker?** It centralizes privileged APIs, storage, context menus, dictionary fallback fetching, and translation.
- **Why CEDICT?** It supplies traditional, simplified, pinyin, and definitions in a parseable format.
- **Why longest-match lookup?** Chinese words are not reliably separated by spaces.
- **Why `requestAnimationFrame`?** It throttles pointer-driven work to the browser’s rendering cycle.
- **Why Shadow DOM?** It prevents host-page CSS and DOM from interfering with the popup.
- **Why `MutationObserver`?** Spotify dynamically replaces lyric elements.
- **Why save original lyrics?** Settings can be changed and the line can be restored before reprocessing.
- **Why message passing?** Popup, options, page, and worker have different lifecycles and permissions.
- **Why Vite?** It transforms JSX and produces the multiple files required by the extension manifest.
