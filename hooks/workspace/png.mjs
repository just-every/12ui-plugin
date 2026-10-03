/**
 * RGBA pixels to a PNG file, with stored (uncompressed) deflate blocks: no compressor to vendor, and every byte is
 * predictable, so a size budget is arithmetic. Used for the Desktop picture when the server's JPEG is too large to
 * embed in an Svg (picture.mjs). Pure: no `$`.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const STORED_MAX = 65535;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (ISO 3309, as PNG chunks use) of the bytes. */
export function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xffffffff;
  for (let index = start; index < end; index += 1) c = CRC_TABLE[(c ^ bytes[index]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32 (RFC 1950) of the bytes. */
export function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    a = (a + bytes[index]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Bytes a stored PNG of this size takes, without building it: what a size budget compares against. */
export function storedPngBytes(width, height, channels) {
  const raw = (width * channels + 1) * height;
  const blocks = Math.max(1, Math.ceil(raw / STORED_MAX));
  const idat = 2 + raw + blocks * 5 + 4;
  return SIGNATURE.length + (12 + 13) + (12 + idat) + 12;
}

function writeUint32(out, at, value) {
  out[at] = (value >>> 24) & 0xff;
  out[at + 1] = (value >>> 16) & 0xff;
  out[at + 2] = (value >>> 8) & 0xff;
  out[at + 3] = value & 0xff;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  for (let index = 0; index < 4; index += 1) out[4 + index] = type.charCodeAt(index);
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

function zlibStored(raw) {
  const blocks = Math.max(1, Math.ceil(raw.length / STORED_MAX));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let at = 2;
  for (let block = 0; block < blocks; block += 1) {
    const start = block * STORED_MAX;
    const length = Math.min(STORED_MAX, raw.length - start);
    out[at] = block === blocks - 1 ? 1 : 0;
    out[at + 1] = length & 0xff;
    out[at + 2] = (length >>> 8) & 0xff;
    out[at + 3] = ~length & 0xff;
    out[at + 4] = (~length >>> 8) & 0xff;
    out.set(raw.subarray(start, start + length), at + 5);
    at += 5 + length;
  }
  writeUint32(out, at, adler32(raw));
  return out;
}

/**
 * A whole PNG of the pixels: 8-bit RGB (`alpha: false`, the default, since workspace pictures are opaque) or RGBA,
 * filter 0 on every row.
 */
export function encodePng({ rgba, width, height }, { alpha = false } = {}) {
  if (!(width > 0 && height > 0) || rgba.length < width * height * 4) throw new Error('PNG pixels do not match the size');
  const channels = alpha ? 4 : 3;
  const stride = width * channels + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    let at = y * stride + 1;
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 4;
      raw[at] = rgba[from];
      raw[at + 1] = rgba[from + 1];
      raw[at + 2] = rgba[from + 2];
      if (alpha) raw[at + 3] = rgba[from + 3];
      at += channels;
    }
  }
  const header = new Uint8Array(13);
  writeUint32(header, 0, width);
  writeUint32(header, 4, height);
  header[8] = 8;
  header[9] = alpha ? 6 : 2;
  const parts = [Uint8Array.from(SIGNATURE), chunk('IHDR', header), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
