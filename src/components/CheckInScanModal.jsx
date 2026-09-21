import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { S } from "../styles";

const SCANNER_ID = "checkin-camera-region";
const PENDING_TIMEOUT_MS = 1200; // how long a detected code stays "in focus" without a fresh sighting

// A check-in scanner for Phase 3: scanning is automatic — point the
// camera at an item's QR code and it checks in on its own — with an
// optional Capture button as a manual backup for when a code is tricky
// to auto-detect. A live summary up top shows how many of the total
// units are checked in; for items with per-unit codes, it tracks the
// SPECIFIC unit numbers seen this session and calls out exactly which
// ones are still missing (e.g. "Missing: #4, #6") rather than just a
// count, as long as this session accounts for everything checked in so
// far (if some were checked in during an earlier session, there's no
// way to know which specific units those were, so it falls back to a
// plain count instead of guessing). A "Missing QR Code?" option lets an
// item be checked in manually when its code is damaged or missing, but
// requires a short note before it'll proceed. Once everything's
// checked in, the camera stops and a completion screen takes over
// until the requester chooses to leave.
export function CheckInScanModal({ order, lineItems, items, onResolveAction, onUpdateOrder, onClose }) {
  const [flash, setFlash] = useState(null); // { text, tone: "ok" | "error" } | null
  const [pendingScan, setPendingScan] = useState(null); // { code, name } | null — currently in focus
  const [capturing, setCapturing] = useState(false);
  // { [itemName]: Set<number> } — unit numbers seen, seeded from whatever
  // was already saved on the order (Firestore), so an interrupted session
  // (lost connection, dead battery, closed tab) picks back up with the
  // specific numbers intact instead of losing track of what's missing.
  const [scannedUnits, setScannedUnits] = useState(() => {
    const stored = (order && order.checkedInUnits) || {};
    const initial = {};
    for (const name of Object.keys(stored)) {
      initial[name] = new Set(stored[name] || []);
    }
    return initial;
  });
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingItemName, setMissingItemName] = useState("");
  const [missingNote, setMissingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const lineItemsRef = useRef(lineItems);
  const itemsRef = useRef(items);
  const onResolveActionRef = useRef(onResolveAction);
  const lastProcessedRef = useRef({ code: null, at: 0 });
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

  // Describes what's left for one line item. If this session's own
  // scans account for every unit already checked in for this item (so
  // we can trust which specific numbers we've seen), names the exact
  // missing unit numbers; otherwise falls back to a plain count, since
  // some may have been checked in in an earlier session we have no
  // record of.
  function progressLabel(li) {
    const alreadyDone = li.qty - li.stillOut;
    const seen = scannedUnits[li.name] || new Set();
    if (li.qty > 1 && seen.size === alreadyDone) {
      const missing = [];
      for (let n = 1; n <= li.qty; n++) {
        if (!seen.has(n)) missing.push(n);
      }
      if (missing.length === li.stillOut) {
        return missing.length > 0 ? `Missing: #${missing.join(", #")}` : "All checked in";
      }
    }
    return li.stillOut > 0 ? `${li.stillOut} more needed` : "All checked in";
  }

  // Groups a list of line items by department (category), sorted by
  // department name, for the "save/organize by department" views below.
  function groupByDepartment(list) {
    const byDept = new Map();
    for (const li of list) {
      const dept = li.category || "Uncategorized";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(li);
    }
    return Array.from(byDept.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([department, deptItems]) => ({ department, items: deptItems }));
  }
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

  function recordUnitSeen(name, unit) {
    if (typeof unit !== "number") return;
    setScannedUnits((prev) => {
      const set = new Set(prev[name] || []);
      set.add(unit);
      const next = { ...prev, [name]: set };
      persistScannedUnits(next);
      return next;
    });
  }

  // Saves the full scanned-units map to the order in Firestore after
  // every successful scan, so progress survives a lost connection, a
  // dead battery, or the tab just being closed — reopening the scanner
  // later (even on a different device) picks back up with the exact
  // same specific unit numbers already accounted for.
  function persistScannedUnits(unitsMap) {
    if (!order || !onUpdateOrder) return;
    const plain = {};
    for (const name of Object.keys(unitsMap)) {
      plain[name] = Array.from(unitsMap[name]);
    }
    onUpdateOrder(order.id, { checkedInUnits: plain });
  }

  // The actual check-in logic — called automatically on every detected
  // code, and also from the Capture button as a manual backup. Safe to
  // call more than once for the same physical code in quick succession;
  // the debounce below makes a repeat call for the same code within a
  // couple seconds a no-op.
  async function processCode(trimmed) {
    const now = Date.now();
    if (lastProcessedRef.current.code === trimmed && now - lastProcessedRef.current.at < 2500) {
      return;
    }
    lastProcessedRef.current = { code: trimmed, at: now };

    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch (e) {
      showFlash("That QR code isn't recognized.", "error");
      return;
    }

    const name = payload.name;
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

    try {
      await onResolveActionRef.current(liveItem.id, -1);
      recordUnitSeen(name, payload.unit);
      showFlash(`Checked in: ${name}`, "ok");
    } catch (e) {
      showFlash("Couldn't check that item in — try again.", "error");
    }
  }

  // Called continuously by the scanner for every successful decode —
  // tracks what's in focus (for the optional Capture button and the
  // "in focus" hint) AND automatically attempts to check it in.
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
    processCode(trimmed);
  }

  async function handleCapture() {
    if (!pendingScan || capturing) return;
    setCapturing(true);
    try {
      await processCode(pendingScan.code);
    } finally {
      setCapturing(false);
    }
  }

  // Picks a specific camera instead of leaving it to the browser: bare
  // { facingMode: "environment" } lets it choose ANY back-facing lens on
  // a multi-camera phone, and it often grabs the ultra-wide one — which
  // has a much longer minimum focus distance and more distortion up
  // close, making a QR code hard to focus on. This filters those out
  // and picks the plain standard back camera instead, falling back to
  // facingMode only if the device list can't be read for some reason.
  async function pickBestCamera() {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) return null;
      const isFront = (label) => /front|user|selfie/i.test(label);
      const isWide = (label) => /ultra[\s-]?wide|wide[\s-]?angle|telephoto|macro/i.test(label);
      const plainBack = cameras.find((c) => !isFront(c.label) && !isWide(c.label));
      if (plainBack) return plainBack.id;
      const anyBack = cameras.find((c) => !isFront(c.label));
      return anyBack ? anyBack.id : cameras[0].id;
    } catch (e) {
      return null; // couldn't enumerate — fall back to facingMode below
    }
  }

  useEffect(() => {
    if (completed) return;

    const html5Qrcode = new Html5Qrcode(SCANNER_ID);
    scannerInstanceRef.current = html5Qrcode;
    let cancelled = false;

    (async () => {
      const cameraId = await pickBestCamera();
      if (cancelled) return;
      html5Qrcode
        .start(
          cameraId || { facingMode: "environment" },
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
    })();

    return () => {
      cancelled = true;
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
            Point the camera at each item's QR code — it checks in automatically. If a code won't focus,
            tap Capture once it's in view.
          </p>
          <div style={{ ...S.card, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: "#1a1a2e" }}>
              {checkedInUnits} of {totalUnits} checked in
            </div>
            {remaining.length > 0 && (
              <div style={{ ...S.tinyMuted, marginTop: 4 }}>
                {groupByDepartment(remaining).map((group) => (
                  <div key={group.department}>
                    <strong>{group.department}:</strong>{" "}
                    {group.items.map((li) => `${li.name} — ${progressLabel(li)}`).join("; ")}
                  </div>
                ))}
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
                ...S.secondaryBtn,
                ...(!pendingScan || capturing ? S.btnDisabled : {}),
              }}
              disabled={!pendingScan || capturing}
              onClick={handleCapture}
            >
              {capturing ? "Checking In…" : "Capture (optional)"}
            </button>
          </div>

          <div style={{ ...S.summaryListWrap, marginTop: 4 }}>
            {groupByDepartment(lineItems).map((group) => (
              <div key={group.department}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#888", margin: "8px 0 2px" }}>
                  {group.department}
                </div>
                {group.items.map((li, idx) => (
                  <div key={idx} style={S.summaryRow}>
                    <span>{li.name}</span>
                    <span style={S.summaryQty}>
                      {li.qty - li.stillOut} of {li.qty} — {progressLabel(li)}
                    </span>
                  </div>
                ))}
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
              {groupByDepartment(remaining).map((group) => (
                <optgroup key={group.department} label={group.department}>
                  {group.items.map((li) => (
                    <option key={li.name} value={li.name}>
                      {li.name} ({li.qty - li.stillOut} of {li.qty} checked in)
                    </option>
                  ))}
                </optgroup>
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
