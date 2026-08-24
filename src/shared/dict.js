const api = globalThis.browser ?? chrome;
const STORAGE_META_KEY = "cedictMeta";
const DICT_VERSION = 5;
const CEDICT_URL = api.runtime.getURL("data/cedict_ts.u8");

const state = { index: null };

function buildIndex(entries) {
  const words = {};
  let maxLen = 1;
  for (const entry of entries || []) {
    if (!entry || !entry.simplified) continue;
    const simp = entry.simplified;
    const trad = entry.traditional || "";
    if (!words[simp]) words[simp] = [];
    words[simp].push(entry);
    if (trad && trad !== simp) {
      if (!words[trad]) words[trad] = [];
      words[trad].push(entry);
    }
    maxLen = Math.max(maxLen, entry.simplified.length, entry.traditional ? entry.traditional.length : 1);
  }
  return { words, maxLen };
}

async function loadFromStorage() {
  const res = await api.storage.local.get([STORAGE_META_KEY]);
  const meta = res?.[STORAGE_META_KEY];
  if (!meta || meta.version !== DICT_VERSION) {
    await api.storage.local.remove([STORAGE_META_KEY]);
    return null;
  }
  return null;
}

async function persistMeta() {
  try {
    await api.storage.local.set({
      [STORAGE_META_KEY]: { version: DICT_VERSION, savedAt: Date.now(), source: "bundled" }
    });
    return true;
  } catch (err) {
    console.warn("Persist dictionary failed", err);
    return false;
  }
}

async function loadBundledCedictEntries() {
  const res = await fetch(CEDICT_URL);
  const text = await res.text();
  const entries = parseCedictText(text);
  if (entries.length < 10000) {
    throw new Error(`CEDICT parse too small: ${entries.length}`);
  }
  return entries;
}

export async function loadDictionary() {
  if (state.index) return state.index;
  const stored = await loadFromStorage();
  if (stored) {
    state.index = stored;
    return stored;
  }
  try {
    const entries = await loadBundledCedictEntries();
    const bundled = buildIndex(entries);
    state.index = bundled;
    await persistMeta();
    return bundled;
  } catch (err) {
    console.warn("Failed to load bundled CEDICT, falling back to sample", err);
    return null;
  }
}

function isCjk(ch) {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f) ||
    (code >= 0x2b820 && code <= 0x2ceaf)
  );
}

function lookupFragment(fragment) {
  if (!state.index) return null;
  const { words, maxLen } = state.index;
  const maxCandidate = Math.min(maxLen, fragment.length);
  for (let len = maxCandidate; len >= 1; len--) {
    const piece = fragment.slice(0, len);
    if (!isCjk(piece[0])) continue;
    if (words[piece]) return { match: piece, entries: words[piece] };
  }
  return null;
}

export async function lookupAtText(text, offset) {
  await loadDictionary();
  if (!state.index) return null;
  const windowSize = Math.min(state.index.maxLen, text.length - offset);
  if (windowSize <= 0) return null;
  const fragment = text.slice(offset, offset + windowSize);
  return lookupFragment(fragment);
}

export async function lookupExact(word) {
  await loadDictionary();
  if (!state.index) return null;
  return state.index.words[word] || null;
}

export function parseCedictText(text) {
  const lines = text.split(/\n+/);
  const entries = [];
  const cedictPattern = /^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+)\/$/;
  for (const line of lines) {
    const cleaned = (line || "").trim();
    if (!cleaned || cleaned.startsWith("#")) continue;
    const m = cleaned.match(cedictPattern);
    if (!m) continue;
    const traditional = m[1];
    const simplified = m[2];
    const pinyin = m[3];
    const defs = m[4].split("/").filter(Boolean);
    entries.push({ traditional, simplified, pinyin, definitions: defs });
  }
  return entries;
}

export async function installEntries(entries, persistToStorage = true) {
  state.index = buildIndex(entries);
  if (persistToStorage) await persistMeta();
  return state.index;
}

export async function installFromCedict(text, persistToStorage = true) {
  const entries = parseCedictText(text);
  return installEntries(entries, persistToStorage);
}

export async function clearDictionary() {
  state.index = null;
  await api.storage.local.remove([STORAGE_META_KEY]);
}

export async function getStats() {
  await loadDictionary();
  if (!state.index) return { entries: 0, maxLen: 0, source: "none" };
  const res = await api.storage.local.get([STORAGE_META_KEY]);
  const meta = res?.[STORAGE_META_KEY];
  return {
    entries: Object.keys(state.index.words).length,
    maxLen: state.index.maxLen,
    source: meta?.source || "unknown"
  };
}
