import React, { useMemo, useState } from "react";
import { QRBox } from "./QRBox";
import { S, NAVY } from "../styles";

// Change this one value if you get the exact official jw.org blue hex —
// it controls the color of every QR code on this page.
const BRAND_BLUE = "#0072CE";

function clearPrintOnly() {
  document.querySelectorAll(".qr-print-card.qr-print-only").forEach((el) => el.classList.remove("qr-print-only"));
}

// Marks just one card for printing (via a temporary class + CSS :has()
// rule) so a single QR code can be printed on its own, without pulling
// in every other card on the page.
function handlePrintOne(key) {
  clearPrintOnly();
  const card = document.querySelector(`.qr-print-card[data-key="${key}"]`);
  if (!card) return;
  card.classList.add("qr-print-only");
  const cleanup = () => {
    card.classList.remove("qr-print-only");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Lists every item's QR code, with a Print button, plus a generator at
// the top for creating a one-off QR code from any text or URL (not
// tied to a catalog item). All codes are branded with a "CEPC-Lubbock"
// header and rendered in the brand blue. Cards are spaced apart with a
// dashed cut-line so they're easy to scan without interference and
// easy to trim apart if printed on sticker paper.
//
// Items with "perUnitQr" checked in Admin get one distinct code per
// physical unit (e.g. Pole #1 of 31, Pole #2 of 31, ...) instead of a
// single shared code — useful for equipment where each individual
// piece needs to be scanned and checked in on its own. Since that can
// mean a lot of codes, an "All Items" / per-item tab list lets you
// jump straight to just the codes for one item at a time, and each
// card has its own "Print This Code" button for printing just one.
export function QrCodesPage({ items }) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const [selectedItemId, setSelectedItemId] = useState(null); // null = All Items

  const expanded = useMemo(() => {
    return sorted.flatMap((item) => {
      if (item.perUnitQr) {
        const total = Math.max(Number(item.total) || 0, 1);
        return Array.from({ length: total }, (_, i) => ({
          key: `${item.id}-${i + 1}`,
          itemId: item.id,
          payload: JSON.stringify({ name: item.name, unit: i + 1 }),
          label: `${item.name} #${i + 1} of ${total}`,
        }));
      }
      return [
        {
          key: item.id,
          itemId: item.id,
          payload: JSON.stringify({ name: item.name }),
          label: item.name,
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const selectedItem = sorted.find((i) => i.id === selectedItemId) || null;
  const visibleEntries = selectedItemId ? expanded.filter((e) => e.itemId === selectedItemId) : expanded;

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
            <div className="qr-print-card" data-key="generated" style={qrCardStyle}>
              <div style={brandHeaderStyle}>CEPC-Lubbock</div>
              <QRBox payload={generated.text} color={BRAND_BLUE} />
              <div style={qrLabelStyle}>{generated.label}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                style={S.addItemBtn}
                onClick={() => {
                  clearPrintOnly();
                  window.print();
                }}
              >
                Print This Code              </button>
              <button style={S.secondaryBtn} onClick={handleClearGenerated}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {sorted.length > 0 && (
        <div style={S.catTabs}>
          <button
            style={{ ...S.catTab, ...(selectedItemId === null ? S.catTabActive : {}) }}
            onClick={() => setSelectedItemId(null)}
          >
            All Items
          </button>
          {sorted.map((item) => (
            <button
              key={item.id}
              style={{ ...S.catTab, ...(selectedItemId === item.id ? S.catTabActive : {}) }}
              onClick={() => setSelectedItemId(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      <div style={S.adminBar}>
        <h2 style={S.cardTitle}>{selectedItem ? `${selectedItem.name} QR Codes` : "Printable QR Codes"}</h2>
        <button
          style={S.addItemBtn}
          onClick={() => {
            clearPrintOnly();
            window.print();
          }}
        >
          {selectedItem ? "Print This Item's Codes" : "Print All QR Codes"}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : (
        <div className="qr-print-grid" style={qrGridStyle}>
          {visibleEntries.map((entry) => (
            <div key={entry.key} className="qr-print-card" data-key={entry.key} style={qrCardStyle}>
              <div style={brandHeaderStyle}>CEPC-Lubbock</div>
              <QRBox payload={entry.payload} color={BRAND_BLUE} />
              <div style={qrLabelStyle}>{entry.label}</div>
              <button className="no-print" style={printOneBtnStyle} onClick={() => handlePrintOne(entry.key)}>
                Print This Code
              </button>
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
          .qr-print-grid:has(.qr-print-card.qr-print-only) .qr-print-card:not(.qr-print-only) {
            display: none;
          }
          .no-print { display: none !important; }
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

const printOneBtnStyle = {
  marginTop: 8,
  width: "100%",
  background: "#eef0f5",
  color: NAVY,
  border: "none",
  borderRadius: 6,
  padding: "6px 0",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
