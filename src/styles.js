export const NAVY = "#1a1a2e";

export const CAT_COLORS = {
  "Contributions/Donations": "#c0392b",
  "Attendant": "#8e44ad",
  "Audio/Video": "#2980b9",
  "Baptismal Crate/Equipment": "#16a085",
  "Cleaning Equipment": "#27ae60",
  "First Aid": "#e74c3c",
  "Signs": "#d35400",
  "Installation": "#7f8c8d",
  "Stage": "#2c3e50",
  "Parking": "#f39c12",
};

export function colorFor(category) {
  return CAT_COLORS[category] || "#5d6d7e";
}

export const S = {
  page: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#f4f5f7", minHeight: "100vh", color: "#1a1a2e" },
  header: { background: NAVY, color: "#fff", padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 50 },
  headerTop: { maxWidth: 1100, margin: "0 auto" },
  headerTitleRow: { display: "flex", alignItems: "center", gap: 10 },
  h1: { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: 0.2 },
  h2: { fontSize: 13, opacity: 0.75, marginTop: 2 },
  syncWrap: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 },
  syncDot: { width: 10, height: 10, borderRadius: "50%", display: "inline-block" },
  refreshBtn: { background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex" },
  navTabs: { display: "flex", gap: 4, marginTop: 12 },
  navTab: { background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.7)", padding: "8px 14px", borderRadius: "8px 8px 0 0", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  navTabActive: { background: "#f4f5f7", color: NAVY },

  main: { maxWidth: 1100, margin: "0 auto", padding: "16px 12px 100px" },

  card: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  cardHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: NAVY },
  editBtn: { display: "flex", alignItems: "center", gap: 4, background: "#eef0f5", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: NAVY, cursor: "pointer" },

  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  fieldLabel: { display: "flex", flexDirection: "column", fontSize: 12, fontWeight: 600, color: "#555", gap: 4, marginBottom: 10 },
  fieldInput: { fontSize: 14, padding: "9px 10px", borderRadius: 8, border: "1px solid #d9dce3", fontFamily: "inherit", color: "#1a1a2e", boxSizing: "border-box", width: "100%" },
  fieldInputLocked: { background: "#f4f5f7", color: "#888" },
  saveBtn: { marginTop: 4, width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  saveBtnDisabled: { background: "#c7c9d4", cursor: "not-allowed" },
  tinyMuted: { fontSize: 11, color: "#999", marginTop: 4 },

  scanRow: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "18px 0" },
  scanBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#e74c3c", color: "#fff", border: "none", borderRadius: 30, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px rgba(231,76,60,0.35)" },
  scanBtnDisabled: { background: "#c7c9d4", boxShadow: "none", cursor: "not-allowed" },
  scanHint: { fontSize: 12, color: "#888" },

  toolbar: { display: "flex", gap: 8, marginBottom: 10 },
  searchWrap: { flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #d9dce3", borderRadius: 10, padding: "8px 12px", color: "#999" },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 14, fontFamily: "inherit", color: "#1a1a2e" },

  catTabs: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4, WebkitOverflowScrolling: "touch" },
  catTab: { flex: "0 0 auto", background: "#fff", border: "1px solid #e2e4ea", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "#555", cursor: "pointer", whiteSpace: "nowrap" },
  catTabActive: { background: NAVY, color: "#fff", borderColor: NAVY },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginTop: 6 },
  emptyState: { gridColumn: "1/-1", textAlign: "center", color: "#999", padding: 30, fontSize: 14 },

  itemCard: { position: "relative", background: "#fff", borderRadius: 10, padding: "10px 10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "2px solid transparent", display: "flex", flexDirection: "column" },
  itemCardOut: { borderColor: "#e74c3c" },
  catStripe: { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderRadius: "10px 10px 0 0" },
  qrBtn: { position: "absolute", top: 8, right: 8, background: "rgba(26,26,46,0.06)", border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: NAVY, display: "flex" },
  itemImgWrap: { width: "100%", height: 86, borderRadius: 8, overflow: "hidden", background: "#f0f1f4", marginTop: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  itemImg: { width: "100%", height: "100%", objectFit: "cover" },
  itemImgPlaceholder: { fontSize: 10, color: "#bbb" },
  itemCat: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  itemName: { fontSize: 12.5, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.25, minHeight: 30 },
  itemNote: { fontSize: 10, color: "#999", marginTop: 2, lineHeight: 1.3 },

  countRow: { display: "flex", justifyContent: "space-between", margin: "8px 0", gap: 4 },
  countBox: { flex: 1, textAlign: "center", background: "#f7f8fa", borderRadius: 6, padding: "4px 0" },
  countVal: { fontSize: 13, fontWeight: 800, color: "#555" },
  countLabel: { fontSize: 8, color: "#999", textTransform: "uppercase", letterSpacing: 0.3 },

  btnRow: { display: "flex", gap: 6, marginTop: "auto" },
  outBtn: { flex: 1, background: "#fdecea", color: "#c0392b", border: "none", borderRadius: 7, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  inBtn: { flex: 1, background: "#e9f9ef", color: "#1e8449", border: "none", borderRadius: 7, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  adminBtnRow: { display: "flex", gap: 6, marginTop: 6 },
  adminEditBtn: { flex: 1, background: "#eef0f5", color: NAVY, border: "none", borderRadius: 7, padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  adminDeleteBtn: { flex: 1, background: "#fdecea", color: "#c0392b", border: "none", borderRadius: 7, padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" },

  textarea: { width: "100%", border: "1px solid #d9dce3", borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", color: "#1a1a2e" },
  noteSaveRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 8 },
  saveNoteBtn: { background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  savedFlash: { fontSize: 12, color: "#1e8449", fontWeight: 600 },

  fabSubmit: { position: "fixed", bottom: 18, right: 18, display: "flex", alignItems: "center", gap: 8, background: NAVY, color: "#fff", border: "none", borderRadius: 30, padding: "13px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(26,26,46,0.4)", zIndex: 40 },
  fabBadge: { background: "#e74c3c", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 800 },

  overlay: { position: "fixed", inset: 0, background: "rgba(26,26,46,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, padding: 0 },
  modal: { background: "#fff", width: "100%", maxWidth: 460, borderRadius: "16px 16px 0 0", maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #eee", position: "sticky", top: 0, background: "#fff" },
  modalTitle: { fontSize: 16, fontWeight: 700, color: NAVY },
  modalClose: { background: "#f4f5f7", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "#555", display: "flex" },
  modalBody: { padding: 18 },
  modalHint: { fontSize: 12.5, color: "#666", lineHeight: 1.5, marginTop: 0 },
  code: { background: "#f4f5f7", padding: "1px 5px", borderRadius: 4, fontSize: 11 },
  pasteBox: { width: "100%", border: "1px solid #d9dce3", borderRadius: 8, padding: 10, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", marginBottom: 10 },
  errorText: { color: "#c0392b", fontSize: 12, marginBottom: 10 },
  primaryBtn: { width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { width: "100%", background: "#eef0f5", color: NAVY, border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 },

  scanResult: { textAlign: "center" },
  scanResultName: { fontSize: 17, fontWeight: 800, color: NAVY },
  scanResultCat: { fontSize: 12, color: "#999", marginBottom: 18, marginTop: 2 },
  toggleBtn: { width: "100%", border: "none", borderRadius: 10, padding: "16px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", color: "#fff" },
  toggleBtnOut: { background: "#e74c3c" },
  toggleBtnIn: { background: "#27ae60" },

  qrCaption: { textAlign: "center", fontSize: 12, color: "#999", marginTop: 8 },

  summaryBlock: { background: "#f7f8fa", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 },
  summaryListWrap: { maxHeight: 200, overflowY: "auto", marginBottom: 14, borderTop: "1px solid #eee", borderBottom: "1px solid #eee", padding: "6px 0" },
  summaryRow: { display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 },
  summaryQty: { fontWeight: 700, color: NAVY },

  successBox: { textAlign: "center", padding: "10px 0" },
  successCheck: { width: 54, height: 54, borderRadius: "50%", background: "#e9f9ef", color: "#1e8449", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" },
  successTitle: { fontSize: 16, fontWeight: 700, marginBottom: 4, color: NAVY },
  notWiredNote: { fontSize: 11, color: "#aaa", marginTop: 14, lineHeight: 1.5 },

  adminBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  addItemBtn: { background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  photoUploadBox: { border: "2px dashed #d9dce3", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", marginBottom: 12 },
  photoPreview: { width: 100, height: 100, objectFit: "cover", borderRadius: 8, margin: "0 auto 8px", display: "block" },
  configWarning: { background: "#fff4e5", border: "1px solid #f5c98a", color: "#8a5a00", borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.5, margin: "16px 12px" },
};
