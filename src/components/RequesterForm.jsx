import React from "react";
import { S } from "../styles";

const EVENT_OPTIONS = ["Circuit Assembly", "Regional Convention", "Memorial"];

// Always editable — nothing here "locks," so the requester can change
// their mind about any field right up until they submit their order.
export function RequesterForm({ requester, setRequester }) {
  function update(field, val) {
    setRequester((r) => ({ ...r, [field]: val }));
  }

  return (
    <section style={S.card}>
      <h2 style={S.cardTitle}>Request Details</h2>
      <div style={S.formGrid}>
        <Field label="Requester Name" value={requester.name} onChange={(v) => update("name", v)} placeholder="Full name" />
        <Field label="Cell Phone Number" value={requester.phone} onChange={(v) => update("phone", v)} placeholder="(555) 555-5555" />
        <SelectField
          label="Event"
          value={requester.eventType}
          onChange={(v) => update("eventType", v)}
          options={EVENT_OPTIONS}
        />
        <Field label="Event Date" value={requester.eventDate} onChange={(v) => update("eventDate", v)} type="date" />
        <Field label="Desired Pick Up Date" value={requester.pickupDate} onChange={(v) => update("pickupDate", v)} type="date" />
        <Field label="Return Date" value={requester.returnDate} onChange={(v) => update("returnDate", v)} type="date" />
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label style={S.fieldLabel}>
      {label}
      <input
        style={S.fieldInput}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={S.fieldLabel}>
      {label}
      <select style={S.fieldInput} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select event…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
