import React from "react";
import { S, colorFor } from "../styles";
import { Icon } from "./Icon";

export function ItemCard({ item, onCheckOut, onCheckIn, onShowQr, adminMode, onEdit, onDelete }) {
  const out = item.out || 0;
  const available = item.total - out;
  const fullyOut = available <= 0;
  const color = colorFor(item.category);

  return (
    <div style={{ ...S.itemCard, ...(fullyOut ? S.itemCardOut : {}) }}>
      <div style={{ ...S.catStripe, background: color }} />
      {!adminMode && (
        <button style={S.qrBtn} onClick={onShowQr} title="Show QR code">
          <Icon.qr />
        </button>
      )}
      <div style={S.itemImgWrap}>
        {item.img ? (
          <img src={item.img} alt={item.name} style={S.itemImg} />
        ) : (
          <div style={S.itemImgPlaceholder}>No photo</div>
        )}
      </div>
      <div style={{ ...S.itemCat, color }}>{item.category}</div>
      <div style={S.itemName}>{item.name}</div>
      {item.note && <div style={S.itemNote}>{item.note}</div>}
      <div style={S.countRow}>
        <Count label="Total" value={item.total} />
        <Count label="Out" value={out} />
        <Count label="Available" value={available} highlight={!fullyOut} />
      </div>

      {!adminMode ? (
        <div style={S.btnRow}>
          <button
            style={{ ...S.outBtn, ...(available <= 0 ? S.btnDisabled : {}) }}
            disabled={available <= 0}
            onClick={onCheckOut}
          >
            Check Out
          </button>
          <button
            style={{ ...S.inBtn, ...(out <= 0 ? S.btnDisabled : {}) }}
            disabled={out <= 0}
            onClick={onCheckIn}
          >
            Check In
          </button>
        </div>
      ) : (
        <div style={S.adminBtnRow}>
          <button style={S.adminEditBtn} onClick={onEdit}>
            <Icon.edit /> Edit
          </button>
          <button style={S.adminDeleteBtn} onClick={onDelete}>
            <Icon.trash /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Count({ label, value, highlight }) {
  return (
    <div style={S.countBox}>
      <div style={{ ...S.countVal, ...(highlight ? { color: "#1a1a2e" } : {}) }}>{value}</div>
      <div style={S.countLabel}>{label}</div>
    </div>
  );
}
