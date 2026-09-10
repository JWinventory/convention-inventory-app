import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Modal } from "./Modal";
import { S } from "../styles";

const SCANNER_ID = "checkin-camera-region";

// A streamlined, check-in-only scanner for Phase 3: scan an item's QR
// code and it's checked in automatically — no buttons, no confirmation
// — and the camera keeps running so the next item can be scanned right
// away, without ever needing to pick a camera again. A "Missing QR
// Code?" option lets an item be checked in manually when its code is
// damaged or missing, but requires a short note before it'll proceed.
export function CheckInScanModal({ lineItems, items, onResolveAction, onClose }) {
  const [flash, setFlash] = useState(null); // { text, tone: "ok" | "error" } | null
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingItemName, setMissingItemName] = useState("");
  const [missingNote, setMissingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lineItemsRef = useRef(lineItems);
  const itemsRef = useRef(items);
  const onResolveActionRef = useRef(onResolveAction);
  const lastScanRef = useRef({ name: null, at: 0 });

  useEffect(() => {
    lineItemsRef.current = lineItems;
    itemsRef.current = items;
    onResolveActionRef.current = onResolveAction;
  }, [lineItems, items, onResolveAction]);

  const remaining = lineItems.filter((li) => li.stillOut > 0);
  const allDone = lineItems.length > 0 && remaining.length === 0;

  // Auto-close once everything's checked in.
  useEffect(() => {
    if (!allDone) return;
    setFlash({ text: "All items checked in!", tone: "ok" });
    const t = setTimeout(() => onClose(), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  function showFlash(text, tone) {
    setFlash({ text, tone });
    setTimeout(() => setFlash((f) => (f && f.text === text ? null : f)), 1400);
  }

  async function handleDecoded(decodedText) {
    let payload;
    try {
      payload = JSON.parse(decodedText.trim());
    } catch (e) {
      showFlash("That QR code isn't recognized.", "error");
      return;
    }

    const name = payload.name;
    const now = Date.now();
    if (lastScanRef.current.name === name && now - lastScanRef.current.at < 2500) {
      return; // debounce repeat reads of the same code while it's still in frame
    }
    lastScanRef.current = { name, at: now };

    const li = lineItemsRef.current.find((l) => l.name === name);
    if (!li) {
      showFlash("That item isn't part of this order.", "error");
      return;
    }
    if (li.stillOut <= 0) {
      showFlash(`${name} is already checked in.`, "ok");
      return;
    }
    const liveItem = itemsRef.current.find((i) => i.name === name);
    if (!liveItem) {
      showFlash("That item couldn't be found in the catalog.", "error");
      return;
    }

    await onResolveActionRef.current(liveItem.id, -1);
    showFlash(`Checked in: ${name}`, "ok");
  }

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode(SCANNER_ID);

    html5Qrcode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {
          /* ignore per-frame decode errors */
        }
      )
      .catch(() => {
        showFlash("Couldn't access the camera. Check camera permissions for this site.", "error");
      });

    return () => {
      html5Qrcode
        .stop()
        .catch(() => {})
        .finally(() => {
          html5Qrcode.clear().catch(() => {});
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <Modal onClose={onClose} title="Scan to Check In">
      {!missingOpen && (
        <p style={S.modalHint}>
          Point the camera at each item's QR code — it checks in automatically and moves on to the next
          one, no need to tap anything.
        </p>
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
          <div style={{ ...S.summaryListWrap, marginTop: 12 }}>
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
