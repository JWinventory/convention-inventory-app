import React, { useState } from "react";
import { S, colorFor } from "../styles";
import { Icon } from "./Icon";
import { Lightbox } from "./Lightbox";
import { ImageCarousel } from "./ImageCarousel";
import { getItemImages } from "../imageUtils";

export function ItemCard({ item, onCheckOut, onShowQr, adminMode, onEdit, onDelete }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const out = item.out || 0;
  const available = item.total - out;
  const fullyOut = available <= 0;
  const color = colorFor(item.category);
  const images = getItemImages(item);

  const [outQty, setOutQty] = useState(1);
  const outMax = Math.max(available, 1);
  const safeOutQty = Math.min(outQty, outMax);

  return (
    <div style={{ ...S.itemCard, ...(fullyOut ? S.itemCardOut : {}) }}>
      <div style={{ ...S.catStripe, background: color }} />
      {!adminMode && (
        <button style={S.qrBtn} onClick={onShowQr} title="Show QR code">
          <Icon.qr />
        </button>
      )}
      <div style={S.itemImgWrap}>
        <ImageCarousel images={images} alt={item.name} onEnlarge={setLightboxSrc} />
      </div>
      <div style={{ ...S.itemCat, color }}>{item.category}</div>
      <div style={S.itemName}>{item.name}</div>
      {item.note && <div style={S.itemNote}>{item.note}</div>}

      <div style={S.availableRow}>
        <span style={S.availableCount}>{available}</span>
        <span style={S.availableLabel}> of {item.total} available</span>
      </div>

      {!adminMode ? (
        <div style={S.qtyRow}>
          <select
            style={S.qtySelect}
            value={safeOutQty}
            onChange={(e) => setOutQty(Number(e.target.value))}
            disabled={available <= 0}
          >
            {Array.from({ length: outMax }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            style={{ ...S.outBtn, flex: 1, ...(available <= 0 ? S.btnDisabled : {}) }}
            disabled={available <= 0}
            onClick={() => onCheckOut(safeOutQty)}
          >
            Check Out
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

      {lightboxSrc && <Lightbox src={lightboxSrc} alt={item.name} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
