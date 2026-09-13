import React, { useMemo, useState } from "react";
import { S } from "../styles";

// currentVolunteerName is who's actually logged in right now — used to
// make sure only the designated Reviewer can click "Mark as Reviewed"
// for themselves, not just anyone with Orders access.
export function OrdersPage({ orders, items, onMarkReady, volunteers, reviewerId, currentVolunteerName, onUpdateOrder }) {
  const [search, setSearch] = useState("");

  const reviewer = volunteers.find((v) => v.id === reviewerId) || null;
  const reviewerName = reviewer?.name || "";
  const volunteerNames = volunteers.map((v) => v.name);

  // For each order, look up the *current* out-count for every item it listed
  // (matched by name). An order stays here while it's still active (anything
  // still checked out); once fully checked back in it disappears from this
  // page entirely and shows up in Admin > History instead.
  const allOrders = useMemo(() => {
    return orders.map((order) => {
      const lineItems = (order.items || []).map((li) => {
        const liveItem = items.find((i) => i.name === li.name);
        const stillOut = liveItem ? Math.min(li.qty, liveItem.out || 0) : 0;
        return { ...li, stillOut, exists: Boolean(liveItem) };
      });
      const isActive = lineItems.some((li) => li.stillOut > 0);
      const status = order.status || "submitted";
      const reviewedBy = Array.isArray(order.reviewedBy) ? order.reviewedBy : [];
      const assignedFillers = Array.isArray(order.assignedFillers) ? order.assignedFillers : [];
      return { ...order, lineItems, isActive, status, reviewedBy, assignedFillers };
    });
  }, [orders, items]);

  const activeOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (!o.isActive) return false;
      if (!q) return true;
      return (
        (o.requesterName || "").toLowerCase().includes(q) ||
        (o.lineItems || []).some((li) => li.name.toLowerCase().includes(q))
      );
    });
  }, [allOrders, search]);

  const needsReviewCount = activeOrders.filter((o) => o.status === "submitted").length;

  return (
    <div>
      {needsReviewCount > 0 && (
        <div style={needsReviewBannerStyle}>
          {needsReviewCount === 1
            ? "1 request needs review"
            : `${needsReviewCount} requests need review`}
          {reviewerName ? ` — ${reviewerName}, take a look below.` : " — set a reviewer under the Volunteers tab."}
        </div>
      )}

      <div style={S.card}>
        <h2 style={S.cardTitle}>Orders</h2>
        <div style={S.tinyMuted}>
          Every request moves through review, assignment, and fulfillment here. Once everything's checked
          back in, it moves to the History tab automatically.
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
          <div style={S.tinyMuted}>Nothing currently active.</div>
        </div>
      )}
      {activeOrders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          volunteerNames={volunteerNames}
          reviewerName={reviewerName}
          currentVolunteerName={currentVolunteerName}
          onMarkReady={onMarkReady}
          onUpdateOrder={onUpdateOrder}
        />
      ))}
    </div>
  );
}

function OrderCard({ order, volunteerNames, reviewerName, currentVolunteerName, onMarkReady, onUpdateOrder }) {
  const [sending, setSending] = useState(false);
  const [pickedFillers, setPickedFillers] = useState(order.assignedFillers || []);

  const reviewerConfigured = Boolean(reviewerName);
  const isReviewer = reviewerConfigured && currentVolunteerName === reviewerName;

  function handleMarkReviewed() {
    onUpdateOrder(order.id, { reviewedBy: [reviewerName], status: "reviewed" });
  }

  function toggleFiller(name) {
    setPickedFillers((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function handleAssign() {
    if (pickedFillers.length === 0) return;
    onUpdateOrder(order.id, { assignedFillers: pickedFillers, status: "assigned" });
  }

  async function handleMarkReady() {
    setSending(true);
    try {
      await onMarkReady(order);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={S.card}>
      <div style={S.cardHeaderRow}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
              {order.requesterName || "Unnamed requester"}
            </span>
            <StatusTag status={order.status} />
          </div>
          <div style={S.tinyMuted}>
            {order.requesterPhone || "—"}
            {order.requesterEmail ? ` · ${order.requesterEmail}` : ""}
          </div>
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

      {/* Phase 2, step 1: review — only the designated reviewer can act here */}
      {order.status === "submitted" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          {!reviewerConfigured ? (
            <p style={S.tinyMuted}>Set a reviewer under the Volunteers tab to continue.</p>
          ) : isReviewer ? (
            <button style={S.primaryBtn} onClick={handleMarkReviewed}>
              Mark as Reviewed ({reviewerName})
            </button>
          ) : (
            <p style={S.tinyMuted}>Waiting on {reviewerName} to review this.</p>
          )}
        </div>
      )}

      {/* Phase 2, step 2: assign fillers */}
      {order.status === "reviewed" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6 }}>
            Reviewed by {order.reviewedBy.join(", ")} — assign who will fill this order
          </div>
          {volunteerNames.length === 0 ? (
            <p style={S.tinyMuted}>Add volunteers under the Volunteers tab to assign someone.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                {volunteerNames.map((v) => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={pickedFillers.includes(v)} onChange={() => toggleFiller(v)} />
                    {v}
                  </label>
                ))}
              </div>
              <button style={S.primaryBtn} disabled={pickedFillers.length === 0} onClick={handleAssign}>
                Assign to Fill
              </button>
            </>
          )}
        </div>
      )}

      {/* Phase 2, step 3: fill + notify */}
      {order.status === "assigned" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <div style={S.tinyMuted}>
            Assigned to: <strong>{order.assignedFillers.join(", ")}</strong>
          </div>
          <button style={{ ...S.primaryBtn, marginTop: 10 }} disabled={sending} onClick={handleMarkReady}>
            {sending ? "Marking Ready…" : "Mark Ready & Notify Requester"}
          </button>
        </div>
      )}

      {/* Fulfilled: waiting on the requester to check items back in */}
      {order.status === "fulfilled" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <div style={S.tinyMuted}>
            Reviewed by {order.reviewedBy.join(", ") || "—"} · Filled by {order.assignedFillers.join(", ") || "—"}
          </div>
          <div style={{ ...S.tinyMuted, marginTop: 4 }}>Ready for pickup — waiting on the requester to check items back in.</div>
        </div>
      )}
    </div>
  );
}

function StatusTag({ status }) {
  const map = {
    submitted: { label: "Needs Review", style: { background: "#fdecea", color: "#c0392b" } },
    reviewed: { label: "Needs Assignment", style: { background: "#fff4e5", color: "#8a5a00" } },
    assigned: { label: "Being Filled", style: { background: "#eaf3fc", color: "#2471a3" } },
    fulfilled: { label: "Ready for Pickup", style: { background: "#e9f9ef", color: "#1e8449" } },
  };
  const cfg = map[status] || map.submitted;
  return (
    <span
      style={{
        ...cfg.style,
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 20,
        padding: "2px 10px",
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {cfg.label}
    </span>
  );
}

const needsReviewBannerStyle = {
  background: "#fdecea",
  border: "1px solid #f5b7b1",
  color: "#c0392b",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 14,
};
