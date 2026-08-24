export const popupStyles = `
.zh-popup {
  position: absolute;
  z-index: 2147483647;
  max-width: 320px;
  background: #0f172a;
  color: #e2e8f0;
  border: 1px solid #1e293b;
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  padding: 10px 12px;
  font-family: "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

.zh-popup h3 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: #f8fafc;
}

.zh-popup .pinyin {
  color: #fbbf24;
  font-size: 12px;
  margin-bottom: 4px;
}

.zh-popup .defs {
  margin: 0;
  padding: 0;
  list-style: none;
}

.zh-popup .defs li {
  margin-bottom: 4px;
}

.zh-popup .zh-link {
  background: none;
  border: none;
  color: #22d3ee;
  cursor: pointer;
  padding: 0;
  margin: 0;
  font: inherit;
  text-decoration: underline;
}

.zh-popup .actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.zh-popup .entry-block + .entry-block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #1e293b;
}

.zh-popup button {
  background: #22d3ee;
  border: none;
  color: #0f172a;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 120ms ease, background 150ms ease, color 150ms ease;
}

.zh-popup button.secondary {
  background: #334155;
  color: #e2e8f0;
}

.zh-popup button.added {
  background: #22c55e;
  color: #0f172a;
  animation: zh-bounce 220ms ease;
}

.zh-popup button.exists {
  background: #ef4444;
  color: #0f172a;
  animation: zh-shake 260ms ease;
}

.zh-popup .footer {
  margin-top: 6px;
  font-size: 11px;
  color: #cbd5e1;
}

@keyframes zh-bounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes zh-shake {
  0% { transform: translateX(0); }
  30% { transform: translateX(-2px); }
  60% { transform: translateX(2px); }
  100% { transform: translateX(0); }
}
`;
