import React, { useState } from "react";
import { S } from "../styles";

// A collapsed, prominent call-to-action that expands into a small
// lookup form — lets a requester pick up an in-progress draft to keep
// adding items and submit, or jump straight to check-in scanning once
// their order is ready for pickup, all by phone number or email.
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
        <button style={findOrderCtaStyle} onClick={() => setOpen(true)}>
          Already started or submitted an order? Click Here
        </button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Find My Request</h2>
      <p style={S.tinyMuted}>
        Enter the phone number or email used for the request. If it's still in progress, you'll come right
        back to it to keep adding items and submit. If it's already been filled, you'll be taken to scan
        items back in.
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

const findOrderCtaStyle = {
  background: "#0072CE",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "16px 24px",
  fontSize: 17,
  fontWeight: 800,
  width: "100%",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,114,206,0.35)",
};
