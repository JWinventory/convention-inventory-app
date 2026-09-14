import React, { useRef, useState } from "react";

// Full-screen tap-to-close image viewer. Accepts either a single
// image (pass `images` as a one-item array, or just use `src` for
// backward compatibility) or a full list — when there's more than one,
// left/right arrows and a swipe gesture let you flip through the rest
// without closing and reopening from the small thumbnail carousel.
export function Lightbox({ images, src, initialIndex = 0, alt, onClose }) {
  const list = Array.isArray(images) ? images : src ? [src] : [];
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(list.length - 1, 0)));
  const touchStartX = useRef(null);

  if (list.length === 0) return null;
  const current = list[index];

  function prev(e) {
    if (e) e.stopPropagation();
    setIndex((i) => (i - 1 + list.length) % list.length);
  }
  function next(e) {
    if (e) e.stopPropagation();
    setIndex((i) => (i + 1) % list.length);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta > 0) prev();
      else next();
    }
    touchStartX.current = null;
  }

  return (
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
        cursor: "zoom-out",
      }}
    >
      <img
        src={current}
        alt={alt || ""}
        style={{
          maxWidth: "100%",
          maxHeight: "90vh",
          borderRadius: 8,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          objectFit: "contain",
        }}
      />

      {list.length > 1 && (
        <>
          <button type="button" onClick={prev} style={{ ...bigArrowStyle, left: 14 }} aria-label="Previous photo">
            ‹
          </button>
          <button type="button" onClick={next} style={{ ...bigArrowStyle, right: 14 }} aria-label="Next photo">
            ›
          </button>
          <div style={bigCounterStyle}>
            {index + 1} of {list.length}
          </div>
        </>
      )}
    </div>
  );
}

const bigArrowStyle = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: 48,
  height: 48,
  fontSize: 28,
  lineHeight: "44px",
  padding: 0,
  cursor: "pointer",
};

const bigCounterStyle = {
  position: "absolute",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 20,
  padding: "5px 14px",
};
