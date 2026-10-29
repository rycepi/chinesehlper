export function placePopup(anchor, size, viewport) {
  const margin = 8;
  const gap = 14;
  const clamp = (value, max) => Math.max(margin, Math.min(value, max));
  const below = anchor.y + gap;
  const top = below + size.height <= viewport.height - margin
    ? below
    : anchor.y - gap - size.height;
  return {
    x: clamp(anchor.x + gap, viewport.width - size.width - margin),
    y: clamp(top, viewport.height - size.height - margin)
  };
}
