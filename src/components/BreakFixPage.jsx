import React, { useMemo, useState } from "react";
import { S } from "../styles";
import { Lightbox } from "./Lightbox";
import { fileToCompressedDataUrl, budgetPerNewImage } from "../imageUtils";

const TYPE_LABELS = {
  broken: "Broken",
  missing: "Missing",
  "needs-photo": "Needs Updated Photo",
  "needs-description": "Needs Updated Description",
  project: "Project",
  other: "Other",
};

function typeLabel(key) {
  return TYPE_LABELS[key] || "Other";
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// A photo attached here lives nested inside a whole order document
// (alongside everything else on that order), not its own document —
// so it gets a tighter budget than a catalog item's photo, which has
// a document mostly to itself.
const RETURN_PHOTO_MAX_DIM = 800;
const RETURN_PHOTO_QUALITY = 0.75;
const RETURN_PHOTO_MAX_LENGTH = 200000; // ~200KB

// Break/Fix & Projects: one combined, assignable worklist for
// "something needs attention" — whether it was flagged automatically
// during a return check-in (a broken/missing item, one that needs an
// updated photo or description) or logged directly here as a
// standalone project (equipment trouble spotted between events, with
// no order attached). Any volunteer with Orders/Returns access can log
// a new project, add a note, or attach a photo documenting the
// damage/problem; only a Reviewer (or admin) can assign something to a
// specific volunteer with a due date, which emails that volunteer to
// come check this dashboard. A return-flagged item lives on its
// order's returnActionItems — editing it here updates that same order,
// so it stays in sync with what shows on the Returns tab.
export function BreakFixPage({
  orders,
  breakfixItems,
  volunteers,
  reviewerIds,
  currentVolunteerName,
  isCurrentVolunteerAdmin,
  onUpdateOrder,
  onAssignActionItem,
  onAddBreakfixProject,
  onUpdateBreakfixProject,
  onAssignBreakfixProject,
}) {
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images, index } | null

  const reviewerNames = (volunteers || []).filter((v) => (reviewerIds || []).includes(v.id)).map((v) => v.name);
  const isReviewer = reviewerNames.includes(currentVolunteerName) || Boolean(isCurrentVolunteerAdmin);

  // Every return-flagged action item across every order, tagged with
  // which order (and requester) it came from.
  const returnEntries = useMemo(() => {
    const list = [];
    for (const order of orders || []) {
      if (order.status === "cancelled") continue;
      const actionItems = Array.isArray(order.returnActionItems) ? order.returnActionItems : [];
      for (const ai of actionItems) {
        list.push({
          key: `return:${order.id}:${ai.id}`,
          kind: "return",
          orderId: order.id,
          actionItemId: ai.id,
          title: ai.itemName || "General note",
          typeKey: ai.type,
          note: ai.note || "",
          status: ai.status || "open",
          assignedToId: ai.assignedToId || null,
          assignedToName: ai.assignedToName || null,
          dueDate: ai.dueDate || null,
          createdBy: ai.createdBy || "—",
          createdAtMs: ai.createdAtMs || 0,
          photos: Array.isArray(ai.photos) ? ai.photos : [],
          sourceLabel: `Return — ${order.requesterName || "Unnamed requester"}`,
        });
      }
    }
    return list;
  }, [orders]);

  const projectEntries = useMemo(() => {
    return (breakfixItems || []).map((p) => ({
      key: `project:${p.id}`,
      kind: "project",
      projectId: p.id,
      title: p.title || "Untitled project",
      typeKey: "project",
      note: p.description || "",
      status: p.status || "open",
      assignedToId: p.assignedToId || null,
      assignedToName: p.assignedToName || null,
      dueDate: p.dueDate || null,
      createdBy: p.createdBy || "—",
      createdAtMs: p.createdAtMs || 0,
      photos: Array.isArray(p.photos) ? p.photos : [],
      sourceLabel: "Project",
    }));
  }, [breakfixItems]);

  const allEntries = useMemo(
    () => [...returnEntries, ...projectEntries].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)),
    [returnEntries, projectEntries]
  );

  const openCount = allEntries.filter((e) => e.status !== "done").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEntries.filter((e) => {
      if (!showDone && e.status === "done") return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.note.toLowerCase().includes(q) ||
        (e.sourceLabel || "").toLowerCase().includes(q)
      );
    });
  }, [allEntries, search, showDone]);

  async function handleToggleDone(entry) {
    if (entry.kind === "return") {
      const order = (orders || []).find((o) => o.id === entry.orderId);
      if (!order) return;
      const actionItems = Array.isArray(order.returnActionItems) ? order.returnActionItems : [];
      const next = actionItems.map((x) =>
        x.id === entry.actionItemId ? { ...x, status: x.status === "done" ? "open" : "done" } : x
      );
      const allDone = next.length > 0 && next.every((x) => x.status === "done");
      await onUpdateOrder(order.id, { returnActionItems: next, ...(allDone ? { returnReviewStatus: "closed" } : {}) });
    } else {
      await onUpdateBreakfixProject(entry.projectId, { status: entry.status === "done" ? "open" : "done" });
    }
  }

  async function handleAssign(entry, volunteerId, dueDate) {
    const volunteer = (volunteers || []).find((v) => v.id === volunteerId);
    if (!volunteer) return;
    if (entry.kind === "return") {
      const order = (orders || []).find((o) => o.id === entry.orderId);
      if (!order) return;
      const actionItems = Array.isArray(order.returnActionItems) ? order.returnActionItems : [];
      const next = actionItems.map((x) =>
        x.id === entry.actionItemId
          ? { ...x, assignedToId: volunteer.id, assignedToName: volunteer.name, dueDate: dueDate || null }
          : x
      );
      await onUpdateOrder(order.id, { returnActionItems: next });
      const updatedAi = next.find((x) => x.id === entry.actionItemId);
      if (onAssignActionItem && updatedAi) await onAssignActionItem(order, updatedAi, volunteer, dueDate || null);
    } else {
      await onUpdateBreakfixProject(entry.projectId, {
        assignedToId: volunteer.id,
        assignedToName: volunteer.name,
        dueDate: dueDate || null,
      });
      if (onAssignBreakfixProject) {
        const project = (breakfixItems || []).find((p) => p.id === entry.projectId);
        if (project) await onAssignBreakfixProject({ ...project, assignedToId: volunteer.id, assignedToName: volunteer.name, dueDate: dueDate || null }, volunteer, dueDate || null);
      }
    }
  }

  async function handleAddPhotos(entry, files) {
    if (!files || files.length === 0) return;
    if (entry.kind === "return") {
      const order = (orders || []).find((o) => o.id === entry.orderId);
      if (!order) return;
      const dataUrls = await Promise.all(
        files.map((f) => fileToCompressedDataUrl(f, RETURN_PHOTO_MAX_DIM, RETURN_PHOTO_QUALITY, RETURN_PHOTO_MAX_LENGTH))
      );
      const actionItems = Array.isArray(order.returnActionItems) ? order.returnActionItems : [];
      const next = actionItems.map((x) =>
        x.id === entry.actionItemId ? { ...x, photos: [...(Array.isArray(x.photos) ? x.photos : []), ...dataUrls] } : x
      );
      await onUpdateOrder(order.id, { returnActionItems: next });
    } else {
      const perImageBudget = budgetPerNewImage(entry.photos, files.length);
      const dataUrls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f, 900, 0.82, perImageBudget)));
      await onUpdateBreakfixProject(entry.projectId, { photos: [...entry.photos, ...dataUrls] });
    }
  }

  return (
    <div>
      {openCount > 0 && (
        <div style={bannerStyle}>{openCount === 1 ? "1 item needs attention" : `${openCount} items need attention`}</div>
      )}

      <div style={S.card}>
        <h2 style={S.cardTitle}>Break/Fix &amp; Projects</h2>
        <div style={S.tinyMuted}>
          Everything needing attention in one place — items flagged during a return check-in (broken,
          missing, needs a new photo or description), plus any project logged here directly. Attach photos
          to document damage or progress; a Reviewer can assign something to a volunteer with a due date,
          which emails them to come check this dashboard.
        </div>
      </div>

      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <input
            style={S.searchInput}
            placeholder="Search by item, project, or requester…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button style={S.addItemBtn} onClick={() => setNewOpen((v) => !v)}>
          {newOpen ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {newOpen && (
        <NewProjectForm
          currentVolunteerName={currentVolunteerName}
          onAddBreakfixProject={onAddBreakfixProject}
          onDone={() => setNewOpen(false)}
        />
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 14px", fontSize: 13, color: "#555" }}>
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        Show completed
      </label>

      {filtered.length === 0 ? (
        <div style={S.card}>
          <p style={S.tinyMuted}>
            {search ? `Nothing matches "${search}".` : showDone ? "Nothing here yet." : "Nothing needs attention right now."}
          </p>
        </div>
      ) : (
        filtered.map((entry) => (
          <EntryCard
            key={entry.key}
            entry={entry}
            volunteers={volunteers}
            isReviewer={isReviewer}
            onToggleDone={() => handleToggleDone(entry)}
            onAssign={(volunteerId, dueDate) => handleAssign(entry, volunteerId, dueDate)}
            onAddPhotos={(files) => handleAddPhotos(entry, files)}
            onEnlarge={(images, index) => setLightbox({ images, index })}
          />
        ))
      )}

      {lightbox && <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function NewProjectForm({ currentVolunteerName, onAddBreakfixProject, onDone }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAddBreakfixProject({
        title: title.trim(),
        description: description.trim(),
        createdBy: currentVolunteerName || "Unnamed volunteer",
      });
      setTitle("");
      setDescription("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...S.card, marginTop: -4 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#888", marginBottom: 6 }}>
        New Project
      </div>
      <label style={S.fieldLabel}>
        Title
        <input
          style={S.fieldInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. PA speaker crackling"
        />
      </label>
      <label style={S.fieldLabel}>
        Details
        <textarea
          style={S.textarea}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's going on, and where it was spotted…"
        />
      </label>
      <button style={S.primaryBtn} type="submit" disabled={!title.trim() || saving}>
        {saving ? "Saving…" : "Log Project"}
      </button>
    </form>
  );
}

function EntryCard({ entry, volunteers, isReviewer, onToggleDone, onAssign, onAddPhotos, onEnlarge }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [volunteerId, setVolunteerId] = useState(entry.assignedToId || "");
  const [dueDate, setDueDate] = useState(entry.dueDate || "");
  const [uploading, setUploading] = useState(false);
  const fileInputId = `breakfix-photo-${entry.key}`;

  const done = entry.status === "done";

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow picking the same file again later
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onAddPhotos(files);
    } catch (err) {
      alert("Couldn't add one of those photos. Try a different file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={typeBadgeStyle(entry.typeKey)}>{typeLabel(entry.typeKey)}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{entry.title}</span>
          </div>
          <div style={{ ...S.tinyMuted, marginTop: 2 }}>{entry.sourceLabel}</div>
          {entry.note && <div style={{ fontSize: 13, color: "#333", marginTop: 6 }}>{entry.note}</div>}
          <div style={{ ...S.tinyMuted, marginTop: 6 }}>Logged by {entry.createdBy}</div>
          {entry.assignedToName ? (
            <div style={{ ...S.tinyMuted, marginTop: 2 }}>
              Assigned to <strong>{entry.assignedToName}</strong>
              {entry.dueDate ? ` — due ${entry.dueDate}` : ""}
            </div>
          ) : (
            <div style={{ ...S.tinyMuted, marginTop: 2 }}>Unassigned</div>
          )}
        </div>
        <button style={{ ...S.adminEditBtn, flex: "0 0 auto", padding: "6px 10px" }} onClick={onToggleDone}>
          {done ? "Reopen" : "Mark Done"}
        </button>
      </div>

      {entry.photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {entry.photos.map((src, i) => (
            <button
              key={i}
              onClick={() => onEnlarge(entry.photos, i)}
              style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
            >
              <img
                src={src}
                alt={`${entry.title} photo ${i + 1}`}
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, display: "block" }}
              />
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor={fileInputId} style={linkBtnStyle}>
          {uploading ? "Adding photo…" : "Add Photo"}
        </label>
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: "none" }}
          disabled={uploading}
          onChange={handleFiles}
        />

        {isReviewer && !done && (
          <button style={linkBtnStyle} onClick={() => setAssignOpen((v) => !v)}>
            {entry.assignedToName ? "Reassign" : "Assign to a volunteer"}
          </button>
        )}
      </div>

      {assignOpen && (
        <div style={{ marginTop: 10, background: "#f7f8fa", borderRadius: 8, padding: "10px 12px" }}>
          <label style={S.fieldLabel}>
            Volunteer
            <select style={S.fieldInput} value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)}>
              <option value="">Select…</option>
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label style={S.fieldLabel}>
            Due Date
            <input style={S.fieldInput} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...S.primaryBtn, marginTop: 0 }}
              disabled={!volunteerId}
              onClick={() => {
                onAssign(volunteerId, dueDate);
                setAssignOpen(false);
              }}
            >
              Save Assignment
            </button>
            <button style={{ ...S.secondaryBtn, marginTop: 0 }} onClick={() => setAssignOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function typeBadgeStyle(type) {
  const map = {
    broken: { background: "#fdecea", color: "#c0392b" },
    missing: { background: "#fff4e5", color: "#8a5a00" },
    "needs-photo": { background: "#eaf3fc", color: "#2471a3" },
    "needs-description": { background: "#eaf3fc", color: "#2471a3" },
    project: { background: "#f0e6fb", color: "#6c3483" },
    other: { background: "#f0f1f4", color: "#555" },
  };
  const cfg = map[type] || map.other;
  return {
    ...cfg,
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 12,
    padding: "2px 8px",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  };
}

const bannerStyle = {
  background: "#fdecea",
  border: "1px solid #f5b7b1",
  color: "#c0392b",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 14,
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "#0072CE",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};
