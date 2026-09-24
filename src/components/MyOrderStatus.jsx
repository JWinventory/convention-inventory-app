import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { S } from "../styles";

// Shown on the requester's own device in place of the checkout screen
// once they've submitted an order — this is what "locks" the screen
// from further changes. Automatically shows the right message and
// controls for whichever phase the order is in. Once submitted, this
// doubles as a printable confirmation: a full review of exactly what
// was requested, with a Print List button, in case a paper copy is
// handy to keep or hand off. Once ready for pickup, a separate Print
// Check-In Checklist button gives a pen-and-paper backup for checking
// items back in by department — using the exact same proven print
// mechanism as the admin Print Lists page, so the two are guaranteed
// to behave identically.
export function MyOrderStatus({ order, lineItems, phase, onScanCheckIn }) {
  const allDone = lineItems.length > 0 && lineItems.every((li) => li.stillOut === 0);
  const [checklistActive, setChecklistActive] = useState(false);

  useEffect(() => {
    function handleAfterPrint() {
      document.body.classList.remove("printing-checklist");
      setChecklistActive(false);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // flushSync forces React to finish applying the print-active class
  // before we call print — the same mechanism the admin Print Lists
  // page uses, since that's the one proven to work reliably.
  function printChecklist() {
    flushSync(() => {
      setChecklistActive(true);
    });
    document.body.classList.add("printing-checklist");
    window.print();
  }

  const groups = React.useMemo(() => {
    const byDept = new Map();
    for (const li of lineItems) {
      const dept = li.category || "Uncategorized";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(li);
    }
    return Array.from(byDept.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([department, items]) => ({ department, items }));
  }, [lineItems]);

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
        <>
          <button style={S.primaryBtn} onClick={onScanCheckIn}>
            Scan QR to Check In
          </button>
          <button className="no-print" style={{ ...S.secondaryBtn, marginTop: 8 }} onClick={printChecklist}>
            Print Check-In Checklist
          </button>
        </>
      )}

      {/* Bare pen-and-paper backup: a count-based checklist grouped by
          department, identical in format to the admin Print Lists page.
          Only shown when actually printing in checklist mode. */}
      <div className={"checkin-checklist-print-only" + (checklistActive ? " print-active" : "")}>
        <h2 style={{ marginBottom: 4 }}>Check-In Checklist</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
          {order?.requesterName || "—"} · Return Date {order?.returnDate || "—"}
        </p>
        <table className="checkin-checklist-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: 110 }}>Returned</th>
              <th style={{ width: "35%" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.department}>
                <tr>
                  <td colSpan={3} className="checkin-dept-row">
                    {group.department}
                  </td>
                </tr>
                {group.items.map((li, idx) => (
                  <tr key={idx}>
                    <td>{li.name}</td>
                    <td>
                      <span className="checkin-blank-line" /> of {li.qty}
                    </td>
                    <td>
                      <span className="checkin-notes-line" />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .checkin-checklist-print-only { display: none; }
        .checkin-checklist-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .checkin-checklist-table th, .checkin-checklist-table td {
          border: 1px solid #ddd;
          padding: 8px 10px;
          text-align: left;
        }
        .checkin-checklist-table th {
          background: #f4f5f7;
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
        }
        .checkin-dept-row {
          background: #eaf3fc;
          font-weight: 800;
          font-size: 12px;
          text-transform: uppercase;
          color: #2471a3;
        }
        .checkin-blank-line {
          display: inline-block;
          border-bottom: 1px solid #999;
          width: 50px;
        }
        .checkin-notes-line {
          display: inline-block;
          border-bottom: 1px solid #ccc;
          width: 100%;
          height: 14px;
        }

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

          /* Checklist-specific scoping — same mechanism as the admin
             Print Lists page: once this body class is active, hide
             absolutely everything, then reveal only the one marked
             block via visibility (not display), which is what's
             proven reliable for print across browsers. */
          body.printing-checklist * { visibility: hidden; }
          body.printing-checklist .checkin-checklist-print-only.print-active,
          body.printing-checklist .checkin-checklist-print-only.print-active * {
            visibility: visible;
          }
          body.printing-checklist .checkin-checklist-print-only.print-active {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
