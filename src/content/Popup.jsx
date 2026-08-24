import React from "react";
import { formatPinyin, formatPinyinLower } from "../shared/pinyin";

export function Popup({ match, displayScript, position, selectionText, addStatus, onAddCard, onAddAll, onJump, onClose }) {
  if (!match) return null;
  const entries = match.entries || [];
  const primary = entries[0] || {};
  const displayText =
    displayScript === "traditional" ? primary.traditional || match.match : primary.simplified || match.match;
  const isCjkString = value => /[\u3400-\u9fff]/.test(value || "");

  const renderDefinition = def => {
    const parts = [];
    let cursor = 0;
    let idx = 0;
    const re = /([^\s/]+?)\[(.+?)\]/g;
    let m;
    const pushText = text => {
      if (!text) return;
      parts.push(
        <span key={`t-${idx++}`}>{text}</span>
      );
    };
    while ((m = re.exec(def)) !== null) {
      const before = def.slice(cursor, m.index);
      pushText(before);
      const wordRaw = m[1];
      const pinyinRaw = m[2];
      let prefix = "";
      let word = wordRaw;
      if (word.startsWith("CL:")) {
        prefix = "CL:";
        word = word.slice(3);
      }
      let simplified = "";
      let traditional = "";
      let display = word;
      if (word.includes("|")) {
        const [trad, simp] = word.split("|");
        traditional = trad;
        simplified = simp;
        display = displayScript === "traditional" ? trad : simp;
      }
      const canJump = Boolean(onJump) && (simplified || traditional || isCjkString(display));
      if (prefix) pushText(prefix);
      if (canJump) {
        parts.push(
          <button
            type="button"
            key={`b-${idx++}`}
            className="zh-link"
            onClick={() => onJump({ simplified, traditional, raw: display })}
          >
            {display}
          </button>
        );
      } else {
        pushText(display);
      }
      pushText(`[${formatPinyinLower(pinyinRaw)}]`);
      cursor = m.index + m[0].length;
    }
    const tail = def.slice(cursor);
    pushText(tail);
    return parts;
  };
  return (
    <div
      className="zh-popup"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={e => e.stopPropagation()}
    >
      <h3>{displayText}</h3>
      {entries.map((entry, idx) => (
        <div key={idx} className="entry-block">
          <div className="pinyin">{formatPinyin(entry.pinyin || "")}</div>
          <ul className="defs">
            {(entry.definitions || []).map((d, i) => (
              <li key={`${idx}-${i}`}>{renderDefinition(d)}</li>
            ))}
          </ul>
          <div className="actions">
            <button
              className={addStatus === "added" ? "added" : addStatus === "exists" ? "exists" : ""}
              onClick={() => onAddCard(match, entry)}
            >
              {addStatus === "exists" ? "Already Added" : "Add Card"}
            </button>
          </div>
        </div>
      ))}
      {entries.length > 1 && (
        <div className="actions">
          <button
            className={addStatus === "added" ? "added" : addStatus === "exists" ? "exists" : ""}
            onClick={() => onAddAll && onAddAll(match)}
          >
            Add All Definitions
          </button>
        </div>
      )}
      <div className="actions">
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
      {addStatus && (
        <div className="footer">{addStatus === "exists" ? "Already in flashcards" : "Added to flashcards"}</div>
      )}
      {selectionText && (
        <div className="footer">
          Selection: {selectionText.slice(0, 80)}
          {selectionText.length > 80 ? "..." : ""}
        </div>
      )}
    </div>
  );
}
