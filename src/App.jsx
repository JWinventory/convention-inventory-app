import React, { useEffect, useMemo, useRef, useState } from "react";
import { S, CAT_COLORS } from "./styles";
import { Icon } from "./components/Icon";
import { RequesterForm } from "./components/RequesterForm";
import { ItemCard } from "./components/ItemCard";
import { NotesSection } from "./components/NotesSection";
import { CheckInScanModal } from "./components/CheckInScanModal";
import { QrModal } from "./components/QrModal";
import { OrderReviewPage } from "./components/OrderReviewPage";
import { MyOrderStatus } from "./components/MyOrderStatus";
import { FindOrderForm } from "./components/FindOrderForm";
import { SelectedItemsList } from "./components/SelectedItemsList";
import { AdminHub } from "./components/AdminHub";
import { PullToRefresh } from "./components/PullToRefresh";
import { useInventory } from "./useInventory";
import { firebaseConfigured } from "./firebase";

const REQUESTER_KEY = "convention-inventory-requester";
const MY_ORDER_KEY = "convention-inventory-my-order-id";

function loadRequester() {
  try {
    const raw = localStorage.getItem(REQUESTER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return { name: "", phone: "", eventType: "", eventDate: "", pickupDate: "", returnDate: "" };
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
    const phoneDigits = (o.requesterPhone || "").replace(/\D/g, "");
    const email = (o.requesterEmail || "").toLowerCase();
    const phoneMatch = qDigits.length >= 7 && phoneDigits === qDigits;
    const emailMatch = q.includes("@") && email === q;
    return phoneMatch || emailMatch;
  });

  const active = matches.filter((o) => computeLineItems(o, items).some((li) => li.stillOut > 0));
  return active[0] || null;
}

export default function App() {
  const {
    items,
    orders,
    drafts,
    notes,
    volunteers,
    volunteersReady,
    reviewerId,
    syncStatus,
    seedIfEmpty,
    addItem,
    updateItem,
    deleteItem,
    applyCheckChange,
    addOrder,
    deleteDraft,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    saveNotes,
    addVolunteer,
    updateVolunteer,
    deleteVolunteer,
    resetVolunteerPassword,
    setVolunteerPassword,
    saveReviewerId,
  } = useInventory();

  const [tab, setTab] = useState("inventory"); // inventory | admin
  const [requester, setRequester] = useState(loadRequester);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [checkInScanOpen, setCheckInScanOpen] = useState(false);
  const [qrItem, setQrItem] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Purely local — the browsing screen is a static form. Nothing here
  // touches Firestore or is visible to anyone else until Submit; a new
  // visitor always starts with this empty, regardless of what anyone
  // else is doing elsewhere at the same time.
  const [selections, setSelections] = useState({}); // { [itemId]: qty }
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes);
  const [noteFlash, setNoteFlash] = useState(false);

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

  // Requester info is always editable — just keep it saved locally as it
  // changes, so it's remembered next time without needing an explicit
  // "Save" step that would otherwise lock the fields.
  useEffect(() => {
    localStorage.setItem(REQUESTER_KEY, JSON.stringify(requester));
  }, [requester]);

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

  // --- Phase 1-3 order tracking (this browser's own submitted order) ---
  const myOrder = useMemo(() => orders.find((o) => o.id === myOrderId) || null, [orders, myOrderId]);
  const myLineItems = useMemo(() => (myOrder ? computeLineItems(myOrder, items) : []), [myOrder, items]);
  const myOrderPhase = useMemo(() => {
    if (!myOrder) return "none";
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
    setSelections({}); // clear the static form now that it's been submitted

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

    const reviewerVolunteer = volunteers.find((v) => v.id === reviewerId);
    try {
      await fetch("/api/notify-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerEmail: reviewerVolunteer?.email || "",
          requester: { name: order.requester.name, phone: order.requester.phone },
          eventType: order.requester.eventType,
          eventDate: order.requester.eventDate,
          items: order.items,
        }),
      });
    } catch (err) {
      // Order is already saved even if the review-alert email fails to send.
    }
  }

  // Cross-device lookup: a requester who submitted on another device
  // can find their order here by phone or email, and pick it up on
  // this one too. (Only submitted orders — the browsing/picking screen
  // itself is a static, local-only form with nothing to look up until
  // Submit.)
  function handleFindOrder(query) {
    const found = findMyOrder(orders, items, query);
    if (!found) return false;

    localStorage.setItem(MY_ORDER_KEY, found.id);
    setMyOrderId(found.id);

    setRequester({
      name: found.requesterName || "",
      phone: found.requesterPhone || "",
      eventType: found.eventType || "",
      eventDate: found.eventDate || "",
      pickupDate: found.pickupDate || "",
      returnDate: found.returnDate || "",
    });

    return true;
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
  async function handleUpdateOrderItems(order, newItems) {
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

    await updateOrder(order.id, { items: newItems });
  }

  // Cancels an in-progress (not-yet-submitted) draft. Since items aren't
  // tied to a specific draft until it's actually submitted, this releases
  // everything currently checked out — the honest limitation being that if
  // more than one draft is somehow in progress at once, this clears both.
  async function handleCancelDraft(draft) {
    const requesterLabel = draft.requesterName || "this requester";
    if (
      !window.confirm(
        `Cancel this in-progress order for ${requesterLabel}? Everything checked out so far will be returned to available.`
      )
    ) {
      return;
    }
    for (const it of items) {
      if ((it.out || 0) > 0) {
        // eslint-disable-next-line no-await-in-loop
        await applyCheckChange(it.id, -(it.out || 0), "Draft cancelled", "In-progress order cancelled by staff");
      }
    }
    await deleteDraft(draft.id);
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
            onDeleteOrder={handleDeleteOrder}
            volunteers={volunteers}
            volunteersReady={volunteersReady}
            reviewerId={reviewerId}
            onAddVolunteer={addVolunteer}
            onUpdateVolunteer={updateVolunteer}
            onDeleteVolunteer={deleteVolunteer}
            onResetVolunteerPassword={resetVolunteerPassword}
            onSetVolunteerPassword={setVolunteerPassword}
            onSaveReviewerId={saveReviewerId}
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
                  onCheckOut={(qty) =>
                    setSelections((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + qty }))
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
        <button style={S.fabSubmit} onClick={() => setReviewOpen(true)}>
          <Icon.bell />
          <span>Save</span>
          {checkedOutItems.length > 0 && <span style={S.fabBadge}>{checkedOutItems.length}</span>}
        </button>
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