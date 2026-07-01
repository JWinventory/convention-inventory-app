import React from "react";
import { Modal } from "./Modal";
import { S } from "../styles";
import { Icon } from "./Icon";

export function SubmitModal({ requester, checkedOutItems, email, setEmail, notes, setNotes, done, onSubmit, onClose }) {
  if (done) {
    return (
      <Modal onClose={onClose} title="Request Submitted">
        <div style={S.successBox}>
          <div style={S.successCheck}>
            <Icon.check size={28} />
          </div>
          <div style={S.successTitle}>Notification sent</div>
          <div style={S.tinyMuted}>
            {requester.name || "The requester"} will hear back about pickup for {checkedOutItems.length} item
            {checkedOutItems.length === 1 ? "" : "s"}.
          </div>
          <div style={S.notWiredNote}>
            Note: email delivery isn't wired up yet — connect a service like SendGrid, Resend, or a webhook in
            src/components/SubmitModal.jsx to send a real notification.
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose} title="Submit & Notify">
      <div style={S.summaryBlock}>
        <div>
          <strong>{requester.name || "—"}</strong> · {requester.phone || "—"}
        </div>
        <div style={S.tinyMuted}>
          Event {requester.eventDate || "—"} · Pickup {requester.pickupDate || "—"} · Return {requester.returnDate || "—"}
        </div>
      </div>
      <div style={S.summaryListWrap}>
        {checkedOutItems.length === 0 && <div style={S.tinyMuted}>No items checked out yet.</div>}
        {checkedOutItems.map((it) => (
          <div key={it.id} style={S.summaryRow}>
            <span>{it.name}</span>
            <span style={S.summaryQty}>×{it.out}</span>
          </div>
        ))}
      </div>
      <label style={S.fieldLabel}>
        Email
        <input style={S.fieldInput} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label style={S.fieldLabel}>
        Notes for the equipment coordinator
        <textarea style={S.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button style={S.primaryBtn} onClick={onSubmit}>
        Submit &amp; Notify
      </button>
    </Modal>
  );
}
