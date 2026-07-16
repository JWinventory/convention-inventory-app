import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Modal } from "./Modal";
import { S } from "../styles";

const SCANNER_ID = "qr-camera-region";

export function ScanModal({ items, itemState, onResolveAction, onClose }) {
  const [mode, setMode] = useState("camera"); // camera | manual
  const [manualText, setManualText] = useState("");
  const [scannedName, setScannedName] = useState(null);
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
    const item = items.find((i) => i.name === payload.name);
    if (!item) {
      setError("No matching item found for that code.");
      return;
    }
    setError("");
    setScannedName(item.name);
  }

  useEffect(() => {
    if (mode !== "camera" || scannedName) return;
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
  }, [mode, scannedName]);

  // Always look up the live item + counts fresh on every render, so repeated
  // taps update the numbers immediately without needing to rescan.
  const liveItem = scannedName ? items.find((i) => i.name === scannedName) : null;
  const cur = liveItem ? itemState[liveItem.id] || { out: 0 } : null;
  const out = cur ? cur.out : 0;
  const available = liveItem ? liveItem.total - out : 0;

  function resetScanner() {
    setScannedName(null);
    setError("");
  }

  return (
    <Modal onClose={onClose} title="Scan QR Code">
      {!scannedName && (
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

      {!scannedName && mode === "camera" && (
        <div>
          <div id={SCANNER_ID} />
          {error && <div style={S.errorText}>{error}</div>}
        </div>
      )}

      {!scannedName && mode === "manual" && (
        <div>
          <p style={S.modalHint}>
            Paste the QR payload (a small JSON blob like{" "}
            <code style={S.code}>{`{"name":"..."}`}</code>) or type an item's exact name.
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
                  setScannedName(found.name);
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

      {liveItem && (
        <div style={S.scanResult}>
          <div style={S.scanResultName}>{liveItem.name}</div>
          <div style={S.scanResultCat}>{liveItem.category}</div>

          <div style={S.countRow}>
            <CountMini label="Total" value={liveItem.total} />
            <CountMini label="Out" value={out} />
            <CountMini label="Available" value={available} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              style={{
                ...S.toggleBtn,
                ...S.toggleBtnOut,
                flex: 1,
                fontSize: 14,
                padding: "14px 0",
                ...(available <= 0 ? { opacity: 0.4, cursor: "not-allowed" } : {}),
              }}
              disabled={available <= 0}
              onClick={() => onResolveAction(liveItem.id, 1)}
            >
              + Check Out
            </button>
            <button
              style={{
                ...S.toggleBtn,
                ...S.toggleBtnIn,
                flex: 1,
                fontSize: 14,
                padding: "14px 0",
                ...(out <= 0 ? { opacity: 0.4, cursor: "not-allowed" } : {}),
              }}
              disabled={out <= 0}
              onClick={() => onResolveAction(liveItem.id, -1)}
            >
              + Check In
            </button>
          </div>

          <div style={S.tinyMuted}>
            Tap either button as many times as you need — it stays on this item so you can
            check out or in multiple units at once.
          </div>

          <button style={S.secondaryBtn} onClick={resetScanner}>
            Scan another item
          </button>
          <button style={{ ...S.secondaryBtn, marginTop: 8 }} onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

function CountMini({ label, value }) {
  return (
    <div style={S.countBox}>
      <div style={S.countVal}>{value}</div>
      <div style={S.countLabel}>{label}</div>
    </div>
  );
}
