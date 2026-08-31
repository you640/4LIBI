import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(customKey?: string): Buffer {
  const secret =
    customKey ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.CONNECTION_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY (alebo JWT_SECRET) musí mať aspoň 32 znakov."
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a sensitive string (such as an OAuth access or refresh token) using AES-256-GCM.
 * Output format: `iv_hex:auth_tag_hex:ciphertext_hex`
 */
export function encryptToken(plainText: string, customKey?: string): string {
  if (!plainText) return "";
  const key = getMasterKey(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a token payload encrypted with `encryptToken`.
 */
export function decryptToken(cipherPayload: string, customKey?: string): string {
  if (!cipherPayload) return "";
  const parts = cipherPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Neplatný formát zašifrovaného tokenu (očakáva sa iv:authTag:ciphertext).");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getMasterKey(customKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
