import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import {
  clearDictionary,
  getStats,
  installFromCedict,
  loadDictionary
} from "../shared/dict";
import { formatPinyin } from "../shared/pinyin";

const api = globalThis.browser ?? chrome;

export default function App() {
  const [base, setBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [displayScript, setDisplayScript] = useState("simplified");
  const [status, setStatus] = useState("");
  const [dictStats, setDictStats] = useState({ entries: 0, maxLen: 0, source: "unknown" });
  const fileRef = useRef(null);
  const [cards, setCards] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({ term: "", pinyin: "", definitions: "" });
  const [practiceId, setPracticeId] = useState(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    loadSettings();
    refreshStats();
    loadCards();
  }, []);

  async function loadSettings() {
    const res = await api.runtime.sendMessage({ type: "getSettings" });
    const settings = res.settings || {};
    setBase(settings.translationBase || "");
    setApiKey(settings.apiKey || "");
    setDisplayScript(settings.displayScript || "simplified");
  }

  async function save() {
    const settings = { translationBase: base.trim(), apiKey: apiKey.trim(), displayScript };
    await api.runtime.sendMessage({ type: "saveSettings", settings });
    setStatus("Saved");
    setTimeout(() => setStatus(""), 1500);
  }

  async function refreshStats() {
    await loadDictionary();
    const stats = await getStats();
    setDictStats(stats);
  }

  async function loadCards() {
    const res = await api.runtime.sendMessage({ type: "getFlashcards" });
    setCards(res.cards || []);
  }

  function parseDefinitions(str) {
    return (str || "")
      .split(/[;\/]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function beginEdit(card) {
    setEditId(card.id);
    setEditDraft({
      term: card.term || "",
      pinyin: card.pinyin || "",
      definitions: (card.definitions || []).join("; ")
    });
  }

  async function saveEdit() {
    const patch = {
      term: editDraft.term.trim(),
      pinyin: editDraft.pinyin.trim(),
      definitions: parseDefinitions(editDraft.definitions)
    };
    const res = await api.runtime.sendMessage({ type: "updateFlashcard", id: editId, patch });
    const updated = res?.card;
    if (updated) {
      setCards(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    }
    setEditId(null);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function deleteCard(id) {
    await api.runtime.sendMessage({ type: "deleteFlashcard", id });
    setCards(prev => prev.filter(c => c.id !== id));
    if (practiceId === id) {
      setPracticeId(null);
      setReveal(false);
    }
  }

  function pickPractice(excludeId) {
    const pool = cards.filter(c => c.id !== excludeId);
    if (pool.length === 0) return excludeId || null;
    const next = pool[Math.floor(Math.random() * pool.length)];
    return next?.id || null;
  }

  function startPractice() {
    const id = pickPractice(null);
    setPracticeId(id);
    setReveal(false);
  }

  async function gradePractice(correct) {
    if (!practiceId) return;
    const card = cards.find(c => c.id === practiceId);
    if (!card) return;
    const nextScore = (card.score || 0) + (correct ? 1 : -1);
    const res = await api.runtime.sendMessage({
      type: "updateFlashcard",
      id: card.id,
      patch: { score: nextScore }
    });
    const updated = res?.card || { ...card, score: nextScore };
    setCards(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    const nextId = pickPractice(card.id);
    setPracticeId(nextId);
    setReveal(false);
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setStatus("Importing…");
    const text = await file.text();
    await installFromCedict(text, true);
    await refreshStats();
    setStatus("Imported CEDICT");
  }

  async function handleClear() {
    await clearDictionary();
    await refreshStats();
    setStatus("Dictionary cleared");
  }

  const practiceCard = cards.find(c => c.id === practiceId) || null;

  return (
    <div className="app">
      <h1>Options</h1>

      <section>
        <h2>Custom Translation API</h2>
        <label>
          Base URL
          <input value={base} onChange={e => setBase(e.target.value)} placeholder="https://your-api.example" />
        </label>
        <label>
          API key (optional)
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </label>
        <label>
          Display Script
          <select value={displayScript} onChange={e => setDisplayScript(e.target.value)}>
            <option value="simplified">Simplified (简体)</option>
            <option value="traditional">Traditional (繁體)</option>
          </select>
        </label>
        <button onClick={save}>Save</button>
        <div className="status">{status}</div>
      </section>

      <section>
        <h2>Dictionary</h2>
        <div className="status">
          Entries: {dictStats.entries}, max word length: {dictStats.maxLen}, source: {dictStats.source}
        </div>
      </section>

      <section>
        <h2>Flashcards</h2>
        <div className="status">Cards saved: {cards.length}</div>
        <div className="flashcard-actions">
          <button onClick={startPractice} disabled={cards.length === 0}>
            Start Practice
          </button>
          <button className="secondary" onClick={loadCards}>
            Refresh
          </button>
        </div>

        {practiceCard && (
          <div className="practice">
            <div className="practice-term">{practiceCard.term}</div>
            <div className="practice-pinyin">{formatPinyin(practiceCard.pinyin)}</div>
            {reveal && (
              <div className="practice-defs">{(practiceCard.definitions || []).join("; ")}</div>
            )}
            <div className="practice-actions">
              {!reveal && (
                <button onClick={() => setReveal(true)}>Reveal</button>
              )}
              {reveal && (
                <>
                  <button onClick={() => gradePractice(true)}>Correct</button>
                  <button className="secondary" onClick={() => gradePractice(false)}>
                    Incorrect
                  </button>
                </>
              )}
            </div>
            <div className="status">Score: {practiceCard.score || 0}</div>
          </div>
        )}

        <ul className="flashcard-list">
          {cards.map(card => (
            <li key={card.id} className="flashcard-item">
              {editId === card.id ? (
                <div className="flashcard-edit">
                  <label>
                    Term
                    <input
                      type="text"
                      value={editDraft.term}
                      onChange={e => setEditDraft(d => ({ ...d, term: e.target.value }))}
                    />
                  </label>
                  <label>
                    Pinyin
                    <input
                      type="text"
                      value={editDraft.pinyin}
                      onChange={e => setEditDraft(d => ({ ...d, pinyin: e.target.value }))}
                    />
                  </label>
                  <label>
                    Definitions (separate with ; or /)
                    <input
                      type="text"
                      value={editDraft.definitions}
                      onChange={e => setEditDraft(d => ({ ...d, definitions: e.target.value }))}
                    />
                  </label>
                  <div className="flashcard-actions">
                    <button onClick={saveEdit}>Save</button>
                    <button className="secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flashcard-view">
                  <div className="term">{card.term}</div>
                  <div className="pinyin">{formatPinyin(card.pinyin)}</div>
                  <div className="defs">{(card.definitions || []).join("; ")}</div>
                  <div className="flashcard-actions">
                    <button onClick={() => beginEdit(card)}>Edit</button>
                    <button className="secondary" onClick={() => deleteCard(card.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {cards.length === 0 && <div className="status">No flashcards yet.</div>}
      </section>
    </div>
  );
}
