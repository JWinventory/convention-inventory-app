import React, { useEffect, useMemo, useState } from "react";
import { S, CAT_COLORS } from "./styles";
import { Icon } from "./components/Icon";
import { RequesterForm } from "./components/RequesterForm";
import { ItemCard } from "./components/ItemCard";
import { NotesSection } from "./components/NotesSection";
import { CheckInScanModal } from "./components/CheckInScanModal";
import { QrModal } from "./components/QrModal";
import { SubmitModal } from "./components/SubmitModal";
import { MyOrderStatus } from "./components/MyOrderStatus";
import { FindOrderForm } from "./components/FindOrderForm";
import { SelectedItemsList } from "./components/SelectedItemsList";
import { AdminHub } from "./components/AdminHub";
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
    return { ...li, stillOut, exists: Boolean(liveItem) };
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
    notes,
    volunteers,
    reviewerName,
    reviewerEmail,
    syncStatus,
    seedIfEmpty,
    addItem,
    updateItem,
    deleteItem,
    applyCheckChange,
    addOrder,
    updateOrderStatus,
    updateOrder,
    saveNotes,
    saveVolunteers,
    saveReviewerSettings,
  } = useInventory();

  const [tab, setTab] = useState("inventory"); // inventory | admin
  const [requester, setRequester] = useState(loadRequester);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [checkInScanOpen, setCheckInScanOpen] = useState(false);
  const [qrItem, setQrItem] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes);
  const [noteFlash, setNoteFlash] = useState(false);

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

  const checkedOutItems = useMemo(
    () => items.filter((it) => (it.out || 0) > 0),
    [items]
  );

  function saveNote() {
    saveNotes(noteDraft);
    setNoteFlash(true);
    setTimeout(() => setNoteFlash(false), 2000);
  }

  // Fully checks an item back in, taking it off the pending order —
  // used by the "Remove" button in the Your Order So Far list.
  function handleRemoveFromOrder(item) {
    applyCheckChange(item.id, -(item.out || 0), requester.name);
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
    }
  }, [myOrder, myOrderPhase]);

  // If the order finishes while the check-in scanner happens to still be
  // open for some reason, make sure it closes too.
  useEffect(() => {
    if (myOrderPhase !== "ready") setCheckInScanOpen(false);
  }, [myOrderPhase]);

  async function handleOrderCreated(order) {
    const id = await addOrder(order);
    if (id) {
      localStorage.setItem(MY_ORDER_KEY, id);
      setMyOrderId(id);
      try {
        await fetch("/api/notify-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewerEmail,
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
  }

  // Cross-device lookup: a requester who submitted on another device
  // can find their in-progress order here by phone or email, and pick
  // it up on this one too.
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
    <div style={S.page}>
      <header style={S.header}>
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
            addItem={addItem}
            updateItem={updateItem}
            deleteItem={deleteItem}
            seedIfEmpty={seedIfEmpty}
            syncStatus={syncStatus}
            onMarkReady={handleMarkOrderReady}
            volunteers={volunteers}
            reviewerName={reviewerName}
            reviewerEmail={reviewerEmail}
            onSaveVolunteers={saveVolunteers}
            onSaveReviewerSettings={saveReviewerSettings}
            onUpdateOrder={updateOrder}
          />
        ) : myOrderPhase !== "none" ? (
          <MyOrderStatus
            lineItems={myLineItems}
            phase={myOrderPhase}
            onScanCheckIn={() => setCheckInScanOpen(true)}
          />
        ) : (
          <>
            <FindOrderForm onFind={handleFindOrder} />
            <RequesterForm requester={requester} setRequester={setRequester} />
            <SelectedItemsList items={checkedOutItems} onRemove={handleRemoveFromOrder} />
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
            <div style={S.grid}>
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onCheckOut={(qty) => applyCheckChange(item.id, qty, requester.name)}
                  onShowQr={() => setQrItem(item)}
                />
              ))}
              {filteredItems.length === 0 && <div style={S.emptyState}>No items match your search.</div>}
            </div>
            <NotesSection noteDraft={noteDraft} setNoteDraft={setNoteDraft} onSave={saveNote} flash={noteFlash} />
          </>
        )}
      </main>

      {tab === "inventory" && myOrderPhase === "none" && (
        <button style={S.fabSubmit} onClick={() => setSubmitOpen(true)}>
          <Icon.bell />
          <span>Submit &amp; Notify</span>
          {checkedOutItems.length > 0 && <span style={S.fabBadge}>{checkedOutItems.length}</span>}
        </button>
      )}

      {checkInScanOpen && myOrder && (
        <CheckInScanModal
          lineItems={myLineItems}
          items={items}
          onResolveAction={(id, delta, note) => applyCheckChange(id, delta, requester.name, note)}
          onClose={() => setCheckInScanOpen(false)}
        />
      )}
      {qrItem && <QrModal item={qrItem} onClose={() => setQrItem(null)} />}
      {submitOpen && (
        <SubmitModal
          requester={requester}
          checkedOutItems={checkedOutItems}
          email={submitEmail}
          setEmail={setSubmitEmail}
          notes={submitNotes}
          setNotes={setSubmitNotes}
          onOrderCreated={handleOrderCreated}
          onClose={() => setSubmitOpen(false)}
        />
      )}
    </div>
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
