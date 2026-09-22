import React from "react";
import { S } from "../styles";
import { Icon } from "./Icon";

const CIRCUITS = ["TX 27-S", "TX 65-B", "TX 9", "TX 18"];
const EVENT_TYPES = ["Circuit Assembly", "Regional Convention", "Memorial"];

export function RequesterForm({ requester, setRequester, locked, onSave, onEdit }) {
  function update(field, val) {
    setRequester((r) => ({ ...r, [field]: val }));
  }

  const complete =
    requester.name.trim() &&
    requester.phone.trim() &&
    requester.eventDate &&
    requester.pickupDate &&
    requester.returnDate &&
    (!requester.hasReturner ||
      (requester.returnerName?.trim() && requester.returnerPhone?.trim() && requester.returnerEmail?.trim()));

  return (
    <section style={S.card}>
      <div style={S.cardHeaderRow}>
        <h2 style={S.cardTitle}>Request Details</h2>
        {locked && (
          <button style={S.editBtn} onClick={onEdit}>
            <Icon.edit /> Edit
          </button>
        )}
      </div>
      <div style={S.formGrid}>
        <Field label="Requester Name" value={requester.name} locked={locked} onChange={(v) => update("name", v)} placeholder="Full name" />
        <Field label="Cell Phone Number" value={requester.phone} locked={locked} onChange={(v) => update("phone", v)} placeholder="(555) 555-5555" />
        <label style={S.fieldLabel}>
          Event
          <select
            style={{ ...S.fieldInput, ...(locked ? S.fieldInputLocked : {}) }}
            value={requester.eventType || ""}
            disabled={locked}
            onChange={(e) => update("eventType", e.target.value)}
          >
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
          <select
            style={{ ...S.fieldInput, ...(locked ? S.fieldInputLocked : {}) }}
            value={requester.circuit || ""}
            disabled={locked}
            onChange={(e) => update("circuit", e.target.value)}
          >
            <option value="">Select a circuit…</option>
            {CIRCUITS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Field label="Event Date" value={requester.eventDate} locked={locked} onChange={(v) => update("eventDate", v)} type="date" />
        <Field label="Desired Pick Up Date" value={requester.pickupDate} locked={locked} onChange={(v) => update("pickupDate", v)} type="date" />
        <Field label="Return Date" value={requester.returnDate} locked={locked} onChange={(v) => update("returnDate", v)} type="date" />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "#1a1a2e" }}>
        <input
          type="checkbox"
          checked={Boolean(requester.hasReturner)}
          disabled={locked}
          onChange={(e) => update("hasReturner", e.target.checked)}
        />
        Will someone else be returning these items?
      </label>

      {requester.hasReturner && (
        <div style={{ marginTop: 10 }}>
          <h3 style={{ ...S.cardTitle, fontSize: 15, marginBottom: 6 }}>Contact that will be returning the items</h3>
          <div style={S.formGrid}>
            <Field
              label="Name"
              value={requester.returnerName || ""}
              locked={locked}
              onChange={(v) => update("returnerName", v)}
              placeholder="Full name"
            />
            <Field
              label="Number"
              value={requester.returnerPhone || ""}
              locked={locked}
              onChange={(v) => update("returnerPhone", v)}
              placeholder="(555) 555-5555"
            />
            <Field
              label="Email"
              value={requester.returnerEmail || ""}
              locked={locked}
              onChange={(v) => update("returnerEmail", v)}
              placeholder="name@example.com"
              type="email"
            />
            <label style={S.fieldLabel}>
              Circuit
              <select
                style={{ ...S.fieldInput, ...(locked ? S.fieldInputLocked : {}) }}
                value={requester.returnerCircuit || ""}
                disabled={locked}
                onChange={(e) => update("returnerCircuit", e.target.value)}
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

      {!locked && (
        <button style={{ ...S.saveBtn, ...(complete ? {} : S.saveBtnDisabled) }} disabled={!complete} onClick={onSave}>
          Save Request Details
        </button>
      )}
    </section>
  );
}

function Field({ label, value, onChange, locked, type = "text", placeholder }) {
  return (
    <label style={S.fieldLabel}>
      {label}
      <input
        style={{ ...S.fieldInput, ...(locked ? S.fieldInputLocked : {}) }}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
