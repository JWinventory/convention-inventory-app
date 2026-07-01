import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export function QRBox({ payload }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      payload,
      { width: 200, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } },
      (err) => {
        if (err) setError(true);
      }
    );
  }, [payload]);

  if (error) {
    return (
      <div style={{ fontSize: 12, color: "#888", textAlign: "center", padding: 20 }}>
        Couldn't render QR code. Payload:
        <br />
        <code style={{ fontSize: 10, wordBreak: "break-all" }}>{payload}</code>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
