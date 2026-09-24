import React, { useState } from "react";
import { Modal } from "./Modal";
import { S } from "../styles";

const MAX_REVIEWERS = 4;
const REQUIRED_REVIEWS = 2;

// Manage the volunteer roster, who's a designated Reviewer (up to 4 —
// any 2 of them reviewing an order is enough to advance it), and each
// volunteer's permissions. Only visible to volunteers with the
// "Manage Volunteers" permission.
export function VolunteersPage({
  volunteers,
  reviewerIds,
  onAddVolunteer,
  onUpdateVolunteer,
  onDeleteVolunteer,
  onResetVolunteerPassword,
  onSaveReviewerIds,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState({ catalog: false, orders: false, volunteers: false });
  const [editingId, setEditingId] = useState(null);

  const reviewers = volunteers.filter((v) => (reviewerIds || []).includes(v.id));
  const editing = volunteers.find((v) => v.id === editingId) || null;

  function toggleReviewer(id) {
    const current = reviewerIds || [];
    if (current.includes(id)) {
      onSaveReviewerIds(current.filter((rid) => rid !== id));
    } else if (current.length < MAX_REVIEWERS) {
      onSaveReviewerIds([...current, id]);
    }
  }

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
    if ((reviewerIds || []).includes(v.id)) {
      await onSaveReviewerIds(reviewerIds.filter((id) => id !== v.id));
    }
  }

  async function handleReset(v) {
    if (!window.confirm(`Reset ${v.name}'s password? They'll need to create a new one next time they log in.`)) return;
    await onResetVolunteerPassword(v.id);
  }

  return (
    <div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Reviewers</h2>
        <p style={S.tinyMuted}>
          Up to {MAX_REVIEWERS} volunteers can be set as reviewers. Any {REQUIRED_REVIEWS} of them reviewing a
          request is enough to move it forward — the rest are optional backup, not required.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          {volunteers.length === 0 ? (
            <p style={S.tinyMuted}>Add a volunteer below first.</p>
          ) : (
            volunteers.map((v) => {
              const checked = (reviewerIds || []).includes(v.id);
              const disabled = !checked && (reviewerIds || []).length >= MAX_REVIEWERS;
              return (
                <label
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: disabled ? "#bbb" : "#1a1a2e",
                  }}
                >
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleReviewer(v.id)} />
                  {v.name}
                </label>
              );
            })
          )}
        </div>
        {(reviewerIds || []).length >= MAX_REVIEWERS && (
          <p style={S.tinyMuted}>Maximum of {MAX_REVIEWERS} reviewers reached — uncheck one to add another.</p>
        )}
        {reviewers.length > 0 && (
          <p style={S.tinyMuted}>
            Review-request emails go to:{" "}
            {reviewers.map((v) => v.email || `${v.name} (no email on file)`).join(", ")}.
          </p>
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
                  {v.name} {(reviewerIds || []).includes(v.id) && <span style={reviewerBadgeStyle}>Reviewer</span>}
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
