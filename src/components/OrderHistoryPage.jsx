import React, { useMemo, useState } from "react";
import { S } from "../styles";
import { EditOrderModal } from "./EditOrderModal";

// Every order that's been fully checked back in lands here permanently
// — it's off the Orders page so that list stays focused on what's
// actually in progress, but nothing is deleted automatically, so past
// requests can always be looked up. Deleting one here is permanent and
// restricted to the designated Reviewer or a full admin, same as
// cancelling an order. Reactivating one (same permission) opens an
// edit screen pre-filled with the original's details and items and,
// on save, creates a brand-new active order from them — the original
// stays here, untouched.
export function OrderHistoryPage({ orders, items, volunteers, reviewerIds, currentVolunteerName, isCurrentVolunteerAdmin, onDeleteOrder, onReactivateOrder }) {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [reactivatingOrder, setReactivatingOrder] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  const reviewerNames = (volunteers || []).filter((v) => (reviewerIds || []).includes(v.id)).map((v) => v.name);
  const isReviewer = reviewerNames.includes(currentVolunteerName);
  const canDelete = isReviewer || Boolean(isCurrentVolunteerAdmin);
  const canReactivate = canDelete;

  const completedOrders = useMemo(() => {
    return orders
      .map((order) => {
        const lineItems = (order.items || []).map((li) => {
          const liveItem = items.find((i) => i.name === li.name);
          const stillOut = liveItem ? Math.min(li.qty, liveItem.out || 0) : 0;
          return { ...li, stillOut, exists: Boolean(liveItem) };
        });
        const isActive = order.status !== "cancelled" && lineItems.some((li) => li.stillOut > 0);
        return {
          ...order,
          lineItems,
          isActive,
          reviewedBy: Array.isArray(order.reviewedBy) ? order.reviewedBy : [],
          assignedFillers: Array.isArray(order.assignedFillers) ? order.assignedFillers : [],
        };
      })
      .filter((o) => !o.isActive);
  }, [orders, items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return completedOrders;
    return completedOrders.filter(
      (o) =>
        (o.requesterName || "").toLowerCase().includes(q) ||
        (o.lineItems || []).some((li) => li.name.toLowerCase().includes(q)) ||
        (o.assignedFillers || []).some((n) => n.toLowerCase().includes(q))
    );
  }, [completedOrders, search]);

  return (
    <div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Order History</h2>
        <div style={S.tinyMuted}>
          Every order that's been fully checked back in, kept here permanently for reference.
        </div>
      </div>

      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <input
            style={S.searchInput}
            placeholder="Search by requester, item, or filler name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>{search ? `No completed orders match "${search}".` : "No completed orders yet."}</p>
        </div>
      ) : (
        filtered.map((order) => (
          <div key={order.id} style={S.card}>
            <div style={S.cardHeaderRow}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
                  {order.requesterName || "Unnamed requester"}
                </span>
                {order.status === "cancelled" && <span style={cancelledTagStyle}>Cancelled</span>}
              </div>
              <div style={{ ...S.tinyMuted, textAlign: "right" }}>Submitted {order.createdAtLabel || "—"}</div>
            </div>
            <div style={S.tinyMuted}>
              {order.eventType || "—"} · Event {order.eventDate || "—"} · Pickup {order.pickupDate || "—"} · Return{" "}
              {order.returnDate || "—"}
            </div>
            <div style={{ ...S.summaryListWrap, marginTop: 10 }}>
              {order.lineItems.map((li, idx) => (
                <div key={idx} style={S.summaryRow}>
                  <span>{li.name}</span>
                  <span style={S.summaryQty}>×{li.qty}</span>
                </div>
              ))}
            </div>
            <div style={S.tinyMuted}>
              Reviewed by {order.reviewedBy.join(" & ") || "—"} · Filled by{" "}
              {order.assignedFillers.join(", ") || "—"}
            </div>
            {order.notes && (
              <div style={{ ...S.tinyMuted, marginTop: 6 }}>
                <strong>Notes:</strong> {order.notes}
              </div>
            )}
            {order.reactivatedFromLabel && (
              <div style={{ ...S.tinyMuted, marginTop: 6 }}>
                Reactivated from an order submitted {order.reactivatedFromLabel}.
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid #eee",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 14,
              }}
            >
              {canReactivate ? (
                <button style={S.adminEditBtn} onClick={() => setReactivatingOrder(order)}>
                  Reactivate
                </button>
              ) : null}
              {canDelete ? (
                <button
                  style={deleteLinkStyle}
                  disabled={deletingId === order.id}
                  onClick={async () => {
                    setDeletingId(order.id);
                    try {
                      await onDeleteOrder(order);
                    } finally {
                      setDeletingId(null);
                    }
                  }}
                >
                  {deletingId === order.id ? "Deleting…" : "Delete Permanently"}
                </button>
              ) : (
                <span style={{ ...S.tinyMuted, fontSize: 11 }}>
                  Only the reviewer or an admin can delete or reactivate this.
                </span>
              )}
            </div>
          </div>
        ))
      )}

      {reactivatingOrder && (
        <EditOrderModal
          order={reactivatingOrder}
          items={items}
          title={`Reactivate Order — ${reactivatingOrder.requesterName || "Requester"}`}
          hint="This creates a brand-new request using these details and items, picking up right where the original left off — update anything that's changed since then (the event, pickup, and return dates, above all) before creating it. The original stays here in History, untouched."
          saveLabel={reactivating ? "Creating…" : "Create Reactivated Order"}
          onSave={async (newItems, newDetails) => {
            setReactivating(true);
            try {
              await onReactivateOrder(reactivatingOrder, newItems, newDetails);
            } finally {
              setReactivating(false);
            }
          }}
          onClose={() => setReactivatingOrder(null)}
        />
      )}
    </div>
  );
}

const cancelledTagStyle = {
  background: "#f4f5f7",
  color: "#888",
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 12,
  padding: "2px 8px",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const deleteLinkStyle = {
  background: "none",
  border: "none",
  color: "#c0392b",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};
