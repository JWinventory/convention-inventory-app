// Vercel serverless function — emails the designated reviewer whenever
// a new order is submitted and needs review. Reuses the same
// RESEND_API_KEY already configured for api/notify.js and api/notify-ready.js.
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

  const { reviewerEmail, requester, eventType, eventDate, items } = req.body || {};
  if (!requester || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing request details or item list." });
    return;
  }

  // No reviewer email on file — nothing to send, but this isn't an
  // error; the order still shows up in the Orders page either way.
  if (!reviewerEmail) {
    res.status(200).json({ ok: true, skipped: "no-email" });
    return;
  }

  const itemLines = items.map((it) => `• ${it.name} × ${it.qty}`).join("\n");
  const text = `A new equipment request needs your review.

Requester: ${requester.name || "—"}
Phone: ${requester.phone || "—"}
Event: ${eventType || "—"} (${eventDate || "—"})

Items requested:
${itemLines || "(none)"}

Open the app and go to Admin > Orders to review it.
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
        to: [reviewerEmail],
        subject: "New equipment request needs review",
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
