import React from "react";
import { S } from "../styles";
import { Icon } from "./Icon";

export function RequesterForm({ requester, setRequester, locked, onSave, onEdit }) {
  function update(field, val) {
    setRequester((r) => ({ ...r, [field]: val }));
  }
  const complete =
    requester.name.trim() &&
    requester.phone.trim() &&
    requester.eventDate &&
    requester.pickupDate &&
    requester.returnDate;

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
        <Field label="Event Date" value={requester.eventDate} locked={locked} onChange={(v) => update("eventDate", v)} type="date" />
        <Field label="Desired Pick Up Date" value={requester.pickupDate} locked={locked} onChange={(v) => update("pickupDate", v)} type="date" />
        <Field label="Return Date" value={requester.returnDate} locked={locked} onChange={(v) => update("returnDate", v)} type="date" />
      </div>
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
