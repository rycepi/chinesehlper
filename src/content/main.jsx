import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { lookupAtText, loadDictionary, lookupExact } from "../shared/dict";
import { Popup } from "./Popup";
import { popupStyles } from "./styles";
import { startSpotifyLyrics } from "./spotifyLyrics";

const api = globalThis.browser ?? chrome;
const mountId = "zhpopup-react-root";

let stopSpotifyLyrics = null;

async function initSpotifyLyrics() {
  if (location.hostname !== "open.spotify.com") return;
  // The content bundle runs on many websites, but Spotify lyric logic should
  // only initialize on Spotify pages.
  let settings = { simplify: true, pinyin: true };
  try {
    const res = await api.runtime.sendMessage({ type: "getSettings" });
    const stored = res?.settings || {};
    // spotifyLyricsEnabled is retained for compatibility with older saved
    // settings. The two newer settings control the features independently.
    const legacyEnabled = stored.spotifyLyricsEnabled !== false;
    settings = {
      simplify: legacyEnabled && stored.spotifySimplifyEnabled !== false,
      pinyin: legacyEnabled && stored.spotifyPinyinEnabled !== false
    };
  } catch (err) {
    // Use the enabled default if settings are temporarily unavailable.
  }
  stopSpotifyLyrics = startSpotifyLyrics(settings);
  api.runtime.onMessage.addListener(msg => {
    if (msg?.type !== "setSpotifyLyricsSettings") return;
    // Stop first so existing modified lines are restored, then process them
    // again using the newly selected settings.
    stopSpotifyLyrics?.();
    stopSpotifyLyrics = startSpotifyLyrics({ simplify: msg.simplify, pinyin: msg.pinyin });
  });
}

initSpotifyLyrics();

function injectShadowRoot() {
  let host = document.getElementById(mountId);
  if (host) return host.shadowRoot;
  host = document.createElement("div");
  host.id = mountId;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = popupStyles;
  shadow.appendChild(style);
  const container = document.createElement("div");
  container.id = "zhpopup-container";
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  return shadow;
}

function getCaretInfo(clientX, clientY) {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos) return { node: pos.offsetNode, offset: pos.offset };
  }
  return null;
}

function isTextNode(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}

function resolveTextNode(target) {
  if (!target) return null;
  if (isTextNode(target.node)) return target;
  // Some browsers return an element; walk to the first text node under it.
  if (target.node && target.node.nodeType === Node.ELEMENT_NODE) {
    const walker = document.createTreeWalker(target.node, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) return { node: first, offset: Math.min(target.offset || 0, first.length || 0) };
  }
  return null;
}

function getSelectionText() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  return sel.toString().trim();
}

