import React, { useEffect, useState } from "react";
import { S } from "../styles";
import { AdminPage } from "./AdminPage";
import { OrdersPage } from "./OrdersPage";
import { OrderHistoryPage } from "./OrderHistoryPage";
import { QrCodesPage } from "./QrCodesPage";
import { EmergencyChecklistPage } from "./EmergencyChecklistPage";
import { VolunteersPage } from "./VolunteersPage";
import { ReturnReviewPage } from "./ReturnReviewPage";
import { BreakFixPage } from "./BreakFixPage";

const SESSION_KEY = "volunteerSessionId";

// Replaces the old single shared password with real per-volunteer
// logins. The very first volunteer ever created becomes a full admin
// automatically (so there's never a moment with zero admins), and any
// volunteer without a password yet is walked through creating one the
// first time they try to log in.
export function AdminHub({
  items,
  orders,
  drafts,
  headerHeight,
  addItem,
  updateItem,
  deleteItem,
  seedIfEmpty,
  syncStatus,
  onMarkReady,
  onAssignFillers,
  onResendFillerNotice,
  onResendReadyEmail,
  onResendSubmittedEmail,
  onCancelOrder,
  onUpdateOrderItems,
  onCancelDraft,
  onUpdateDraftItems,
  onDeleteOrder,
  onReactivateOrder,
  volunteers,
  volunteersReady,
  breakfixItems,
  reviewerIds,
  onAddVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
  onResetVolunteerPassword,
  onSetVolunteerPassword,
  onSaveReviewerIds,
  onUpdateOrder,
  onAssignActionItem,
  onAddBreakfixProject,
  onUpdateBreakfixProject,
  onAssignBreakfixProject,
  resetToken,
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

  // A valid reset link takes priority over everything else, including
  // an existing session — that's the whole point of it: getting back
  // in without needing to already be logged in.
  if (resetToken) {
    return (
      <ResetPasswordScreen
        resetToken={resetToken}
        volunteers={volunteers}
        onUpdateVolunteer={onUpdateVolunteer}
        onLoggedIn={handleLoggedIn}
      />
    );
  }

  if (!currentVolunteer) {
    if (volunteers.length === 0) {
      return <FirstTimeSetup onAddVolunteer={onAddVolunteer} onSetVolunteerPassword={onSetVolunteerPassword} onLoggedIn={handleLoggedIn} />;
    }
    return (
      <LoginForm
        volunteers={volunteers}
        onUpdateVolunteer={onUpdateVolunteer}
        onSetVolunteerPassword={onSetVolunteerPassword}
        onLoggedIn={handleLoggedIn}
      />
    );
  }

  const SECTIONS = [];
  if (currentVolunteer.permissions?.catalog) SECTIONS.push({ key: "catalog", label: "Catalog" });
  if (currentVolunteer.permissions?.orders) SECTIONS.push({ key: "orders", label: "Orders" });
  if (currentVolunteer.permissions?.orders) SECTIONS.push({ key: "returns", label: "Returns" });
  if (currentVolunteer.permissions?.orders) SECTIONS.push({ key: "breakfix", label: "Break/Fix & Projects" });
  SECTIONS.push({ key: "history", label: "History" });
  SECTIONS.push({ key: "qrcodes", label: "QR Codes" });
  SECTIONS.push({ key: "emergency", label: "Print Lists" });
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
          headerHeight={headerHeight}
        />
      )}
      {activeSection === "orders" && (
        <OrdersPage
          orders={orders}
          drafts={drafts}
          items={items}
          onMarkReady={onMarkReady}
          onAssignFillers={onAssignFillers}
          onResendFillerNotice={onResendFillerNotice}
          onResendReadyEmail={onResendReadyEmail}
          onResendSubmittedEmail={onResendSubmittedEmail}
          onCancelOrder={onCancelOrder}
          onUpdateOrderItems={onUpdateOrderItems}
          onCancelDraft={onCancelDraft}
          onUpdateDraftItems={onUpdateDraftItems}
          volunteers={volunteers}
          reviewerIds={reviewerIds}
          currentVolunteerName={currentVolunteer.name}
          isCurrentVolunteerAdmin={Boolean(currentVolunteer.permissions?.volunteers)}
          onUpdateOrder={onUpdateOrder}
        />
      )}
      {activeSection === "returns" && (
        <ReturnReviewPage
          orders={orders}
          items={items}
          volunteers={volunteers}
          reviewerIds={reviewerIds}
          currentVolunteerName={currentVolunteer.name}
          isCurrentVolunteerAdmin={Boolean(currentVolunteer.permissions?.volunteers)}
          onUpdateOrder={onUpdateOrder}
          onAssignActionItem={onAssignActionItem}
        />
      )}
      {activeSection === "breakfix" && (
        <BreakFixPage
          orders={orders}
          breakfixItems={breakfixItems}
          volunteers={volunteers}
          reviewerIds={reviewerIds}
          currentVolunteerName={currentVolunteer.name}
          isCurrentVolunteerAdmin={Boolean(currentVolunteer.permissions?.volunteers)}
          onUpdateOrder={onUpdateOrder}
          onAssignActionItem={onAssignActionItem}
          onAddBreakfixProject={onAddBreakfixProject}
          onUpdateBreakfixProject={onUpdateBreakfixProject}
          onAssignBreakfixProject={onAssignBreakfixProject}
        />
      )}
      {activeSection === "history" && (
        <OrderHistoryPage
          orders={orders}
          items={items}
          volunteers={volunteers}
          reviewerIds={reviewerIds}
          currentVolunteerName={currentVolunteer.name}
          isCurrentVolunteerAdmin={Boolean(currentVolunteer.permissions?.volunteers)}
          onDeleteOrder={onDeleteOrder}
          onReactivateOrder={onReactivateOrder}
        />
      )}
      {activeSection === "qrcodes" && <QrCodesPage items={items} updateItem={updateItem} />}
      {activeSection === "emergency" && <EmergencyChecklistPage items={items} orders={orders} />}
      {activeSection === "volunteers" && (
        <VolunteersPage
          volunteers={volunteers}
          reviewerIds={reviewerIds}
          onAddVolunteer={onAddVolunteer}
          onUpdateVolunteer={onUpdateVolunteer}
          onDeleteVolunteer={onDeleteVolunteer}
          onResetVolunteerPassword={onResetVolunteerPassword}
          onSaveReviewerIds={onSaveReviewerIds}
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

// Volunteer names are stored as one free-text "name" field (no
// separate first/last), so "last name" just means the last
// whitespace-separated word — good enough for sorting a dropdown and
// avoids needing a schema change.
function lastNameOf(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

function sortByLastName(list) {
  return [...list].sort((a, b) =>
    lastNameOf(a.name).localeCompare(lastNameOf(b.name), undefined, { sensitivity: "base" })
  );
}

// Generates the 6-digit code emailed for the second login step. Not
// stored anywhere in plaintext — only its hash ever reaches Firestore
// (see sendLoginCode below), the same way a real password is handled,
// so reading the volunteers collection directly can't hand someone a
// working code.
function makeLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// "Remember this device" for 2FA: skips the emailed code (not the
// password) on a device that already proved itself once, for 30 days.
// The actual secret — a random per-device token — lives only in this
// browser's localStorage and is never sent to Firestore; only its hash
// (plus an expiry) is saved on the volunteer's own record, in the
// trustedDevices array, the same hash-only treatment already used for
// passwords and login codes. A volunteer can carry a few of these at
// once (different devices), so old/expired ones are pruned whenever a
// new one is added rather than letting the list grow forever.
const TRUSTED_DEVICE_DAYS = 30;
const MAX_TRUSTED_DEVICES = 8;
const TRUSTED_DEVICE_KEY_PREFIX = "convention-inventory-trusted-device-";

function getStoredDeviceToken(volunteerId) {
  try {
    return localStorage.getItem(TRUSTED_DEVICE_KEY_PREFIX + volunteerId);
  } catch {
    return null;
  }
}

function setStoredDeviceToken(volunteerId, token) {
  try {
    localStorage.setItem(TRUSTED_DEVICE_KEY_PREFIX + volunteerId, token);
  } catch {
    // Storage might be unavailable (private browsing, etc.) — the
    // device just won't be remembered next time; nothing else breaks.
  }
}

function makeDeviceToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Checks this browser's stored token (if any) against the volunteer's
// saved trusted-device hashes. Expired entries are skipped (and swept
// out for good the next time a device is remembered).
async function isDeviceTrusted(volunteer) {
  const token = getStoredDeviceToken(volunteer.id);
  if (!token) return false;
  const entries = Array.isArray(volunteer.trustedDevices) ? volunteer.trustedDevices : [];
  const now = Date.now();
  for (const entry of entries) {
    if (!entry || !entry.expiresAtMs || entry.expiresAtMs < now) continue;
    try {
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token, hash: entry.hash, salt: entry.salt }),
      });
      const data = await res.json();
      if (data.ok) return true;
    } catch {
      // Network hiccup — fall through to asking for a code instead of
      // silently failing the login.
    }
  }
  return false;
}

