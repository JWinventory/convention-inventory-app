// Vercel serverless function (runs on the server, not in the browser).
// It compares the submitted password to the ADMIN_PASSWORD environment
// variable, which is never sent to the client's JavaScript bundle.
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ ok: false, error: "ADMIN_PASSWORD is not set on the server" });
    return;
  }

  const { password } = req.body || {};
  if (typeof password === "string" && password === expected) {
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
}
