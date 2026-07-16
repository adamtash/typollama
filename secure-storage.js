import { SECRET_KEYS } from "./constants.js";

const ENCRYPTION_KEY = "typollamaEncryptionKey";

async function encryptionKey() {
  const stored = await chrome.storage.local.get(ENCRYPTION_KEY);
  if (stored[ENCRYPTION_KEY]) {
    const bytes = Uint8Array.from(stored[ENCRYPTION_KEY]);
    return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", key);
  await chrome.storage.local.set({ [ENCRYPTION_KEY]: [...new Uint8Array(raw)] });
  return key;
}

async function encrypt(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return { version: 2, iv: [...iv], cipher: [...new Uint8Array(cipher)] };
}

async function decrypt(value) {
  if (!value?.iv || !value?.cipher) return "";
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(value.iv) }, await encryptionKey(), new Uint8Array(value.cipher));
  return new TextDecoder().decode(data);
}

async function decryptLegacy(value, serializedKey) {
  if (!serializedKey || !value?.iv || !value?.cipher) return "";
  const raw = Uint8Array.from(JSON.parse(serializedKey));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(value.iv) }, key, new Uint8Array(value.cipher));
  return new TextDecoder().decode(data);
}

export async function configurePrivateStorage() {
  if (chrome.storage.local.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  }
}

export async function readSecrets() {
  const values = await chrome.storage.local.get([...SECRET_KEYS, "encKey"]);
  const entries = await Promise.all(SECRET_KEYS.map(async (name) => {
    const value = values[name];
    if (!value) return [name, ""];
    const secret = value.version === 2 ? await decrypt(value) : await decryptLegacy(value, values.encKey);
    if (secret && value.version !== 2) await saveSecret(name, secret);
    return [name, secret];
  }));
  if (values.encKey) await chrome.storage.local.remove("encKey");
  return Object.fromEntries(entries);
}

export async function saveSecret(name, value) {
  if (!SECRET_KEYS.includes(name)) throw new Error("Unknown secret setting.");
  if (!value) return chrome.storage.local.remove(name);
  return chrome.storage.local.set({ [name]: await encrypt(value) });
}