// Remembers this device for the given volunteer: mints a fresh token,
// hashes it, saves the hash (with a 30-day expiry) onto the
// volunteer's record alongside any of their other still-valid trusted
// devices, and keeps the plaintext token only in this browser.
// Non-fatal if any of this fails — the device just won't be
// remembered, the login itself has already succeeded.
async function rememberThisDevice(volunteer, onUpdateVolunteer) {
  try {
    const token = makeDeviceToken();
    const hashRes = await fetch("/api/hash-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: token }),
    });
    const hashData = await hashRes.json();
    if (!hashRes.ok) return;
    const now = Date.now();
    const existing = Array.isArray(volunteer.trustedDevices) ? volunteer.trustedDevices : [];
    const stillValid = existing.filter((e) => e && e.expiresAtMs && e.expiresAtMs > now);
    const next = [
      ...stillValid.slice(-(MAX_TRUSTED_DEVICES - 1)),
      { hash: hashData.hash, salt: hashData.salt, expiresAtMs: now + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000 },
    ];
    await onUpdateVolunteer(volunteer.id, { trustedDevices: next });
    setStoredDeviceToken(volunteer.id, token);
  } catch {
    // See comment above — not remembering the device is the only
    // consequence of a failure here.
  }
}

function LoginForm({ volunteers, onUpdateVolunteer, onSetVolunteerPassword, onLoggedIn }) {
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeAttempts, setCodeAttempts] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  const selected = volunteers.find((v) => v.id === selectedId) || null;
  const needsNewPassword = selected && !selected.passwordHash;

  // Second factor: generates a fresh 6-digit code, saves only its hash
  // (plus a 10-minute expiry) on the volunteer's own record, and
  // emails the plaintext code — the email inbox is the actual secret,
  // not anything sitting in the database.
  async function sendLoginCode(volunteer) {
    const plainCode = makeLoginCode();
    const hashRes = await fetch("/api/hash-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: plainCode }),
    });
    const hashData = await hashRes.json();
    if (!hashRes.ok) {
      throw new Error(hashData.error || "Couldn't generate a login code.");
    }
    await onUpdateVolunteer(volunteer.id, {
      loginCodeHash: hashData.hash,
      loginCodeSalt: hashData.salt,
      loginCodeExpiresAtMs: Date.now() + 10 * 60 * 1000,
    });
    if (!volunteer.email) {
      throw new Error("no-email");
    }
    const res = await fetch("/api/notify-login-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerEmail: volunteer.email, volunteerName: volunteer.name, code: plainCode }),
    });
    if (!res.ok) {
      console.error("notify-login-code failed:", res.status, await res.text());
      throw new Error("Couldn't send your login code — check your connection and try again.");
    }
  }

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
        // Brand-new password, so there's no way this device could
        // already be trusted — straight to the code step.
        await sendLoginCode(selected);
        setCodeStep(true);
      } catch (err) {
        setError(
          err?.message === "no-email"
            ? "Your password is set, but there's no email on file to send a login code to — ask an admin to add one."
            : err?.message || "Something went wrong setting up your password."
        );
      } finally {
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
      if (!data.ok) {
        setError("Incorrect password.");
        setBusy(false);
        return;
      }
      // Password's good — if this device already proved itself within
      // the last 30 days, skip the emailed code and log straight in.
      if (await isDeviceTrusted(selected)) {
        onLoggedIn(selected.id);
        return;
      }
      await sendLoginCode(selected);
      setCodeStep(true);
    } catch (err) {
      setError(
        err?.message === "no-email"
          ? "That password is correct, but there's no email on file to send a login code to — ask an admin to add one."
          : err?.message || "Couldn't verify password — check your connection."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    if (!selected || code.trim().length !== 6) return;
    setCodeError("");
    setVerifying(true);
    try {
      if (!selected.loginCodeExpiresAtMs || Date.now() > selected.loginCodeExpiresAtMs) {
        setCodeError("That code has expired — send a new one.");
        setVerifying(false);
        return;
      }
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code.trim(), hash: selected.loginCodeHash, salt: selected.loginCodeSalt }),
      });
      const data = await res.json();
      if (data.ok) {
        await onUpdateVolunteer(selected.id, { loginCodeHash: null, loginCodeSalt: null, loginCodeExpiresAtMs: null });
        if (rememberDevice) {
          await rememberThisDevice(selected, onUpdateVolunteer);
        }
        onLoggedIn(selected.id);
        return;
      }
      const attempts = codeAttempts + 1;
      setCodeAttempts(attempts);
      setCode("");
      setCodeError(
        attempts >= 5 ? "Too many wrong tries — send a new code." : "That code isn't right — double check and try again."
      );
    } catch (err) {
      setCodeError("Couldn't verify that code — check your connection.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendCode() {
    if (!selected) return;
    setResending(true);
    setCodeError("");
    try {
      await sendLoginCode(selected);
      setCode("");
      setCodeAttempts(0);
      setCodeError("A new code is on its way.");
    } catch (err) {
      setCodeError(err?.message || "Couldn't send a new code — check your connection.");
    } finally {
      setResending(false);
    }
  }

  function handleUseDifferentAccount() {
    setCodeStep(false);
    setCode("");
    setCodeError("");
    setCodeAttempts(0);
    setPassword("");
    setConfirm("");
    setRememberDevice(true);
  }

  if (forgotOpen) {
    return (
      <ForgotPasswordForm
        volunteers={volunteers}
        onUpdateVolunteer={onUpdateVolunteer}
        onBack={() => setForgotOpen(false)}
      />
    );
  }

  if (codeStep && selected) {
    const tooManyAttempts = codeAttempts >= 5;
    return (
      <div style={S.card}>
        <h2 style={S.cardTitle}>Check Your Email</h2>
        <p style={S.tinyMuted}>
          We sent a 6-digit code to {selected.email || "your email"}. Enter it below to finish logging in —
          it's good for 10 minutes.
        </p>
        <form onSubmit={handleVerifyCode}>
          <label style={S.fieldLabel}>
            Login Code
            <input
              style={{ ...S.fieldInput, letterSpacing: 4, fontSize: 18, textAlign: "center" }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              disabled={tooManyAttempts}
            />
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, fontSize: 12.5, color: "#1a1a2e" }}>
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              Remember this device for 30 days, so I don't get asked for a code again here.
              <br />
              <span style={S.tinyMuted}>Leave this unchecked on a shared or public computer.</span>
            </span>
          </label>
          {codeError && <div style={S.errorText}>{codeError}</div>}
          <button
            style={S.primaryBtn}
            type="submit"
            disabled={code.trim().length !== 6 || verifying || tooManyAttempts}
          >
            {verifying ? "Verifying…" : "Verify & Log In"}
          </button>
        </form>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <button style={forgotLinkStyle} disabled={resending} onClick={handleResendCode}>
            {resending ? "Sending…" : "Resend Code"}
          </button>
          <button style={forgotLinkStyle} onClick={handleUseDifferentAccount}>
            Use a Different Account
          </button>
        </div>
      </div>
    );
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
            {sortByLastName(volunteers).map((v) => (
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
      {!needsNewPassword && (
        <button style={forgotLinkStyle} onClick={() => setForgotOpen(true)}>
          Forgot your password? Click here to reset
        </button>
      )}
    </div>
  );
}

// Step 1 of self-service reset: look up the account by email (not by
// the name dropdown — someone who's locked out may not remember which
// entry is theirs, but they know their own email) and, if it matches,
// email a one-time link that's good for an hour. The same confirmation
// message shows either way, so this can't be used to probe which
// emails have an account.
function ForgotPasswordForm({ volunteers, onUpdateVolunteer, onBack }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function makeToken() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const match = volunteers.find((v) => (v.email || "").trim().toLowerCase() === trimmed);
      if (match && match.email) {
        const resetToken = makeToken();
        const resetTokenExpiresAtMs = Date.now() + 60 * 60 * 1000; // 1 hour
        await onUpdateVolunteer(match.id, { resetToken, resetTokenExpiresAtMs });
        const resetLink = `${window.location.origin}${window.location.pathname}?resetToken=${resetToken}`;
        const res = await fetch("/api/notify-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volunteerEmail: match.email, volunteerName: match.name, resetLink }),
        });
        if (!res.ok) {
          console.error("notify-password-reset failed:", res.status, await res.text());
        }
      }
      // Same confirmation whether or not a match was found.
      setSent(true);
    } catch (err) {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div style={S.card}>
        <h2 style={S.cardTitle}>Check Your Email</h2>
        <p style={S.tinyMuted}>
          If that email matches an account, a reset link is on its way — it's good for one hour. Follow it
          to set a new password.
        </p>
        <button style={S.secondaryBtn} onClick={onBack}>
          Back to Log In
        </button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Reset Your Password</h2>
      <p style={S.tinyMuted}>Enter the email on file for your account — we'll send a link to reset your password.</p>
      <form onSubmit={handleSubmit}>
        <label style={S.fieldLabel}>
          Email
          <input
            style={S.fieldInput}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </label>
        {error && <div style={S.errorText}>{error}</div>}
        <button style={S.primaryBtn} type="submit" disabled={!email.trim() || busy}>
          {busy ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
      <button style={forgotLinkStyle} onClick={onBack}>
        Back to Log In
      </button>
    </div>
  );
}

// Step 2: landed here from the emailed link (?resetToken=...). Looks
// up whichever volunteer currently holds that exact token and hasn't
// let it expire, then lets them set a brand new password — no need to
// already be logged in, since being locked out is the whole reason
// they're here. Signs them straight in once it's set.
function ResetPasswordScreen({ resetToken, volunteers, onUpdateVolunteer, onLoggedIn }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const match = volunteers.find(
    (v) => v.resetToken && v.resetToken === resetToken && (v.resetTokenExpiresAtMs || 0) > Date.now()
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!match) return;
    if (password.length < 4 || password !== confirm) {
      setError("Passwords must match and be at least 4 characters.");
      return;
    }
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
        setError(hashData.error || "Couldn't set your new password.");
        setBusy(false);
        return;
      }
      await onUpdateVolunteer(match.id, {
        passwordHash: hashData.hash,
        passwordSalt: hashData.salt,
        resetToken: null,
        resetTokenExpiresAtMs: null,
      });
      onLoggedIn(match.id);
    } catch (err) {
      setError("Something went wrong setting your new password.");
      setBusy(false);
    }
  }

  if (!match) {
    return (
      <div style={S.card}>
        <h2 style={S.cardTitle}>Reset Link Expired</h2>
        <p style={S.tinyMuted}>
          This link is no longer valid — it may have already been used, or more than an hour has passed.
          Go back and request a new one, or ask an admin to reset your password from the Volunteers tab.
        </p>
        <button style={S.primaryBtn} onClick={() => window.location.replace(window.location.pathname)}>
          Back to Log In
        </button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Set a New Password, {match.name}</h2>
      <form onSubmit={handleSubmit}>
        <label style={S.fieldLabel}>
          New Password
          <input style={S.fieldInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label style={S.fieldLabel}>
          Confirm Password
          <input style={S.fieldInput} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div style={S.errorText}>{error}</div>}
        <button style={S.primaryBtn} type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save Password & Log In"}
        </button>
      </form>
    </div>
  );
}

const forgotLinkStyle = {
  display: "block",
  background: "none",
  border: "none",
  color: "#0072CE",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  marginTop: 12,
};

const loggedInBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  color: "#888",
  marginBottom: 10,
};
