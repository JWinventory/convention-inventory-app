import React, { useState } from "react";
import { QRBox } from "./QRBox";
import { Icon } from "./Icon";
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

// Prints every code belonging to one or more items — used for both
// "Print All" on a single item's header and "Print Selected" across a
// custom group, since both just mark a set of items to keep visible.
function printItemGroups(itemIds) {
  clearPrintMarks();
  const found = itemIds
    .map((id) => document.querySelector(`.accordion-item[data-item-id="${id}"]`))
    .filter(Boolean);
  if (found.length === 0) return;
  found.forEach((el) => el.classList.add("qr-print-only-group"));
  const cleanup = () => {
    clearPrintMarks();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Each item is a collapsible section (collapsed by default) so
// browsing doesn't mean scrolling through every code for every item
// at once. Each item also has its own adjustable "how many codes"
// count — independent of its catalog Total Quantity, so you can print
// spares, fewer than you have, or however many you actually need —
// and a checkbox to build a custom group of items to print together.
export function QrCodesPage({ items, updateItem }) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const [openItems, setOpenItems] = useState({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({}); // { [itemId]: true }
  const [countDrafts, setCountDrafts] = useState({}); // { [itemId]: "5" } while editing

  const filtered = sorted.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  function toggleItem(id) {
    setOpenItems((o) => ({ ...o, [id]: !o[id] }));
  }

  function toggleSelected(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function countFor(item) {
    if (countDrafts[item.id] !== undefined) return countDrafts[item.id];
    const stored = item.qrCount != null ? item.qrCount : item.perUnitQr ? Math.max(Number(item.total) || 0, 1) : 1;
    return String(stored);
  }

  function commitCount(item) {
    const raw = countDrafts[item.id];
    if (raw === undefined) return;
    const n = Math.max(parseInt(raw, 10) || 1, 1);
    updateItem(item.id, { qrCount: n, perUnitQr: n > 1 });
    setCountDrafts((d) => {
      const next = { ...d };
      delete next[item.id];
      return next;
    });
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

      {sorted.length > 0 && (
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Icon.search />
            <input
              style={S.searchInput}
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div style={selectedBarStyle}>
          <span>
            {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.addItemBtn} onClick={() => printItemGroups(selectedIds)}>
              Print Selected
            </button>
            <button style={S.secondaryBtn} onClick={() => setSelected({})}>
              Clear
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items match "{search}".</p>
        </div>
      ) : (
        <div style={S.card}>
          {filtered.map((item) => {
            const count = countFor(item);
            const n = Math.max(parseInt(count, 10) || 1, 1);
            const codes =
              n > 1
                ? Array.from({ length: n }, (_, i) => ({
                    key: `${item.id}-${i + 1}`,
                    payload: JSON.stringify({ name: item.name, unit: i + 1 }),
                    label: `${item.name} #${i + 1} of ${n}`,
                  }))
                : [{ key: item.id, payload: JSON.stringify({ name: item.name }), label: item.name }];
            const isOpen = Boolean(openItems[item.id]);

            return (
              <div key={item.id} className="accordion-item" data-item-id={item.id} style={accordionItemStyle}>
                <div style={accordionHeaderStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      className="no-print"
                      type="checkbox"
                      checked={Boolean(selected[item.id])}
                      onChange={() => toggleSelected(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div onClick={() => toggleItem(item.id)} style={{ cursor: "pointer" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{item.name}</div>
                      <div style={S.tinyMuted}>{n === 1 ? "1 code" : `${n} codes`}</div>
                    </div>
                  </div>
                  <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#888" }}>
                      Codes:
                      <input
                        type="number"
                        min="1"
                        style={countInputStyle}
                        value={count}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setCountDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                        onBlur={() => commitCount(item)}
                      />
                    </label>
                    <button
                      style={printGroupBtnStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        printItemGroups([item.id]);
                      }}
                    >
                      Print All
