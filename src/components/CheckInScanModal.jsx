import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { S } from "../styles";

const SCANNER_ID = "checkin-camera-region";
const PENDING_TIMEOUT_MS = 1200; // how long a detected code stays "in focus" without a fresh sighting

// A check-in scanner for Phase 3: point the camera at an item's QR code,
// and once it's in focus, tap Capture to check it in. A live summary up
// top shows how many of the total units are checked in and which
// specific items are still outstanding, so it's obvious at a glance
// what's left to collect rather than needing to scan the whole list. A
// "Missing QR Code?" option lets an item be checked in manually when
// its code is damaged or missing, but requires a short note before
// it'll proceed. Once everything's checked in, the camera stops and a
// completion screen takes over until the requester chooses to leave.
export function CheckInScanModal({ lineItems, items, onResolveAction, onClose }) {
  const [flash, setFlash] = useState(null); // { text, tone: "ok" | "error" } | null
  const [pendingScan, setPendingScan] = useState(null); // { code, name } | null — currently in focus, awaiting capture
  const [capturing, setCapturing] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingItemName, setMissingItemName] = useState("");
  const [missingNote, setMissingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const lineItemsRef = useRef(lineItems);
  const itemsRef = useRef(items);
  const onResolveActionRef = useRef(onResolveAction);
  const lastCapturedRef = useRef({ code: null, at: 0 });
  const pendingLastSeenRef = useRef(0);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    lineItemsRef.current = lineItems;
    itemsRef.current = items;
    onResolveActionRef.current = onResolveAction;
  }, [lineItems, items, onResolveAction]);

  const remaining = lineItems.filter((li) => li.stillOut > 0);
  const allDone = lineItems.length > 0 && remaining.length === 0;
  const totalUnits = lineItems.reduce((sum, li) => sum + li.qty, 0);
  const checkedInUnits = totalUnits - remaining.reduce((sum, li) => sum + li.stillOut, 0);

  // A detected code stops counting as "in focus" if it hasn't been seen
  // again in the last PENDING_TIMEOUT_MS — covers the case where it's
  // moved out of frame without a distinct "lost tracking" event from
  // the scanner library to tell us so directly.
  useEffect(() => {
    if (!pendingScan) return;
    const interval = setInterval(() => {
      if (Date.now() - pendingLastSeenRef.current > PENDING_TIMEOUT_MS) {
        setPendingScan(null);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [pendingScan]);

  // Fully stops and tears down the camera before returning. Pulls the
  // instance out of the ref FIRST so it's safe to call this more than
  // once (e.g. once from the "all done" effect and again from the
  // scanner effect's own cleanup) — a second call just finds nothing
  // left to do instead of racing the first one.
  async function stopCamera() {
    const instance = scannerInstanceRef.current;
    scannerInstanceRef.current = null;
    if (!instance) return;
    try {
      await instance.stop();
    } catch (e) {
      // already stopped, or never fully started — nothing to do
    }
    try {
      await instance.clear();
    } catch (e) {
      // the scanner region's DOM node may already be gone — fine
    }
  }

  // Once everything's checked in, fully stop the camera and ONLY THEN
  // switch to the completion screen. Switching screens unmounts the
  // camera's DOM element — if that happens before the camera library
  // finishes its own cleanup of that same element, it throws trying to
  // tear down a node that's already gone, which crashes the whole page
  // (the classic React vs. imperative-DOM-library conflict). Awaiting
  // stopCamera() first avoids that race entirely.
  useEffect(() => {
    if (!allDone) return;
    let cancelled = false;
    stopCamera().then(() => {
      if (!cancelled) setCompleted(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  function showFlash(text, tone) {
    setFlash({ text, tone });
    setTimeout(() => setFlash((f) => (f && f.text === text ? null : f)), 1400);
  }

  // Called continuously by the scanner for every successful decode —
  // just tracks what's currently in focus. Nothing is checked in until
  // the volunteer taps Capture.
  function handleDetected(decodedText) {
    const trimmed = decodedText.trim();
    pendingLastSeenRef.current = Date.now();
    setPendingScan((prev) => {
      if (prev && prev.code === trimmed) return prev;
      let name = null;
      try {
        const payload = JSON.parse(trimmed);
        name = payload.name || null;
      } catch (e) {
        // leave name null — shown as an unrecognized code below
      }
      return { code: trimmed, name };
    });
  }

  async function handleCapture() {
    if (!pendingScan || capturing) return;
    const { code: trimmed, name } = pendingScan;
    const now = Date.now();

    // Guards against a double-tap, or the same code still sitting in
    // frame, capturing the same physical unit twice in a row.
    if (lastCapturedRef.current.code === trimmed && now - lastCapturedRef.current.at < 2500) {
      return;
    }
    lastCapturedRef.current = { code: trimmed, at: now };

    if (!name) {
      showFlash("That QR code isn't recognized.", "error");
      setPendingScan(null);
      return;
    }

    const li = lineItemsRef.current.find((l) => l.name === name);
    if (!li) {
      showFlash("That item isn't part of this order.", "error");
      setPendingScan(null);
      return;
    }
    if (li.stillOut <= 0) {
      showFlash(`${name} is already checked in.`, "ok");
      setPendingScan(null);
      return;
    }
    const liveItem = itemsRef.current.find((i) => i.name === name);
    if (!liveItem) {
      showFlash("That item couldn't be found in the catalog.", "error");
      setPendingScan(null);
      return;
    }

    setCapturing(true);
    try {
      await onResolveActionRef.current(liveItem.id, -1);
      showFlash(`Checked in: ${name}`, "ok");
    } catch (e) {
      showFlash("Couldn't check that item in — try again.", "error");
    } finally {
      setCapturing(false);
      setPendingScan(null);
    }
  }

  useEffect(() => {
    if (completed) return;

    const html5Qrcode = new Html5Qrcode(SCANNER_ID);
    scannerInstanceRef.current = html5Qrcode;

    html5Qrcode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleDetected(decodedText);
        },
        () => {
          /* ignore per-frame decode errors */
        }
      )
      .catch(() => {
        showFlash("Couldn't access the camera. Check camera permissions for this site.", "error");
      });

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  async function handleManualCheckIn() {
    if (!missingItemName || !missingNote.trim()) return;
    const li = lineItemsRef.current.find((l) => l.name === missingItemName);
    const liveItem = itemsRef.current.find((i) => i.name === missingItemName);
    if (!li || !liveItem) return;

    setSubmitting(true);
    try {
      await onResolveActionRef.current(liveItem.id, -1, missingNote.trim());
      showFlash(`Checked in: ${missingItemName}`, "ok");
      setMissingOpen(false);
      setMissingItemName("");
      setMissingNote("");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <Modal onClose={onClose} title="Scanning Complete">
        <div style={S.successBox}>
          <div style={S.successCheck}>
            <Icon.check size={28} />
          </div>
          <div style={S.successTitle}>Thanks for returning all of the items!</div>
          <div style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>CEPC-Lubbock</div>
          <div style={S.tinyMuted}>Everything has been checked in. You can now close this screen.</div>
          <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={onClose}>
            Return to Inventory Screen
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Scan to Check In">
      {!missingOpen && (
        <>
          <p style={S.modalHint}>
            Point the camera at an item's QR code, then tap Capture once it's in focus.
          </p>
          <div style={{ ...S.card, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: "#1a1a2e" }}>
              {checkedInUnits} of {totalUnits} checked in
            </div>
            {remaining.length > 0 && (
              <div style={{ ...S.tinyMuted, marginTop: 4 }}>
                Still needed: {remaining.map((li) => `${li.name} (${li.stillOut})`).join(", ")}
              </div>
            )}
          </div>
        </>
      )}

      {/* The camera view stays mounted the whole time (just hidden while the
          Missing QR form is open) so it never needs to reconnect. */}
      <div style={{ position: "relative" }}>
        <div id={SCANNER_ID} style={missingOpen ? { display: "none" } : undefined} />
        {flash && !missingOpen && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              textAlign: "center",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: flash.tone === "error" ? "#c0392b" : "#1e8449",
            }}
          >
            {flash.text}
          </div>
        )}
      </div>

      {!missingOpen && (
        <>
          <div style={{ textAlign: "center", margin: "10px 0" }}>
            <div style={{ ...S.tinyMuted, marginBottom: 6, minHeight: 16 }}>
              {pendingScan
                ? pendingScan.name
                  ? `In focus: ${pendingScan.name}`
                  : "Unrecognized code in focus"
                : "Point the camera at a QR code…"}
            </div>
            <button
              style={{
                ...S.primaryBtn,
                ...(!pendingScan || capturing ? S.btnDisabled : {}),
              }}
              disabled={!pendingScan || capturing}
              onClick={handleCapture}
            >
              {capturing ? "Checking In…" : "Capture"}
            </button>
          </div>

          <div style={{ ...S.summaryListWrap, marginTop: 4 }}>
            {lineItems.map((li, idx) => (
              <div key={idx} style={S.summaryRow}>
                <span>{li.name}</span>
                <span style={S.summaryQty}>
                  {li.qty - li.stillOut} of {li.qty} checked in
                </span>
              </div>
            ))}
          </div>
          <button style={{ ...S.secondaryBtn, marginTop: 10 }} onClick={() => setMissingOpen(true)}>
            Missing QR Code?
          </button>
        </>
      )}

      {missingOpen && (
        <div>
          <p style={S.modalHint}>
            Choose the item you're checking in, and add a quick note about why the QR code couldn't be
            scanned (damaged, missing, etc.) before continuing.
          </p>
          <label style={S.fieldLabel}>
            Item
            <select
              style={S.fieldInput}
              value={missingItemName}
              onChange={(e) => setMissingItemName(e.target.value)}
            >
              <option value="">Select an item…</option>
              {remaining.map((li) => (
                <option key={li.name} value={li.name}>
                  {li.name} ({li.qty - li.stillOut} of {li.qty} checked in)
                </option>
              ))}
            </select>
          </label>
          <label style={S.fieldLabel}>
            Why was this checked in manually?
            <textarea
              style={S.textarea}
              rows={3}
              value={missingNote}
              onChange={(e) => setMissingNote(e.target.value)}
              placeholder="e.g. QR sticker fell off during the event"
            />
          </label>
          <button
            style={S.primaryBtn}
            disabled={!missingItemName || !missingNote.trim() || submitting}
            onClick={handleManualCheckIn}
          >
            {submitting ? "Checking In…" : "Check In Item"}
          </button>
          <button style={S.secondaryBtn} onClick={() => setMissingOpen(false)}>
            Back to Scanning
          </button>
        </div>
      )}
    </Modal>
  );
}
