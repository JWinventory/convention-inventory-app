import React, { useState, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { S } from "../styles";

// Print Lists: two things live here.
//   1. Ready-for-pickup orders — once an order has been fulfilled and the
//      requester notified, its exact items show up here as its own small
//      pull sheet, printable on its own.
//   2. The full catalog checklist, grouped by department, for a general
//      paper backup of everything in inventory.
// Both use a count-based checklist format, grouped by department: a
// blank "Returned: ___ of N" line per item plus a Notes line, rather
// than a single checkbox — this scales cleanly to any quantity and
// leaves room to note anything damaged or missing.
// "Print This List" / "Print Checklist" only print the one block clicked —
// everything else is hidden from the print output via the printing-scoped
// body class below, regardless of how many order sections exist.
export function EmergencyChecklistPage({ items, orders }) {
  const [printTarget, setPrintTarget] = useState(null); // null | "catalog" | orderId

  useEffect(() => {
    function handleAfterPrint() {
      document.body.classList.remove("printing-scoped");
      setPrintTarget(null);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  function printOnly(targetKey) {
    // flushSync forces React to finish applying the print-scoping class to
    // the DOM before we call print — without it, requestAnimationFrame (or
    // any async approach) can race React's render, so the print dialog
    // sometimes opens before the right section is actually visible, which
    // is what makes the button feel unresponsive or need a second tap.
    flushSync(() => {
      setPrintTarget(targetKey);
    });
    document.body.classList.add("printing-scoped");
    window.print();
  }

  const readyOrders = useMemo(() => (orders || []).filter((o) => o.status === "fulfilled"), [orders]);

  // Groups one order's items by department, looking each item's
  // category up from the live catalog (an order's own items only
  // store name + qty).
  function groupOrderItemsByDept(order) {
    const byDept = new Map();
    for (const li of order.items || []) {
      const liveItem = items.find((it) => it.name === li.name);
      const dept = liveItem ? liveItem.category : "Uncategorized";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(li);
    }
    return Array.from(byDept.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([department, deptItems]) => ({ department, items: deptItems }));
  }

  const groups = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
    const byDept = new Map();
    for (const item of sorted) {
      const dept = item.category || "Uncategorized";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(item);
    }
    return Array.from(byDept.entries()).map(([department, deptItems]) => ({ department, items: deptItems }));
  }, [items]);

  return (
    <div>
      <h2 style={S.cardTitle}>Print Lists</h2>

      <h3 style={{ ...S.cardTitle, marginTop: 14 }}>Ready for Pickup ({readyOrders.length})</h3>
      <p style={S.tinyMuted}>
        Orders that have been reviewed, filled, and the requester notified. Each one prints as its own list
        of just what that order needs.
      </p>

      {readyOrders.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>Nothing ready for pickup right now.</p>
        </div>
      ) : (
        readyOrders.map((order) => (
          <div key={order.id} className={"print-block" + (printTarget === order.id ? " print-active" : "")} style={S.card}>
            <div style={S.adminBar}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{order.requesterName || "Unnamed requester"}</div>
                <div style={S.tinyMuted}>
                  {order.requesterPhone || "—"} · Pickup {order.pickupDate || "—"}
                </div>
              </div>
              <button style={S.addItemBtn} onClick={() => printOnly(order.id)}>
                Print This List
              </button>
            </div>
            {order.notes && (
              <div style={{ ...S.tinyMuted, marginBottom: 8 }}>
                <strong>Notes:</strong> {order.notes}
              </div>
            )}
            <table className="order-print-table" style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Item</th>
                  <th style={{ ...thStyle, width: 110 }}>Returned</th>
                  <th style={{ ...thStyle, width: "35%" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {groupOrderItemsByDept(order).map((group, groupIdx) => (
                  <React.Fragment key={group.department}>
                    <tr>
                      <td colSpan={3} style={{ ...deptRowStyle, ...(groupIdx > 0 ? deptSeparatorStyle : {}) }}>
                        {group.department}
                      </td>
                    </tr>
                    {group.items.map((li, idx) => (
                      <tr key={idx}>
                        <td style={tdStyle}>{li.name}</td>
                        <td style={tdStyle}>
                          <span style={blankLineStyle} /> of {li.qty}
                        </td>
                        <td style={tdStyle}>
                          <span style={notesLineStyle} />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <h3 style={{ ...S.cardTitle, marginTop: 24 }}>Full Catalog Checklist</h3>
      <div style={S.adminBar}>
        <p style={{ ...S.tinyMuted, margin: 0 }}>
          A paper-friendly list of every catalog item, grouped by department, in case the app or internet is
          unavailable.
        </p>
        <button style={S.addItemBtn} onClick={() => printOnly("catalog")}>
          Print Checklist
        </button>
      </div>

      {groups.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : (
        <div className={"print-block" + (printTarget === "catalog" ? " print-active" : "")}>
          <table className="checklist-print-table" style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={{ ...thStyle, width: 110 }}>Returned</th>
                <th style={{ ...thStyle, width: "35%" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIdx) => (
                <React.Fragment key={group.department}>
                  <tr>
                    <td colSpan={3} style={{ ...deptRowStyle, ...(groupIdx > 0 ? deptSeparatorStyle : {}) }}>
                      {group.department}
                    </td>
                  </tr>
                  {group.items.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>{item.name}</td>
                      <td style={tdStyle}>
                        <span style={blankLineStyle} /> of {item.total}
                      </td>
                      <td style={tdStyle}>
                        <span style={notesLineStyle} />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @media print {
          body.printing-scoped * { visibility: hidden; }
          body.printing-scoped .print-active,
          body.printing-scoped .print-active * { visibility: visible; }
          body.printing-scoped .print-active {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .checklist-print-table th, .checklist-print-table td,
          .order-print-table th, .order-print-table td {
            border: 1px solid #999;
            padding: 6px 8px;
          }
        }
      `}</style>
    </div>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 10,
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
};

const thStyle = {
  textAlign: "left",
  fontSize: 12,
  textTransform: "uppercase",
  color: "#999",
  padding: "8px 10px",
  borderBottom: "2px solid #eee",
};

const tdStyle = {
  fontSize: 13,
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  color: "#1a1a2e",
};

const deptRowStyle = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#555",
  background: "#f4f5f7",
  padding: "8px 10px",
};

const deptSeparatorStyle = {
  borderTop: "3px solid #999",
};

const blankLineStyle = {
  display: "inline-block",
  borderBottom: "1px solid #999",
  width: 50,
};

const notesLineStyle = {
  display: "inline-block",
  borderBottom: "1px solid #ccc",
  width: "100%",
  height: 14,
};
