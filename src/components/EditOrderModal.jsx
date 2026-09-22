import React, { useState } from "react";
import { Modal } from "./Modal";
import { S } from "../styles";

const CIRCUITS = ["TX 27-S", "TX 65-B", "TX 9", "TX 18"];
const EVENT_TYPES = ["Circuit Assembly", "Regional Convention", "Memorial"];

// Lets staff open a submitted order (or an in-progress draft) and
// change anything on it — the requester's contact info and request
// details, or the item list itself. Item changes on a real order
// compute the difference between old and new quantities and adjust
// live inventory to match; a draft has no live inventory to reconcile
// since it hasn't been submitted yet. Either way, this is currently
// the only way to correct a requester's details after they've saved —
// there's no self-service edit path once something's submitted.
export function EditOrderModal({ order, items, title, hint, onSave, onClose }) {
  const [editItems, setEditItems] = useState(() => (order.items || []).map((li) => ({ ...li })));
  const [addItemName, setAddItemName] = useState("");
  const [details, setDetails] = useState(() => ({
    requesterName: order.requesterName || "",
    requesterPhone: order.requesterPhone || "",
    eventType: order.eventType || "",
    eventDate: order.eventDate || "",
    pickupDate: order.pickupDate || "",
    returnDate: order.returnDate || "",
    circuit: order.circuit || "",
    hasReturner: Boolean(order.hasReturner),
    returnerName: order.returnerName || "",
    returnerPhone: order.returnerPhone || "",
    returnerEmail: order.returnerEmail || "",
    returnerCircuit: order.returnerCircuit || "",
  }));
  const [saving, setSaving] = useState(false);

  function updateDetail(field, val) {
    setDetails((d) => ({ ...d, [field]: val }));
  }

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
      await onSave(cleaned, details);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={title || `Edit Order — ${order.requesterName || "Requester"}`}>
      <p style={S.modalHint}>
        {hint ||
          "Adjust quantities, remove items, or add ones that weren't originally requested. Saving updates live inventory to match — removing or reducing an item returns stock to available; adding or increasing reserves more of it."}
      </p>

      <h3 style={{ ...S.cardTitle, fontSize: 15, marginBottom: 6 }}>Request Details</h3>
      <div style={S.formGrid}>
        <label style={S.fieldLabel}>
          Requester Name
          <input style={S.fieldInput} value={details.requesterName} onChange={(e) => updateDetail("requesterName", e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Cell Phone Number
          <input style={S.fieldInput} value={details.requesterPhone} onChange={(e) => updateDetail("requesterPhone", e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Event
          <select style={S.fieldInput} value={details.eventType} onChange={(e) => updateDetail("eventType", e.target.value)}>
            <option value="">Select an event…</option>
            {EVENT_TYPES.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </label>
        <label style={S.fieldLabel}>
          Circuit
          <select style={S.fieldInput} value={details.circuit} onChange={(e) => updateDetail("circuit", e.target.value)}>
            <option value="">Select a circuit…</option>
            {CIRCUITS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={S.fieldLabel}>
          Event Date
          <input style={S.fieldInput} type="date" value={details.eventDate} onChange={(e) => updateDetail("eventDate", e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Desired Pick Up Date
          <input style={S.fieldInput} type="date" value={details.pickupDate} onChange={(e) => updateDetail("pickupDate", e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Return Date
          <input style={S.fieldInput} type="date" value={details.returnDate} onChange={(e) => updateDetail("returnDate", e.target.value)} />
        </label>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "#1a1a2e" }}>
        <input
          type="checkbox"
          checked={Boolean(details.hasReturner)}
          onChange={(e) => updateDetail("hasReturner", e.target.checked)}
        />
        Will someone else be returning these items?
      </label>

      {details.hasReturner && (
        <div style={{ marginTop: 10 }}>
          <h3 style={{ ...S.cardTitle, fontSize: 15, marginBottom: 6 }}>Contact that will be returning the items</h3>
          <div style={S.formGrid}>
            <label style={S.fieldLabel}>
              Name
              <input style={S.fieldInput} value={details.returnerName} onChange={(e) => updateDetail("returnerName", e.target.value)} />
            </label>
            <label style={S.fieldLabel}>
              Number
              <input style={S.fieldInput} value={details.returnerPhone} onChange={(e) => updateDetail("returnerPhone", e.target.value)} />
            </label>
            <label style={S.fieldLabel}>
              Email
              <input
                style={S.fieldInput}
                type="email"
                value={details.returnerEmail}
                onChange={(e) => updateDetail("returnerEmail", e.target.value)}
              />
            </label>
            <label style={S.fieldLabel}>
              Circuit
              <select
                style={S.fieldInput}
                value={details.returnerCircuit}
                onChange={(e) => updateDetail("returnerCircuit", e.target.value)}
              >
                <option value="">Select a circuit…</option>
                {CIRCUITS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <h3 style={{ ...S.cardTitle, fontSize: 15, marginTop: 16, marginBottom: 6 }}>Items</h3>
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
