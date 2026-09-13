import React, { useState } from "react";
import { Modal } from "./Modal";
import { S } from "../styles";

// Manage the volunteer roster, who's the designated Reviewer, and each
// volunteer's permissions. Only visible to volunteers with the
// "Manage Volunteers" permission.
export function VolunteersPage({
  volunteers,
  reviewerId,
  onAddVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
  onResetVolunteerPassword,
  onSaveReviewerId,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState({ catalog: false, orders: false, volunteers: false });
  const [editingId, setEditingId] = useState(null);

  const reviewer = volunteers.find((v) => v.id === reviewerId) || null;
  const editing = volunteers.find((v) => v.id === editingId) || null;

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onAddVolunteer({ name: name.trim(), phone: phone.trim(), email: email.trim(), permissions: perms });
    setName("");
    setPhone("");
    setEmail("");
    setPerms({ catalog: false, orders: false, volunteers: false });
  }

  async function handleRemove(v) {
    if (!window.confirm(`Remove ${v.name}? This can't be undone.`)) return;
    await onDeleteVolunteer(v.id);
    if (v.id === reviewerId) {
      await onSaveReviewerId("");
    }
  }

  async function handleReset(v) {
    if (!window.confirm(`Reset ${v.name}'s password? They'll need to create a new one next time they log in.`)) return;
    await onResetVolunteerPassword(v.id);
  }

  return (
    <div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Reviewer</h2>
        <p style={S.tinyMuted}>This person must mark a request as reviewed before it can be assigned to be filled.</p>
        <label style={S.fieldLabel}>
          Reviewer
          <select style={S.fieldInput} value={reviewerId || ""} onChange={(e) => onSaveReviewerId(e.target.value)}>
            <option value="">Select…</option>
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        {reviewer && (
          <p style={S.tinyMuted}>Notifications for new requests will be emailed to {reviewer.email || "(no email on file)"}.</p>
        )}
      </div>

      <div style={S.card}>
        <h2 style={S.cardTitle}>Add a Volunteer</h2>
        <form onSubmit={handleAdd}>
          <label style={S.fieldLabel}>
            Name
            <input style={S.fieldInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </label>
          <label style={S.fieldLabel}>
            Phone
            <input style={S.fieldInput} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </label>
          <label style={S.fieldLabel}>
            Email
            <input style={S.fieldInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label style={S.fieldLabel}>Permissions</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <PermCheckbox label="Manage Catalog" checked={perms.catalog} onChange={(v) => setPerms((p) => ({ ...p, catalog: v }))} />
            <PermCheckbox label="Manage Orders" checked={perms.orders} onChange={(v) => setPerms((p) => ({ ...p, orders: v }))} />
            <PermCheckbox label="Manage Volunteers" checked={perms.volunteers} onChange={(v) => setPerms((p) => ({ ...p, volunteers: v }))} />
          </div>
          <button style={S.primaryBtn} type="submit" disabled={!name.trim()}>
            Add Volunteer
          </button>
        </form>
      </div>

      <div style={S.card}>
        <h2 style={S.cardTitle}>Volunteers ({volunteers.length})</h2>
        {volunteers.length === 0 ? (
          <p style={S.tinyMuted}>No volunteers yet.</p>
        ) : (
          volunteers.map((v) => (
            <div key={v.id} style={volunteerRowStyle}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>
                  {v.name} {v.id === reviewerId && <span style={reviewerBadgeStyle}>Reviewer</span>}
                </div>
                <div style={S.tinyMuted}>
                  {v.phone || "—"}
                  {v.email ? ` · ${v.email}` : ""}
                </div>
                <div style={S.tinyMuted}>
                  {[
                    v.permissions?.catalog && "Catalog",
                    v.permissions?.orders && "Orders",
                    v.permissions?.volunteers && "Volunteers",
                  ]
                    .filter(Boolean)
                    .join(", ") || "No admin permissions"}
                </div>
                <div style={S.tinyMuted}>{v.passwordHash ? "Password set" : "No password set yet"}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button style={S.adminEditBtn} onClick={() => setEditingId(v.id)}>
                  Edit
                </button>
                <button style={S.adminEditBtn} onClick={() => handleReset(v)}>
                  Reset Password
                </button>
                <button style={S.adminDeleteBtn} onClick={() => handleRemove(v)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <EditVolunteerModal
          volunteer={editing}
          onSave={async (patch) => {
            await onUpdateVolunteer(editing.id, patch);
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function PermCheckbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1a1a2e" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function EditVolunteerModal({ volunteer, onSave, onClose }) {
  const [phone, setPhone] = useState(volunteer.phone || "");
  const [email, setEmail] = useState(volunteer.email || "");
  const [perms, setPerms] = useState({
    catalog: Boolean(volunteer.permissions?.catalog),
    orders: Boolean(volunteer.permissions?.orders),
    volunteers: Boolean(volunteer.permissions?.volunteers),
  });

  return (
    <Modal title={`Edit ${volunteer.name}`} onClose={onClose}>
      <label style={S.fieldLabel}>
        Phone
        <input style={S.fieldInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label style={S.fieldLabel}>
        Email
        <input style={S.fieldInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label style={S.fieldLabel}>Permissions</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <PermCheckbox label="Manage Catalog" checked={perms.catalog} onChange={(v) => setPerms((p) => ({ ...p, catalog: v }))} />
        <PermCheckbox label="Manage Orders" checked={perms.orders} onChange={(v) => setPerms((p) => ({ ...p, orders: v }))} />
        <PermCheckbox label="Manage Volunteers" checked={perms.volunteers} onChange={(v) => setPerms((p) => ({ ...p, volunteers: v }))} />
      </div>
      <button style={S.primaryBtn} onClick={() => onSave({ phone: phone.trim(), email: email.trim(), permissions: perms })}>
        Save Changes
      </button>
    </Modal>
  );
}

const volunteerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "10px 0",
  borderBottom: "1px solid #eee",
  gap: 10,
};

const reviewerBadgeStyle = {
  background: "#eaf3fc",
  color: "#2471a3",
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 12,
  padding: "1px 8px",
  marginLeft: 6,
  textTransform: "uppercase",
};
