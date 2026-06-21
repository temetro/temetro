import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  randomBytes,
} from "@noble/hashes/utils.js";

// Cryptographic primitives shared (by convention — the wire format is mirrored
// in the mobile wallet app's src/lib/crypto.ts) between the clinic backend and
// the patient wallet. Identity is an Ed25519 keypair; the patient's public key,
// base58check-encoded with a `tmw_` prefix, is their human-typeable **wallet
// number**. Record bundles are sealed to a recipient's ephemeral X25519 key
// (sealed-box: ephemeral sender key + X25519 ECDH + XChaCha20-Poly1305) so the
// relay only ever forwards ciphertext, and signed with the wallet's Ed25519 key
// so the recipient can verify the bundle truly came from that wallet number.
//
// Both apps use @noble so the byte layout is identical on every platform.

export const WALLET_PREFIX = "tmw_";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] as number) << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    out += B58_ALPHABET[digits[i] as number];
  }
  return out;
}

function base58Decode(str: string): Uint8Array {
  let zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < str.length; i++) {
    const value = B58_ALPHABET.indexOf(str[i] as string);
    if (value < 0) throw new Error("Invalid base58 character.");
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += (bytes[j] as number) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[zeros + bytes.length - 1 - i] = bytes[i] as number;
  }
  return out;
}

function checksum(payload: Uint8Array): Uint8Array {
  return sha256(sha256(payload)).slice(0, 4);
}

// --- Ed25519 identity -------------------------------------------------------

export function newSigningKeypair(): { privateKeyHex: string; publicKeyHex: string } {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey),
  };
}

export function signMessage(privateKeyHex: string, message: Uint8Array): string {
  return bytesToHex(ed25519.sign(message, hexToBytes(privateKeyHex)));
}

export function verifySignature(
  publicKey: Uint8Array,
  signatureHex: string,
  message: Uint8Array,
): boolean {
  try {
    return ed25519.verify(hexToBytes(signatureHex), message, publicKey);
  } catch {
    return false;
  }
}

// `ed25519:9f86 d081 …` — a short, human-comparable fingerprint of a public key
// (first 16 bytes of its SHA-256, grouped in fours). Matches the panel format.
export function fingerprint(publicKey: Uint8Array): string {
  const hex = bytesToHex(sha256(publicKey)).slice(0, 32);
  const groups = hex.match(/.{1,4}/g) ?? [];
  return `ed25519:${groups.join(" ")}`;
}

// --- Wallet number (base58check of the Ed25519 public key) ------------------

export function encodeWalletNumber(publicKey: Uint8Array): string {
  const payload = concatBytes(publicKey, checksum(publicKey));
  return WALLET_PREFIX + base58Encode(payload);
}

// Decode + validate a wallet number back to its 32-byte Ed25519 public key.
// Throws on a bad prefix, bad base58, wrong length, or checksum mismatch.
export function decodeWalletNumber(walletNumber: string): Uint8Array {
  const trimmed = walletNumber.trim();
  if (!trimmed.startsWith(WALLET_PREFIX)) {
    throw new Error("Wallet number must start with tmw_.");
  }
  const decoded = base58Decode(trimmed.slice(WALLET_PREFIX.length));
  if (decoded.length !== 36) {
    throw new Error("Wallet number has an invalid length.");
  }
  const publicKey = decoded.slice(0, 32);
  const check = decoded.slice(32);
  const expected = checksum(publicKey);
  if (check.some((b, i) => b !== expected[i])) {
    throw new Error("Wallet number checksum mismatch (likely a typo).");
  }
  return publicKey;
}

export function isValidWalletNumber(walletNumber: string): boolean {
  try {
    decodeWalletNumber(walletNumber);
    return true;
  } catch {
    return false;
  }
}

// --- Sealed box (anonymous sender -> recipient X25519 public key) -----------

export function newEncryptionKeypair(): {
  privateKeyHex: string;
  publicKeyHex: string;
} {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey),
  };
}

function deriveKey(
  shared: Uint8Array,
  ephemeralPub: Uint8Array,
  recipientPub: Uint8Array,
): Uint8Array {
  return sha256(concatBytes(shared, ephemeralPub, recipientPub));
}

// Seal `plaintext` to `recipientPublicKeyHex` (X25519). Returns base64 of
// `ephemeralPub(32) || nonce(24) || ciphertext`.
export function seal(
  recipientPublicKeyHex: string,
  plaintext: Uint8Array,
): string {
  const recipientPub = hexToBytes(recipientPublicKeyHex);
  const ephemeralPriv = x25519.utils.randomSecretKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  const shared = x25519.getSharedSecret(ephemeralPriv, recipientPub);
  const key = deriveKey(shared, ephemeralPub, recipientPub);
  const nonce = randomBytes(24);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);
  return Buffer.from(concatBytes(ephemeralPub, nonce, ciphertext)).toString(
    "base64",
  );
}

export function open(
  recipientPrivateKeyHex: string,
  sealedBase64: string,
): Uint8Array {
  const recipientPriv = hexToBytes(recipientPrivateKeyHex);
  const recipientPub = x25519.getPublicKey(recipientPriv);
  const blob = new Uint8Array(Buffer.from(sealedBase64, "base64"));
  const ephemeralPub = blob.slice(0, 32);
  const nonce = blob.slice(32, 56);
  const ciphertext = blob.slice(56);
  const shared = x25519.getSharedSecret(recipientPriv, ephemeralPub);
  const key = deriveKey(shared, ephemeralPub, recipientPub);
  return xchacha20poly1305(key, nonce).decrypt(ciphertext);
}
