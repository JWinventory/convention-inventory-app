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
      <Modal onClose={onClose} title="Check-In Complete">
        <div style={S.successBox}>
          <div style={S.successCheck}>
            <Icon.check size={28} />
          </div>
          <div style={S.successTitle}>See you at the next event!</div>
          <div style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>CEPC-Lubbock</div>
          <div style={S.tinyMuted}>All your items have been checked in. You may now close this window.</div>
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
