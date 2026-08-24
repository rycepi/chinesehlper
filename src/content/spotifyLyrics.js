import { loadDictionary } from "../shared/dict";
import { formatPinyinLower } from "../shared/pinyin";

const PROCESSED = "zhSpotifyProcessed";
const ORIGINAL = "zhSpotifyOriginal";

// Spotify renders lyrics dynamically, so this function is called repeatedly
// as the user changes songs or opens/closes the lyrics panel.
function isChinese(text) {
  return /[\u3400-\u9fff]/.test(text || "");
}

function lyricNodes() {
  // Spotify currently uses data-test-id. The data-testid variant keeps this
  // compatible with older or alternate Spotify page layouts.
  const nodes = Array.from(document.querySelectorAll(
    '[data-test-id="lyrics-line"], [data-testid="lyrics-line"]'
  ));
  const chineseNodes = nodes.filter(node => isChinese(node.textContent) && node.dataset[PROCESSED] !== "true");
  return chineseNodes;
}

async function convertLine(text, index) {
  // The shared dictionary contains Traditional, Simplified, and pinyin data.
  // We use the longest matching dictionary entry so phrases are converted
  // before falling back to individual characters.
  const dictionary = await loadDictionary();
  if (!dictionary) {
    return { simplified: text, pinyin: "" };
  }
  const { words, maxLen } = dictionary;
  let simplified = "";
  const pinyin = [];
  let cursor = 0;
  while (cursor < text.length) {
    let found = null;
    const limit = Math.min(maxLen, text.length - cursor);
    for (let len = limit; len > 0; len--) {
      const piece = text.slice(cursor, cursor + len);
      const entries = words[piece];
      if (entries) {
        found = { piece, entry: entries[0] };
        break;
      }
    }
    if (!found) {
      // Preserve punctuation, spaces, and characters that are not in CEDICT.
      simplified += text[cursor];
      pinyin.push("");
      cursor += 1;
      continue;
    }
    simplified += found.entry.simplified || found.piece;
    pinyin.push(formatPinyinLower(found.entry.pinyin || ""));
    cursor += found.piece.length;
  }
  const result = { simplified, pinyin: pinyin.filter(Boolean).join(" ") };
  return result;
}

async function processNode(node, settings) {
  // A line is processed only once per settings pass. When settings change,
  // restore() removes this marker and the line can be processed again.
  if (node.dataset[PROCESSED] === "true") return;
  const original = node.textContent || "";
  node.dataset[ORIGINAL] = original;
  const result = await convertLine(original);
  // Simplification and pinyin are independent, so either can be disabled.
  const simplifiedText = settings.simplify ? result.simplified : original;
  const pinyinText = settings.pinyin ? result.pinyin : "";
  if (simplifiedText === original && !pinyinText) {
    delete node.dataset[ORIGINAL];
    return;
  }
  node.textContent = "";
  const simplified = document.createElement("span");
  simplified.textContent = simplifiedText;
  const pinyin = document.createElement("span");
  pinyin.className = "zh-spotify-pinyin";
  pinyin.textContent = pinyinText;
  node.append(simplified);
  if (pinyinText) node.append(pinyin);
  node.dataset[PROCESSED] = "true";
}

function restore() {
  // Replacing textContent removes Spotify's original child nodes. Saving the
  // original text lets us restore the line before applying new preferences.
  document.querySelectorAll('[data-test-id="lyrics-line"], [data-testid="lyrics-line"]').forEach(node => {
    if (node.dataset[PROCESSED] !== "true") return;
    node.textContent = node.dataset[ORIGINAL] || node.textContent;
    delete node.dataset[PROCESSED];
    delete node.dataset[ORIGINAL];
  });
}

export function startSpotifyLyrics(settings = {}) {
  if (location.hostname !== "open.spotify.com") return () => {};
  const options = {
    simplify: settings.simplify !== false,
    pinyin: settings.pinyin !== false
  };
  // Keep the stylesheet local to this feature. It controls the smaller pinyin
  // line inserted below each Spotify lyric.
  const style = document.createElement("style");
  style.textContent = ".zh-spotify-pinyin { display:block; font-size:.72em; opacity:.75; line-height:1.2; }";
  document.documentElement.appendChild(style);
  let running = false;
  const process = async () => {
    if (running) return;
    running = true;
    try {
      const nodes = lyricNodes();
      await Promise.all(nodes.map(node => processNode(node, options)));
    } catch (err) {
      console.warn("Spotify lyric processing failed", err);
    } finally {
      running = false;
    }
  };
  // Spotify is a single-page app. MutationObserver catches lyrics that appear
  // after navigation instead of relying on a one-time page-load scan.
  const observer = new MutationObserver(process);
  observer.observe(document.body, { childList: true, subtree: true });
  process();
  return () => {
    // The cleanup function is called whenever the user changes either toggle.
    observer.disconnect();
    restore();
    style.remove();
  };
}

export function setSpotifyLyricsEnabled(enabled) {
  document.documentElement.dataset.zhSpotifyLyrics = enabled ? "on" : "off";
}
