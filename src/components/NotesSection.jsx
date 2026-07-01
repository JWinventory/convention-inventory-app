import React from "react";
import { S } from "../styles";

export function NotesSection({ noteDraft, setNoteDraft, onSave, flash }) {
  return (
    <section style={S.card}>
      <h2 style={S.cardTitle}>Shared Notes</h2>
      <div style={S.tinyMuted}>
        Damaged items, missing pieces, or instructions for the next volunteer — visible to everyone.
      </div>
      <textarea
        style={S.textarea}
        rows={4}
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        placeholder="e.g. One mop wringer cracked, set aside in blue crate…"
      />
      <div style={S.noteSaveRow}>
        <button style={S.saveNoteBtn} onClick={onSave}>
          Save Note
        </button>
        {flash && <span style={S.savedFlash}>✓ Saved &amp; shared</span>}
      </div>
    </section>
  );
}
