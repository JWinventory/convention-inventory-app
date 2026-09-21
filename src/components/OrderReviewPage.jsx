import React, { useState } from "react";
import { S } from "../styles";

// A dedicated review screen between "picking items" and "actually
// submitting." Reached by tapping Save on the inventory screen — shows
// everything checked out so far, collects the requester's email and
// notes, and asks "Ready to submit your order?" with the real Submit
// action at the bottom. "Continue Choosing Items" goes back to
// browsing without submitting anything, so more items can be added
// later before the requester finally submits.
export function OrderReviewPage({ requester, checkedOutItems, email, setEmail, notes, setNotes, onOrderCreated, onBack }) {
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [errorMsg, setErrorMsg] = useState("");

  const emailValid = email.trim().includes("@");

  async function handleSubmit() {
    if (!emailValid || checkedOutItems.length === 0) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      if (onOrderCreated) {
        await onOrderCreated({
          requester,
          requesterEmail: email,
          items: checkedOutItems.map((it) => ({ name: it.name, qty: it.out })),
          notes,
        });
      }
      // On success, the parent screen switches away to order tracking
      // automatically once the new order id is set — nothing more to do here.
    } catch (err) {
      setErrorMsg("Couldn't submit the order. Check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div>
      <button style={S.editBtn} onClick={onBack}>
        ‹ Continue Choosing Items
      </button>

      <div style={{ ...S.card, marginTop: 12 }}>
        <h2 style={S.cardTitle}>Review Your Order</h2>
        <div style={S.tinyMuted}>
          {requester.name || "—"} · {requester.phone || "—"}
        </div>
        <div style={S.tinyMuted}>
          Event {requester.eventDate || "—"} · Pickup {requester.pickupDate || "—"} · Return{" "}
          {requester.returnDate || "—"}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>Items ({checkedOutItems.length})</h3>
        <div style={S.summaryListWrap}>
          {checkedOutItems.length === 0 && <div style={S.tinyMuted}>No items checked out yet.</div>}
          {checkedOutItems.map((it) => (
            <div key={it.id} style={S.summaryRow}>
              <span>{it.name}</span>
              <span style={S.summaryQty}>×{it.out}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <label style={S.fieldLabel}>
          Your email (required, so we can notify you when your order is ready)
          <input
            style={S.fieldInput}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label style={S.fieldLabel}>
          Notes for the inventory team
          <textarea style={S.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div style={S.card}>
        <h3 style={S.cardTitle}>Ready to submit your order?</h3>
        <p style={S.tinyMuted}>
          You can also go back and add more items before submitting — everything you've picked is saved
          and waiting whenever you're ready.
        </p>
        {status === "error" && <div style={S.errorText}>{errorMsg}</div>}
        <button
          style={S.primaryBtn}
          disabled={status === "sending" || !emailValid || checkedOutItems.length === 0}
          onClick={handleSubmit}
        >
          {status === "sending" ? "Submitting…" : "Submit Order"}
        </button>
      </div>
    </div>
  );
}
