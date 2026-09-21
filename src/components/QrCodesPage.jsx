import React, { useState } from "react";
import { QRBox } from "./QRBox";
import { Icon } from "./Icon";
import { S, NAVY } from "../styles";

// Change this one value if you get the exact official jw.org blue hex —
// it controls the color of every QR code on this page.
const BRAND_BLUE = "#0072CE";
// A lighter tint of the brand blue, used for the department "ribbon"
// section headers in the browsing list.
const RIBBON_BLUE = "#4DA6E0";

function clearPrintMarks() {
  document.querySelectorAll(".qr-print-only, .qr-print-only-group").forEach((el) => {
    el.classList.remove("qr-print-only", "qr-print-only-group");
  });
}

// Turns a department name into a safe DOM id for the "jump to group" nav.
function deptSlug(name) {
  return "qr-dept-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Same "how many codes does this item get" logic used on-screen, kept as
// its own helper so the bare print-all grid can compute it for every
// item in the catalog, not just whichever ones happen to be expanded
// or match the current search box.
function codesForItem(item) {
  const stored = item.qrCount != null ? item.qrCount : item.perUnitQr ? Math.max(Number(item.total) || 0, 1) : 1;
  const n = Math.max(parseInt(stored, 10) || 1, 1);
  if (n > 1) {
    return Array.from({ length: n }, (_, i) => ({
      key: `${item.id}-${i + 1}`,
      payload: JSON.stringify({ name: item.name, unit: i + 1 }),
      label: `${item.name} #${i + 1} of ${n}`,
    }));
  }
  return [{ key: item.id, payload: JSON.stringify({ name: item.name }), label: item.name }];
}

// Prints every code on the page, across every item in the whole catalog
// (regardless of search filter or which accordions happen to be open),
// as a dense, bare grid grouped by department — no forms, no per-item
// headers, no per-code labels, just codes and a small department line,
// to fit as many as possible on each page.
function printAll() {
  clearPrintMarks();
  document.body.classList.add("print-all-mode");
  const cleanup = () => {
    document.body.classList.remove("print-all-mode");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Prints one or more specific codes/stickers by their key, hiding
// everything else that would otherwise show on the page.
function printCodes(keys) {
  clearPrintMarks();
  const found = keys.map((k) => document.querySelector(`.qr-print-card[data-key="${k}"]`)).filter(Boolean);
  if (found.length === 0) return;
  found.forEach((el) => el.classList.add("qr-print-only"));
  const cleanup = () => {
    clearPrintMarks();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Prints just one specific code, wherever it is.
function printOneCode(key) {
  printCodes([key]);
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
  const [openDepts, setOpenDepts] = useState({}); // { [department]: true } — collapsed by default
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({}); // { [itemId]: true }
  const [countDrafts, setCountDrafts] = useState({}); // { [itemId]: "5" } while editing
  const [paperSize, setPaperSize] = useState("letter"); // "letter" | "tabloid" (11x17) — applies to any print from this page

  const filtered = sorted.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  // The browsing list, grouped by department — so a "jump to group" nav
  // can scroll straight to one instead of scrolling the whole page.
  const groupedFiltered = React.useMemo(() => {
    const byDept = new Map();
    for (const item of filtered) {
      const dept = item.category || "Uncategorized";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(item);
    }
    return Array.from(byDept.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([department, deptItems]) => ({ department, items: deptItems }));
  }, [filtered]);

  // Grouped for the bare "Print All" grid — built from every item in the
  // catalog (not the search-filtered list), by department.
  const departmentPrintGroups = React.useMemo(() => {
    const byDept = new Map();
    for (const item of sorted) {
      const dept = item.category || "Uncategorized";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(...codesForItem(item));
    }
    return Array.from(byDept.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([department, codes]) => ({ department, codes }));
  }, [sorted]);

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

  const [stickerText, setStickerText] = useState("Lubbock CEPC");
  const [stickerShape, setStickerShape] = useState("circle"); // circle | square
  const [stickerCount, setStickerCount] = useState("1");
  const [stickers, setStickers] = useState([]); // [{ key, text, shape }]

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

  function handleGenerateStickers(e) {
    e.preventDefault();
    const text = stickerText.trim();
    if (!text) return;
    const n = Math.max(parseInt(stickerCount, 10) || 1, 1);
    setStickers(
      Array.from({ length: n }, (_, i) => ({ key: `sticker-${Date.now()}-${i}`, text, shape: stickerShape }))
    );
  }

  function handleClearStickers() {
    setStickers([]);
  }

  return (
    <div className="qr-page-root">
      <div className="qr-all-print-only">
        {departmentPrintGroups.map((group) => (
          <React.Fragment key={group.department}>
            <div className="qr-dept-label">
              {group.department} — {group.codes.length} {group.codes.length === 1 ? "code" : "codes"}
            </div>
            <div className="qr-print-grid-dense">
              {group.codes.map((entry) => (
                <div key={entry.key} className="qr-print-card" style={qrCardStyle}>
                  <div className="qr-brand-header" style={brandHeaderStyle}>CEPC-Lubbock</div>
                  <QRBox payload={entry.payload} color={BRAND_BLUE} />
                  <div className="qr-code-label" style={qrLabelStyle}>{entry.label}</div>
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="no-print" style={S.card}>
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
      </div>

      {generated && (
        <div style={S.card}>
          <div className="qr-print-card" data-key="generated" style={qrCardStyle}>
            <div className="qr-brand-header" style={brandHeaderStyle}>CEPC-Lubbock</div>
            <QRBox payload={generated.text} color={BRAND_BLUE} />
            <div className="qr-code-label" style={qrLabelStyle}>{generated.label}</div>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={S.addItemBtn} onClick={() => printOneCode("generated")}>
              Print This Code
            </button>
            <button style={S.secondaryBtn} onClick={handleClearGenerated}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="no-print" style={S.card}>
        <h2 style={S.cardTitle}>Custom Text Sticker</h2>
        <p style={S.tinyMuted}>
          Bold, eye-catching stickers — no QR code — handy for branding equipment cases, boxes, or
          trailers. Each prints at about 2 inches.
        </p>
        <form onSubmit={handleGenerateStickers}>
          <label style={S.fieldLabel}>
            Sticker Text
            <input
              style={S.fieldInput}
              value={stickerText}
              onChange={(e) => setStickerText(e.target.value)}
              placeholder="Lubbock CEPC"
            />
          </label>
          <label style={S.fieldLabel}>Shape</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              style={{ ...S.catTab, flex: 1, ...(stickerShape === "circle" ? S.catTabActive : {}) }}
              onClick={() => setStickerShape("circle")}
            >
              Circle
            </button>
            <button
              type="button"
              style={{ ...S.catTab, flex: 1, ...(stickerShape === "square" ? S.catTabActive : {}) }}
              onClick={() => setStickerShape("square")}
            >
              Square
            </button>
          </div>
          <label style={S.fieldLabel}>
            How many stickers?
            <input
              style={S.fieldInput}
              type="number"
              min="1"
              value={stickerCount}
              onChange={(e) => setStickerCount(e.target.value)}
            />
          </label>
          <button style={S.primaryBtn} type="submit" disabled={!stickerText.trim()}>
            Generate Stickers
          </button>
        </form>
      </div>

      {stickers.length > 0 && (
        <div style={S.card}>
          <p className="no-print" style={S.tinyMuted}>
            {stickers.length === 1
              ? "1 sticker ready to print."
              : `${stickers.length} identical stickers ready to print — showing one preview below.`}
          </p>

          {/* Only the first sticker is shown on screen — the rest exist
              purely so "Print All Stickers" produces the full batch. */}
          <div className="qr-print-grid" style={{ ...qrGridStyle, maxWidth: 220, margin: "0 auto" }}>
            <div
              className="qr-print-card sticker-print-card"
              data-key={stickers[0].key}
              style={stickers[0].shape === "circle" ? stickerCircleStyle : stickerSquareStyle}
            >
              <div style={stickerTextStyle}>{stickers[0].text}</div>
              <button
                className="no-print"
                style={printOneStickerBtnStyle}
                onClick={() => printCodes([stickers[0].key])}
              >
                Print This Sticker
              </button>
            </div>
          </div>

          {stickers.length > 1 && (
            <div className="screen-hide-print-show">
              <div className="qr-print-grid" style={qrGridStyle}>
                {stickers.slice(1).map((s) => (
                  <div
                    key={s.key}
                    className="qr-print-card sticker-print-card"
                    data-key={s.key}
                    style={s.shape === "circle" ? stickerCircleStyle : stickerSquareStyle}
                  >
                    <div style={stickerTextStyle}>{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={S.addItemBtn} onClick={() => printCodes(stickers.map((s) => s.key))}>
              Print All Stickers ({stickers.length})
            </button>
            <button style={S.secondaryBtn} onClick={handleClearStickers}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div style={S.adminBar}>
        <h2 style={S.cardTitle}>Printable QR Codes</h2>
        <button style={S.addItemBtn} onClick={printAll}>
          Print All QR Codes
        </button>
      </div>

      <div className="no-print" style={paperSizeRowStyle}>
        <span style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>Paper Size:</span>
        <button
          type="button"
          style={{ ...S.catTab, ...(paperSize === "letter" ? S.catTabActive : {}) }}
          onClick={() => setPaperSize("letter")}
        >
          Letter
        </button>
        <button
          type="button"
          style={{ ...S.catTab, ...(paperSize === "tabloid" ? S.catTabActive : {}) }}
          onClick={() => setPaperSize("tabloid")}
        >
          11×17 (Tabloid)
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="no-print" style={S.toolbar}>
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

      {groupedFiltered.length > 1 && (
        <div className="no-print" style={quickNavWrapStyle}>
          {groupedFiltered.map((g) => (
            <button
              key={g.department}
              type="button"
              style={quickNavChipStyle}
              onClick={() => {
                setOpenDepts((d) => ({ ...d, [g.department]: true }));
                const el = document.getElementById(deptSlug(g.department));
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {g.department}
            </button>
          ))}
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
      ) : groupedFiltered.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items match "{search}".</p>
        </div>
      ) : (
        <div style={S.card}>
          {groupedFiltered.map((group) => {
            const deptItemIds = group.items.map((it) => it.id);
            return (
              <div key={group.department} id={deptSlug(group.department)} className="qr-dept-section">
                <div
                  className="no-print"
                  style={{ ...deptSectionHeaderStyle, cursor: "pointer" }}
                  onClick={() => setOpenDepts((d) => ({ ...d, [group.department]: !d[group.department] }))}
                >
                  <span style={deptSectionTitleStyle}>
                    <span style={{ display: "inline-block", marginRight: 6 }}>
                      {openDepts[group.department] ? "⌄" : "›"}
                    </span>
                    {group.department}
                  </span>
                  <button
                    style={deptPrintBtnStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      printItemGroups(deptItemIds);
                    }}
                  >
                    Print All in Group
                  </button>
                </div>
                <div className="dept-items-body" style={{ display: openDepts[group.department] ? "block" : "none" }}>
                {group.items.map((item) => {
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
                          </button>
                          <span style={{ color: "#bbb", fontSize: 18, cursor: "pointer" }} onClick={() => toggleItem(item.id)}>
                            {isOpen ? "⌄" : "›"}
                          </span>
                        </div>
                      </div>
                      <div className="accordion-body" style={{ display: isOpen ? "block" : "none", paddingBottom: 14 }}>
                        <div className="qr-print-grid" style={qrGridStyle}>
                          {codes.map((entry) => (
                            <div key={entry.key} className="qr-print-card" data-key={entry.key} style={qrCardStyle}>
                              <div className="qr-brand-header" style={brandHeaderStyle}>CEPC-Lubbock</div>
                              <QRBox payload={entry.payload} color={BRAND_BLUE} />
                              <div className="qr-code-label" style={qrLabelStyle}>{entry.label}</div>
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
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .screen-hide-print-show { display: none; }
        .qr-all-print-only { display: none; }
        @page {
          size: ${paperSize === "tabloid" ? "11in 17in" : "letter"};
          margin: 0.4in;
        }
        @media print {
          body * { visibility: hidden; }
          .qr-page-root, .qr-page-root * { visibility: visible; }
          .qr-page-root { position: absolute; left: 0; top: 0; width: 100%; }
          /* Only force open the specific department section(s) and item(s)
             actually being printed — forcing the whole catalog open (as a
             blanket rule once did) makes the browser lay out every hidden
             QR canvas on every print action, which is what caused the lag
             on mobile. */
          .qr-dept-section:has(.accordion-item.qr-print-only-group) .dept-items-body,
          .qr-dept-section:has(.qr-print-card.qr-print-only) .dept-items-body {
            display: block !important;
          }
          .accordion-item.qr-print-only-group .accordion-body,
          .accordion-item:has(.qr-print-card.qr-print-only) .accordion-body {
            display: block !important;
          }
          .screen-hide-print-show { display: block; }
          /* Every printed QR code (any print action) comes out a
             consistent, fixed 2x2in card — same footprint as the text
             stickers below. The canvas shrinks to fit whatever room is
             left after the brand header and label text, landing around
             1.4-1.5in of actual code, comfortably scannable with room
             to spare. */
          .qr-print-card {
            page-break-inside: avoid;
            box-shadow: none !important;
            width: 2in !important;
            height: auto !important;
            min-height: 2in !important;
            max-width: none !important;
            box-sizing: border-box;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            padding: 0.08in !important;
          }
          .qr-print-card canvas {
            width: auto !important;
            height: auto !important;
            max-width: 1.3in !important;
            max-height: 1.3in !important;
          }
          .qr-brand-header {
            font-size: 11px !important;
            margin-bottom: 2px !important;
          }
          .qr-code-label {
            font-size: 9px !important;
            margin-top: 3px !important;
            line-height: 1.2 !important;
          }
          .sticker-print-card {
            width: 2in !important;
            height: 2in !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            margin: 0 auto;
          }
          .no-print { display: none !important; }
          .qr-page-root:has(.qr-print-card.qr-print-only) .qr-print-card:not(.qr-print-only) {
            display: none;
          }
          .qr-page-root:has(.accordion-item.qr-print-only-group) .accordion-item:not(.qr-print-only-group) {
            display: none;
          }

          /* "Print All QR Codes" — bare codes only, grouped by department,
             to maximize how many fit on each page. Everything else on
             this page (forms, search bar, per-item headers/branding/
             labels) is hidden while this mode is active. */
          body.print-all-mode .qr-page-root > *:not(.qr-all-print-only) {
            display: none !important;
          }
          body.print-all-mode .qr-all-print-only {
            display: block !important;
          }
          .qr-dept-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #555;
            margin: 10px 0 4px;
            break-after: avoid;
          }
          .qr-print-grid-dense {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(2in, 1fr));
            gap: 0.2in;
            margin-bottom: 14px;
            justify-items: center;
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
  gap: 10,
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
  whiteSpace: "nowrap",
};

const paperSizeRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
};

const quickNavWrapStyle = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 8,
  marginBottom: 4,
  WebkitOverflowScrolling: "touch",
};

const quickNavChipStyle = {
  background: "#eaf3fc",
  color: "#2471a3",
  border: "1px solid #b8d9f5",
  borderRadius: 999,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const deptSectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  marginTop: 16,
  marginBottom: 8,
  background: RIBBON_BLUE,
  borderRadius: 8,
  boxShadow: "0 2px 6px rgba(77,166,224,0.35)",
};

const deptSectionTitleStyle = {
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#fff",
};

const deptPrintBtnStyle = {
  background: "rgba(255,255,255,0.92)",
  color: "#0b5ea8",
  border: "none",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const countInputStyle = {
  width: 46,
  fontSize: 12,
  padding: "3px 4px",
  borderRadius: 6,
  border: "1px solid #d9dce3",
  textAlign: "center",
};

const selectedBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#eaf3fc",
  border: "1px solid #b8d9f5",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "#2471a3",
  marginBottom: 14,
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

const stickerBaseStyle = {
  background: BRAND_BLUE,
  boxShadow: "0 6px 16px rgba(0,114,206,0.4)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "26px 16px",
  aspectRatio: "1",
  width: "100%",
  maxWidth: 220,
  margin: "0 auto",
};

const stickerCircleStyle = { ...stickerBaseStyle, borderRadius: "50%" };
const stickerSquareStyle = { ...stickerBaseStyle, borderRadius: 12 };

const stickerTextStyle = {
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
  lineHeight: 1.25,
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  wordBreak: "break-word",
};

const printOneStickerBtnStyle = {
  background: "rgba(255,255,255,0.9)",
  color: NAVY,
  border: "none",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};
