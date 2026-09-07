import React from "react";

// Full-screen tap-to-close image viewer. Used anywhere a thumbnail
// (item photo, admin preview) should enlarge when tapped.
export function Lightbox({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
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
        src={src}
        alt={alt || ""}
        style={{
          maxWidth: "100%",
          maxHeight: "90vh",
          borderRadius: 8,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
