import React from "react";
import { S } from "../styles";

// A running list of everything checked out so far this session, with a
// Remove button per item — lets a volunteer undo a selection before
// submitting, without needing a full Check In control on every card.
export function SelectedItemsList({ items, onRemove }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Your Order So Far</h2>
      <div style={S.summaryListWrap}>
        {items.map((item) => (
          <div key={item.id} style={S.summaryRow}>
            <span>
              {item.name} <span style={S.summaryQty}>×{item.out}</span>
            </span>
            <button style={S.adminDeleteBtn} onClick={() => onRemove(item)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
