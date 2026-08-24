# Chinese Helper

Chinese Helper is a Chrome/Chromium Manifest V3 extension for looking up Chinese text while browsing and building a personal flashcard deck. Hold `Shift` and hover over Chinese text to open a dictionary popup with matching characters, pinyin, and definitions.

Get it at: 
https://microsoftedge.microsoft.com/addons/detail/mdolcdfebdkmomdioanifdceahogdofh

## Features

- Shift + hover lookup using the bundled CEDICT dictionary.
- Simplified and traditional character display.
- Save lookups to flashcards from the popup or page context menu.
- Review, edit, delete, and score flashcards from Options.
- Translate pasted Chinese paragraphs through a configurable endpoint.
- Enable or disable page scanning from the extension popup.

## Requirements

- Node.js 18 or newer
- Google Chrome, Chromium, or another Chromium-based browser

## Development

```sh
npm install
npm run build
```

The compiled extension is written to `dist/`. Use `npm run dev` for the Vite development server.

## Load the extension

1. Open `chrome://extensions` (or the equivalent extensions page).
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project’s `dist` directory.
5. Reload the extension after each `npm run build`.

## Configuration

Open the extension popup and choose **Options** to configure translation. Requests are sent as `POST <Base URL>/translate` with `q`, `source`, `target`, `format`, and an optional `api_key`. The response should provide `translatedText` or `translation`.

The bundled dictionary loads automatically. Options also shows dictionary statistics and can import a CEDICT-formatted file or clear the local dictionary.

## Project structure

```text
src/background/  Service worker, settings, flashcards, translation
src/content/     In-page Shift + hover lookup UI
src/options/     Dictionary, translation, and flashcard management
src/popup/       Extension popup
src/shared/      Dictionary and pinyin helpers
public/data/     Bundled dictionary data
```

## License

No license has been specified yet.