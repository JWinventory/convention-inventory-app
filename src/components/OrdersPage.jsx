import React, { useMemo, useState } from "react";
import { S } from "../styles";

export function OrdersPage({ orders, items }) {
  const [search, setSearch] = useState("");

  // For each order, look up the *current* out-count for every item it listed
  // (matched by name). An order is "Active" while any of its items are still
  // checked out, and flips to "Completed" once everything's back in — but it
  // stays in this list either way, so there's always a full history to browse.
  const allOrders = useMemo(() => {
    return orders.map((order) => {
      const lineItems = (order.items || []).map((li) => {
        const liveItem = items.find((i) => i.name === li.name);
        const stillOut = liveItem ? Math.min(li.qty, liveItem.out || 0) : 0;
        return { ...li, stillOut, exists: Boolean(liveItem) };
      });
      const isActive = lineItems.some((li) => li.stillOut > 0);
      return { ...order, lineItems, isActive };
    });
  }, [orders, items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOrders;
    return allOrders.filter(
      (o) =>
        (o.requesterName || "").toLowerCase().includes(q) ||
        (o.lineItems || []).some((li) => li.name.toLowerCase().includes(q))
    );
  }, [allOrders, search]);

  const activeOrders = filtered.filter((o) => o.isActive);
  const completedOrders = filtered.filter((o) => !o.isActive);

  return (
    <div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Orders</h2>
        <div style={S.tinyMuted}>
          Every submitted request, kept here permanently. An order is tagged Active while any of
          its items are still checked out, and flips to Completed once everything's back in — you
          can always scroll back to look at old ones.
        </div>
      </div>

      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <input
            style={S.searchInput}
            placeholder="Search by requester or item name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <h3 style={{ ...S.cardTitle, marginTop: 18 }}>Active ({activeOrders.length})</h3>
      {activeOrders.length === 0 && (
        <div style={S.card}>
          <div style={S.tinyMuted}>Nothing currently out under a submitted request.</div>
        </div>
      )}
      {activeOrders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}

      <h3 style={{ ...S.cardTitle, marginTop: 24 }}>Completed ({completedOrders.length})</h3>
      {completedOrders.length === 0 && (
        <div style={S.card}>
          <div style={S.tinyMuted}>No completed orders yet.</div>
        </div>
      )}
      {completedOrders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }) {
  return (
    <div style={S.card}>
      <div style={S.cardHeaderRow}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
              {order.requesterName || "Unnamed requester"}
            </span>
            <StatusTag active={order.isActive} />
          </div>
          <div style={S.tinyMuted}>
            {order.requesterPhone || "—"}
            {order.requesterEmail ? ` · ${order.requesterEmail}` : ""}
          </div>
        </div>
        <div style={{ ...S.tinyMuted, textAlign: "right" }}>Submitted {order.createdAtLabel || "—"}</div>
      </div>

      <div style={S.tinyMuted}>
        Event {order.eventDate || "—"} · Pickup {order.pickupDate || "—"} · Return {order.returnDate || "—"}
      </div>

      <div style={{ ...S.summaryListWrap, marginTop: 10 }}>
        {order.lineItems.map((li, idx) => (
          <div key={idx} style={S.summaryRow}>
            <span>
              {li.name}
              {!li.exists && <span style={{ color: "#c0392b", fontSize: 11 }}> (item no longer in catalog)</span>}
            </span>
            <span style={S.summaryQty}>
              {li.stillOut} of {li.qty} still out
            </span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div style={{ ...S.tinyMuted, marginTop: 8 }}>
          <strong>Notes:</strong> {order.notes}
        </div>
      )}
    </div>
  );
}

function StatusTag({ active }) {
  const style = active
    ? { background: "#fdecea", color: "#c0392b" }
    : { background: "#e9f9ef", color: "#1e8449" };
  return (
    <span
      style={{
        ...style,
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 20,
        padding: "2px 10px",
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {active ? "Active" : "Completed"}
    </span>
  );
}
