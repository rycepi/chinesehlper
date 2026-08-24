function toTitleCaseFirst(input) {
  if (!input) return "";
  return input[0].toUpperCase() + input.slice(1);
}

function toneMarkSyllable(raw) {
  const m = raw.match(/^(.+?)([1-5])$/);
  if (!m) return raw;
  let syllable = m[1];
  const tone = Number(m[2]);
  if (tone === 5) return syllable;
  syllable = syllable.replace("u:", "v").replace("ü", "v");
  const vowelMap = {
    a: ["a", "ā", "á", "ǎ", "à"],
    e: ["e", "ē", "é", "ě", "è"],
    i: ["i", "ī", "í", "ǐ", "ì"],
    o: ["o", "ō", "ó", "ǒ", "ò"],
    u: ["u", "ū", "ú", "ǔ", "ù"],
    v: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"]
  };
  const lower = syllable.toLowerCase();
  const pickIndex = () => {
    if (lower.includes("a")) return lower.indexOf("a");
    if (lower.includes("e")) return lower.indexOf("e");
    if (lower.includes("o")) return lower.indexOf("o");
    if (lower.includes("iu")) return lower.indexOf("u");
    if (lower.includes("ui")) return lower.indexOf("i");
    const vowels = ["i", "u", "v"];
    for (const v of vowels) {
      const idx = lower.indexOf(v);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const idx = pickIndex();
  if (idx === -1) return syllable;
  const ch = lower[idx];
  const marked = vowelMap[ch]?.[tone] || lower[idx];
  const result = syllable.slice(0, idx) + marked + syllable.slice(idx + 1);
  return result.replace("v", "ü");
}

function formatPinyinInternal(pinyin, capitalizeFirst) {
  const parts = (pinyin || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(toneMarkSyllable);
  const joined = parts.join(" ");
  return capitalizeFirst ? toTitleCaseFirst(joined) : joined;
}

export function formatPinyin(pinyin) {
  return formatPinyinInternal(pinyin, true);
}

export function formatPinyinLower(pinyin) {
  return formatPinyinInternal(pinyin, false);
}
