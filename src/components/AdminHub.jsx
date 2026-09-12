import React, { useState } from "react";
import { S } from "../styles";
import { AdminPage } from "./AdminPage";
import { OrdersPage } from "./OrdersPage";
import { OrderHistoryPage } from "./OrderHistoryPage";
import { QrCodesPage } from "./QrCodesPage";
import { EmergencyChecklistPage } from "./EmergencyChecklistPage";

// Wraps the Admin section: one password gate, then a submenu that
// switches between the catalog manager, Orders, History, QR Codes,
// and the Emergency checklist — all under the same "Admin" tab.
export function AdminHub({
  items,
  orders,
  addItem,
  updateItem,
  deleteItem,
  seedIfEmpty,
  syncStatus,
  onMarkReady,
  volunteers,
  reviewerName,
  reviewerEmail,
  onSaveVolunteers,
  onSaveReviewerSettings,
  onUpdateOrder,
}) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("adminUnlocked") === "1");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [checking, setChecking] = useState(false);
  const [section, setSection] = useState("catalog"); // catalog | orders | history | qrcodes | emergency

  async function handleUnlock(e) {
    e.preventDefault();
    if (!pw) return;
    setChecking(true);
    setPwError("");
    try {
      const res = await fetch("/api/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("adminUnlocked", "1");
        setUnlocked(true);
      } else {
        setPwError("Incorrect password.");
      }
    } catch (err) {
      setPwError("Couldn't verify password — check your connection.");
    } finally {
      setChecking(false);
      setPw("");
    }
  }

  if (!unlocked) {
    return (
      <div style={S.card}>
        <h2 style={S.cardTitle}>Admin Access</h2>
        <p style={S.tinyMuted}>Enter the admin password to manage the catalog.</p>
        <form onSubmit={handleUnlock}>
          <label style={S.fieldLabel}>
            Password
            <input
              style={S.fieldInput}
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
            />
          </label>
          {pwError && <div style={S.errorText}>{pwError}</div>}
          <button style={S.primaryBtn} type="submit" disabled={checking || !pw}>
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  const SECTIONS = [
    { key: "catalog", label: "Catalog" },
    { key: "orders", label: "Orders" },
    { key: "history", label: "History" },
    { key: "qrcodes", label: "QR Codes" },
    { key: "emergency", label: "Emergency" },
  ];

  return (
    <div>
      <div style={S.catTabs}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            style={{ ...S.catTab, ...(section === s.key ? S.catTabActive : {}) }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "catalog" && (
        <AdminPage
          items={items}
          addItem={addItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
          seedIfEmpty={seedIfEmpty}
          syncStatus={syncStatus}
        />
      )}
      {section === "orders" && (
        <OrdersPage
          orders={orders}
          items={items}
          onMarkReady={onMarkReady}
          volunteers={volunteers}
          reviewerName={reviewerName}
          reviewerEmail={reviewerEmail}
          onSaveVolunteers={onSaveVolunteers}
          onSaveReviewerSettings={onSaveReviewerSettings}
          onUpdateOrder={onUpdateOrder}
        />
      )}
      {section === "history" && <OrderHistoryPage orders={orders} items={items} />}
      {section === "qrcodes" && <QrCodesPage items={items} />}
      {section === "emergency" && <EmergencyChecklistPage items={items} />}
    </div>
  );
}
