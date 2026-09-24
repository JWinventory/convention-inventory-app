import React, { useEffect, useMemo, useRef, useState } from "react";
import { S, CAT_COLORS } from "./styles";
import { Icon } from "./components/Icon";
import { RequesterForm } from "./components/RequesterForm";
import { ItemCard } from "./components/ItemCard";
import { NotesSection } from "./components/NotesSection";
import { CheckInScanModal } from "./components/CheckInScanModal";
import { QrModal } from "./components/QrModal";
import { Modal } from "./components/Modal";
import { OrderReviewPage } from "./components/OrderReviewPage";
import { MyOrderStatus } from "./components/MyOrderStatus";
import { FindOrderForm } from "./components/FindOrderForm";
import { SelectedItemsList } from "./components/SelectedItemsList";
import { AdminHub } from "./components/AdminHub";
import { PullToRefresh } from "./components/PullToRefresh";
import { useInventory } from "./useInventory";
import { firebaseConfigured } from "./firebase";

const MY_ORDER_KEY = "convention-inventory-my-order-id";
const MY_DRAFT_KEY = "convention-inventory-my-draft-id";

function defaultRequester() {
  return {
    name: "",
    phone: "",
    eventType: "",
    eventDate: "",
    pickupDate: "",
    returnDate: "",
    circuit: "",
    hasReturner: false,
    returnerName: "",
    returnerPhone: "",
    returnerEmail: "",
    returnerCircuit: "",
  };
}

// Matches each order line item up against the live catalog to see how
// much of it is still checked out right now.
function computeLineItems(order, items) {
  return (order.items || []).map((li) => {
    const liveItem = items.find((i) => i.name === li.name);
    const stillOut = liveItem ? Math.min(li.qty, liveItem.out || 0) : 0;
    return { ...li, stillOut, exists: Boolean(liveItem), category: liveItem ? liveItem.category : "Uncategorized" };
  });
}

// Finds the most recent still-active order whose phone or email
// matches the query, so a requester can pick up their order on a
// different device than the one they submitted from. Orders are
// already sorted newest-first by the live query in useInventory.
function findMyOrder(orders, items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const qDigits = q.replace(/\D/g, "");

  const matches = orders.filter((o) => {
    const requesterPhoneDigits = (o.requesterPhone || "").replace(/\D/g, "");
    const returnerPhoneDigits = (o.returnerPhone || "").replace(/\D/g, "");
    const requesterEmail = (o.requesterEmail || "").toLowerCase();
    const returnerEmail = (o.returnerEmail || "").toLowerCase();
    const phoneMatch = qDigits.length >= 7 && (requesterPhoneDigits === qDigits || returnerPhoneDigits === qDigits);
    const emailMatch = q.includes("@") && (requesterEmail === q || returnerEmail === q);
    return phoneMatch || emailMatch;
  });

  const active = matches.filter((o) => computeLineItems(o, items).some((li) => li.stillOut > 0));
  return active[0] || null;
}

// Finds the most recently-saved draft (in-progress, not yet submitted
// order) whose phone or email matches the query — checking both the
// requester's and the returner's contact info, so either one can pick
// up the draft. Drafts arrive already sorted newest-first by the live
// query in useInventory.
function findMyDraft(drafts, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const qDigits = q.replace(/\D/g, "");

  const matches = drafts.filter((d) => {
    const requesterPhoneDigits = (d.requesterPhone || "").replace(/\D/g, "");
    const returnerPhoneDigits = (d.returnerPhone || "").replace(/\D/g, "");
    const requesterEmail = (d.requesterEmail || "").toLowerCase();
    const returnerEmail = (d.returnerEmail || "").toLowerCase();
    const phoneMatch = qDigits.length >= 7 && (requesterPhoneDigits === qDigits || returnerPhoneDigits === qDigits);
    const emailMatch = q.includes("@") && (requesterEmail === q || returnerEmail === q);
    return phoneMatch || emailMatch;
  });

  return matches[0] || null;
}

