import React, { useMemo, useState } from "react";
import { S, colorFor, CAT_COLORS } from "../styles";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Lightbox } from "./Lightbox";
import { ImageCarousel } from "./ImageCarousel";
import { fileToCompressedDataUrl, getItemImages, budgetPerNewImage } from "../imageUtils";

const EVENT_OPTIONS = ["Circuit Assembly", "Regional Convention", "Memorial"];

const BLANK_FORM = { name: "", category: "", total: "1", note: "", images: [], events: [], perUnitQr: false };

export function AdminPage({ items, addItem, updateItem, deleteItem, seedIfEmpty, syncStatus, headerHeight }) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [lightbox, setLightbox] = useState(null); // { images, index } | null

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // Same ordering as the Inventory page's category tabs: known
  // categories in their defined order first, then any extra ones
  // sorted alphabetically, with "All" always first.
  const catTabsList = useMemo(() => {
    const known = Object.keys(CAT_COLORS);
    const present = Array.from(new Set(items.map((i) => i.category)));
    const ordered = known.filter((c) => present.includes(c));
    const extra = present.filter((c) => !known.includes(c)).sort();
    return ["All", ...ordered, ...extra];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = items.filter((i) => {
      if (activeCat !== "All" && i.category !== activeCat) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.category.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, activeCat]);

  function openNew() {
    setForm(BLANK_FORM);
    setEditing("new");
  }
  function openEdit(item) {
    setForm({
      name: item.name,
      category: item.category,
      total: String(item.total),
      note: item.note || "",
      images: getItemImages(item),
      events: Array.isArray(item.events) ? item.events : [],
      perUnitQr: Boolean(item.perUnitQr),
    });
    setEditing(item);
  }
  function closeEditor() {
    setEditing(null);
    setForm(BLANK_FORM);
  }

  async function handlePhoto(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      // Split the available per-item space across however many photos are
      // being added right now, so a big batch (e.g. 10 photos at once)
      // still fits under Firestore's 1MB document cap instead of each one
      // being compressed as if it were the only photo on this item.
      const perImageBudget = budgetPerNewImage(form.images, files.length);
      const dataUrls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f, 900, 0.85, perImageBudget)));
      setForm((f) => ({ ...f, images: [...f.images, ...dataUrls] }));
    } catch (err) {
      alert("Couldn't read one of those images. Try different files.");
    } finally {
      e.target.value = "";
    }
  }

  function removeImage(idx) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  function toggleEvent(ev) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((x) => x !== ev) : [...f.events, ev],
    }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.category.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        total: Number(form.total) || 0,
        note: form.note.trim(),
        images: form.images,
        events: form.events,
        perUnitQr: form.perUnitQr,
      };
      if (editing === "new") {
        await addItem(payload);
      } else {
        await updateItem(editing.id, payload);
      }
      closeEditor();
    } catch (err) {
      alert("Couldn't save that item — check your connection and Firebase setup.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    await deleteItem(item.id);
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg("");
    const res = await seedIfEmpty();
    setSeeding(false);
    if (res.ok) setSeedMsg(`Loaded ${res.count} starter items.`);
    else if (res.reason === "not-empty") setSeedMsg(`Catalog already has ${res.count} items — seed skipped.`);
    else setSeedMsg("Couldn't seed — check your Firebase configuration.");
  }

  return (
    <div>
      <div style={{ position: "sticky", top: headerHeight || 0, zIndex: 40, background: "#f4f5f7", paddingTop: 6 }}>
        <div style={S.adminBar}>
          <div style={S.toolbar}>
            <div style={S.searchWrap}>
              <Icon.search />
              <input style={S.searchInput} placeholder="Search catalog…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <button style={S.addItemBtn} onClick={openNew}>
            <Icon.plus /> Add Item
          </button>
        </div>

        <div style={S.catTabs}>
          {catTabsList.map((c) => (
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
      </div>

      {items.length === 0 && (
        <div style={S.card}>
          <h2 style={S.cardTitle}>Catalog is empty</h2>
          <p style={S.tinyMuted}>
            Load the original Spanish Regional Convention inventory (73 starter items with photos) to get going, or
            start adding items manually above.
          </p>
          <button style={S.primaryBtn} disabled={seeding} onClick={handleSeed}>
            {seeding ? "Loading…" : "Load Starter Inventory"}
          </button>
          {seedMsg && <div style={S.tinyMuted}>{seedMsg}</div>}
        </div>
      )}

      <div style={S.grid}>
        {filtered.map((item) => (
          <AdminItemCard
            key={item.id}
            item={item}
            onEdit={() => openEdit(item)}
            onDelete={() => handleDelete(item)}
            onEnlarge={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
          />
        ))}
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Add Item" : "Edit Item"} onClose={closeEditor}>
          <label style={S.fieldLabel}>
            Name
            <input style={S.fieldInput} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Mop Buckets" />
          </label>
          <label style={S.fieldLabel}>
            Category
            <input
              style={S.fieldInput}
              list="category-options"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Type existing or new category"
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label style={S.fieldLabel}>
            Total Quantity
            <input style={S.fieldInput} type="number" min="0" value={form.total} onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1a1a2e", marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={form.perUnitQr}
              onChange={(e) => setForm((f) => ({ ...f, perUnitQr: e.target.checked }))}
            />
            Print a separate QR code for each unit (e.g. Pole #1, #2… — for items where each physical
            piece needs its own code)
          </label>
          <label style={S.fieldLabel}>
            Note (optional)
            <textarea style={S.textarea} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </label>

          <label style={S.fieldLabel}>Visible For (leave all unchecked to show for every event)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            {EVENT_OPTIONS.map((ev) => (
              <label key={ev} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1a1a2e" }}>
                <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                {ev}
              </label>
            ))}
          </div>

          <label style={S.fieldLabel}>Photos (optional)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {form.images.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, cursor: "zoom-in" }}
                  onClick={() => setLightbox({ images: form.images, index: i })}
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  style={removeBadgeStyle}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                border: "2px dashed #d9dce3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#999",
                fontSize: 26,
              }}
              onClick={() => document.getElementById("photo-input").click()}
            >
              +
            </div>
          </div>
          <input id="photo-input" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhoto} />

          <button style={S.primaryBtn} disabled={saving || !form.name.trim() || !form.category.trim()} onClick={handleSave}>
            {saving ? "Saving…" : editing === "new" ? "Add to Catalog" : "Save Changes"}
          </button>
        </Modal>
      )}

      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function AdminItemCard({ item, onEdit, onDelete, onEnlarge }) {
  const color = colorFor(item.category);
  const images = getItemImages(item);
  const events = Array.isArray(item.events) ? item.events : [];
  return (
    <div style={S.itemCard}>
      <div style={{ ...S.catStripe, background: color }} />
      <div style={S.itemImgWrap}>
        <ImageCarousel images={images} alt={item.name} onEnlarge={onEnlarge} />
      </div>
      <div style={{ ...S.itemCat, color }}>{item.category}</div>
      <div style={S.itemName}>{item.name}</div>
      <div style={S.tinyMuted}>Total: {item.total} · Out: {item.out || 0}</div>
      <div style={S.tinyMuted}>{events.length > 0 ? events.join(", ") : "All events"}</div>
      <div style={S.adminBtnRow}>
        <button style={S.adminEditBtn} onClick={onEdit}>
          <Icon.edit /> Edit
        </button>
        <button style={S.adminDeleteBtn} onClick={onDelete}>
          <Icon.trash /> Delete
        </button>
      </div>
    </div>
  );
}

const removeBadgeStyle = {
  position: "absolute",
  top: -6,
  right: -6,
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: "#c0392b",
  color: "#fff",
  border: "2px solid #fff",
  fontSize: 13,
  lineHeight: "16px",
  padding: 0,
  cursor: "pointer",
};
