import "./App.css";
import React, { useEffect, useMemo, useState } from "react";
import { formatPinyin } from "../shared/pinyin";

const api = globalThis.browser ?? chrome;

function escapeHtml(str) {
  return (str || "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function Card({ card, onDelete }) {
  return (
    <li className="card">
      <div className="term">{card.term}</div>
      <div className="pinyin">{formatPinyin(card.pinyin)}</div>
      <div className="defs">{(card.definitions || []).join("; ")}</div>
      <button className="danger" onClick={() => onDelete(card.id)}>
        Delete
      </button>
    </li>
  );
}

export default function App() {
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [spotifySimplifyEnabled, setSpotifySimplifyEnabled] = useState(true);
  const [spotifyPinyinEnabled, setSpotifyPinyinEnabled] = useState(true);
  const cardCount = useMemo(() => cards.length, [cards]);

  useEffect(() => {
    loadCards();
    loadSettings();
  }, []);

  async function loadCards() {
    const res = await api.runtime.sendMessage({ type: "getFlashcards" });
    setCards(res.cards || []);
  }

  async function translate() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    const res = await api.runtime.sendMessage({ type: "translateParagraph", text: trimmed });
    setTranslation(res?.translation || "(no result)");
    setLoading(false);
  }

  async function deleteCard(id) {
    await api.runtime.sendMessage({ type: "deleteFlashcard", id });
    await loadCards();
  }

  async function loadSettings() {
    const res = await api.runtime.sendMessage({ type: "getSettings" });
    if (res?.settings && typeof res.settings.enabled === "boolean") {
      setEnabled(res.settings.enabled);
    }
    const settings = res?.settings || {};
    setSpotifySimplifyEnabled(settings.spotifySimplifyEnabled !== false && settings.spotifyLyricsEnabled !== false);
    setSpotifyPinyinEnabled(settings.spotifyPinyinEnabled !== false && settings.spotifyLyricsEnabled !== false);
  }

  async function toggleSpotifySetting(name) {
    // Each button changes only its own preference. The content script receives
    // both values so it can rebuild the current lyric lines immediately.
    const nextSimplify = name === "simplify" ? !spotifySimplifyEnabled : spotifySimplifyEnabled;
    const nextPinyin = name === "pinyin" ? !spotifyPinyinEnabled : spotifyPinyinEnabled;
    setSpotifySimplifyEnabled(nextSimplify);
    setSpotifyPinyinEnabled(nextPinyin);
    await api.runtime.sendMessage({ type: "saveSettings", settings: {
      spotifySimplifyEnabled: nextSimplify,
      spotifyPinyinEnabled: nextPinyin,
      spotifyLyricsEnabled: nextSimplify || nextPinyin
    } });
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) api.tabs.sendMessage(tab.id, {
        type: "setSpotifyLyricsSettings",
        simplify: nextSimplify,
        pinyin: nextPinyin
      }).catch(() => {});
    } catch (e) {
      // ignore pages where content scripts cannot run
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await api.runtime.sendMessage({ type: "setEnabled", enabled: next });
    // Notify active tab content script to update immediately
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        api.tabs.sendMessage(tab.id, { type: "setEnabled", enabled: next }).catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="app">
      <header>
        <div className="header-links">
          <a href="options.html" target="_blank" rel="noreferrer">
            Options
          </a>
        </div>
      </header>

      <div className="section translator">
        <label htmlFor="text">Translate paragraph</label>
        <textarea
          id="text"
          rows={3}
          placeholder="Paste Chinese text here"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button onClick={translate} disabled={loading}>
          {loading ? "Translating…" : "Translate"}
        </button>
        <div className="translation">{escapeHtml(translation)}</div>
      </div>

      <div className="section">
        <h2>Scanning</h2>
        <button onClick={toggleEnabled}>Scanning: {enabled ? "On" : "Off"}</button>
        <div className="status">Controls hover lookups on pages.</div>
      </div>

      <div className="section">
        <h2>Spotify lyrics</h2>
        <button onClick={() => toggleSpotifySetting("simplify")}>
          Simplified: {spotifySimplifyEnabled ? "On" : "Off"}
        </button>
        <button onClick={() => toggleSpotifySetting("pinyin")}>
          Pinyin: {spotifyPinyinEnabled ? "On" : "Off"}
        </button>
        <div className="status">Applies to lyrics shown on open.spotify.com.</div>
      </div>

      <div className="section cards">
        <div className="cards-header">
          <h2>Flashcards</h2>
          <span id="card-count">{cardCount}</span>
        </div>
        <ul id="card-list">
          {cards.slice(0, 50).map(card => (
            <Card key={card.id} card={card} onDelete={deleteCard} />
          ))}
        </ul>
        {cards.length === 0 && <div className="status">No cards saved yet.</div>}
      </div>
    </div>
  );
}
