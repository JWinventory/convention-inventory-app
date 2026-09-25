// Vercel serverless function — emails the reviewer(s) whenever a new
// order is submitted and needs their review. Reuses the same
// RESEND_API_KEY already configured for the other notify endpoints.
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

  const { reviewerEmail, requester, items } = req.body || {};
  if (!requester || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing request details or item list." });
    return;
  }

  // Reviewer Email can hold one or more comma-separated addresses.
  const recipients = (reviewerEmail || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  // No reviewer email(s) on file — nothing to send, but not an error;
  // the order still shows up in the Orders page banner either way.
  if (recipients.length === 0) {
    res.status(200).json({ ok: true, skipped: "no-email" });
    return;
  }

  // Basic HTML-escaping so a name, item, or note containing &, <, or >
  // can never break the markup or inject anything into the email.
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  const requesterName = requester.name || "—";
  const requesterPhone = requester.phone || "—";

  // --- Plain-text fallback ---
  const itemLinesText = items.map((it) => `• ${it.name} × ${it.qty}`).join("\n");
  const text = `A new equipment request needs your review.

Requester: ${requesterName}
Phone: ${requesterPhone}

Items requested:
${itemLinesText || "(none)"}

Open the app's Admin > Orders tab to review it.

Thank you for keeping things running smoothly.

Warmly,
CEPC-Lubbock Equipment Team
`;

  // --- HTML version: same blended design as the ready-for-pickup email ---
  const itemRowsHtml = items.map((it) => `✅ ${esc(it.name)} × ${esc(it.qty)}`).join("<br/>\n          ");

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
          <div style="font-size:21px; font-weight:700; color:#1a1a2e;">A new equipment request needs your review</div>
        </td></tr>

        <tr><td style="padding: 16px 36px 0;">
          <div style="background:#eaf3fc; border-radius:10px; padding:16px 18px; font-size:14px; color:#1a1a2e; line-height:1.6;">
            Open the app's <strong>Admin &gt; Orders</strong> tab to review this request.
          </div>
        </td></tr>

        <tr><td style="padding: 26px 36px 0;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#999; border-bottom:1px solid #eee; padding-bottom:6px;">Request Details</div>
          <div style="font-size:14px; color:#333; padding-top:8px; line-height:1.6;">Requester: ${esc(requesterName)}<br/>Phone: ${esc(requesterPhone)}</div>
        </td></tr>

        <tr><td style="padding: 22px 36px 0;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#999; border-bottom:1px solid #eee; padding-bottom:6px;">Items Requested</div>
          <div style="font-size:14px; color:#333; padding-top:8px; line-height:1.9;">
          ${itemRowsHtml || "(none)"}
          </div>
        </td></tr>

        <tr><td style="padding: 26px 36px 36px; font-size:14px; color:#333; line-height:1.6;">
          Thank you for keeping things running smoothly.<br/><br/>
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
        to: recipients,
        subject: "New request needs your review",
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
