/**
 * §15.2 key storage. Android: Keystore-backed secure storage plugin. PWA: AES-GCM under a
 * passphrase (PBKDF2) kept only for the session. Keys never reach the export or backup.
 */
import { hasPlugin, isNative } from "@/native/bridge";

export type KeyName = "anthropic" | "gemini";

let passphrase: string | null = null;
export const setPassphrase = (p: string | null) => (passphrase = p);
export const hasPassphrase = () => passphrase !== null;

const STORAGE_PREFIX = "531log.key.";

async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function nativeStore() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

export async function setKey(name: KeyName, value: string): Promise<void> {
  if (isNative() && hasPlugin("SecureStorage")) {
    await (await nativeStore()).set(`${STORAGE_PREFIX}${name}`, value);
    return;
  }
  if (!passphrase) throw new Error("Enter a passphrase first");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(value)));
  localStorage.setItem(`${STORAGE_PREFIX}${name}`, JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
}

export async function getKey(name: KeyName): Promise<string | null> {
  if (isNative() && hasPlugin("SecureStorage")) {
    const v = await (await nativeStore()).get(`${STORAGE_PREFIX}${name}`);
    return typeof v === "string" ? v : null;
  }
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${name}`);
  if (!raw) return null;
  if (!passphrase) throw new Error("Enter a passphrase to unlock the key");
  const { salt, iv, ct } = JSON.parse(raw) as { salt: string; iv: string; ct: string };
  const key = await deriveKey(passphrase, unb64(salt));
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) as BufferSource }, key, unb64(ct) as BufferSource);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("Wrong passphrase");
  }
}

export async function hasKey(name: KeyName): Promise<boolean> {
  if (isNative() && hasPlugin("SecureStorage")) return (await (await nativeStore()).get(`${STORAGE_PREFIX}${name}`)) !== null;
  return localStorage.getItem(`${STORAGE_PREFIX}${name}`) !== null;
}

export async function clearKey(name: KeyName): Promise<void> {
  if (isNative() && hasPlugin("SecureStorage")) {
    await (await nativeStore()).remove(`${STORAGE_PREFIX}${name}`);
    return;
  }
  localStorage.removeItem(`${STORAGE_PREFIX}${name}`);
}

export const needsPassphrase = () => !(isNative() && hasPlugin("SecureStorage"));
