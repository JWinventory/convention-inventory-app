import crypto from "crypto";

// Verifies a password against a previously stored hash+salt. The
// comparison happens server-side using a timing-safe check, so timing
// differences can't leak information about the correct password.
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password, hash, salt } = req.body || {};
  if (!password || !hash || !salt) {
    res.status(400).json({ error: "Missing password, hash, or salt." });
    return;
  }

  try {
    const computed = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    res.status(200).json({ ok });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify password." });
  }
}
