import React, { useState } from "react";
import { QRBox } from "./QRBox";
import { S, NAVY } from "../styles";

// Change this one value if you get the exact official jw.org blue hex —
// it controls the color of every QR code on this page.
const BRAND_BLUE = "#0072CE";

function clearPrintMarks() {
  document.querySelectorAll(".qr-print-only, .qr-print-only-group").forEach((el) => {
    el.classList.remove("qr-print-only", "qr-print-only-group");
  });
}

// Prints every code on the page, across every item, regardless of
// which accordion sections happen to be expanded on screen (the print
// CSS force-expands everything).
function printAll() {
  clearPrintMarks();
  window.print();
}

// Prints just one specific code, wherever it is.
function printOneCode(key) {
  clearPrintMarks();
  const card = document.querySelector(`.qr-print-card[data-key="${key}"]`);
  if (!card) return;
  card.classList.add("qr-print-only");
  const cleanup = () => {
    clearPrintMarks();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Prints every code belonging to one item, even if that item's
// section is currently collapsed.
function printItemGroup(itemId) {
  clearPrintMarks();
  const group = document.querySelector(`.accordion-item[data-item-id="${itemId}"]`);
  if (!group) return;
  group.classList.add("qr-print-only-group");
  const cleanup = () => {
    clearPrintMarks();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Each item is a collapsible section (collapsed by default) so
// browsing doesn't mean scrolling through every code for every item
// at once. Items with "perUnitQr" checked in Admin get one distinct
// code per physical unit (e.g. Pole #1 of 31); everything else gets a
// single shared code.
export function QrCodesPage({ items }) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const [openItems, setOpenItems] = useState({});

  function toggleItem(id) {
    setOpenItems((o) => ({ ...o, [id]: !o[id] }));
  }

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
    <div className="qr-page-root">
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
              <button style={S.addItemBtn} onClick={() => printOneCode("generated")}>
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
        <button style={S.addItemBtn} onClick={printAll}>
          Print All QR Codes
        </button>
      </div>

      {sorted.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : (
        <div style={S.card}>
          {sorted.map((item) => {
            const total = Math.max(Number(item.total) || 0, 1);            const codes = item.perUnitQr
              ? Array.from({ length: total }, (_, i) => ({
                  key: `${item.id}-${i + 1}`,
                  payload: JSON.stringify({ name: item.name, unit: i + 1 }),
                  label: `${item.name} #${i + 1} of ${total}`,
                }))
              : [{ key: item.id, payload: JSON.stringify({ name: item.name }), label: item.name }];
            const isOpen = Boolean(openItems[item.id]);

            return (
              <div key={item.id} className="accordion-item" data-item-id={item.id} style={accordionItemStyle}>
                <div style={accordionHeaderStyle} onClick={() => toggleItem(item.id)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{item.name}</div>
                    <div style={S.tinyMuted}>{codes.length === 1 ? "1 code" : `${codes.length} codes`}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      className="no-print"
                      style={printGroupBtnStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        printItemGroup(item.id);
                      }}
                    >
                      Print All
                    </button>
                    <span style={{ color: "#bbb", fontSize: 18 }}>{isOpen ? "⌄" : "›"}</span>
                  </div>
                </div>
                <div className="accordion-body" style={{ display: isOpen ? "block" : "none", paddingBottom: 14 }}>
                  <div className="qr-print-grid" style={qrGridStyle}>
                    {codes.map((entry) => (
                      <div key={entry.key} className="qr-print-card" data-key={entry.key} style={qrCardStyle}>
                        <div style={brandHeaderStyle}>CEPC-Lubbock</div>
                        <QRBox payload={entry.payload} color={BRAND_BLUE} />
                        <div style={qrLabelStyle}>{entry.label}</div>
                        <button className="no-print" style={printOneBtnStyle} onClick={() => printOneCode(entry.key)}>
                          Print This Code
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-page-root, .qr-page-root * { visibility: visible; }
          .qr-page-root { position: absolute; left: 0; top: 0; width: 100%; }
          .accordion-body { display: block !important; }
          .qr-print-card { page-break-inside: avoid; box-shadow: none !important; }
          .no-print { display: none !important; }
          .qr-page-root:has(.qr-print-card.qr-print-only) .qr-print-card:not(.qr-print-only) {
            display: none;
          }
          .qr-page-root:has(.accordion-item.qr-print-only-group) .accordion-item:not(.qr-print-only-group) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

const accordionItemStyle = { borderBottom: "1px solid #eee" };
const accordionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 4px",
  cursor: "pointer",
};
const printGroupBtnStyle = {
  background: "#eef0f5",
  color: NAVY,
  border: "none",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const qrGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 32,
  marginTop: 10,
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
