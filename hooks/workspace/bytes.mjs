/**
 * Bytes helpers for the Design workspace mod: base64 both ways and UUID v4 ids.
 *
 * Written by hand on purpose: the mod's environment has no Node `Buffer`, and CI runs these modules under Node 22.13,
 * which has no `Uint8Array.prototype.toBase64` or `Uint8Array.fromBase64`. Pure: no `$`.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < ALPHABET.length; index += 1) table[ALPHABET.charCodeAt(index)] = index;
  return table;
})();

/** Standard padded base64 of the bytes. */
export function base64Encode(bytes) {
  const parts = [];
  const CHUNK = 3 * 4096;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(bytes.length, start + CHUNK);
    let out = '';
    let index = start;
    for (; index + 2 < end; index += 3) {
      const n = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
      out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
    }
    const rest = end - index;
    if (rest === 1) {
      const n = bytes[index] << 16;
      out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + '==';
    } else if (rest === 2) {
      const n = (bytes[index] << 16) | (bytes[index + 1] << 8);
      out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + '=';
    }
    parts.push(out);
  }
  return parts.join('');
}

/** The bytes of standard base64 text; whitespace is ignored, anything else outside the alphabet throws. */
export function base64Decode(text) {
  const clean = String(text).replace(/[\t\n\r ]/g, '');
  if (clean.length % 4 === 1) throw new Error('base64 text has a bad length');
  const unpadded = clean.replace(/={1,2}$/, '');
  const out = new Uint8Array(Math.floor((unpadded.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let at = 0;
  for (let index = 0; index < unpadded.length; index += 1) {
    const code = unpadded.charCodeAt(index);
    const digit = code < 128 ? LOOKUP[code] : -1;
    if (digit < 0) throw new Error('base64 text holds a character outside its alphabet');
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at] = (value >> bits) & 0xff;
      at += 1;
    }
  }
  return out;
}

/** Sixteen random bytes from the environment's `crypto.getRandomValues`. */
export function randomBytes16() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** A UUID v4 (the schema's pattern: lower-case hex, version 4, variant 8-b) from 16 bytes, random by default. */
export function uuidV4(bytes = randomBytes16()) {
  const b = Uint8Array.from(bytes.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The server's UUID v4 pattern for opId, handoffId and clientRequestId. */
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
