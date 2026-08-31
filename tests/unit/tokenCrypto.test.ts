import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "../../server/tokenCrypto";

describe("Token Encryption & Decryption (AES-256-GCM)", () => {
  it("zašifruje a správne dešifruje citlivý OAuth token", () => {
    const plainToken = "lin_oauth_token_123456789abcdef";
    const encrypted = encryptToken(plainToken);

    expect(encrypted).not.toBe(plainToken);
    expect(encrypted.split(":").length).toBe(3);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plainToken);
  });

  it("vygeneruje odlišný ciphertext pri dvoch volaniach vďaka náhodnému IV", () => {
    const plainToken = "secret_gho_token_xyz987";
    const enc1 = encryptToken(plainToken);
    const enc2 = encryptToken(plainToken);

    expect(enc1).not.toBe(enc2);
    expect(decryptToken(enc1)).toBe(plainToken);
    expect(decryptToken(enc2)).toBe(plainToken);
  });

  it("bezpečne zlyhá pri poškodenom auth tagu alebo ciphertexte", () => {
    const plainToken = "my_access_token";
    const encrypted = encryptToken(plainToken);
    const parts = encrypted.split(":");
    
    // Corrupt the ciphertext
    const corruptedCipher = `${parts[0]}:${parts[1]}:deadbeef`;
    expect(() => decryptToken(corruptedCipher)).toThrow();

    // Corrupt the auth tag
    const corruptedTag = `${parts[0]}:00112233445566778899aabbccddeeff:${parts[2]}`;
    expect(() => decryptToken(corruptedTag)).toThrow();
  });

  it("spracuje prázdny reťazec ako prázdny bez chyby", () => {
    expect(encryptToken("")).toBe("");
    expect(decryptToken("")).toBe("");
  });
});