function ContentApp() {
  const [match, setMatch] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectionText, setSelectionText] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [displayScript, setDisplayScript] = useState("simplified");
  const rafRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const shiftHeld = useRef(false);
  const lastMatchKey = useRef("");
  const hostRef = useRef(null);

  useEffect(() => {
    loadDictionary();
    api.runtime.sendMessage({ type: "getSettings" }).then(res => {
      if (res?.settings) {
        if (typeof res.settings.enabled === "boolean") setEnabled(res.settings.enabled);
        if (res.settings.displayScript) setDisplayScript(res.settings.displayScript);
      }
    });
  }, []);

  useEffect(() => {
    hostRef.current = document.getElementById(mountId);
  }, []);

  useEffect(() => {
    const onMove = evt => {
      lastPos.current = { x: evt.clientX, y: evt.clientY };
      shiftHeld.current = evt.shiftKey;
      if (rafRef.current) return;
      rafRef.current = true;
      requestAnimationFrame(processHover);
    };

    const onKeyDown = evt => {
      if (evt.key === "Shift") shiftHeld.current = true;
    };
    const onKeyUp = evt => {
      if (evt.key === "Shift") shiftHeld.current = false;
    };
    const onMouseDown = evt => {
      const host = hostRef.current;
      if (!host) {
        hidePopup();
        return;
      }
      const path = evt.composedPath ? evt.composedPath() : [];
      const clickedInside = path.includes(host);
      if (!clickedInside) hidePopup();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
    };
  });

  useEffect(() => {
    const onMsg = msg => {
      if (msg?.type === "setEnabled" && typeof msg.enabled === "boolean") {
        setEnabled(msg.enabled);
        if (!msg.enabled) hidePopup();
      }
      if (msg?.type === "setDisplayScript" && msg.value) {
        setDisplayScript(msg.value);
      }
    };
    api.runtime.onMessage.addListener(onMsg);
    return () => api.runtime.onMessage.removeListener(onMsg);
  }, []);

  const isCaretWithinMatch = (text, offset, currentMatch) => {
    if (!text || !currentMatch) return false;
    const len = currentMatch.length;
    for (let i = 0; i < len; i++) {
      const start = offset - i;
      if (start < 0) continue;
      if (text.slice(start, start + len) === currentMatch) return true;
    }
    return false;
  };

  const processHover = async () => {
    rafRef.current = false;
    if (!enabled) return;
    if (!shiftHeld.current) return;
    const { x, y } = lastPos.current;
    const caret = resolveTextNode(getCaretInfo(x, y));
    if (!caret) {
      return;
    }
    const text = caret.node.data || "";
    const offset = caret.offset || 0;
    if (!text || offset >= text.length) {
      return;
    }
    const found = await lookupAtText(text, offset);
    if (!found) {
      return;
    }
    if (match) {
      if (isCaretWithinMatch(text, offset, match.match)) return;
      if (lastMatchKey.current === found.match) return;
    }
    const foundKey = found.match;
    const sel = getSelectionText();
    setMatch(found);
    setAddStatus("");
    setSelectionText(sel);
    setPosition({ x: x + window.scrollX + 14, y: y + window.scrollY + 14 });
    lastMatchKey.current = foundKey;
  };

  function hidePopup() {
    setMatch(null);
    setAddStatus("");
    lastMatchKey.current = "";
  }

  async function addCard(matchObj, entry) {
    const res = await api.runtime.sendMessage({
      type: "addFlashcard",
      data: {
        term: matchObj.match,
        simplified: entry.simplified || "",
        traditional: entry.traditional || "",
        pinyin: entry.pinyin || "",
        definitions: entry.definitions || [],
        variant: "single"
      }
    });
    if (res?.existed) {
      setAddStatus("exists");
    } else {
      setAddStatus("added");
    }
  }

  async function addAllCard(matchObj) {
    const entries = matchObj.entries || [];
    if (entries.length === 0) return;
    const primary = entries[0];
    const pinyin = Array.from(new Set(entries.map(e => e.pinyin).filter(Boolean))).join(" / ");
    const definitions = Array.from(
      new Set(entries.flatMap(e => (e.definitions || []).map(d => d.trim())).filter(Boolean))
    );
    const res = await api.runtime.sendMessage({
      type: "addFlashcard",
      data: {
        term: matchObj.match,
        simplified: primary.simplified || "",
        traditional: primary.traditional || "",
        pinyin,
        definitions,
        variant: "all"
      }
    });
    if (res?.existed) {
      setAddStatus("exists");
    } else {
      setAddStatus("added");
    }
  }

  async function jumpTo(ref) {
    const simp = ref?.simplified || "";
    const trad = ref?.traditional || "";
    const raw = ref?.raw || "";
    const entries =
      (simp && (await lookupExact(simp))) ||
      (trad && (await lookupExact(trad))) ||
      (raw && (await lookupExact(raw)));
    if (!entries) return;
    const primary = entries[0];
    const term =
      displayScript === "traditional"
        ? primary.traditional || trad || raw || simp
        : primary.simplified || simp || raw || trad;
    setMatch({ match: term, entries });
    setAddStatus("");
    setSelectionText("");
    lastMatchKey.current = term;
  }

  return (
    <Popup
      match={match}
      displayScript={displayScript}
      position={position}
      selectionText={selectionText}
      addStatus={addStatus}
      onAddCard={addCard}
      onAddAll={addAllCard}
      onJump={jumpTo}
      onClose={hidePopup}
    />
  );
}

function main() {
  const shadow = injectShadowRoot();
  const container = shadow.getElementById("zhpopup-container");
  if (container.__zhpopupMounted) return;
  container.__zhpopupMounted = true;
  const root = createRoot(container);
  root.render(<ContentApp />);
}

main();
