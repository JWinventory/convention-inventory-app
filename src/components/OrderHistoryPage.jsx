import React, { useMemo, useState } from "react";
import { S } from "../styles";

// Every order that's been fully checked back in lands here permanently
// — it's off the Orders page so that list stays focused on what's
// actually in progress, but nothing is ever deleted, so past requests
// can always be looked up.
export function OrderHistoryPage({ orders, items }) {
  const [search, setSearch] = useState("");

  const completedOrders = useMemo(() => {
    return orders
      .map((order) => {
        const lineItems = (order.items || []).map((li) => {
          const liveItem = items.find((i) => i.name === li.name);
          const stillOut = liveItem ? Math.min(li.qty, liveItem.out || 0) : 0;
          return { ...li, stillOut, exists: Boolean(liveItem) };
        });
        const isActive = lineItems.some((li) => li.stillOut > 0);
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
              <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
                {order.requesterName || "Unnamed requester"}
              </span>
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
          </div>
        ))
      )}
    </div>
  );
}
