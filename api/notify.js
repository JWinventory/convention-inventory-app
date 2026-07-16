// Vercel serverless function — runs on the server, never in the browser,
// so RESEND_API_KEY stays private (it's a plain env var, not a VITE_ one).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_TO_EMAIL;

  if (!apiKey || !toEmail) {
    res.status(500).json({
      error:
        "Email isn't configured on the server yet. Add RESEND_API_KEY and NOTIFY_TO_EMAIL in Vercel project settings.",
    });
    return;
  }

  const { requesterEmail, requester, items, notes } = req.body || {};

  if (!requester || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing request details or item list." });
    return;
  }

  const itemLines = items.map((it) => `• ${it.name} × ${it.out}`).join("\n");

  const text = `New equipment request submitted

Requester: ${requester.name || "—"}
Phone: ${requester.phone || "—"}
Event date: ${requester.eventDate || "—"}
Pickup date: ${requester.pickupDate || "—"}
Return date: ${requester.returnDate || "—"}

Items requested:
${itemLines || "(none)"}

Notes:
${notes || "(none)"}
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
        to: [toEmail],
        reply_to: requesterEmail || undefined,
        subject: `Equipment request from ${requester.name || "a volunteer"}`,
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
