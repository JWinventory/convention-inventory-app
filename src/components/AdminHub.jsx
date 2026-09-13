import React, { useEffect, useState } from "react";
import { S } from "../styles";
import { AdminPage } from "./AdminPage";
import { OrdersPage } from "./OrdersPage";
import { OrderHistoryPage } from "./OrderHistoryPage";
import { QrCodesPage } from "./QrCodesPage";
import { EmergencyChecklistPage } from "./EmergencyChecklistPage";
import { VolunteersPage } from "./VolunteersPage";

const SESSION_KEY = "volunteerSessionId";

// Replaces the old single shared password with real per-volunteer
// logins. The very first volunteer ever created becomes a full admin
// automatically (so there's never a moment with zero admins), and any
// volunteer without a password yet is walked through creating one the
// first time they try to log in.
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
  volunteersReady,
  reviewerId,
  onAddVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
  onResetVolunteerPassword,
  onSetVolunteerPassword,
  onSaveReviewerId,
  onUpdateOrder,
}) {
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [section, setSection] = useState(null);

  const currentVolunteer = volunteers.find((v) => v.id === sessionId) || null;

  // If the logged-in volunteer was deleted (or the session is stale),
  // drop back to the login screen automatically.
  useEffect(() => {
    if (volunteersReady && sessionId && !currentVolunteer) {
      sessionStorage.removeItem(SESSION_KEY);
      setSessionId(null);
    }
  }, [volunteersReady, sessionId, currentVolunteer]);

  function handleLoggedIn(volunteerId) {
    sessionStorage.setItem(SESSION_KEY, volunteerId);
    setSessionId(volunteerId);
    setSection(null);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionId(null);
  }

  if (!volunteersReady) {
    return (
      <div style={S.card}>
        <p style={S.tinyMuted}>Loading…</p>
      </div>
    );
  }

  if (!currentVolunteer) {
    if (volunteers.length === 0) {
      return <FirstTimeSetup onAddVolunteer={onAddVolunteer} onSetVolunteerPassword={onSetVolunteerPassword} onLoggedIn={handleLoggedIn} />;
    }
    return (
      <LoginForm
        volunteers={volunteers}
        onSetVolunteerPassword={onSetVolunteerPassword}
        onLoggedIn={handleLoggedIn}
      />
    );
  }

  const SECTIONS = [];
  if (currentVolunteer.permissions?.catalog) SECTIONS.push({ key: "catalog", label: "Catalog" });
  if (currentVolunteer.permissions?.orders) SECTIONS.push({ key: "orders", label: "Orders" });
  SECTIONS.push({ key: "history", label: "History" });
  SECTIONS.push({ key: "qrcodes", label: "QR Codes" });
  SECTIONS.push({ key: "emergency", label: "Emergency" });
  if (currentVolunteer.permissions?.volunteers) SECTIONS.push({ key: "volunteers", label: "Volunteers" });

  const activeSection = SECTIONS.some((s) => s.key === section) ? section : SECTIONS[0]?.key;

  return (
    <div>
      <div style={loggedInBarStyle}>
        <span>Logged in as {currentVolunteer.name}</span>
        <button style={S.editBtn} onClick={handleLogout}>
          Log Out
        </button>
      </div>

      <div style={S.catTabs}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            style={{ ...S.catTab, ...(activeSection === s.key ? S.catTabActive : {}) }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "catalog" && (
        <AdminPage
          items={items}
          addItem={addItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
          seedIfEmpty={seedIfEmpty}
          syncStatus={syncStatus}
        />
      )}
      {activeSection === "orders" && (
        <OrdersPage
          orders={orders}
          items={items}
          onMarkReady={onMarkReady}
          volunteers={volunteers}
          reviewerId={reviewerId}
          currentVolunteerName={currentVolunteer.name}
          onUpdateOrder={onUpdateOrder}
        />
      )}
      {activeSection === "history" && <OrderHistoryPage orders={orders} items={items} />}
      {activeSection === "qrcodes" && <QrCodesPage items={items} updateItem={updateItem} />}
      {activeSection === "emergency" && <EmergencyChecklistPage items={items} />}
      {activeSection === "volunteers" && (
        <VolunteersPage
          volunteers={volunteers}
          reviewerId={reviewerId}
          onAddVolunteer={onAddVolunteer}
          onUpdateVolunteer={onUpdateVolunteer}
          onDeleteVolunteer={onDeleteVolunteer}
          onResetVolunteerPassword={onResetVolunteerPassword}
          onSaveReviewerId={onSaveReviewerId}
        />
      )}
    </div>
  );
}

// Shown only when the volunteer roster is completely empty — the very
// first person to open Admin sets themselves up as the initial admin
// with every permission, so the app is never in a locked-out state.
function FirstTimeSetup({ onAddVolunteer, onSetVolunteerPassword, onLoggedIn }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const complete = name.trim() && password.length >= 4 && password === confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!complete) return;
    setBusy(true);
    setError("");
    try {
      const hashRes = await fetch("/api/hash-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const hashData = await hashRes.json();
      if (!hashRes.ok) {
        setError(hashData.error || "Couldn't set up your password.");
        setBusy(false);
        return;
      }
      const id = await onAddVolunteer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        permissions: { catalog: true, orders: true, volunteers: true },
      });
      if (!id) {
        setError("Couldn't create your account — check your connection and try again.");
        setBusy(false);
        return;
      }
      await onSetVolunteerPassword(id, hashData.hash, hashData.salt);
      onLoggedIn(id);
    } catch (err) {
      setError("Something went wrong setting up your account.");
      setBusy(false);
    }
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Welcome — Set Up the First Admin Account</h2>
      <p style={S.tinyMuted}>
        No volunteers have been added yet. Set yourself up here first — you'll get full access to manage
        the catalog, orders, and other volunteers.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={S.fieldLabel}>
          Your Name
          <input style={S.fieldInput} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Phone
          <input style={S.fieldInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Email
          <input style={S.fieldInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Choose a Password
          <input style={S.fieldInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Confirm Password
          <input style={S.fieldInput} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div style={S.errorText}>{error}</div>}
        <button style={S.primaryBtn} type="submit" disabled={!complete || busy}>
          {busy ? "Setting Up…" : "Create Admin Account & Log In"}
        </button>
      </form>
    </div>
  );
}

