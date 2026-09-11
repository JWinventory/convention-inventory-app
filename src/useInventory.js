import React, { useState } from "react";
import { S } from "../styles";

// A collapsed link that expands into a small lookup form, so a
// requester can pick up their in-progress order on a different device
// than the one they originally submitted from.
export function FindOrderForm({ onFind }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const found = onFind(query);
    setNotFound(!found);
  }

  if (!open) {
    return (
      <div style={{ textAlign: "center", margin: "4px 0 16px" }}>
        <button style={S.editBtn} onClick={() => setOpen(true)}>
          Already submitted an order?
        </button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Find My Request</h2>
      <p style={S.tinyMuted}>
        Enter the phone number or email you used when you submitted your request, to pick it up on this device.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={S.fieldLabel}>
          Phone or Email
          <input
            style={S.fieldInput}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotFound(false);
            }}
            placeholder="(555) 555-5555 or you@example.com"
          />
        </label>
        {notFound && (
          <div style={S.errorText}>
            No active request found with that info. Double-check it matches exactly what you entered when you
            submitted.
          </div>
        )}
        <button style={S.primaryBtn} type="submit" disabled={!query.trim()}>
          Find My Request
        </button>
        <button type="button" style={S.secondaryBtn} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </form>
    </div>
  );
}
