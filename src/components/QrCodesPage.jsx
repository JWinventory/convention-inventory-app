import React, { useState } from "react";
import { QRBox } from "./QRBox";
import { S } from "../styles";

// Change this one value if you get the exact official jw.org blue hex —
// it controls the color of every QR code on this page.
const BRAND_BLUE = "#0072CE";

// Lists every item's QR code in a grid, with a Print button, plus a
// generator at the top for creating a one-off QR code from any text
// or URL (not tied to a catalog item). All codes are branded with a
// "CEPC-Lubbock" header and rendered in the brand blue. Cards are
// spaced apart with a dashed cut-line so they're easy to scan without
// interference and easy to trim apart if printed on sticker paper.
//
// Items with "perUnitQr" checked in Admin get one distinct code per
// physical unit (e.g. Pole #1 of 31, Pole #2 of 31, ...) instead of a
// single shared code — useful for equipment where each individual
// piece needs to be scanned and checked in on its own.
export function QrCodesPage({ items }) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));

  const expanded = sorted.flatMap((item) => {
    if (item.perUnitQr) {
      const total = Math.max(Number(item.total) || 0, 1);
      return Array.from({ length: total }, (_, i) => ({
        key: `${item.id}-${i + 1}`,
        payload: JSON.stringify({ name: item.name, unit: i + 1 }),
        label: `${item.name} #${i + 1} of ${total}`,
      }));
    }
    return [
      {
        key: item.id,
        payload: JSON.stringify({ name: item.name }),
        label: item.name,
      },
    ];
  });

  const [customText, setCustomText] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [generated, setGenerated] = useState(null); // { text, label } | null

  function handleGenerate(e) {
    e.preventDefault();
    if (!customText.trim()) return;
    setGenerated({ text: customText.trim(), label: customLabel.trim() || customText.trim() });
  }

  function handleClearGenerated() {
    setGenerated(null);
    setCustomText("");
    setCustomLabel("");
  }

  return (
    <div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Custom QR Code Generator</h2>
        <p style={S.tinyMuted}>
          Create a QR code for any text or link — a sign-up form, WiFi password, a webpage, anything.
        </p>
        <form onSubmit={handleGenerate}>
          <label style={S.fieldLabel}>
            Text or URL
            <input
              style={S.fieldInput}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="https://example.com or any text"
            />
          </label>
          <label style={S.fieldLabel}>
            Label (optional)
            <input
              style={S.fieldInput}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="What to print under the code"
            />
          </label>
          <button style={S.primaryBtn} type="submit" disabled={!customText.trim()}>
            Generate QR Code
          </button>
        </form>

        {generated && (
          <div style={{ marginTop: 16 }}>
            <div className="qr-print-card" style={qrCardStyle}>
              <div style={brandHeaderStyle}>CEPC-Lubbock</div>
              <QRBox payload={generated.text} color={BRAND_BLUE} />
              <div style={qrLabelStyle}>{generated.label}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={S.addItemBtn} onClick={() => window.print()}>
                Print This Code
              </button>
              <button style={S.secondaryBtn} onClick={handleClearGenerated}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={S.adminBar}>
        <h2 style={S.cardTitle}>Printable QR Codes</h2>
        <button style={S.addItemBtn} onClick={() => window.print()}>
          Print All QR Codes
        </button>
      </div>

      {sorted.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : (
        <div className="qr-print-grid" style={qrGridStyle}>
          {expanded.map((entry) => (
            <div key={entry.key} className="qr-print-card" style={qrCardStyle}>
              <div style={brandHeaderStyle}>CEPC-Lubbock</div>
              <QRBox payload={entry.payload} color={BRAND_BLUE} />
              <div style={qrLabelStyle}>{entry.label}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-print-grid, .qr-print-grid *, .qr-print-card, .qr-print-card * { visibility: visible; }
          .qr-print-grid {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .qr-print-card {
            page-break-inside: avoid;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const qrGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 32,
  marginTop: 14,
};

const qrCardStyle = {
  background: "#fff",
  borderRadius: 10,
  padding: 14,
  textAlign: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: "1px dashed #bbb",
};

const brandHeaderStyle = {
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: BRAND_BLUE,
  marginBottom: 4,
};

const qrLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  marginTop: 6,
  color: "#1a1a2e",
};