function LoginForm({ volunteers, onSetVolunteerPassword, onLoggedIn }) {
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = volunteers.find((v) => v.id === selectedId) || null;
  const needsNewPassword = selected && !selected.passwordHash;

  async function handleLogin(e) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setBusy(true);

    if (needsNewPassword) {
      if (password.length < 4 || password !== confirm) {
        setError("Passwords must match and be at least 4 characters.");
        setBusy(false);
        return;
      }
      try {
        const hashRes = await fetch("/api/hash-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const hashData = await hashRes.json();
        if (!hashRes.ok) {
          setError(hashData.error || "Couldn't set up your password.");
          setBusy(false);
          return;
        }
        await onSetVolunteerPassword(selected.id, hashData.hash, hashData.salt);
        onLoggedIn(selected.id);
      } catch (err) {
        setError("Something went wrong setting up your password.");
        setBusy(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, hash: selected.passwordHash, salt: selected.passwordSalt }),
      });
      const data = await res.json();
      if (data.ok) {
        onLoggedIn(selected.id);
      } else {
        setError("Incorrect password.");
        setBusy(false);
      }
    } catch (err) {
      setError("Couldn't verify password — check your connection.");
      setBusy(false);
    }
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Admin Log In</h2>
      <form onSubmit={handleLogin}>
        <label style={S.fieldLabel}>
          Your Name
          <select
            style={S.fieldInput}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setPassword("");
              setConfirm("");
              setError("");
            }}
          >
            <option value="">Select…</option>
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        {selected && needsNewPassword && (
          <p style={S.tinyMuted}>You haven't set a password yet — create one now to log in.</p>
        )}

        {selected && (
          <>
            <label style={S.fieldLabel}>
              {needsNewPassword ? "Create a Password" : "Password"}
              <input style={S.fieldInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {needsNewPassword && (
              <label style={S.fieldLabel}>
                Confirm Password
                <input style={S.fieldInput} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            )}
          </>
        )}

        {error && <div style={S.errorText}>{error}</div>}
        <button style={S.primaryBtn} type="submit" disabled={!selected || busy}>
          {busy ? "Please wait…" : needsNewPassword ? "Create Password & Log In" : "Log In"}
        </button>
      </form>
    </div>
  );
}

const loggedInBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  color: "#888",
  marginBottom: 10,
};
