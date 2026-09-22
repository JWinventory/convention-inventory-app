import React, { useState } from "react";
import { S, colorFor } from "../styles";
import { Icon } from "./Icon";
import { Lightbox } from "./Lightbox";
import { ImageCarousel } from "./ImageCarousel";
import { getItemImages } from "../imageUtils";

export function ItemCard({ item, onCheckOut, onShowQr, adminMode, onEdit, onDelete }) {
  const [lightbox, setLightbox] = useState(null); // { images, index } | null
  const out = item.out || 0;
  const available = item.total - out;
  const fullyOut = available <= 0;
  const color = colorFor(item.category);
  const images = getItemImages(item);

  const [outQty, setOutQty] = useState(1);
  // The requester screen is a static form — quantity choice isn't
  // limited by anyone else's live picks; conflicts are sorted out
  // later by staff when the order is reviewed, not prevented here.
  // Admin's Catalog view still shows and respects the real live count.
  const outMax = adminMode ? Math.max(available, 1) : Math.max(item.total, 1);
  const safeOutQty = Math.min(outQty, outMax);

  return (
    <div style={{ ...S.itemCard, ...(adminMode && fullyOut ? S.itemCardOut : {}) }}>
      <div style={{ ...S.catStripe, background: color }} />
      {!adminMode && (
        <button style={S.qrBtn} onClick={onShowQr} title="Show QR code">
          <Icon.qr />
        </button>
      )}
      <div style={S.itemImgWrap}>
        <ImageCarousel images={images} alt={item.name} onEnlarge={(imgs, idx) => setLightbox({ images: imgs, index: idx })} />
      </div>
      <div style={{ ...S.itemCat, color }}>{item.category}</div>
      <div style={S.itemName}>{item.name}</div>
      {item.note && <div style={S.itemNote}>{item.note}</div>}

      {adminMode ? (
        <div style={S.availableRow}>
          <span style={S.availableCount}>{available}</span>
          <span style={S.availableLabel}> of {item.total} available</span>
        </div>
      ) : (
        <div style={S.availableRow}>
          <span style={S.availableLabel}>Total on hand: {item.total}</span>
        </div>
      )}

      {!adminMode ? (
        <div style={S.qtyRow}>
          <select style={S.qtySelect} value={safeOutQty} onChange={(e) => setOutQty(Number(e.target.value))}>
            {Array.from({ length: outMax }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button style={{ ...S.outBtn, flex: 1 }} onClick={() => onCheckOut(safeOutQty)}>
            Add to Request
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

      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} alt={item.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
