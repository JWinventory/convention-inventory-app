import crypto from "crypto";

// Hashes a password server-side using scrypt (Node's built-in, no new
// dependency needed) with a fresh random salt. The plaintext password
// is never stored anywhere — only the hash and salt are saved.
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password } = req.body || {};
  if (!password || typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters." });
    return;
  }

  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    res.status(200).json({ hash, salt });
  } catch (err) {
    res.status(500).json({ error: "Failed to hash password." });
  }
}
