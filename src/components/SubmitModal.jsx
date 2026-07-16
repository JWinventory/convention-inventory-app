import React, { useState } from "react";
import { Modal } from "./Modal";
import { S } from "../styles";
import { Icon } from "./Icon";

export function SubmitModal({ requester, checkedOutItems, email, setEmail, notes, setNotes, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: email,
          requester,
          items: checkedOutItems.map((it) => ({ name: it.name, out: it.out })),
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong sending the notification.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch (err) {
      setErrorMsg("Couldn't reach the notification service. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <Modal onClose={onClose} title="Request Submitted">
        <div style={S.successBox}>
          <div style={S.successCheck}>
            <Icon.check size={28} />
          </div>
          <div style={S.successTitle}>Notification sent</div>
          <div style={S.tinyMuted}>
            The equipment coordinator has been emailed about {checkedOutItems.length} item
            {checkedOutItems.length === 1 ? "" : "s"} for {requester.name || "this request"}.
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
        Your email (optional, so the coordinator can reply)
        <input style={S.fieldInput} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label style={S.fieldLabel}>
        Notes for the equipment coordinator
        <textarea style={S.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {status === "error" && <div style={S.errorText}>{errorMsg}</div>}
      <button style={S.primaryBtn} disabled={status === "sending"} onClick={handleSubmit}>
        {status === "sending" ? "Sending…" : "Submit & Notify"}
      </button>
    </Modal>
  );
}
