import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM with MOODLE_TOKEN_KEY (32 random bytes, base64). Format: iv.tag.ciphertext (base64url). */
function key(): Buffer {
  const k = process.env.MOODLE_TOKEN_KEY;
  if (!k) throw new Error("MOODLE_TOKEN_KEY not set");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("MOODLE_TOKEN_KEY must be 32 bytes (base64)");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(packed: string): string {
  const [iv, tag, enc] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
