// Vercel serverless function — emails the requester once their order
// has been gathered and is ready for pickup. Reuses the same
// RESEND_API_KEY already configured for api/notify.js.
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

  const { requesterEmail, requester, items } = req.body || {};
  if (!requester || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing request details or item list." });
    return;
  }

  // No email on file for this requester — nothing to send, but this
  // isn't an error; staff can still mark the order ready either way.
  if (!requesterEmail) {
    res.status(200).json({ ok: true, skipped: "no-email" });
    return;
  }

  const itemLines = items.map((it) => `• ${it.name} × ${it.qty}`).join("\n");
  const text = `Good news — your equipment request is ready for pickup!

Requester: ${requester.name || "—"}
Phone: ${requester.phone || "—"}

Items ready:
${itemLines || "(none)"}

Once you've picked everything up and are ready to return it, scan each item's QR code in the app to check it back in.
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
        to: [requesterEmail],
        subject: "Your equipment request is ready!",
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
