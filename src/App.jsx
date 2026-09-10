import React, { useEffect, useMemo, useState } from "react";
import { S, CAT_COLORS } from "./styles";
import { Icon } from "./components/Icon";
import { RequesterForm } from "./components/RequesterForm";
import { ItemCard } from "./components/ItemCard";
import { NotesSection } from "./components/NotesSection";
import { ScanModal } from "./components/ScanModal";
import { QrModal } from "./components/QrModal";
import { SubmitModal } from "./components/SubmitModal";
import { MyOrderStatus } from "./components/MyOrderStatus";
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
  return { name: "", phone: "", eventDate: "", pickupDate: "", returnDate: "" };
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

export default function App() {
  const {
    items,
    orders,
    notes,
    syncStatus,
    seedIfEmpty,
    addItem,
    updateItem,
    deleteItem,
    applyCheckChange,
    addOrder,
    updateOrderStatus,
    saveNotes,
  } = useInventory();

  const [tab, setTab] = useState("inventory"); // inventory | admin
  const [requester, setRequester] = useState(loadRequester);
  const [requesterLocked, setRequesterLocked] = useState(() => {
    const r = loadRequester();
    return Boolean(r.name && r.phone);
  });
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [scanOpen, setScanOpen] = useState(false);
  const [qrItem, setQrItem] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes);
  const [noteFlash, setNoteFlash] = useState(false);

  const [myOrderId, setMyOrderId] = useState(() => localStorage.getItem(MY_ORDER_KEY) || null);

  useEffect(() => setNoteDraft(notes), [notes]);

  function saveRequester() {
    setRequesterLocked(true);
    localStorage.setItem(REQUESTER_KEY, JSON.stringify(requester));
  }
  function editRequester() {
    setRequesterLocked(false);
  }

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
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!it.name.toLowerCase().includes(q) && !it.category.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, activeCat, search]);

  const checkedOutItems = useMemo(
    () => items.filter((it) => (it.out || 0) > 0),
    [items]
  );

  const canScan = requesterLocked && requester.name.trim() !== "" && requester.phone.trim() !== "";

  function saveNote() {
    saveNotes(noteDraft);
    setNoteFlash(true);
    setTimeout(() => setNoteFlash(false), 2000);
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

  async function handleOrderCreated(order) {
    const id = await addOrder(order);
    if (id) {
      localStorage.setItem(MY_ORDER_KEY, id);
      setMyOrderId(id);
    }
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
              <h1 style={S.h1}>Convention Inventory</h1>
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
            <h1 style={S.h1}>Convention Inventory</h1>
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
          />
        ) : myOrderPhase !== "none" ? (
          <MyOrderStatus lineItems={myLineItems} phase={myOrderPhase} onScanCheckIn={() => setScanOpen(true)} />
        ) : (
          <>
            <RequesterForm
              requester={requester}
              setRequester={setRequester}
              locked={requesterLocked}
              onSave={saveRequester}
              onEdit={editRequester}
            />
            <div style={S.scanRow}>
              <button
                style={{ ...S.scanBtn, ...(canScan ? {} : S.scanBtnDisabled) }}
                disabled={!canScan}
                onClick={() => setScanOpen(true)}
              >
                <Icon.camera />&nbsp;Scan QR
              </button>
              <div style={S.scanHint}>
                {canScan ? "Tap to check items in or out" : "Save your request details above to enable scanning"}
              </div>
            </div>
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
                  onCheckIn={(qty) => applyCheckChange(item.id, -qty, requester.name)}
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

      {scanOpen && (
        <ScanModal
          items={items}
          itemState={Object.fromEntries(items.map((i) => [i.id, { out: i.out || 0 }]))}
          onResolveAction={(id, delta) => applyCheckChange(id, delta, requester.name)}
          onClose={() => setScanOpen(false)}
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
