/**
 * 客户端 AES-256-GCM 加密工具
 * 日记内容在上传前本地加密，服务端只存密文
 * 密钥派生自用户密码 + userId（PBKDF2）
 *
 * 注：当前版本为可选加密（用户在设置中开启）
 * 开启后旧数据需重新加密，关闭后密文无法读取
 */

const ALGO = "AES-GCM";
const KEY_LEN = 256;
const ITERATIONS = 100000;

function str2buf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function buf2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642buf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function deriveKey(password: string, userId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw", str2buf(password + userId), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: str2buf(userId), iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: ALGO, length: KEY_LEN },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: ALGO, iv }, key, str2buf(plaintext)
  );
  // Format: base64(iv):base64(ciphertext)
  return `enc:${buf2b64(iv.buffer)}:${buf2b64(cipherBuf)}`;
}

export async function decryptText(encrypted: string, key: CryptoKey): Promise<string> {
  if (!encrypted.startsWith("enc:")) return encrypted; // not encrypted
  const parts = encrypted.split(":");
  if (parts.length !== 3) return encrypted;
  try {
    const iv = b642buf(parts[1]);
    const cipher = b642buf(parts[2]);
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return "[解密失败，请检查密钥]";
  }
}

export function isEncrypted(text: string): boolean {
  return text.startsWith("enc:");
}

// Key cache (session only)
let _cachedKey: CryptoKey | null = null;
let _cachedUserId: string | null = null;

export async function getSessionKey(password: string, userId: string): Promise<CryptoKey> {
  if (_cachedKey && _cachedUserId === userId) return _cachedKey;
  _cachedKey = await deriveKey(password, userId);
  _cachedUserId = userId;
  return _cachedKey;
}

export function clearSessionKey(): void {
  _cachedKey = null;
  _cachedUserId = null;
}

// Encryption enabled flag
export function isEncryptionEnabled(): boolean {
  return localStorage.getItem("diary_encryption") === "1";
}

export function setEncryptionEnabled(v: boolean): void {
  if (v) localStorage.setItem("diary_encryption", "1");
  else localStorage.removeItem("diary_encryption");
}

export function getEncryptionPassword(): string {
  return localStorage.getItem("diary_enc_pw") || "";
}

export function setEncryptionPassword(pw: string): void {
  // Store pw in sessionStorage only (lost on tab close for security)
  sessionStorage.setItem("diary_enc_pw_session", pw);
}

export function getSessionPassword(): string {
  return sessionStorage.getItem("diary_enc_pw_session") || "";
}
