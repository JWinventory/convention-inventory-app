import React from "react";
import { S } from "../styles";

// Shown on the requester's own device in place of the checkout screen
// once they've submitted an order — this is what "locks" the screen
// from further changes. Automatically shows the right message and
// controls for whichever phase the order is in. Once submitted, this
// doubles as a printable confirmation: a full review of exactly what
// was requested, with a Print List button, in case a paper copy is
// handy to keep or hand off.
export function MyOrderStatus({ order, lineItems, phase, onScanCheckIn }) {
  const allDone = lineItems.length > 0 && lineItems.every((li) => li.stillOut === 0);

  return (
    <div className="my-order-print-root" style={S.card}>
      <h2 style={S.cardTitle}>{phase === "ready" ? "Your Order is Ready!" : "Order Submitted"}</h2>
      <p style={S.tinyMuted}>
        {phase === "ready"
          ? "Your equipment is ready. Scan each item's QR code below to check it in as you return it."
          : "Your request has been sent to the equipment coordinator. You'll get an email once it's ready — this screen will update automatically, no need to check back manually."}
      </p>

      {phase === "submitted" && order && (
        <div style={{ ...S.tinyMuted, marginTop: 4, lineHeight: 1.6 }}>
          {order.requesterName || "—"} · {order.requesterPhone || "—"}
          <br />
          {order.eventType || "—"} · Event {order.eventDate || "—"} · Pickup {order.pickupDate || "—"} · Return{" "}
          {order.returnDate || "—"}
          {order.notes && (
            <>
              <br />
              <strong>Notes:</strong> {order.notes}
            </>
          )}
        </div>
      )}

      <div style={{ ...S.summaryListWrap, marginTop: 10 }}>
        {lineItems.map((li, idx) => (
          <div key={idx} style={S.summaryRow}>
            <span>{li.name}</span>
            <span style={S.summaryQty}>
              {phase === "ready" ? `${li.qty - li.stillOut} of ${li.qty} checked in` : `×${li.qty}`}
            </span>
          </div>
        ))}
      </div>

      {phase === "submitted" && (
        <button className="no-print" style={{ ...S.secondaryBtn, marginTop: 12 }} onClick={() => window.print()}>
          Print List
        </button>
      )}

      {phase === "ready" && !allDone && (
        <button style={S.primaryBtn} onClick={onScanCheckIn}>
          Scan QR to Check In
        </button>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .my-order-print-root, .my-order-print-root * { visibility: visible; }
          .my-order-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