export default function App() {
  const {
    items,
    orders,
    drafts,
    notes,
    volunteers,
    volunteersReady,
    reviewerIds,
    syncStatus,
    seedIfEmpty,
    addItem,
    updateItem,
    deleteItem,
    applyCheckChange,
    addOrder,
    saveDraft,
    deleteDraft,
    updateDraftItems,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    saveNotes,
    addVolunteer,
    updateVolunteer,
    deleteVolunteer,
    resetVolunteerPassword,
    setVolunteerPassword,
    saveReviewerIds,
  } = useInventory();

  const [tab, setTab] = useState("inventory"); // inventory | admin
  const [requester, setRequester] = useState(defaultRequester);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [checkInScanOpen, setCheckInScanOpen] = useState(false);
  const [qrItem, setQrItem] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [myDraftId, setMyDraftId] = useState(() => localStorage.getItem(MY_DRAFT_KEY) || null);
  // Purely local — the browsing screen is a static form. Nothing here
  // touches Firestore or is visible to anyone else until Submit; a new
  // visitor always starts with this empty, regardless of what anyone
  // else is doing elsewhere at the same time.
  const [selections, setSelections] = useState({}); // { [itemId]: qty }
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes);
  const [noteFlash, setNoteFlash] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(null); // { phone } | null — brief confirmation after Save

  // Measures the sticky header's actual rendered height, so the search
  // bar / category tabs below it can stick at exactly that offset
  // instead of a guessed pixel value that could drift out of sync.
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [myOrderId, setMyOrderId] = useState(() => localStorage.getItem(MY_ORDER_KEY) || null);

  useEffect(() => setNoteDraft(notes), [notes]);

  const categories = useMemo(() => {
    const known = Object.keys(CAT_COLORS);
    const present = Array.from(new Set(items.map((i) => i.category)));
    const ordered = known.filter((c) => present.includes(c));
    const extra = present.filter((c) => !known.includes(c)).sort();
    return ["All", ...ordered, ...extra];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        if (activeCat !== "All" && it.category !== activeCat) return false;
        if (requester.eventType) {
          const evs = Array.isArray(it.events) ? it.events : [];
          if (evs.length > 0 && !evs.includes(requester.eventType)) return false;
        }
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!it.name.toLowerCase().includes(q) && !it.category.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, activeCat, search, requester.eventType]);

  // Built from local selections only — never from live item.out counts,
  // so this is always this visitor's own picks, private until Submit.
  const checkedOutItems = useMemo(() => {
    return Object.entries(selections)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = items.find((it) => it.id === id);
        return item ? { ...item, out: qty } : null;
      })
      .filter(Boolean);
  }, [selections, items]);

  function saveNote() {
    saveNotes(noteDraft);
    setNoteFlash(true);
    setTimeout(() => setNoteFlash(false), 2000);
  }

  // Removes an item from this static, local-only selection — nothing
  // to undo in Firestore, since nothing's been written there yet.
  function handleRemoveFromOrder(item) {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  // Checkpoints the current picks as a draft. Resets the whole form
  // right after — items and requester details both — so there's no
  // ambiguity about whether it actually saved: an empty, ready-for-the-
  // next-request screen IS the confirmation, backed up by an explicit
  // "Saved!" message. To keep adding to this same draft, or to finish
  // and submit it, they come back via "Already submitted an order?"
  // with their phone number.
  async function handleSaveDraft() {
    const draftItems = checkedOutItems.map((it) => ({ name: it.name, qty: it.out }));
    const savedPhone = requester.phone;
    const id = await saveDraft(myDraftId, requester, submitEmail, submitNotes, draftItems);
    if (id && !myDraftId) {
      localStorage.setItem(MY_DRAFT_KEY, id);
    }
    setSelections({});
    setRequester(defaultRequester());
    setSubmitEmail("");
    setSubmitNotes("");
    // Forget which draft this was too — otherwise picking new items
    // and saving again (without looking the draft back up first) would
    // silently overwrite its just-saved contact info with these now-
    // blank fields.
    localStorage.removeItem(MY_DRAFT_KEY);
    setMyDraftId(null);
    setSaveConfirm({ phone: savedPhone });
  }

  // --- Phase 1-3 order tracking (this browser's own submitted order) ---
  const myOrder = useMemo(() => orders.find((o) => o.id === myOrderId) || null, [orders, myOrderId]);
  const myLineItems = useMemo(() => (myOrder ? computeLineItems(myOrder, items) : []), [myOrder, items]);
  const myOrderPhase = useMemo(() => {
    if (!myOrder) return "none";
    if (myOrder.status === "cancelled") return "none";
    const allDone = myLineItems.length > 0 && myLineItems.every((li) => li.stillOut === 0);
    if (allDone) return "none";
    return myOrder.status === "fulfilled" ? "ready" : "submitted";
  }, [myOrder, myLineItems]);

  // Once every item on "my" order is checked back in, stop tracking it
  // so the screen unlocks and is ready for a new request.
  useEffect(() => {
    if (myOrder && myOrderPhase === "none") {
      localStorage.removeItem(MY_ORDER_KEY);
      setMyOrderId(null);
      setReviewOpen(false);
    }
  }, [myOrder, myOrderPhase]);

  // If the order finishes while the check-in scanner happens to still be
  // open for some reason, make sure it closes too.
  useEffect(() => {
    if (myOrderPhase !== "ready") setCheckInScanOpen(false);
  }, [myOrderPhase]);

  async function handleOrderCreated(order) {
    const id = await addOrder(order);
    if (!id) {
      throw new Error("Could not create the order.");
    }
    localStorage.setItem(MY_ORDER_KEY, id);
    setMyOrderId(id);
    // Once a request is submitted, the whole form starts fresh — even
    // returning to this same device later shouldn't carry over the old
    // requester details or item picks, matching the "blank slate for
    // every visit" approach used everywhere else on this screen.
    setSelections({});
    setRequester(defaultRequester());
    setSubmitEmail("");
    setSubmitNotes("");
    if (myDraftId) {
      deleteDraft(myDraftId);
      localStorage.removeItem(MY_DRAFT_KEY);
      setMyDraftId(null);
    }

    // Nothing touched live inventory while browsing — this is what
    // actually reserves the stock, all at once, now that the order
    // itself is safely recorded. If two unrelated static sessions
    // happened to pick the same items, that's sorted out by staff when
    // they review the order, not prevented here.
    for (const li of order.items || []) {
      const liveItem = items.find((i) => i.name === li.name);
      if (liveItem) {
        // eslint-disable-next-line no-await-in-loop
        await applyCheckChange(liveItem.id, li.qty, order.requester.name);
      }
    }

    // notify-review already supports comma-separated multiple addresses,
    // so every configured reviewer (up to 4) gets the alert, not just one.
    const reviewerEmails = reviewerIds
      .map((id) => volunteers.find((v) => v.id === id)?.email)
      .filter(Boolean)
      .join(", ");
    try {
      const res = await fetch("/api/notify-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerEmail: reviewerEmails,
          requester: { name: order.requester.name, phone: order.requester.phone },
          eventType: order.requester.eventType,
          eventDate: order.requester.eventDate,
          items: order.items,
        }),
      });
      if (!res.ok) {
        console.error("notify-review failed:", res.status, await res.text());
      }
    } catch (err) {
      // Order is already saved even if the review-alert email fails to send.
      console.error("notify-review request failed:", err);
    }

    // Confirms to the requester (and the returner, if one was named)
    // that the request went through — separate from the reviewer alert
    // above, and just as non-blocking if it fails to send.
    try {
      const res = await fetch("/api/notify-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: order.requesterEmail || "",
          returnerEmail: order.requester.hasReturner ? order.requester.returnerEmail : "",
          requester: { name: order.requester.name, phone: order.requester.phone },
          returner: order.requester.hasReturner
            ? { name: order.requester.returnerName, phone: order.requester.returnerPhone }
            : null,
          eventType: order.requester.eventType,
          eventDate: order.requester.eventDate,
          pickupDate: order.requester.pickupDate,
          returnDate: order.requester.returnDate,
          items: order.items,
        }),
      });
      if (!res.ok) {
        console.error("notify-submitted failed:", res.status, await res.text());
      }
    } catch (err) {
      // Order is already saved even if this confirmation email fails to send.
      console.error("notify-submitted request failed:", err);
    }
  }

  // Cross-device lookup: finds either a submitted order (to pick up
  // tracking/check-in on this device) or an in-progress draft (to
  // resume picking items where it was left off) by phone or email.
  function handleFindOrder(query) {
    const found = findMyOrder(orders, items, query);
    if (found) {
      localStorage.setItem(MY_ORDER_KEY, found.id);
      setMyOrderId(found.id);

      setRequester({
        name: found.requesterName || "",
        phone: found.requesterPhone || "",
        eventType: found.eventType || "",
        eventDate: found.eventDate || "",
        pickupDate: found.pickupDate || "",
        returnDate: found.returnDate || "",
        circuit: found.circuit || "",
        hasReturner: Boolean(found.hasReturner),
        returnerName: found.returnerName || "",
        returnerPhone: found.returnerPhone || "",
        returnerEmail: found.returnerEmail || "",
        returnerCircuit: found.returnerCircuit || "",
      });

      return true;
    }

    const foundDraft = findMyDraft(drafts, query);
    if (foundDraft) {
      localStorage.setItem(MY_DRAFT_KEY, foundDraft.id);
      setMyDraftId(foundDraft.id);

      setRequester({
        name: foundDraft.requesterName || "",
        phone: foundDraft.requesterPhone || "",
        eventType: foundDraft.eventType || "",
        eventDate: foundDraft.eventDate || "",
        pickupDate: foundDraft.pickupDate || "",
        returnDate: foundDraft.returnDate || "",
        circuit: foundDraft.circuit || "",
        hasReturner: Boolean(foundDraft.hasReturner),
        returnerName: foundDraft.returnerName || "",
        returnerPhone: foundDraft.returnerPhone || "",
        returnerEmail: foundDraft.returnerEmail || "",
        returnerCircuit: foundDraft.returnerCircuit || "",
      });
      setSubmitEmail(foundDraft.requesterEmail || "");
      setSubmitNotes(foundDraft.notes || "");

      const restored = {};
      for (const li of foundDraft.items || []) {
        const liveItem = items.find((i) => i.name === li.name);
        if (liveItem) restored[liveItem.id] = li.qty;
      }
      setSelections(restored);

      // Straight to Review & Submit — resuming a draft means they're
      // here to finish it, not to browse from scratch.
      setReviewOpen(true);

      return true;
    }

    return false;
  }

  // Staff-side: flips the order to "fulfilled" and emails the requester
  // (silently skipped server-side if they didn't leave an email).
  async function handleMarkOrderReady(order) {
    await updateOrderStatus(order.id, "fulfilled");
    try {
      await fetch("/api/notify-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: order.requesterEmail,
          requester: { name: order.requesterName, phone: order.requesterPhone },
          items: order.items,
        }),
      });
    } catch (err) {
      // Status is already updated even if the email fails to send.
    }
  }

  // Force-closes an order at any stage — even if nothing's actually
  // been filled or returned. Any of its items still checked out get
  // returned to available first (so catalog counts stay correct),
  // then the order is marked cancelled, which moves it to History
  // since it's no longer "active."
  async function handleCancelOrder(order) {
    const requesterLabel = order.requesterName || "this requester";
    if (
      !window.confirm(
        `Cancel and archive this order for ${requesterLabel}? Any items still checked out will be returned to available.`
      )
    ) {
      return;
    }
    for (const li of order.items || []) {
      const liveItem = items.find((i) => i.name === li.name);
      if (liveItem) {
        const stillOut = Math.min(li.qty, liveItem.out || 0);
        if (stillOut > 0) {
          // eslint-disable-next-line no-await-in-loop
          await applyCheckChange(liveItem.id, -stillOut, "Order cancelled", "Order cancelled/archived by staff");
        }
      }
    }
    await updateOrder(order.id, { status: "cancelled" });
  }

  // Staff editing an order's items: for each item whose quantity
  // changed (or that was added/removed entirely), adjusts live
  // inventory by the difference — removing or reducing an item returns
  // stock to available, adding or increasing reserves more of it —
  // then saves the order's new item list.
  async function handleUpdateOrderItems(order, newItems, newDetails) {
    const oldMap = new Map((order.items || []).map((li) => [li.name, li.qty]));
    const newMap = new Map(newItems.map((li) => [li.name, li.qty]));
    const allNames = new Set([...oldMap.keys(), ...newMap.keys()]);

    for (const name of allNames) {
      const oldQty = oldMap.get(name) || 0;
      const newQty = newMap.get(name) || 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;
      const liveItem = items.find((i) => i.name === name);
      if (liveItem) {
        // eslint-disable-next-line no-await-in-loop
        await applyCheckChange(liveItem.id, delta, "Order edited", "Order items adjusted by staff");
      }
    }

    await updateOrder(order.id, { items: newItems, ...(newDetails || {}) });
  }

  // Cancels an in-progress (not-yet-submitted) draft. A draft never
  // reserves live inventory — that only happens once an order is
  // actually submitted — so cancelling one is just deleting the draft
  // record itself, nothing to release back to available.
  async function handleCancelDraft(draft) {
    const requesterLabel = draft.requesterName || "this requester";
    if (!window.confirm(`Cancel this in-progress draft for ${requesterLabel}? This can't be undone.`)) {
      return;
    }
    await deleteDraft(draft.id);
  }

  // Staff adding/removing items on a draft before it's ever submitted —
  // no live inventory to reconcile here, since a draft doesn't reserve
  // anything until it becomes a real order.
  async function handleUpdateDraftItems(draft, newItems, newDetails) {
    await updateDraftItems(draft.id, { items: newItems, ...(newDetails || {}) });
  }

  // Permanently deletes an order from history. Unlike cancelling, this
  // can't be undone, so it's confirmed explicitly.
  async function handleDeleteOrder(order) {
    const requesterLabel = order.requesterName || "this requester";
    if (
      !window.confirm(
        `Permanently delete this order for ${requesterLabel}? This can't be undone — it will be removed from history entirely, not just archived.`
      )
    ) {
      return;
    }
    await deleteOrder(order.id);
  }

  if (!firebaseConfigured) {
    return (
      <div style={S.page}>
        <header style={S.header}>
          <div style={S.headerTop}>
            <div style={S.headerTitleRow}>
              <h1 style={S.h1}>Circuit / Convention Inventory</h1>
            </div>
          </div>
        </header>
        <div style={S.configWarning}>
          <strong>Firebase isn't configured yet.</strong>
          <br />
          Copy <code style={S.code}>.env.example</code> to <code style={S.code}>.env</code> and fill in your Firebase
          project's web app config (Firebase Console → Project settings → General → Your apps). See the README for
          step-by-step setup, then restart the dev server.
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh>
    <div style={S.page}>
      <header ref={headerRef} style={S.header}>
        <div style={S.headerTop}>
          <div style={S.headerTitleRow}>
            <h1 style={S.h1}>Circuit / Convention Inventory</h1>
            <SyncDot status={syncStatus} />
          </div>
          <div style={S.h2}>Equipment check-in / check-out tracker</div>
          <div style={S.navTabs}>
            <button style={{ ...S.navTab, ...(tab === "inventory" ? S.navTabActive : {}) }} onClick={() => setTab("inventory")}>
              Inventory
            </button>
            <button style={{ ...S.navTab, ...(tab === "admin" ? S.navTabActive : {}) }} onClick={() => setTab("admin")}>
              Admin
            </button>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {tab === "admin" ? (
          <AdminHub
            items={items}
            orders={orders}
            drafts={drafts}
            headerHeight={headerHeight}
            addItem={addItem}
            updateItem={updateItem}
            deleteItem={deleteItem}
            seedIfEmpty={seedIfEmpty}
            syncStatus={syncStatus}
            onMarkReady={handleMarkOrderReady}
            onCancelOrder={handleCancelOrder}
            onUpdateOrderItems={handleUpdateOrderItems}
            onCancelDraft={handleCancelDraft}
            onUpdateDraftItems={handleUpdateDraftItems}
            onDeleteOrder={handleDeleteOrder}
            volunteers={volunteers}
            volunteersReady={volunteersReady}
            reviewerIds={reviewerIds}
            onAddVolunteer={addVolunteer}
            onUpdateVolunteer={updateVolunteer}
            onDeleteVolunteer={deleteVolunteer}
            onResetVolunteerPassword={resetVolunteerPassword}
            onSetVolunteerPassword={setVolunteerPassword}
            onSaveReviewerIds={saveReviewerIds}
            onUpdateOrder={updateOrder}
          />
        ) : myOrderPhase !== "none" ? (
          <MyOrderStatus
            order={myOrder}
            lineItems={myLineItems}
            phase={myOrderPhase}
            onScanCheckIn={() => setCheckInScanOpen(true)}
          />
        ) : reviewOpen ? (
          <OrderReviewPage
            requester={requester}
            checkedOutItems={checkedOutItems}
            email={submitEmail}
            setEmail={setSubmitEmail}
            notes={submitNotes}
            setNotes={setSubmitNotes}
            onOrderCreated={handleOrderCreated}
            onBack={() => setReviewOpen(false)}
          />
        ) : (
          <>
            <FindOrderForm onFind={handleFindOrder} />
            <RequesterForm requester={requester} setRequester={setRequester} />
            <SelectedItemsList items={checkedOutItems} onRemove={handleRemoveFromOrder} />
            <div style={{ position: "sticky", top: headerHeight, zIndex: 40, background: "#f4f5f7", paddingTop: 6 }}>
              <div style={S.toolbar}>
                <div style={S.searchWrap}>
                  <Icon.search />
                  <input style={S.searchInput} placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div style={S.catTabs}>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCat(c)}
                    style={{
                      ...S.catTab,
                      ...(activeCat === c ? S.catTabActive : {}),
                      ...(c !== "All" ? { borderBottom: `3px solid ${CAT_COLORS[c] || "#999"}` } : {}),
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.grid}>
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  selectedQty={selections[item.id] || 0}
                  onCheckOut={(qty) =>
                    setSelections((prev) => {
                      const current = prev[item.id] || 0;
                      // Never let repeated clicks push the total past what's
                      // actually on hand for this item.
                      const capped = Math.min(current + qty, item.total);
                      return { ...prev, [item.id]: capped };
                    })
                  }
                  onShowQr={() => setQrItem(item)}
                />
              ))}
              {filteredItems.length === 0 && <div style={S.emptyState}>No items match your search.</div>}
            </div>
            <NotesSection noteDraft={noteDraft} setNoteDraft={setNoteDraft} onSave={saveNote} flash={noteFlash} />
          </>
        )}
      </main>

      {tab === "inventory" && myOrderPhase === "none" && !reviewOpen && (
        <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {checkedOutItems.length > 0 && (
            <button style={S.secondaryBtn} onClick={() => setReviewOpen(true)}>
              Review &amp; Submit
            </button>
          )}
          <button style={S.fabSubmit} onClick={handleSaveDraft}>
            <Icon.bell />
            <span>Save</span>
            {checkedOutItems.length > 0 && <span style={S.fabBadge}>{checkedOutItems.length}</span>}
          </button>
        </div>
      )}

      {saveConfirm && (
        <Modal onClose={() => setSaveConfirm(null)} title="Saved">
          <div style={S.successBox}>
            <div style={S.successCheck}>
              <Icon.check size={28} />
            </div>
            <div style={S.successTitle}>Saved!</div>
            <div style={S.tinyMuted}>
              Your progress is safely saved. Come back anytime and use "Already submitted an order?" with{" "}
              {saveConfirm.phone ? <strong>{saveConfirm.phone}</strong> : "your phone number"} to pick up right
              where you left off.
            </div>
            <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={() => setSaveConfirm(null)}>
              Okay
            </button>
          </div>
        </Modal>
      )}

      {checkInScanOpen && myOrder && (
        <CheckInScanModal
          order={myOrder}
          lineItems={myLineItems}
          items={items}
          onResolveAction={(id, delta, note) => applyCheckChange(id, delta, requester.name, note)}
          onUpdateOrder={updateOrder}
          onClose={() => setCheckInScanOpen(false)}
        />
      )}
      {qrItem && <QrModal item={qrItem} onClose={() => setQrItem(null)} />}
    </div>
    </PullToRefresh>
  );
}

function SyncDot({ status }) {
  const color = status === "green" ? "#2ecc71" : status === "yellow" ? "#f1c40f" : "#e74c3c";
  const label = status === "green" ? "Synced" : status === "yellow" ? "Syncing…" : "Sync error";
  return (
    <div style={S.syncWrap} title={label}>
      <span style={{ ...S.syncDot, background: color }} />
    </div>
  );
}
