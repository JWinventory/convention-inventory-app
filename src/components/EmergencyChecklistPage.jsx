import React, { useState, useEffect, useMemo } from "react";
import { S } from "../styles";

// Print Lists: two things live here.
//   1. Ready-for-pickup orders — once an order has been fulfilled and the
//      requester notified, its exact items show up here as its own small
//      pull sheet, printable on its own.
//   2. The full catalog checklist, grouped by department, for a general
//      paper backup of everything in inventory.
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
    setPrintTarget(targetKey);
    requestAnimationFrame(() => {
      document.body.classList.add("printing-scoped");
      window.print();
    });
  }

  const readyOrders = useMemo(() => (orders || []).filter((o) => o.status === "fulfilled"), [orders]);

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
                  <th style={thStyle}>✓</th>
                  <th style={thStyle}>Item</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((li, idx) => (
                  <tr key={idx}>
                    <td style={{ ...tdStyle, width: 30, fontSize: 16 }}>☐</td>
                    <td style={tdStyle}>{li.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{li.qty}</td>
                  </tr>
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
                <th style={thStyle}>✓</th>
                <th style={thStyle}>Item</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Total</th>
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
                      <td style={{ ...tdStyle, width: 30, fontSize: 16 }}>☐</td>
                      <td style={tdStyle}>{item.name}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{item.total}</td>
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
