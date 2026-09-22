import React, { useState } from "react";
import { Modal } from "./Modal";
import { S } from "../styles";

// Lets staff open a submitted order and actually change what's on it —
// adjust a quantity, remove an item entirely, or add one that wasn't
// originally requested. Saving computes the difference between the old
// and new quantities for each item and adjusts live inventory to
// match: removing/reducing returns stock to available, adding/
// increasing reserves more of it.
export function EditOrderModal({ order, items, onSave, onClose }) {
  const [editItems, setEditItems] = useState(() => (order.items || []).map((li) => ({ ...li })));
  const [addItemName, setAddItemName] = useState("");
  const [saving, setSaving] = useState(false);

  const availableToAdd = items
    .filter((it) => !editItems.some((li) => li.name === it.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  function updateQty(name, qty) {
    const n = Math.max(parseInt(qty, 10) || 0, 0);
    setEditItems((prev) => prev.map((li) => (li.name === name ? { ...li, qty: n } : li)));
  }

  function removeItem(name) {
    setEditItems((prev) => prev.filter((li) => li.name !== name));
  }

  function addItem() {
    if (!addItemName) return;
    setEditItems((prev) => [...prev, { name: addItemName, qty: 1 }]);
    setAddItemName("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Drop anything that got its quantity zeroed out entirely.
      const cleaned = editItems.filter((li) => li.qty > 0);
      await onSave(cleaned);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Edit Order — ${order.requesterName || "Requester"}`}>
      <p style={S.modalHint}>
        Adjust quantities, remove items, or add ones that weren't originally requested. Saving updates
        live inventory to match — removing or reducing an item returns stock to available; adding or
        increasing reserves more of it.
      </p>

      <div style={S.summaryListWrap}>
        {editItems.length === 0 && <div style={S.tinyMuted}>No items on this order.</div>}
        {editItems.map((li) => (
          <div key={li.name} style={{ ...S.summaryRow, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{li.name}</span>
            <input
              type="number"
              min="0"
              style={{ ...S.qtySelect, width: 60, marginRight: 8 }}
              value={li.qty}
              onChange={(e) => updateQty(li.name, e.target.value)}
            />
            <button style={S.adminDeleteBtn} onClick={() => removeItem(li.name)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <select style={{ ...S.fieldInput, flex: 1 }} value={addItemName} onChange={(e) => setAddItemName(e.target.value)}>
          <option value="">Add an item…</option>
          {availableToAdd.map((it) => (
            <option key={it.id} value={it.name}>
              {it.name}
            </option>
          ))}
        </select>
        <button style={S.secondaryBtn} disabled={!addItemName} onClick={addItem}>
          Add
        </button>
      </div>

      <button style={{ ...S.primaryBtn, marginTop: 16 }} disabled={saving} onClick={handleSave}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
      <button style={S.secondaryBtn} onClick={onClose}>
        Cancel
      </button>
    </Modal>
  );
}
