import React, { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { S } from "../styles";
import { EditOrderModal } from "./EditOrderModal";

// currentVolunteerName is who's actually logged in right now — used to
// make sure only a designated Reviewer can click "Mark as Reviewed"
// for themselves, not just anyone with Orders access. Up to 4
// reviewers can be configured; any 2 of them reviewing an order is
// enough to advance it — see REQUIRED_REVIEWS below. Cancelling an
// order (submitted or still in-progress) uses the same reviewer check:
// any one designated Reviewer, or a full admin (volunteer-management
// access), can do it.
const REQUIRED_REVIEWS = 1;

export function OrdersPage({
  orders,
  drafts,
  items,
  onMarkReady,
  onAssignFillers,
  onResendFillerNotice,
  onResendReadyEmail,
  onResendSubmittedEmail,
  onCancelOrder,
  onCancelDraft,
  onUpdateDraftItems,
  onUpdateOrderItems,
  volunteers,
  reviewerIds,
  currentVolunteerName,
  isCurrentVolunteerAdmin,
  onUpdateOrder,
}) {
  const [search, setSearch] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);

  const reviewerVolunteers = (reviewerIds || []).map((id) => volunteers.find((v) => v.id === id)).filter(Boolean);
  const reviewerNames = reviewerVolunteers.map((v) => v.name);
  const volunteerNames = volunteers.map((v) => v.name);
  const isReviewer = reviewerNames.includes(currentVolunteerName);
  const canCancel = isReviewer || Boolean(isCurrentVolunteerAdmin);

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
      const isActive = order.status !== "cancelled" && lineItems.some((li) => li.stillOut > 0);
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
          {reviewerNames.length > 0
            ? ` — ${reviewerNames.join(" / ")}, take a look below.`
            : " — set at least 2 reviewers under the Volunteers tab."}
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
          reviewerNames={reviewerNames}
          currentVolunteerName={currentVolunteerName}
          canCancel={canCancel}
          onMarkReady={onMarkReady}
          onAssignFillers={onAssignFillers}
          onResendFillerNotice={onResendFillerNotice}
          onResendReadyEmail={onResendReadyEmail}
          onResendSubmittedEmail={onResendSubmittedEmail}
          onCancelOrder={onCancelOrder}
          onUpdateOrder={onUpdateOrder}
          onEditOrder={() => setEditingOrder(order)}
          volunteers={volunteers}
        />
      ))}

      {drafts && drafts.length > 0 && (
        <>
          <h3 style={{ ...S.cardTitle, marginTop: 18 }}>In-Progress, Not Yet Submitted ({drafts.length})</h3>
          <div style={{ ...S.tinyMuted, marginBottom: 10 }}>
            A requester saved these but hasn't submitted yet — nothing here has reserved any inventory. They
            can resume and finish on any device using "Already submitted an order?" with their phone number.
          </div>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              canCancel={canCancel}
              onCancel={onCancelDraft}
              onEditDraft={setEditingDraft}
            />
          ))}
        </>
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          items={items}
          onSave={(newItems, newDetails) => onUpdateOrderItems(editingOrder, newItems, newDetails)}
          onClose={() => setEditingOrder(null)}
        />
      )}

      {editingDraft && (
        <EditOrderModal
          order={editingDraft}
          items={items}
          title={`Edit Draft — ${editingDraft.requesterName || "Requester"}`}
          hint="Adjust quantities, remove items, or add ones the requester hasn't picked yet. Nothing here touches live inventory — a draft doesn't reserve any stock until it's actually submitted."
          onSave={(newItems, newDetails) => onUpdateDraftItems(editingDraft, newItems, newDetails)}
          onClose={() => setEditingDraft(null)}
        />
      )}

      <style>{`
        @media print {
          body.order-printing-scoped * { visibility: hidden; }
          body.order-printing-scoped .order-print-active,
          body.order-printing-scoped .order-print-active * { visibility: visible; }
          body.order-printing-scoped .order-print-active {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .order-print-table th, .order-print-table td {
            border: 1px solid #999;
            padding: 6px 8px;
          }
        }
      `}</style>
    </div>
  );
}

