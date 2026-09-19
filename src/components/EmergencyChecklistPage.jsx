import React, { useMemo } from "react";
import { S } from "../styles";

// A plain, paper-friendly checklist of every catalog item, grouped by
// department (category) with a line separating each group — for
// printing out, in case the app or internet is unavailable.
export function EmergencyChecklistPage({ items }) {
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
      <div style={S.adminBar}>
        <h2 style={S.cardTitle}>Print Forms</h2>
        <button style={S.addItemBtn} onClick={() => window.print()}>
          Print Checklist
        </button>
      </div>
      <p style={S.tinyMuted}>
        A paper-friendly list of every catalog item with a checkbox, grouped by department, in case the app
        or internet is unavailable.
      </p>

      {groups.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : (
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
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .checklist-print-table, .checklist-print-table * { visibility: visible; }
          .checklist-print-table {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border-collapse: collapse;
          }
          .checklist-print-table th,
          .checklist-print-table td {
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
