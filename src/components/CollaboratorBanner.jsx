import React from "react";
import { S } from "../styles";

// Shown instead of the normal Requester form when someone has looked up
// an in-progress order started by someone else. They can pick items
// that haven't already been claimed, but everything already picked is
// locked — view only.
export function CollaboratorBanner({ draft, collaboratorName, setCollaboratorName, onDone }) {
  return (
    <div style={{ ...S.card, borderLeft: "4px solid #0072CE" }}>
      <h2 style={S.cardTitle}>Picking Items for {draft.requesterName || "This Order"}</h2>
      <p style={S.tinyMuted}>
        Items already claimed for this order are locked below — you can pick anything that's still
        unclaimed and it'll be added in.
      </p>
      <label style={S.fieldLabel}>
        Your name (so we know who picked what)
        <input
          style={S.fieldInput}
          value={collaboratorName}
          onChange={(e) => setCollaboratorName(e.target.value)}
          placeholder="Your name"
        />
      </label>
      <button style={S.secondaryBtn} onClick={onDone}>
        Done Picking
      </button>
    </div>
  );
}
