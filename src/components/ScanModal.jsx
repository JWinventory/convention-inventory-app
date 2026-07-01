import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Modal } from "./Modal";
import { S } from "../styles";

const SCANNER_ID = "qr-camera-region";

export function ScanModal({ items, itemState, onResolveAction, onClose }) {
  const [mode, setMode] = useState("camera"); // camera | manual
  const [manualText, setManualText] = useState("");
  const [scannedItem, setScannedItem] = useState(null);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);

  function lookup(payloadText) {
    let payload;
    try {
      payload = JSON.parse(payloadText.trim());
    } catch (e) {
      setError("That doesn't look like a valid QR code for this app.");
      return;
    }
    const item = items.find((i) => i.id === payload.id);
    if (!item) {
      setError("No matching item found for that code.");
      return;
    }
    setError("");
    setScannedItem(item);
  }

  useEffect(() => {
    if (mode !== "camera" || scannedItem) return;
    const scanner = new Html5QrcodeScanner(
      SCANNER_ID,
      { fps: 10, qrbox: { width: 220, height: 220 } },
      false
    );
    scannerRef.current = scanner;
    scanner.render(
      (decodedText) => {
        lookup(decodedText);
        scanner.pause(true);
      },
      () => {
        /* ignore per-frame decode errors */
      }
    );
    return () => {
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scannedItem]);

  const cur = scannedItem ? itemState[scannedItem.id] || { out: 0 } : null;
  const isOut = cur ? cur.out > 0 : false;

  function resetScanner() {
    setScannedItem(null);
    setError("");
  }

  return (
    <Modal onClose={onClose} title="Scan QR Code">
      {!scannedItem && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            style={{ ...S.catTab, ...(mode === "camera" ? S.catTabActive : {}), flex: 1 }}
            onClick={() => setMode("camera")}
          >
            Camera
          </button>
          <button
            style={{ ...S.catTab, ...(mode === "manual" ? S.catTabActive : {}), flex: 1 }}
            onClick={() => setMode("manual")}
          >
            Type / Paste
          </button>
        </div>
      )}

      {!scannedItem && mode === "camera" && (
        <div>
          <div id={SCANNER_ID} />
          {error && <div style={S.errorText}>{error}</div>}
        </div>
      )}

      {!scannedItem && mode === "manual" && (
        <div>
          <p style={S.modalHint}>
            Paste the QR payload (a small JSON blob like{" "}
            <code style={S.code}>{`{"id":"...","name":"...","category":"..."}`}</code>) or type an item's exact name.
          </p>
          <textarea
            style={S.pasteBox}
            rows={3}
            placeholder="Paste QR text or type item name…"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
          {error && <div style={S.errorText}>{error}</div>}
          <button
            style={S.primaryBtn}
            onClick={() => {
              const text = manualText.trim();
              if (text.startsWith("{")) {
                lookup(text);
              } else {
                const found = items.find(
                  (i) => i.name.toLowerCase() === text.toLowerCase()
                );
                if (found) {
                  setError("");
                  setScannedItem(found);
                } else {
                  setError("No item matches that name exactly.");
                }
              }
            }}
          >
            Look Up Item
          </button>
        </div>
      )}

      {scannedItem && (
        <div style={S.scanResult}>
          <div style={S.scanResultName}>{scannedItem.name}</div>
          <div style={S.scanResultCat}>{scannedItem.category}</div>
          <button
            style={{ ...S.toggleBtn, ...(isOut ? S.toggleBtnIn : S.toggleBtnOut) }}
            onClick={() => {
              onResolveAction(scannedItem.id, isOut ? -1 : 1);
              onClose();
            }}
          >
            {isOut ? "Tap to Check IN" : "Tap to Check OUT"}
          </button>
          <button style={S.secondaryBtn} onClick={resetScanner}>
            Scan another item
          </button>
        </div>
      )}
    </Modal>
  );
}
