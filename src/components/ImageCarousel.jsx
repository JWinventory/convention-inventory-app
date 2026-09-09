import React, { useState } from "react";
import { S } from "../styles";

// Displays one photo from a list, with prev/next arrows and an
// "X of Y" counter when there's more than one. Tapping the photo
// calls onEnlarge with the currently-shown image.
export function ImageCarousel({ images, alt, onEnlarge }) {
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) {
    return <div style={S.itemImgPlaceholder}>No photo</div>;
  }

  const safeIndex = Math.min(index, images.length - 1);
  const current = images[safeIndex];

  function prev(e) {
    e.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function next(e) {
    e.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <img
        src={current}
        alt={alt}
        style={{ ...S.itemImg, cursor: "zoom-in" }}
        onClick={() => onEnlarge && onEnlarge(current)}
      />
      {images.length > 1 && (
        <>
          <button type="button" style={{ ...arrowStyle, left: 4 }} onClick={prev} aria-label="Previous photo">
            ‹
          </button>
          <button type="button" style={{ ...arrowStyle, right: 4 }} onClick={next} aria-label="Next photo">
            ›
          </button>
          <div style={counterStyle}>
            {safeIndex + 1} of {images.length}
          </div>
        </>
      )}
    </div>
  );
}

const arrowStyle = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  background: "rgba(0,0,0,0.45)",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: 22,
  height: 22,
  fontSize: 14,
  lineHeight: "20px",
  padding: 0,
  cursor: "pointer",
};

const counterStyle = {
  position: "absolute",
  bottom: 4,
  right: 4,
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  fontSize: 9,
  fontWeight: 700,
  borderRadius: 8,
  padding: "2px 6px",
};
