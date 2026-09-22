// Vercel serverless function — emails the requester and, if one was
// designated, the person returning the items, confirming a request
// was submitted. Fires alongside notify-review, but never blocks
// order creation if it fails — the order is already safely saved
// before this is ever called. Reuses the same RESEND_API_KEY already
// configured for the other notify endpoints.
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

  const { requesterEmail, returnerEmail, requester, returner, eventType, eventDate, pickupDate, returnDate, items } =
    req.body || {};

  if (!requester || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing request details or item list." });
    return;
  }

  // Either or both may have left an email — send to whichever did.
  const recipients = [requesterEmail, returnerEmail]
    .map((e) => (e || "").trim())
    .filter(Boolean)
    .filter((e, i, arr) => arr.indexOf(e) === i); // de-dupe if they match

  if (recipients.length === 0) {
    res.status(200).json({ ok: true, skipped: "no-email" });
    return;
  }

  const itemLines = items.map((it) => `• ${it.name} × ${it.qty}`).join("\n");
  const returnerLine = returner?.name
    ? `Returning items: ${returner.name}${returner.phone ? ` (${returner.phone})` : ""}\n`
    : "";

  const text = `Your equipment request has been submitted.

Requester: ${requester.name || "—"} (${requester.phone || "—"})
${returnerLine}Event: ${eventType || "—"}
Event Date: ${eventDate || "—"}
Pickup Date: ${pickupDate || "—"}
Return Date: ${returnDate || "—"}

Items requested:
${itemLines || "(none)"}

You'll get another email once it's ready for pickup — no need to check back manually.
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
        subject: "Your equipment request has been submitted",
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
