import React from "react";
import { S } from "../styles";

const CIRCUITS = ["TX 27-S", "TX 65-B", "TX 9", "TX 18"];
const EVENT_TYPES = ["Circuit Assembly", "Regional Convention", "Memorial"];

// Always editable — there's a single Save button at the bottom of the
// screen (in App.jsx) that saves this along with whatever items have
// been picked, all in one action. No separate save/lock step here.
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
        <label style={S.fieldLabel}>
          Event
          <select style={S.fieldInput} value={requester.eventType || ""} onChange={(e) => update("eventType", e.target.value)}>
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
          <select style={S.fieldInput} value={requester.circuit || ""} onChange={(e) => update("circuit", e.target.value)}>
            <option value="">Select a circuit…</option>
            {CIRCUITS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Field label="Event Date" value={requester.eventDate} onChange={(v) => update("eventDate", v)} type="date" />
        <Field label="Desired Pick Up Date" value={requester.pickupDate} onChange={(v) => update("pickupDate", v)} type="date" />
        <Field label="Return Date" value={requester.returnDate} onChange={(v) => update("returnDate", v)} type="date" />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "#1a1a2e" }}>
        <input type="checkbox" checked={Boolean(requester.hasReturner)} onChange={(e) => update("hasReturner", e.target.checked)} />
        Will someone else be returning these items?
      </label>

      {requester.hasReturner && (
        <div style={{ marginTop: 10 }}>
          <h3 style={{ ...S.cardTitle, fontSize: 15, marginBottom: 6 }}>Contact that will be returning the items</h3>
          <div style={S.formGrid}>
            <Field label="Name" value={requester.returnerName || ""} onChange={(v) => update("returnerName", v)} placeholder="Full name" />
            <Field
              label="Number"
              value={requester.returnerPhone || ""}
              onChange={(v) => update("returnerPhone", v)}
              placeholder="(555) 555-5555"
            />
            <Field
              label="Email"
              value={requester.returnerEmail || ""}
              onChange={(v) => update("returnerEmail", v)}
              placeholder="name@example.com"
              type="email"
            />
            <label style={S.fieldLabel}>
              Circuit
              <select
                style={S.fieldInput}
                value={requester.returnerCircuit || ""}
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
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label style={S.fieldLabel}>
      {label}
      <input style={S.fieldInput} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
