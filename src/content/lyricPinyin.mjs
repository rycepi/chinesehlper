import { pinyin, customPinyin } from "pinyin-pro";

// The verb means to count here; the default engine selects the noun reading.
customPinyin({ "数不完": "shǔ bù wán", "數不完": "shǔ bù wán" });

const cache = new Map();
const MAX_LINES = 500;

export function lyricPinyin(text) {
  if (cache.has(text)) return cache.get(text);
  // Give the engine the whole line so it can resolve phrase pronunciations.
  const result = pinyin(text, { toneType: "symbol", nonZh: "consecutive" });
  if (cache.size >= MAX_LINES) cache.delete(cache.keys().next().value);
  cache.set(text, result);
  return result;
}
