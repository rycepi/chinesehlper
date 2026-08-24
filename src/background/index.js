const api = globalThis.browser ?? chrome;
const STORAGE = {
  cards: "zhCards",
  settings: "zhSettings"
};

const defaultSettings = {
  translationBase: "",
  apiKey: "",
  enabled: true,
  spotifyLyricsEnabled: true,
  spotifySimplifyEnabled: true,
  spotifyPinyinEnabled: true,
  displayScript: "simplified"
};

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "zhpopup-add-card",
    title: "Add to ZhPopup flashcards",
    contexts: ["selection"]
  });
});

api.contextMenus.onClicked.addListener(async info => {
  if (info.menuItemId === "zhpopup-add-card" && info.selectionText) {
    await addFlashcard({ term: info.selectionText, pinyin: "", definitions: [] });
  }
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = messageHandlers[msg.type];
  if (!handler) return;
  handler(msg, sender)
    .then(res => sendResponse(res))
    .catch(err => sendResponse({ error: err?.message || "error" }));
  return true;
});

const messageHandlers = {
  async getBundledDictionary() {
    const response = await fetch(api.runtime.getURL("data/cedict_ts.u8"));
    if (!response.ok) throw new Error(`CEDICT request failed: ${response.status}`);
    return { text: await response.text() };
  },
  async translateParagraph(msg) {
    const translation = await translateText(msg.text || "");
    return { translation };
  },
  async addFlashcard(msg) {
    const result = await addFlashcard(msg.data);
    return result;
  },
  async updateFlashcard(msg) {
    const card = await updateFlashcard(msg.id, msg.patch || {});
    return { card };
  },
  async getFlashcards() {
    const cards = await loadCards();
    return { cards };
  },
  async deleteFlashcard(msg) {
    const id = msg.id;
    const cards = await loadCards();
    const filtered = cards.filter(c => c.id !== id);
    await api.storage.local.set({ [STORAGE.cards]: filtered });
    return { success: true };
  },
  async saveSettings(msg) {
    const merged = { ...(await loadSettings()), ...(msg.settings || {}) };
    await api.storage.local.set({ [STORAGE.settings]: merged });
    return { settings: merged };
  },
  async getSettings() {
    const settings = await loadSettings();
    return { settings };
  },
  async setEnabled(msg) {
    const current = await loadSettings();
    const next = { ...current, enabled: Boolean(msg.enabled) };
    await api.storage.local.set({ [STORAGE.settings]: next });
    return { settings: next };
  }
};

async function loadCards() {
  const res = await api.storage.local.get([STORAGE.cards]);
  return res[STORAGE.cards] || [];
}

async function addFlashcard(data) {
  const cards = await loadCards();
  const simp = data.simplified || "";
  const trad = data.traditional || "";
  const term = data.term || simp || trad;
  const variant = data.variant || "single";
  const existing = cards.find(c => {
    if ((c.variant || "single") !== variant) return false;
    const cS = c.simplified || "";
    const cT = c.traditional || "";
    if (simp && (cS === simp || cT === simp)) return true;
    if (trad && (cS === trad || cT === trad)) return true;
    return c.term === term;
  });
  if (existing) return { card: existing, existed: true };
  const definitions = Array.isArray(data.definitions) ? data.definitions.slice() : [];
  if (simp && trad && simp !== trad) {
    definitions.push(`Other: ${simp} / ${trad}`);
  }
  const card = {
    id: Date.now() + Math.random().toString(16).slice(2),
    term,
    simplified: simp,
    traditional: trad,
    pinyin: data.pinyin || "",
    variant,
    definitions,
    addedAt: Date.now(),
    score: 0
  };
  cards.unshift(card);
  const trimmed = cards.slice(0, 500);
  await api.storage.local.set({ [STORAGE.cards]: trimmed });
  return { card, existed: false };
}

async function updateFlashcard(id, patch) {
  const cards = await loadCards();
  const idx = cards.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const current = cards[idx];
  const next = {
    ...current,
    ...patch,
    definitions: Array.isArray(patch.definitions) ? patch.definitions : current.definitions
  };
  cards[idx] = next;
  await api.storage.local.set({ [STORAGE.cards]: cards });
  return next;
}

async function loadSettings() {
  const res = await api.storage.local.get([STORAGE.settings]);
  return { ...defaultSettings, ...(res[STORAGE.settings] || {}) };
}

async function translateText(text) {
  if (!text) return "";
  const settings = await loadSettings();
  const baseRaw = settings.translationBase || "";
  if (!baseRaw) return "Translation API not configured";
  const base = baseRaw.replace(/\/$/, "");
  const url = `${base}/translate`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "zh",
        target: "en",
        format: "text",
        api_key: settings.apiKey || undefined
      })
    });
    const json = await resp.json();
    if (json?.translatedText) return json.translatedText;
    if (json?.translation) return json.translation;
  } catch (err) {
    console.warn("Translation failed", err);
  }
  return `(stub translation) ${text.slice(0, 80)}`;
}
