import React, { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { ImageCarousel } from "./ImageCarousel";
import { Lightbox } from "./Lightbox";
import { getItemImages } from "../imageUtils";
import { S } from "../styles";

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Phase 3, option 2: a digital check-in checklist for a requester
// without a camera handy (or who'd rather type than scan) — one
// number field per item instead of QR codes. Every item checked out
// has to be accounted for in a single submission: the field starts
// pre-filled with the full amount still checked out, and if what's
// entered for an item doesn't match that, a quick note explaining the
// difference is required before "Complete Check-In" will go through.
// Whatever they enter is what gets checked in — the order still
// closes out — but a note on a shortfall lands as an open action item
// on the order, the same list a Reviewer works from once it shows up
// on the Returns tab, so a missing item never just quietly disappears.
export function ManualCheckInModal({ order, lineItems, items, onResolveAction, onUpdateOrder, onReturnCompleted, onClose }) {
  const [quantities, setQuantities] = useState(() => {
    const init = {};
    for (const li of lineItems) init[li.name] = String(li.stillOut);
    return init;
  });
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images, index } | null

  const itemsRef = useRef(items);
  const onResolveActionRef = useRef(onResolveAction);
  const onReturnCompletedRef = useRef(onReturnCompleted);
  useEffect(() => {
    itemsRef.current = items;
    onResolveActionRef.current = onResolveAction;
    onReturnCompletedRef.current = onReturnCompleted;
  }, [items, onResolveAction, onReturnCompleted]);

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

  function setQty(name, value) {
    setQuantities((prev) => ({ ...prev, [name]: value }));
  }

  function setNote(name, value) {
    setNotes((prev) => ({ ...prev, [name]: value }));
  }

  function isMismatch(li) {
    const raw = quantities[li.name];
    if (raw === "" || raw === undefined) return false;
    const entered = Number(raw);
    return !Number.isNaN(entered) && entered !== li.stillOut;
  }

  async function handleComplete() {
    setError("");

    // Every field has to be a valid whole number in range before
    // anything gets submitted.
    for (const li of lineItems) {
      const raw = quantities[li.name];
      const entered = Number(raw);
      if (
        raw === "" ||
        raw === undefined ||
        Number.isNaN(entered) ||
        !Number.isInteger(entered) ||
        entered < 0 ||
        entered > li.stillOut
      ) {
        setError(`Enter a whole number between 0 and ${li.stillOut} for ${li.name}.`);
        return;
      }
    }

    const mismatched = lineItems.filter((li) => Number(quantities[li.name]) !== li.stillOut);
    const missingNotes = mismatched.filter((li) => !(notes[li.name] || "").trim());
    if (missingNotes.length > 0) {
      setError(`Add a note explaining the difference for: ${missingNotes.map((li) => li.name).join(", ")}.`);
      return;
    }

    setSubmitting(true);
    try {
      const newActionItems = [];
      for (const li of lineItems) {
        const liveItem = itemsRef.current.find((i) => i.name === li.name);
        if (!liveItem) continue;
        const mismatch = mismatched.some((m) => m.name === li.name);
        const note = mismatch ? notes[li.name].trim() : undefined;
        // Always release the full amount still checked out — the order
        // closes out either way, and a shortfall is tracked separately
        // as an action item rather than left half-checked-in forever.
        // eslint-disable-next-line no-await-in-loop
        await onResolveActionRef.current(liveItem.id, -li.stillOut, note);
        if (mismatch) {
          newActionItems.push({
            id: makeId(),
            itemName: li.name,
            type: "missing",
            note,
            createdBy: `${order?.requesterName || "Requester"} (at check-in)`,
            createdAtMs: Date.now(),
            assignedToId: null,
            assignedToName: null,
            dueDate: null,
            status: "open",
          });
        }
      }

      if (newActionItems.length > 0 && onUpdateOrder && order) {
        const existing = Array.isArray(order.returnActionItems) ? order.returnActionItems : [];
        await onUpdateOrder(order.id, { returnActionItems: [...existing, ...newActionItems] });
      }

      setCompleted(true);
      if (onReturnCompletedRef.current) await onReturnCompletedRef.current(order);
    } catch (e) {
      setError("Something went wrong checking items in — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <Modal onClose={onClose} title="Checked In">
        <div style={S.successBox}>
          <div style={S.successCheck}>
            <Icon.check size={28} />
          </div>
          <div style={S.successTitle}>Thanks for returning your equipment!</div>
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
    <Modal onClose={onClose} title="Check In — Enter Quantities">
      <p style={S.modalHint}>
        Enter how many of each item you're returning right now. If a number doesn't match what you
        checked out, you'll be asked for a quick note explaining why before you can finish.
      </p>

      {error && <div style={S.errorText}>{error}</div>}

      {groupByDepartment(lineItems).map((group) => (
        <div key={group.department} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#888", margin: "8px 0 4px" }}>
            {group.department}
          </div>
          {group.items.map((li) => {
            const mismatch = isMismatch(li);
            const catalogItem = items.find((i) => i.name === li.name);
            const images = getItemImages(catalogItem);
            return (
              <div
                key={li.name}
                style={{
                  background: mismatch ? "#fdecea" : "#f7f8fa",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={thumbWrapStyle}>
                    <ImageCarousel
                      images={images}
                      alt={li.name}
                      onEnlarge={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{li.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                    <input
                      type="number"
                      min={0}
                      max={li.stillOut}
                      style={{ ...S.fieldInput, width: 64, padding: "6px 8px", textAlign: "center" }}
                      value={quantities[li.name] ?? ""}
                      onChange={(e) => setQty(li.name, e.target.value)}
                    />
                    <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>of {li.stillOut}</span>
                  </div>
                </div>
                {mismatch && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", marginBottom: 4 }}>
                      That doesn't match the {li.stillOut} checked out — what happened?
                    </div>
                    <textarea
                      style={S.textarea}
                      rows={2}
                      value={notes[li.name] || ""}
                      onChange={(e) => setNote(li.name, e.target.value)}
                      placeholder="e.g. one got broken, still have one at home, etc."
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <button style={S.primaryBtn} disabled={submitting} onClick={handleComplete}>
        {submitting ? "Checking In…" : "Complete Check-In"}
      </button>

      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </Modal>
  );
}

const thumbWrapStyle = {
  width: 52,
  height: 52,
  borderRadius: 8,
  overflow: "hidden",
  background: "#f0f1f4",
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
