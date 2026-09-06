import React from "react";
import { QRBox } from "./QRBox";
import { S } from "../styles";

// Lists every item's QR code in a grid, with a Print button.
// The @media print rule hides everything except the grid so the
// printout doesn't include the header, nav tabs, etc.
export function QrCodesPage({ items }) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div style={S.adminBar}>
        <h2 style={S.cardTitle}>Printable QR Codes</h2>
        <button style={S.addItemBtn} onClick={() => window.print()}>
          Print All QR Codes
        </button>
      </div>

      {sorted.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>No items in the catalog yet.</p>
        </div>
      ) : (
        <div className="qr-print-grid" style={qrGridStyle}>
          {sorted.map((item) => (
            <div key={item.id} className="qr-print-card" style={qrCardStyle}>
              <QRBox payload={JSON.stringify({ name: item.name })} />
              <div style={qrLabelStyle}>{item.name}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-print-grid, .qr-print-grid * { visibility: visible; }
          .qr-print-grid {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .qr-print-card {
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #ccc;
          }
        }
      `}</style>
    </div>
  );
}

const qrGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 14,
  marginTop: 10,
};

const qrCardStyle = {
  background: "#fff",
  borderRadius: 10,
  padding: 12,
  textAlign: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const qrLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  marginTop: 6,
  color: "#1a1a2e",
};