function OrderCard({ order, volunteerNames, volunteers, reviewerNames, currentVolunteerName, canCancel, onMarkReady, onAssignFillers, onResendFillerNotice, onResendReadyEmail, onResendSubmittedEmail, onCancelOrder, onUpdateOrder, onEditOrder }) {
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resendingReady, setResendingReady] = useState(false);
  const [resendReadyFlash, setResendReadyFlash] = useState(null); // { text, tone: "ok" | "error" } | null

  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    function handleAfterPrint() {
      document.body.classList.remove("order-printing-scoped");
      setPrinting(false);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // Same scoped-print mechanism used on the Print Lists page: flushSync
  // makes sure the print-only block is actually in the DOM before we
  // call print(), so staff can grab a standalone copy of just this one
  // order — handy to keep on file, hand off, or print for someone
  // without app access.
  function handlePrintOrder() {
    flushSync(() => {
      setPrinting(true);
    });
    document.body.classList.add("order-printing-scoped");
    void document.body.offsetHeight;
    window.print();
  }

  const [submittedResendOpen, setSubmittedResendOpen] = useState(false);
  const [includeRequester, setIncludeRequester] = useState(Boolean(order.requesterEmail));
  const [includeReturner, setIncludeReturner] = useState(Boolean(order.hasReturner && order.returnerEmail));
  const [extraEmails, setExtraEmails] = useState("");
  const [sendingSubmitted, setSendingSubmitted] = useState(false);
  const [submittedFlash, setSubmittedFlash] = useState(null); // { text, tone: "ok" | "error" } | null
  const [pickedFillers, setPickedFillers] = useState(order.assignedFillers || []);
  const [pointOfContactId, setPointOfContactId] = useState("");

  const reviewersConfigured = (reviewerNames || []).length > 0;
  const isReviewer = (reviewerNames || []).includes(currentVolunteerName);
  const reviewedBy = order.reviewedBy || [];
  const alreadyReviewedByMe = reviewedBy.includes(currentVolunteerName);
  const reviewsStillNeeded = Math.max(REQUIRED_REVIEWS - reviewedBy.length, 0);

  async function handleCancel() {
    setCancelling(true);
    try {
      await onCancelOrder(order);
    } finally {
      setCancelling(false);
    }
  }

  function handleMarkReviewed() {
    const updated = alreadyReviewedByMe ? reviewedBy : [...reviewedBy, currentVolunteerName];
    const patch = { reviewedBy: updated };
    if (updated.length >= REQUIRED_REVIEWS) {
      patch.status = "reviewed";
    }
    onUpdateOrder(order.id, patch);
  }

  const [assigning, setAssigning] = useState(false);
  const [resendVolunteerId, setResendVolunteerId] = useState("");
  const [resending, setResending] = useState(false);

  function toggleFiller(name) {
    setPickedFillers((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function handleAssign() {
    if (pickedFillers.length === 0) return;
    setAssigning(true);
    try {
      await onAssignFillers(order, pickedFillers);
    } finally {
      setAssigning(false);
    }
  }

  async function handleResend() {
    if (!resendVolunteerId) return;
    const volunteer = volunteers.find((v) => v.id === resendVolunteerId);
    if (!volunteer) return;
    setResending(true);
    try {
      await onResendFillerNotice(order, volunteer);
      setResendVolunteerId("");
    } finally {
      setResending(false);
    }
  }

  // Shown wherever fillers have already been assigned — lets staff
  // pick any volunteer (already assigned or a swap-in) and resend the
  // exact same order details to them, for a swap or a missed email.
  function renderResendBlock() {
    return (
      <div style={{ marginTop: 10 }}>
        <label style={S.fieldLabel}>
          Resend to a volunteer (swap, or if they didn't receive it)
          <select style={S.fieldInput} value={resendVolunteerId} onChange={(e) => setResendVolunteerId(e.target.value)}>
            <option value="">Select a volunteer…</option>
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <button style={S.secondaryBtn} disabled={!resendVolunteerId || resending} onClick={handleResend}>
          {resending ? "Sending…" : "Resend Order Details"}
        </button>
      </div>
    );
  }

  async function handleMarkReady() {
    setSending(true);
    try {
      const pointOfContact = volunteers.find((v) => v.id === pointOfContactId) || null;
      await onMarkReady(order, pointOfContact);
    } finally {
      setSending(false);
    }
  }

  // For when a requester says they never got the "ready for pickup"
  // email, or staff just want to double check — resends the exact same
  // notice using the point of contact already on file for this order.
  async function handleResendReady() {
    setResendingReady(true);
    setResendReadyFlash(null);
    try {
      const result = await onResendReadyEmail(order);
      if (!result?.ok) {
        setResendReadyFlash({ text: "Couldn't send — try again.", tone: "error" });
      } else if (result.skipped === "no-email") {
        setResendReadyFlash({ text: "No email on file for this requester.", tone: "error" });
      } else {
        setResendReadyFlash({ text: "Sent!", tone: "ok" });
      }
    } finally {
      setResendingReady(false);
    }
  }

  // Resends the original "request submitted" confirmation — to the
  // requester, the returner, or both (whichever checkboxes are on),
  // plus anyone typed into the extra-recipients field.
  async function handleResendSubmitted() {
    const trimmedExtra = extraEmails.trim();
    if (!includeRequester && !includeReturner && !trimmedExtra) return;
    setSendingSubmitted(true);
    setSubmittedFlash(null);
    try {
      const result = await onResendSubmittedEmail(order, {
        includeRequester,
        includeReturner,
        extraEmails: trimmedExtra,
      });
      if (!result?.ok) {
        setSubmittedFlash({ text: "Couldn't send — try again.", tone: "error" });
      } else if (result.skipped === "no-email") {
        setSubmittedFlash({ text: "No recipients — nothing on file and no extra email entered.", tone: "error" });
      } else {
        setSubmittedFlash({ text: "Sent!", tone: "ok" });
      }
    } finally {
      setSendingSubmitted(false);
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
        </div>
        <div style={{ ...S.tinyMuted, textAlign: "right" }}>Submitted {order.createdAtLabel || "—"}</div>
      </div>

      <div style={orderDetailTextStyle}>
        {order.requesterPhone || "—"}
        {order.requesterEmail ? ` · ${order.requesterEmail}` : ""}
        <br />
        {order.circuit || "—"} · {order.eventType || "—"} · Event {order.eventDate || "—"} · Pickup{" "}
        {order.pickupDate || "—"} · Return {order.returnDate || "—"}
      </div>

      {order.hasReturner && (
        <div style={{ ...orderDetailTextStyle, marginTop: 6 }}>
          <strong>Returning:</strong> {order.returnerName || "—"}
          {order.returnerPhone ? ` · ${order.returnerPhone}` : ""}
          {order.returnerEmail ? ` · ${order.returnerEmail}` : ""}
          {order.returnerCircuit ? ` · ${order.returnerCircuit}` : ""}
        </div>
      )}

      <div style={{ ...S.summaryListWrap, marginTop: 10 }}>
        {order.lineItems.map((li, idx) => (
          <div key={idx} style={S.summaryRow}>
            <span>
              {li.name}
              {!li.exists && <span style={{ color: "#c0392b", fontSize: 11 }}> (item no longer in catalog)</span>}
            </span>
            <span style={{ ...S.summaryQty, textAlign: "right" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "#999", fontWeight: 700 }}>Requested</div>
              <div style={{ fontWeight: 700, color: "#1a1a2e" }}>{li.qty}</div>
            </span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div style={{ ...S.tinyMuted, marginTop: 8 }}>
          <strong>Notes:</strong> {order.notes}
        </div>
      )}

      {/* Resends the original "request submitted" confirmation — available
          at any stage, not tied to a particular phase, since someone can
          say they never got it whenever they happen to notice. */}
      <div style={{ marginTop: 10 }}>
        {!submittedResendOpen ? (
          <button style={editLinkStyle} onClick={() => setSubmittedResendOpen(true)}>
            Resend Confirmation Email
          </button>
        ) : (
          <div style={{ background: "#f7f8fa", borderRadius: 8, padding: "10px 12px", marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
              Resend "Request Submitted" Confirmation
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={includeRequester}
                disabled={!order.requesterEmail}
                onChange={(e) => setIncludeRequester(e.target.checked)}
              />
              Requester{order.requesterEmail ? ` (${order.requesterEmail})` : " (no email on file)"}
            </label>
            {order.hasReturner && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={includeReturner}
                  disabled={!order.returnerEmail}
                  onChange={(e) => setIncludeReturner(e.target.checked)}
                />
                Returner{order.returnerEmail ? ` (${order.returnerEmail})` : " (no email on file)"}
              </label>
            )}
            <label style={S.fieldLabel}>
              Other recipients (optional, comma-separated)
              <input
                style={S.fieldInput}
                value={extraEmails}
                onChange={(e) => setExtraEmails(e.target.value)}
                placeholder="name@example.com, another@example.com"
              />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...S.primaryBtn, marginTop: 0 }}
                disabled={sendingSubmitted || (!includeRequester && !includeReturner && !extraEmails.trim())}
                onClick={handleResendSubmitted}
              >
                {sendingSubmitted ? "Sending…" : "Send"}
              </button>
              <button
                style={{ ...S.secondaryBtn, marginTop: 0 }}
                onClick={() => {
                  setSubmittedResendOpen(false);
                  setSubmittedFlash(null);
                }}
              >
                Cancel
              </button>
            </div>
            {submittedFlash && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 8,
                  color: submittedFlash.tone === "error" ? "#c0392b" : "#1e8449",
                }}
              >
                {submittedFlash.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase 2, step 1: review — any 2 of the up-to-4 designated reviewers signing off advances the order */}
      {order.status === "submitted" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          {!reviewersConfigured ? (
            <p style={S.tinyMuted}>Set at least 2 reviewers under the Volunteers tab to continue.</p>
          ) : isReviewer ? (
            alreadyReviewedByMe ? (
              <p style={S.tinyMuted}>
                You've reviewed this ({reviewedBy.length} of {REQUIRED_REVIEWS} required
                {reviewerNames.length > REQUIRED_REVIEWS ? `, ${reviewerNames.length} eligible` : ""}) — waiting on{" "}
                {reviewsStillNeeded} more.
              </p>
            ) : (
              <button style={S.primaryBtn} onClick={handleMarkReviewed}>
                Mark as Reviewed ({currentVolunteerName})
              </button>
            )
          ) : (
            <p style={S.tinyMuted}>
              {reviewedBy.length > 0
                ? `Reviewed by ${reviewedBy.join(", ")} (${reviewedBy.length} of ${REQUIRED_REVIEWS} required) — waiting on ${reviewsStillNeeded} more.`
                : `Waiting on ${reviewerNames.join(" / ")} to review this.`}
            </p>
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
              <button style={S.primaryBtn} disabled={pickedFillers.length === 0 || assigning} onClick={handleAssign}>
                {assigning ? "Assigning…" : "Assign to Fill"}
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
          {renderResendBlock()}
          <label style={{ ...S.fieldLabel, marginTop: 10 }}>
            Point of Contact (for pickup/drop-off — included in the ready email)
            <select style={S.fieldInput} value={pointOfContactId} onChange={(e) => setPointOfContactId(e.target.value)}>
              <option value="">Select a volunteer…</option>
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button style={{ ...S.primaryBtn, marginTop: 10 }} disabled={sending || !pointOfContactId} onClick={handleMarkReady}>
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
          {order.pointOfContactName && (
            <div style={S.tinyMuted}>
              Point of Contact: {order.pointOfContactName}
              {order.pointOfContactPhone ? ` · ${order.pointOfContactPhone}` : ""}
            </div>
          )}
          <div style={{ ...S.tinyMuted, marginTop: 4 }}>Ready for pickup — waiting on the requester to check items back in.</div>
          <button style={{ ...S.secondaryBtn, marginTop: 10 }} disabled={resendingReady} onClick={handleResendReady}>
            {resendingReady ? "Sending…" : "Resend Ready Email to Requester"}
          </button>
          {resendReadyFlash && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginTop: 6,
                color: resendReadyFlash.tone === "error" ? "#c0392b" : "#1e8449",
              }}
            >
              {resendReadyFlash.text}
            </div>
          )}
          {renderResendBlock()}
        </div>
      )}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button style={editLinkStyle} onClick={onEditOrder}>
            Edit Items
          </button>
          <button style={editLinkStyle} onClick={handlePrintOrder}>
            Print / Download Order
          </button>
        </div>
        {canCancel ? (
          <button style={cancelLinkStyle} disabled={cancelling} onClick={handleCancel}>
            {cancelling ? "Cancelling…" : "Cancel & Archive Order"}
          </button>
        ) : (
          <span style={{ ...S.tinyMuted, fontSize: 11 }}>Only the reviewer or an admin can cancel this order.</span>
        )}
      </div>

      {/* Standalone printable copy of just this order — hidden on
          screen, only rendered into the print output when this card's
          own Print/Download button was the one clicked (see the
          body.order-printing-scoped rules at the bottom of the page). */}
      <div className={"order-print-block" + (printing ? " order-print-active" : "")} style={{ display: "none" }}>
        <h2 style={{ marginBottom: 4 }}>{order.requesterName || "Unnamed requester"}</h2>
        <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
          {order.requesterPhone || "—"}
          {order.requesterEmail ? ` · ${order.requesterEmail}` : ""}
          <br />
          {order.circuit || "—"} · {order.eventType || "—"} · Event {order.eventDate || "—"} · Pickup{" "}
          {order.pickupDate || "—"} · Return {order.returnDate || "—"}
        </p>
        {order.hasReturner && (
          <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
            <strong>Returning:</strong> {order.returnerName || "—"}
            {order.returnerPhone ? ` · ${order.returnerPhone}` : ""}
            {order.returnerEmail ? ` · ${order.returnerEmail}` : ""}
            {order.returnerCircuit ? ` · ${order.returnerCircuit}` : ""}
          </p>
        )}
        {order.notes && (
          <p style={{ fontSize: 12, color: "#666" }}>
            <strong>Notes:</strong> {order.notes}
          </p>
        )}
        <table className="order-print-table" style={printTableStyle}>
          <thead>
            <tr>
              <th style={printThStyle}>Item</th>
              <th style={{ ...printThStyle, width: 90, textAlign: "center" }}>Requested</th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((li, idx) => (
              <tr key={idx}>
                <td style={printTdStyle}>
                  {li.name}
                  {!li.exists && " (item no longer in catalog)"}
                </td>
                <td style={{ ...printTdStyle, textAlign: "center", fontWeight: 700 }}>{li.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DraftCard({ draft, canCancel, onCancel, onEditDraft }) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await onCancel(draft);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
        {draft.requesterName || "Unnamed requester"}
      </div>
      <div style={orderDetailTextStyle}>
        {draft.requesterPhone || "—"}
        {draft.requesterEmail ? ` · ${draft.requesterEmail}` : ""}
        <br />
        {draft.circuit || "—"} · {draft.eventType || "—"} · Event {draft.eventDate || "—"} · Pickup{" "}
        {draft.pickupDate || "—"} · Return {draft.returnDate || "—"}
      </div>
      {draft.hasReturner && (
        <div style={{ ...orderDetailTextStyle, marginTop: 6 }}>
          <strong>Returning:</strong> {draft.returnerName || "—"}
          {draft.returnerPhone ? ` · ${draft.returnerPhone}` : ""}
          {draft.returnerEmail ? ` · ${draft.returnerEmail}` : ""}
          {draft.returnerCircuit ? ` · ${draft.returnerCircuit}` : ""}
        </div>
      )}
      {draft.notes && (
        <div style={{ ...S.tinyMuted, marginTop: 8 }}>
          <strong>Notes:</strong> {draft.notes}
        </div>
      )}

      <div style={{ ...S.summaryListWrap, marginTop: 10 }}>
        {(!draft.items || draft.items.length === 0) && (
          <div style={S.tinyMuted}>No items picked yet.</div>
        )}
        {(draft.items || []).map((li, idx) => (
          <div key={idx} style={S.summaryRow}>
            <span>{li.name}</span>
            <span style={S.summaryQty}>×{li.qty}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={editLinkStyle} onClick={() => onEditDraft(draft)}>
          Edit Items
        </button>
        {canCancel ? (
          <button style={cancelLinkStyle} disabled={cancelling} onClick={handleCancel}>
            {cancelling ? "Cancelling…" : "Cancel This Draft"}
          </button>
        ) : (
          <span style={{ ...S.tinyMuted, fontSize: 11 }}>Only the reviewer or an admin can cancel this.</span>
        )}
      </div>
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

const orderDetailTextStyle = {
  fontSize: 14,
  color: "#333",
  lineHeight: 1.6,
  marginTop: 4,
};

const editLinkStyle = {
  background: "none",
  border: "none",
  color: "#0072CE",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};

const cancelLinkStyle = {
  background: "none",
  border: "none",
  color: "#c0392b",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};

const printTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 10,
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
};

const printThStyle = {
  textAlign: "left",
  fontSize: 12,
  textTransform: "uppercase",
  color: "#999",
  padding: "8px 10px",
  borderBottom: "2px solid #eee",
};

const printTdStyle = {
  fontSize: 13,
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  color: "#1a1a2e",
};
