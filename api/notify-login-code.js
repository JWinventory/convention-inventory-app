// Vercel serverless function — emails a volunteer their 6-digit login
// code for the second step of admin sign-in (email-based 2FA). The
// code itself is generated client-side; only the hash of it is ever
// stored in Firestore (see LoginForm's sendLoginCode in AdminHub.jsx).
// This endpoint just sends the plaintext code to the volunteer's
// inbox, which is the actual secret channel. Reuses the same
// RESEND_API_KEY already configured for the other notify endpoints,
// and matches their same layout.
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

  const { volunteerEmail, volunteerName, code } = req.body || {};
  if (!volunteerEmail || !code) {
    res.status(400).json({ error: "Missing recipient or code." });
    return;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  const text = `Here's your CEPC-Lubbock admin login code${volunteerName ? `, ${volunteerName}` : ""}:

${code}

Enter this on the login screen to finish signing in. It's good for 10 minutes.

If you didn't try to log in, you can ignore this email — your account is safe.

Warmly,
CEPC-Lubbock Equipment Team
`;

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
          <div style="font-size:21px; font-weight:700; color:#1a1a2e;">Your login code${volunteerName ? `, ${esc(volunteerName)}` : ""}</div>
        </td></tr>

        <tr><td style="padding: 16px 36px 0;">
          <div style="background:#eaf3fc; border-radius:10px; padding:16px 18px; font-size:14px; color:#1a1a2e; line-height:1.6;">
            Enter this code on the login screen to finish signing in. It expires in 10 minutes.
          </div>
        </td></tr>

        <tr><td style="padding: 28px 36px 0;" align="center">
          <div style="display:inline-block; background:#f5f7fa; border-radius:10px; padding:16px 32px; font-size:34px; font-weight:800; letter-spacing:8px; color:#1a1a2e;">${esc(code)}</div>
        </td></tr>

        <tr><td style="padding: 22px 36px 0; font-size:12px; color:#999; line-height:1.6;" align="center">
          This code is good for 10 minutes.
        </td></tr>

        <tr><td style="padding: 26px 36px 36px; font-size:14px; color:#333; line-height:1.6;">
          If you didn't try to log in, you can ignore this email — your account is safe.<br/><br/>
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
        subject: `Your CEPC-Lubbock login code: ${code}`,
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
