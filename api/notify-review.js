// Vercel serverless function — emails the reviewer whenever a new
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

  const itemLines = items.map((it) => `• ${it.name} × ${it.qty}`).join("\n");
  const text = `A new equipment request needs your review.

Requester: ${requester.name || "—"}
Phone: ${requester.phone || "—"}

Items requested:
${itemLines || "(none)"}

Open the app's Admin > Orders tab to review it.
`;

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Convention Inventory <onboarding@resend.dev>",
        to: recipients,
        subject: "New request needs your review",
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
