// Vercel serverless function — emails a volunteer once something on
// the Break/Fix & Projects dashboard gets assigned to them: a return
// follow-up item (broken/missing/needs a new photo or description) or
// a standalone project. Reuses the same RESEND_API_KEY already
// configured for the other notify endpoints, and matches their same
// layout (navy header bar, blue instruction box, uppercase labeled
// detail sections, same sign-off).
const TYPE_LABELS = {
  broken: "Broken",
  missing: "Missing",
  "needs-photo": "Needs Updated Photo",
  "needs-description": "Needs Updated Description",
  project: "Project",
  other: "Other",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Email isn't configured on the server yet. Add RESEND_API_KEY in Vercel project settings.",
    });
    return;
  }

  const { volunteerEmail, volunteerName, requester, itemName, type, note, dueDate } = req.body || {};
  if (!note) {
    res.status(400).json({ error: "Missing item details." });
    return;
  }

  // No email on file for this volunteer — nothing to send, but not an
  // error; the assignment is already saved either way.
  if (!volunteerEmail) {
    res.status(200).json({ ok: true, skipped: "no-email" });
    return;
  }

  // Basic HTML-escaping so a name or note containing &, <, or > can
  // never break the markup or inject anything into the email.
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  const typeLabel = TYPE_LABELS[type] || "Other";
  const requesterName = requester?.name || "";
  const requesterPhone = requester?.phone || "";

  // --- Plain-text fallback ---
  const text = `You've been assigned something on the Break/Fix & Projects dashboard.

Type: ${typeLabel}
${itemName ? `Item/Project: ${itemName}\n` : ""}Note: ${note}

Due Date: ${dueDate || "No due date set"}${requesterName ? `\nOrder requester: ${requesterName}${requesterPhone ? ` (${requesterPhone})` : ""}` : ""}

Open the app's Admin > Break/Fix & Projects tab for details — you can attach photos there too — and
mark it done once it's taken care of.

Thank you for helping keep things running smoothly.

Warmly,
CEPC-Lubbock Equipment Team
`;

  // --- HTML version: same blended design as the other notify emails ---
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background:#eef0f3;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3; padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:4px; overflow:hidden; font-family: -apple-system, Helvetica, Arial, sans-serif;">
        <tr><td style="background:#0072CE; padding: 22px 36px;">
          <div style="font-size:15px; font-weight:800; color:#fff; letter-spacing:0.8px;">CEPC-LUBBOCK</div>
        </td></tr>

        <tr><td style="padding: 28px 36px 0;">
          <div style="font-size:21px; font-weight:700; color:#1a1a2e;">You've been assigned something on Break/Fix &amp; Projects${volunteerName ? `, ${esc(volunteerName)}` : ""}</div>
        </td></tr>

        <tr><td style="padding: 16px 36px 0;">
          <div style="background:#eaf3fc; border-radius:10px; padding:16px 18px; font-size:14px; color:#1a1a2e; line-height:1.6;">
            Open the app's <strong>Admin &gt; Break/Fix &amp; Projects</strong> tab for details — you can
            attach photos there too — and mark it done once it's taken care of.
          </div>
        </td></tr>

        <tr><td style="padding: 26px 36px 0;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#999; border-bottom:1px solid #eee; padding-bottom:6px;">Job Details</div>
          <div style="font-size:14px; color:#333; padding-top:8px; line-height:1.6;">
            <span style="display:inline-block; background:#fdecea; color:#c0392b; font-size:11px; font-weight:800; border-radius:12px; padding:2px 10px; text-transform:uppercase; letter-spacing:0.3px;">${esc(typeLabel)}</span>
            ${itemName ? `<div style="font-weight:700; margin-top:8px;">${esc(itemName)}</div>` : ""}
            <div style="margin-top:8px;">${esc(note)}</div>
          </div>
        </td></tr>

        <tr><td style="padding: 22px 36px 0;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#999; border-bottom:1px solid #eee; padding-bottom:6px;">Due Date</div>
          <div style="font-size:14px; color:#333; padding-top:8px; line-height:1.6;">
            ${dueDate ? esc(dueDate) : "No due date set"}
            ${requesterName ? `<br/>Order requester: ${esc(requesterName)}${requesterPhone ? ` (${esc(requesterPhone)})` : ""}` : ""}
          </div>
        </td></tr>

        <tr><td style="padding: 26px 36px 36px; font-size:14px; color:#333; line-height:1.6;">
          Thank you for helping keep things running smoothly.<br/><br/>
          <span style="color:#0072CE; font-weight:800;">Warmly, CEPC-Lubbock Equipment Team</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CEPC-Lubbock <alerts@notify.jw-inventory.com>",
        to: [volunteerEmail],
        subject: `Break/Fix assigned: ${typeLabel}${itemName ? ` — ${itemName}` : ""}`,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      res.status(502).json({ error: "Email service rejected the request.", detail: errText });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send email.", detail: String(err) });
  }
}
