import React, { useMemo, useState } from "react";
import { S } from "../styles";

const ACTION_TYPES = [
  { key: "broken", label: "Broken" },
  { key: "missing", label: "Missing" },
  { key: "needs-photo", label: "Needs Updated Photo" },
  { key: "needs-description", label: "Needs Updated Description" },
  { key: "other", label: "Other" },
];

function typeLabel(key) {
  return ACTION_TYPES.find((t) => t.key === key)?.label || "Other";
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Phase 3 follow-up: once every item on an order is checked back in, it
// lands here so staff can log anything that needs attention (broken,
// missing, needs a new photo/description, or anything else). Any
// volunteer with Orders access can add a note — their name is recorded
// on it — or mark one done; only a designated Reviewer (or admin) can
// assign one to a volunteer with a due date, which emails that
// volunteer. Once every action item on an order is Done — or a
// volunteer confirms there's nothing to report — the order quietly
// drops off this tab.
export function ReturnReviewPage({
  orders,
  items,
  volunteers,
  reviewerIds,
  currentVolunteerName,
  isCurrentVolunteerAdmin,
  onUpdateOrder,
  onAssignActionItem,
}) {
  const [search, setSearch] = useState("");

  const reviewerNames = (volunteers || []).filter((v) => (reviewerIds || []).includes(v.id)).map((v) => v.name);
  const isReviewer = reviewerNames.includes(currentVolunteerName) || Boolean(isCurrentVolunteerAdmin);

  const needsReview = useMemo(() => {
    return orders
      .map((order) => {
        const lineItems = (order.items || []).map((li) => {
          const liveItem = items.find((i) => i.name === li.name);
          const stillOut = liveItem ? Math.min(li.qty, liveItem.out || 0) : 0;
          return { ...li, stillOut };
        });
        const fullyReturned = lineItems.length > 0 && lineItems.every((li) => li.stillOut === 0);
        const actionItems = Array.isArray(order.returnActionItems) ? order.returnActionItems : [];
        return { ...order, lineItems, fullyReturned, actionItems };
      })
      .filter((o) => o.status !== "cancelled" && o.fullyReturned && o.returnReviewStatus !== "closed")
      .sort((a, b) => (b.returnCompletedAtMs || b.createdAtMs || 0) - (a.returnCompletedAtMs || a.createdAtMs || 0));
  }, [orders, items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return needsReview;
    return needsReview.filter(
      (o) =>
        (o.requesterName || "").toLowerCase().includes(q) ||
        (o.lineItems || []).some((li) => li.name.toLowerCase().includes(q))
    );
  }, [needsReview, search]);

  return (
    <div>
      {needsReview.length > 0 && (
        <div style={needsReviewBannerStyle}>
          {needsReview.length === 1 ? "1 return needs review" : `${needsReview.length} returns need review`}
        </div>
      )}

      <div style={S.card}>
        <h2 style={S.cardTitle}>Returns</h2>
        <div style={S.tinyMuted}>
          Every order lands here once all of its items are checked back in. Log anything that needs
          attention — a reviewer can then assign it to a volunteer with a due date. Once everything's
          resolved (or there's nothing to report), the order drops off this list.
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

      {filtered.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>
            {search ? `No returned orders match "${search}".` : "Nothing waiting on return review."}
          </p>
        </div>
      ) : (
        filtered.map((order) => (
          <ReturnOrderCard
            key={order.id}
            order={order}
            volunteers={volunteers}
            isReviewer={isReviewer}
            currentVolunteerName={currentVolunteerName}
            onUpdateOrder={onUpdateOrder}
            onAssignActionItem={onAssignActionItem}
          />
        ))
      )}
    </div>
  );
}

function ReturnOrderCard({ order, volunteers, isReviewer, currentVolunteerName, onUpdateOrder, onAssignActionItem }) {
  const [itemName, setItemName] = useState("");
  const [type, setType] = useState("broken");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState(false);

  const actionItems = order.actionItems || [];
  const openItems = actionItems.filter((ai) => ai.status !== "done");
  const doneItems = actionItems.filter((ai) => ai.status === "done");

  async function handleAdd(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setAdding(true);
    try {
      const entry = {
        id: makeId(),
        itemName: itemName || "",
        type,
        note: note.trim(),
        createdBy: currentVolunteerName || "Unnamed volunteer",
        createdAtMs: Date.now(),
        assignedToId: null,
        assignedToName: null,
        dueDate: null,
        status: "open",
      };
      await onUpdateOrder(order.id, { returnActionItems: [...actionItems, entry] });
      setItemName("");
      setType("broken");
      setNote("");
    } finally {
      setAdding(false);
    }
  }

  // Toggling Done/Reopen also checks whether the whole list is now
  // resolved — if so, the order closes out and drops off this tab on
  // its own, no extra click needed.
  async function handleToggleDone(ai) {
    const next = actionItems.map((x) => (x.id === ai.id ? { ...x, status: x.status === "done" ? "open" : "done" } : x));
    const allDone = next.length > 0 && next.every((x) => x.status === "done");
    await onUpdateOrder(order.id, {
      returnActionItems: next,
      ...(allDone ? { returnReviewStatus: "closed" } : {}),
    });
  }

  async function handleAssign(ai, volunteerId, dueDate) {
    const volunteer = volunteers.find((v) => v.id === volunteerId);
    if (!volunteer) return;
    const next = actionItems.map((x) =>
      x.id === ai.id ? { ...x, assignedToId: volunteer.id, assignedToName: volunteer.name, dueDate: dueDate || null } : x
    );
    await onUpdateOrder(order.id, { returnActionItems: next });
    if (onAssignActionItem) {
      await onAssignActionItem(order, ai, volunteer, dueDate || null);
    }
  }

  async function handleCloseNoIssues() {
    setClosing(true);
    try {
      await onUpdateOrder(order.id, { returnReviewStatus: "closed" });
    } finally {
      setClosing(false);
    }
  }

  return (
    <div style={S.card}>
      <div style={S.cardHeaderRow}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
          {order.requesterName || "Unnamed requester"}
        </span>
        <div style={{ ...S.tinyMuted, textAlign: "right" }}>Returned — all items checked in</div>
      </div>

      <div style={{ ...S.summaryListWrap, marginTop: 10 }}>
        {order.lineItems.map((li, idx) => (
          <div key={idx} style={S.summaryRow}>
            <span>{li.name}</span>
            <span style={S.summaryQty}>×{li.qty}</span>
          </div>
        ))}
      </div>

      {(openItems.length > 0 || doneItems.length > 0) && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#888", margin: "8px 0 4px" }}>
            Action Items
          </div>
          {openItems.map((ai) => (
            <ActionItemRow
              key={ai.id}
              ai={ai}
              volunteers={volunteers}
              isReviewer={isReviewer}
              onToggleDone={() => handleToggleDone(ai)}
              onAssign={(volunteerId, dueDate) => handleAssign(ai, volunteerId, dueDate)}
            />
          ))}
          {doneItems.map((ai) => (
            <ActionItemRow key={ai.id} ai={ai} volunteers={volunteers} isReviewer={isReviewer} onToggleDone={() => handleToggleDone(ai)} />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#888", marginBottom: 6 }}>
          Add an Action Item
        </div>
        <label style={S.fieldLabel}>
          Item (optional — leave blank for a general note)
          <select style={S.fieldInput} value={itemName} onChange={(e) => setItemName(e.target.value)}>
            <option value="">General / not item-specific</option>
            {order.lineItems.map((li) => (
              <option key={li.name} value={li.name}>
                {li.name}
              </option>
            ))}
          </select>
        </label>
        <label style={S.fieldLabel}>
          Type
          <select style={S.fieldInput} value={type} onChange={(e) => setType(e.target.value)}>
            {ACTION_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={S.fieldLabel}>
          Note
          <textarea
            style={S.textarea}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs attention?"
          />
        </label>
        <button style={S.secondaryBtn} type="submit" disabled={!note.trim() || adding}>
          {adding ? "Adding…" : "Add Action Item"}
        </button>
      </form>

      {actionItems.length === 0 && (
        <div style={{ marginTop: 10 }}>
          <button style={S.primaryBtn} disabled={closing} onClick={handleCloseNoIssues}>
            {closing ? "Closing…" : "No Issues — Close Out"}
          </button>
        </div>
      )}
    </div>
  );
}

function ActionItemRow({ ai, volunteers, isReviewer, onToggleDone, onAssign }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [volunteerId, setVolunteerId] = useState(ai.assignedToId || "");
  const [dueDate, setDueDate] = useState(ai.dueDate || "");

  const done = ai.status === "done";

  return (
    <div style={{ background: "#f7f8fa", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <span style={typeBadgeStyle(ai.type)}>{typeLabel(ai.type)}</span>
          {ai.itemName && <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", marginLeft: 6 }}>{ai.itemName}</span>}
          <div style={{ fontSize: 13, color: "#333", marginTop: 4 }}>{ai.note}</div>
          <div style={{ ...S.tinyMuted, marginTop: 4 }}>Added by {ai.createdBy || "—"}</div>
          {ai.assignedToName ? (
            <div style={{ ...S.tinyMuted, marginTop: 2 }}>
              Assigned to <strong>{ai.assignedToName}</strong>
              {ai.dueDate ? ` — due ${ai.dueDate}` : ""}
            </div>
          ) : (
            <div style={{ ...S.tinyMuted, marginTop: 2 }}>Unassigned</div>
          )}
        </div>
        <button style={{ ...S.adminEditBtn, flex: "0 0 auto", padding: "6px 10px" }} onClick={onToggleDone}>
          {done ? "Reopen" : "Mark Done"}
        </button>
      </div>

      {isReviewer && !done && onAssign && (
        <div style={{ marginTop: 8 }}>
          {!assignOpen ? (
            <button style={linkBtnStyle} onClick={() => setAssignOpen(true)}>
              {ai.assignedToName ? "Reassign" : "Assign to a volunteer"}
            </button>
          ) : (
            <div style={{ marginTop: 6 }}>
              <label style={S.fieldLabel}>
                Volunteer
                <select style={S.fieldInput} value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)}>
                  <option value="">Select…</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={S.fieldLabel}>
                Due Date
                <input style={S.fieldInput} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.primaryBtn, marginTop: 0 }}
                  disabled={!volunteerId}
                  onClick={() => {
                    onAssign(volunteerId, dueDate);
                    setAssignOpen(false);
                  }}
                >
                  Save Assignment
                </button>
                <button style={{ ...S.secondaryBtn, marginTop: 0 }} onClick={() => setAssignOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function typeBadgeStyle(type) {
  const map = {
    broken: { background: "#fdecea", color: "#c0392b" },
    missing: { background: "#fff4e5", color: "#8a5a00" },
    "needs-photo": { background: "#eaf3fc", color: "#2471a3" },
    "needs-description": { background: "#eaf3fc", color: "#2471a3" },
    other: { background: "#f0f1f4", color: "#555" },
  };
  const cfg = map[type] || map.other;
  return {
    ...cfg,
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 12,
    padding: "2px 8px",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  };
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

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "#0072CE",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};
