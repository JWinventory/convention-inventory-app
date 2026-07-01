import React, { useMemo, useState } from "react";
import { S, colorFor } from "../styles";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { fileToCompressedDataUrl } from "../imageUtils";

const BLANK_FORM = { name: "", category: "", total: "1", note: "", img: null };

export function AdminPage({ items, addItem, updateItem, deleteItem, seedIfEmpty, syncStatus }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [items, search]);

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
      img: item.img || null,
    });
    setEditing(item);
  }
  function closeEditor() {
    setEditing(null);
    setForm(BLANK_FORM);
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, img: dataUrl }));
    } catch (err) {
      alert("Couldn't read that image. Try a different file.");
    }
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
        img: form.img,
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
          <AdminItemCard key={item.id} item={item} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} />
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
          <label style={S.fieldLabel}>
            Note (optional)
            <textarea style={S.textarea} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </label>

          <div style={S.photoUploadBox} onClick={() => document.getElementById("photo-input").click()}>
            {form.img ? (
              <img src={form.img} alt="preview" style={S.photoPreview} />
            ) : (
              <div style={S.tinyMuted}>Tap to upload a photo (optional)</div>
            )}
            <div style={{ fontSize: 11, color: "#999" }}>{form.img ? "Tap to replace" : ""}</div>
          </div>
          <input id="photo-input" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />

          <button style={S.primaryBtn} disabled={saving || !form.name.trim() || !form.category.trim()} onClick={handleSave}>
            {saving ? "Saving…" : editing === "new" ? "Add to Catalog" : "Save Changes"}
          </button>
        </Modal>
      )}
    </div>
  );
}

function AdminItemCard({ item, onEdit, onDelete }) {
  const color = colorFor(item.category);
  return (
    <div style={S.itemCard}>
      <div style={{ ...S.catStripe, background: color }} />
      <div style={S.itemImgWrap}>
        {item.img ? <img src={item.img} alt={item.name} style={S.itemImg} /> : <div style={S.itemImgPlaceholder}>No photo</div>}
      </div>
      <div style={{ ...S.itemCat, color }}>{item.category}</div>
      <div style={S.itemName}>{item.name}</div>
      <div style={S.tinyMuted}>Total: {item.total} · Out: {item.out || 0}</div>
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
