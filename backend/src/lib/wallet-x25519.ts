import { bytesToHex } from "@noble/hashes/utils.js";

// Convert an Ed25519 public key to the matching X25519 (Montgomery) public key,
// so the clinic can `seal()` a record update to a wallet that only publishes an
// Ed25519 identity (its wallet number). The patient wallet derives the matching
// X25519 *private* key from its Ed25519 seed (SHA-512 clamp) to `open()` it —
// this file MUST stay byte-for-byte compatible with the wallet app's
// src/lib/crypto.ts. @noble/curves does not export edwardsToMontgomery in the
// pinned version, so the birational map u = (1 + y) / (1 - y) mod p is done here
// with BigInt. Verified: edPubToMontU(A) === x25519.getPublicKey(edClamp(seed)).

const P = 2n ** 255n - 19n;

function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

// Modular inverse via Fermat's little theorem (p is prime).
function inv(a: bigint): bigint {
  return modpow(((a % P) + P) % P, P - 2n, P);
}

// Ed25519 public key (compressed, little-endian y with the x-sign in the high
// bit) → X25519 u-coordinate, returned as 32-byte little-endian hex.
export function ed25519PubToX25519Hex(edPub: Uint8Array): string {
  if (edPub.length !== 32) throw new Error("Ed25519 public key must be 32 bytes.");
  const bytes = edPub.slice();
  bytes[31] = (bytes[31] as number) & 0x7f; // clear the x sign bit
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i] as number);
  y %= P;
  // u = (1 + y) / (1 - y)  (mod p)
  const u = ((1n + y) * inv((1n - y + P) % P)) % P;
  const out = new Uint8Array(32);
  let v = u;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytesToHex(out);
}
