/**
 * A lossy WebP (VP8 key frame) decoder to RGBA, written for the pane: corpus pictures are WebP only
 * (images.12ui.com serves no JPEG or PNG rendition) and the mod runtime has no image decoder of its own
 * (design.md amendment A3). It follows RFC 6386 and libwebp's decoder step for step: bool decoder, frame
 * header, intra modes, coefficient tokens, dequantisation, inverse WHT and DCT, intra prediction, the normal
 * and simple loop filters. Chroma is upsampled by pixel replication, which is enough for a thumbnail.
 * Not supported: lossless (VP8L) and animation; alpha is dropped (the corpus thumbnails are opaque).
 */

import { AC_TABLE, BMODES_PROBA, COEFF_PROBA0, COEFF_UPDATE_PROBA, DC_TABLE } from './webp-tables.mjs';

const ZIGZAG = [0, 1, 4, 8, 5, 2, 3, 6, 9, 12, 13, 10, 7, 11, 14, 15];
const BANDS = [0, 1, 2, 3, 6, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 0];
const CAT3456 = [[173, 148, 140], [176, 155, 140, 135], [180, 157, 141, 134, 130], [254, 254, 243, 230, 196, 177, 153, 140, 133, 130, 129]];
// libwebp's mode numbers: the 16x16 and chroma modes share the first four with the 4x4 modes.
const DC_PRED = 0, TM_PRED = 1, V_PRED = 2, H_PRED = 3;
const B_VE = 2, B_HE = 3, B_RD = 4, B_VR = 5, B_LD = 6, B_VL = 7, B_HD = 8, B_HU = 9;
// The 4x4 mode tree, as libwebp spells it: a leaf is minus the mode.
const YMODES_INTRA4 = [-0, 1, -1, 2, -2, 3, 4, 6, -3, 5, -4, -5, -6, 7, -7, 8, -8, -9];

class BoolDecoder {
  constructor(buf, start, end) {
    this.buf = buf;
    this.pos = start;
    this.end = end;
    this.value = (this.byte() << 8) | this.byte();
    this.range = 255;
    this.count = 0;
  }

  byte() {
    return this.pos < this.end ? this.buf[this.pos++] : 0;
  }

  bit(prob) {
    const split = 1 + (((this.range - 1) * prob) >> 8);
    const big = split << 8;
    let bit;
    if (this.value >= big) {
      bit = 1;
      this.range -= split;
      this.value -= big;
    } else {
      bit = 0;
      this.range = split;
    }
    while (this.range < 128) {
      this.value <<= 1;
      this.range <<= 1;
      if (++this.count === 8) {
        this.count = 0;
        this.value |= this.byte();
      }
    }
    return bit;
  }

  literal(bits) {
    let v = 0;
    while (bits-- > 0) v = (v << 1) | this.bit(128);
    return v;
  }

  signed(bits) {
    const v = this.literal(bits);
    return this.bit(128) ? -v : v;
  }

  optionalSigned(bits) {
    return this.bit(128) ? this.signed(bits) : 0;
  }
}

const clip = (v, max) => (v < 0 ? 0 : v > max ? max : v);
const clip8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const avg3 = (a, b, c) => (a + 2 * b + c + 2) >> 2;
const avg2 = (a, b) => (a + b + 1) >> 1;
const sclip1 = (v) => (v < -128 ? -128 : v > 127 ? 127 : v);
const sclip2 = (v) => (v < -16 ? -16 : v > 15 ? 15 : v);

/** The VP8 chunk of a RIFF WebP file: its offset and size. */
function vp8Chunk(bytes) {
  const tag = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (bytes.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('not a WebP file');
  let at = 12;
  while (at + 8 <= bytes.length) {
    const name = tag(at);
    const size = bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] << 24);
    if (name === 'VP8 ') return { start: at + 8, size };
    if (name === 'VP8L') throw new Error('lossless WebP is not supported');
    at += 8 + size + (size & 1);
  }
  throw new Error('no VP8 image in the WebP file');
}

function parseHeader(br, segments) {
  br.bit(128); // colour space
  br.bit(128); // clamping type
  const seg = { use: br.bit(128), updateMap: 0, absolute: 0, quantizer: [0, 0, 0, 0], filter: [0, 0, 0, 0], proba: [255, 255, 255] };
  if (seg.use) {
    seg.updateMap = br.bit(128);
    if (br.bit(128)) {
      seg.absolute = br.bit(128);
      for (let s = 0; s < 4; s++) seg.quantizer[s] = br.optionalSigned(7);
      for (let s = 0; s < 4; s++) seg.filter[s] = br.optionalSigned(6);
    }
    if (seg.updateMap) for (let s = 0; s < 3; s++) seg.proba[s] = br.bit(128) ? br.literal(8) : 255;
  }
  const filter = { simple: br.bit(128), level: br.literal(6), sharpness: br.literal(3), useDelta: br.bit(128), ref: [0, 0, 0, 0], mode: [0, 0, 0, 0] };
  if (filter.useDelta && br.bit(128)) {
    for (let i = 0; i < 4; i++) if (br.bit(128)) filter.ref[i] = br.signed(6);
    for (let i = 0; i < 4; i++) if (br.bit(128)) filter.mode[i] = br.signed(6);
  }
  segments.seg = seg;
  segments.filter = filter;
}

function quantFor(br, seg) {
  const base = br.literal(7);
  const dqy1dc = br.optionalSigned(4);
  const dqy2dc = br.optionalSigned(4);
  const dqy2ac = br.optionalSigned(4);
  const dquvdc = br.optionalSigned(4);
  const dquvac = br.optionalSigned(4);
  const out = [];
  for (let s = 0; s < 4; s++) {
    let q = base;
    if (seg.use) q = seg.absolute ? seg.quantizer[s] : seg.quantizer[s] + base;
    const y2ac = (AC_TABLE[clip(q + dqy2ac, 127)] * 101581) >> 16;
    out.push({
      y1: [DC_TABLE[clip(q + dqy1dc, 127)], AC_TABLE[clip(q, 127)]],
      y2: [DC_TABLE[clip(q + dqy2dc, 127)] * 2, y2ac < 8 ? 8 : y2ac],
      uv: [DC_TABLE[clip(q + dquvdc, 117)], AC_TABLE[clip(q + dquvac, 127)]],
    });
  }
  return out;
}

function filterStrengths(seg, filter) {
  const out = [];
  for (let s = 0; s < 4; s++) {
    let base = filter.level;
    if (seg.use) base = seg.absolute ? seg.filter[s] : seg.filter[s] + filter.level;
    const pair = [];
    for (let i4 = 0; i4 <= 1; i4++) {
      let level = base;
      if (filter.useDelta) {
        level += filter.ref[0];
        if (i4) level += filter.mode[0];
      }
      level = clip(level, 63);
      if (level > 0) {
        let ilevel = level;
        if (filter.sharpness > 0) {
          ilevel >>= filter.sharpness > 4 ? 2 : 1;
          if (ilevel > 9 - filter.sharpness) ilevel = 9 - filter.sharpness;
        }
        if (ilevel < 1) ilevel = 1;
        pair.push({ ilevel, limit: 2 * level + ilevel, hev: level >= 40 ? 2 : level >= 15 ? 1 : 0, inner: i4 });
      } else pair.push({ ilevel: 0, limit: 0, hev: 0, inner: i4 });
    }
    out.push(pair);
  }
  return out;
}

function largeValue(br, p) {
  if (!br.bit(p[3])) return br.bit(p[4]) ? 3 + br.bit(p[5]) : 2;
  if (!br.bit(p[6])) {
    if (!br.bit(p[7])) return 5 + br.bit(159);
    return 7 + 2 * br.bit(165) + br.bit(145);
  }
  const bit1 = br.bit(p[8]);
  const bit0 = br.bit(p[9 + bit1]);
  const cat = 2 * bit1 + bit0;
  let v = 0;
  for (const prob of CAT3456[cat]) v += v + br.bit(prob);
  return v + 3 + (8 << cat);
}

/** Coefficient tokens of one 4x4 block into out[off..off+16]; answers the index after the last non-zero one. */
function coeffs(br, proba, type, ctx, dq, n, out, off) {
  const at = (pos, c) => ((type * 8 + BANDS[pos]) * 3 + c) * 11;
  let p = at(n, ctx);
  for (; n < 16; n++) {
    if (!br.bit(proba[p])) return n;
    while (!br.bit(proba[p + 1])) {
      n++;
      if (n === 16) return 16;
      p = at(n, 0);
    }
    let v;
    if (!br.bit(proba[p + 2])) {
      v = 1;
      p = at(n + 1, 1);
    } else {
      v = largeValue(br, proba.subarray(p, p + 11));
      p = at(n + 1, 2);
    }
    out[off + ZIGZAG[n]] = (br.bit(128) ? -v : v) * dq[n > 0 ? 1 : 0];
  }
  return 16;
}

function inverseWht(input, out) {
  const tmp = new Int32Array(16);
  for (let i = 0; i < 4; i++) {
    const a0 = input[i] + input[12 + i];
    const a1 = input[4 + i] + input[8 + i];
    const a2 = input[4 + i] - input[8 + i];
    const a3 = input[i] - input[12 + i];
    tmp[i] = a0 + a1;
    tmp[8 + i] = a0 - a1;
    tmp[4 + i] = a3 + a2;
    tmp[12 + i] = a3 - a2;
  }
  for (let i = 0; i < 4; i++) {
    const dc = tmp[i * 4] + 3;
    const a0 = dc + tmp[3 + i * 4];
    const a1 = tmp[1 + i * 4] + tmp[2 + i * 4];
    const a2 = tmp[1 + i * 4] - tmp[2 + i * 4];
    const a3 = dc - tmp[3 + i * 4];
    out[(i * 4) * 16] = (a0 + a1) >> 3;
    out[(i * 4 + 1) * 16] = (a3 + a2) >> 3;
    out[(i * 4 + 2) * 16] = (a0 - a1) >> 3;
    out[(i * 4 + 3) * 16] = (a3 - a2) >> 3;
  }
}

const mul1 = (a) => ((a * 20091) >> 16) + a;
const mul2 = (a) => (a * 35468) >> 16;

/** Adds the inverse DCT of in[off..off+16] to the 4x4 pixels at plane[at] (row stride `stride`). */
function inverseDct(input, off, plane, at, stride) {
  const c = new Int32Array(16);
  for (let i = 0; i < 4; i++) {
    const a = input[off + i] + input[off + 8 + i];
    const b = input[off + i] - input[off + 8 + i];
    const cc = mul2(input[off + 4 + i]) - mul1(input[off + 12 + i]);
    const d = mul1(input[off + 4 + i]) + mul2(input[off + 12 + i]);
    c[i * 4] = a + d;
    c[i * 4 + 1] = b + cc;
    c[i * 4 + 2] = b - cc;
    c[i * 4 + 3] = a - d;
  }
  for (let i = 0; i < 4; i++) {
    const dc = c[i] + 4;
    const a = dc + c[8 + i];
    const b = dc - c[8 + i];
    const cc = mul2(c[4 + i]) - mul1(c[12 + i]);
    const d = mul1(c[4 + i]) + mul2(c[12 + i]);
    const row = at + i * stride;
    plane[row] = clip8(plane[row] + ((a + d) >> 3));
    plane[row + 1] = clip8(plane[row + 1] + ((b + cc) >> 3));
    plane[row + 2] = clip8(plane[row + 2] + ((b - cc) >> 3));
    plane[row + 3] = clip8(plane[row + 3] + ((a - d) >> 3));
  }
}

/** A plane with the decoder's borders: 127 above the frame, 129 left of it. */
function makePlane(width, height) {
  const data = new Uint8Array(width * height);
  return {
    data,
    width,
    height,
    get(x, y) {
      if (y < 0) return 127;
      if (x < 0) return 129;
      return data[y * width + x];
    },
  };
}

/** Intra prediction of an n x n block at (x0, y0); `edges` says which neighbours exist (DC only). */
function predictBlock(plane, x0, y0, n, mode, hasTop, hasLeft) {
  const { data, width } = plane;
  const top = [];
  const left = [];
  for (let i = 0; i < n; i++) {
    top.push(plane.get(x0 + i, y0 - 1));
    left.push(plane.get(x0 - 1, y0 + i));
  }
  const corner = plane.get(x0 - 1, y0 - 1);
  const shift = n === 16 ? 5 : 4;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v;
      if (mode === DC_PRED) {
        v = 0;
      } else if (mode === TM_PRED) v = clip8(left[y] + top[x] - corner);
      else if (mode === V_PRED) v = top[x];
      else v = left[y];
      data[(y0 + y) * width + x0 + x] = v;
    }
  }
  if (mode !== DC_PRED) return;
  let dc;
  const sum = (list) => list.reduce((s, v) => s + v, 0);
  if (hasTop && hasLeft) dc = (sum(top) + sum(left) + n) >> shift;
  else if (hasTop) dc = (sum(top) + (n >> 1)) >> (shift - 1);
  else if (hasLeft) dc = (sum(left) + (n >> 1)) >> (shift - 1);
  else dc = 128;
  for (let y = 0; y < n; y++) data.fill(dc, (y0 + y) * width + x0, (y0 + y) * width + x0 + n);
}

/** 4x4 intra prediction; `topRight` are the four samples above and to the right. */
function predict4(plane, x0, y0, mode, topRight) {
  const { data, width } = plane;
  const A = [0, 1, 2, 3].map((i) => plane.get(x0 + i, y0 - 1)).concat(topRight);
  const [I, J, K, L] = [0, 1, 2, 3].map((i) => plane.get(x0 - 1, y0 + i));
  const X = plane.get(x0 - 1, y0 - 1);
  const out = new Array(16);
  const set = (x, y, v) => { out[y * 4 + x] = v; };
  switch (mode) {
    case DC_PRED: {
      const dc = (A[0] + A[1] + A[2] + A[3] + I + J + K + L + 4) >> 3;
      out.fill(dc);
      break;
    }
    case TM_PRED:
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(x, y, clip8([I, J, K, L][y] + A[x] - X));
      break;
    case B_VE: {
      const vals = [avg3(X, A[0], A[1]), avg3(A[0], A[1], A[2]), avg3(A[1], A[2], A[3]), avg3(A[2], A[3], A[4])];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(x, y, vals[x]);
      break;
    }
    case B_HE: {
      const vals = [avg3(X, I, J), avg3(I, J, K), avg3(J, K, L), avg3(K, L, L)];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(x, y, vals[y]);
      break;
    }
    case B_RD: {
      const [a, b, c, d] = A;
      set(0, 3, avg3(J, K, L));
      set(1, 3, avg3(I, J, K)); set(0, 2, avg3(I, J, K));
      set(2, 3, avg3(X, I, J)); set(1, 2, avg3(X, I, J)); set(0, 1, avg3(X, I, J));
      for (const [x, y] of [[3, 3], [2, 2], [1, 1], [0, 0]]) set(x, y, avg3(a, X, I));
      set(3, 2, avg3(b, a, X)); set(2, 1, avg3(b, a, X)); set(1, 0, avg3(b, a, X));
      set(3, 1, avg3(c, b, a)); set(2, 0, avg3(c, b, a));
      set(3, 0, avg3(d, c, b));
      break;
    }
    case B_LD: {
      const [a, b, c, d, e, f, g, h] = A;
      set(0, 0, avg3(a, b, c));
      for (const [x, y] of [[1, 0], [0, 1]]) set(x, y, avg3(b, c, d));
      for (const [x, y] of [[2, 0], [1, 1], [0, 2]]) set(x, y, avg3(c, d, e));
      for (const [x, y] of [[3, 0], [2, 1], [1, 2], [0, 3]]) set(x, y, avg3(d, e, f));
      for (const [x, y] of [[3, 1], [2, 2], [1, 3]]) set(x, y, avg3(e, f, g));
      for (const [x, y] of [[3, 2], [2, 3]]) set(x, y, avg3(f, g, h));
      set(3, 3, avg3(g, h, h));
      break;
    }
    case B_VR: {
      const [a, b, c, d] = A;
      set(0, 0, avg2(X, a)); set(1, 2, avg2(X, a));
      set(1, 0, avg2(a, b)); set(2, 2, avg2(a, b));
      set(2, 0, avg2(b, c)); set(3, 2, avg2(b, c));
      set(3, 0, avg2(c, d));
      set(0, 3, avg3(K, J, I));
      set(0, 2, avg3(J, I, X));
      set(0, 1, avg3(I, X, a)); set(1, 3, avg3(I, X, a));
      set(1, 1, avg3(X, a, b)); set(2, 3, avg3(X, a, b));
      set(2, 1, avg3(a, b, c)); set(3, 3, avg3(a, b, c));
      set(3, 1, avg3(b, c, d));
      break;
    }
    case B_VL: {
      const [a, b, c, d, e, f, g, h] = A;
      set(0, 0, avg2(a, b));
      set(1, 0, avg2(b, c)); set(0, 2, avg2(b, c));
      set(2, 0, avg2(c, d)); set(1, 2, avg2(c, d));
      set(3, 0, avg2(d, e)); set(2, 2, avg2(d, e));
      set(0, 1, avg3(a, b, c));
      set(1, 1, avg3(b, c, d)); set(0, 3, avg3(b, c, d));
      set(2, 1, avg3(c, d, e)); set(1, 3, avg3(c, d, e));
      set(3, 1, avg3(d, e, f)); set(2, 3, avg3(d, e, f));
      set(3, 2, avg3(e, f, g));
      set(3, 3, avg3(f, g, h));
      break;
    }
    case B_HD: {
      const [a, b, c] = A;
      set(0, 0, avg2(I, X)); set(2, 1, avg2(I, X));
      set(0, 1, avg2(J, I)); set(2, 2, avg2(J, I));
      set(0, 2, avg2(K, J)); set(2, 3, avg2(K, J));
      set(0, 3, avg2(L, K));
      set(3, 0, avg3(a, b, c));
      set(2, 0, avg3(X, a, b));
      set(1, 0, avg3(I, X, a)); set(3, 1, avg3(I, X, a));
      set(1, 1, avg3(J, I, X)); set(3, 2, avg3(J, I, X));
      set(1, 2, avg3(K, J, I)); set(3, 3, avg3(K, J, I));
      set(1, 3, avg3(L, K, J));
      break;
    }
    case B_HU: {
      set(0, 0, avg2(I, J));
      set(2, 0, avg2(J, K)); set(0, 1, avg2(J, K));
      set(2, 1, avg2(K, L)); set(0, 2, avg2(K, L));
      set(1, 0, avg3(I, J, K));
      set(3, 0, avg3(J, K, L)); set(1, 1, avg3(J, K, L));
      set(3, 1, avg3(K, L, L)); set(1, 2, avg3(K, L, L));
      for (const [x, y] of [[3, 2], [2, 2], [0, 3], [1, 3], [2, 3], [3, 3]]) set(x, y, L);
      break;
    }
    default:
      throw new Error(`unknown 4x4 mode ${mode}`);
  }
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) data[(y0 + y) * width + x0 + x] = out[y * 4 + x];
}

// ---- loop filter (libwebp dsp/dec.c) ----
function needsFilter(d, p, step, t) {
  return 4 * Math.abs(d[p - step] - d[p]) + Math.abs(d[p - 2 * step] - d[p + step]) <= t;
}

function needsFilter2(d, p, step, t, it) {
  const p3 = d[p - 4 * step], p2 = d[p - 3 * step], p1 = d[p - 2 * step], p0 = d[p - step];
  const q0 = d[p], q1 = d[p + step], q2 = d[p + 2 * step], q3 = d[p + 3 * step];
  if (4 * Math.abs(p0 - q0) + Math.abs(p1 - q1) > t) return false;
  return Math.abs(p3 - p2) <= it && Math.abs(p2 - p1) <= it && Math.abs(p1 - p0) <= it
    && Math.abs(q3 - q2) <= it && Math.abs(q2 - q1) <= it && Math.abs(q1 - q0) <= it;
}

function hev(d, p, step, thresh) {
  return Math.abs(d[p - 2 * step] - d[p - step]) > thresh || Math.abs(d[p + step] - d[p]) > thresh;
}

function filter2(d, p, step) {
  const p1 = d[p - 2 * step], p0 = d[p - step], q0 = d[p], q1 = d[p + step];
  const a = 3 * (q0 - p0) + sclip1(p1 - q1);
  const a1 = sclip2((a + 4) >> 3);
  const a2 = sclip2((a + 3) >> 3);
  d[p - step] = clip8(p0 + a2);
  d[p] = clip8(q0 - a1);
}

function filter4(d, p, step) {
  const p1 = d[p - 2 * step], p0 = d[p - step], q0 = d[p], q1 = d[p + step];
  const a = 3 * (q0 - p0);
  const a1 = sclip2((a + 4) >> 3);
  const a2 = sclip2((a + 3) >> 3);
  const a3 = (a1 + 1) >> 1;
  d[p - 2 * step] = clip8(p1 + a3);
  d[p - step] = clip8(p0 + a2);
  d[p] = clip8(q0 - a1);
  d[p + step] = clip8(q1 - a3);
}

function filter6(d, p, step) {
  const p2 = d[p - 3 * step], p1 = d[p - 2 * step], p0 = d[p - step];
  const q0 = d[p], q1 = d[p + step], q2 = d[p + 2 * step];
  const a = sclip1(3 * (q0 - p0) + sclip1(p1 - q1));
  const a1 = (27 * a + 63) >> 7;
  const a2 = (18 * a + 63) >> 7;
  const a3 = (9 * a + 63) >> 7;
  d[p - 3 * step] = clip8(p2 + a3);
  d[p - 2 * step] = clip8(p1 + a2);
  d[p - step] = clip8(p0 + a1);
  d[p] = clip8(q0 - a1);
  d[p + step] = clip8(q1 - a2);
  d[p + 2 * step] = clip8(q2 - a3);
}

function filterLoop(d, p, hstride, vstride, size, thresh, ithresh, hevThresh, outer) {
  const t2 = 2 * thresh + 1;
  for (let i = 0; i < size; i++, p += vstride) {
    if (!needsFilter2(d, p, hstride, t2, ithresh)) continue;
    if (hev(d, p, hstride, hevThresh)) filter2(d, p, hstride);
    else if (outer) filter6(d, p, hstride);
    else filter4(d, p, hstride);
  }
}

function simpleLoop(d, p, hstride, vstride, thresh) {
  const t2 = 2 * thresh + 1;
  for (let i = 0; i < 16; i++, p += vstride) if (needsFilter(d, p, hstride, t2)) filter2(d, p, hstride);
}

function filterMacroblock(planes, mbx, mby, info, simple) {
  const { limit, ilevel, hev: hevThresh, inner } = info;
  if (limit === 0) return;
  const Y = planes.y.data, ys = planes.y.width;
  const y0 = mby * 16 * ys + mbx * 16;
  if (simple) {
    if (mbx > 0) simpleLoop(Y, y0, 1, ys, limit + 4);
    if (inner) for (let k = 1; k <= 3; k++) simpleLoop(Y, y0 + 4 * k, 1, ys, limit);
    if (mby > 0) simpleLoop(Y, y0, ys, 1, limit + 4);
    if (inner) for (let k = 1; k <= 3; k++) simpleLoop(Y, y0 + 4 * k * ys, ys, 1, limit);
    return;
  }
  const us = planes.u.width;
  const c0 = mby * 8 * us + mbx * 8;
  const chroma = [planes.u.data, planes.v.data];
  if (mbx > 0) {
    filterLoop(Y, y0, 1, ys, 16, limit + 4, ilevel, hevThresh, true);
    for (const C of chroma) filterLoop(C, c0, 1, us, 8, limit + 4, ilevel, hevThresh, true);
  }
  if (inner) {
    for (let k = 1; k <= 3; k++) filterLoop(Y, y0 + 4 * k, 1, ys, 16, limit, ilevel, hevThresh, false);
    for (const C of chroma) filterLoop(C, c0 + 4, 1, us, 8, limit, ilevel, hevThresh, false);
  }
  if (mby > 0) {
    filterLoop(Y, y0, ys, 1, 16, limit + 4, ilevel, hevThresh, true);
    for (const C of chroma) filterLoop(C, c0, us, 1, 8, limit + 4, ilevel, hevThresh, true);
  }
  if (inner) {
    for (let k = 1; k <= 3; k++) filterLoop(Y, y0 + 4 * k * ys, ys, 1, 16, limit, ilevel, hevThresh, false);
    for (const C of chroma) filterLoop(C, c0 + 4 * us, us, 1, 8, limit, ilevel, hevThresh, false);
  }
}

const mulHi = (v, c) => (v * c) >> 8;
const yuvClip = (v) => ((v & ~16383) === 0 ? v >> 6 : v < 0 ? 0 : 255);

/** Decodes a lossy WebP file to `{ width, height, data }` with `data` RGBA, 4 bytes a pixel. */
export function decodeWebp(bytes) {
  const { start, size } = vp8Chunk(bytes);
  const end = start + size;
  const bits = bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16);
  if (bits & 1) throw new Error('not a VP8 key frame');
  const firstSize = bits >> 5;
  if (bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) throw new Error('bad VP8 start code');
  const width = (bytes[start + 6] | (bytes[start + 7] << 8)) & 0x3fff;
  const height = (bytes[start + 8] | (bytes[start + 9] << 8)) & 0x3fff;
  if (!width || !height) throw new Error('empty VP8 frame');
  const firstStart = start + 10;
  const br = new BoolDecoder(bytes, firstStart, firstStart + firstSize);
  const hdr = {};
  parseHeader(br, hdr);
  const { seg, filter } = hdr;
  // Token partitions.
  const lastPart = (1 << br.literal(2)) - 1;
  let partStart = firstStart + firstSize + 3 * lastPart;
  const parts = [];
  for (let p = 0; p < lastPart; p++) {
    const at = firstStart + firstSize + 3 * p;
    const psize = bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
    parts.push(new BoolDecoder(bytes, partStart, Math.min(end, partStart + psize)));
    partStart += psize;
  }
  parts.push(new BoolDecoder(bytes, partStart, end));
  const quant = quantFor(br, seg);
  br.bit(128); // refresh entropy probabilities (one frame only)
  const proba = Uint8Array.from(COEFF_PROBA0);
  for (let i = 0; i < proba.length; i++) if (br.bit(COEFF_UPDATE_PROBA[i])) proba[i] = br.literal(8);
  const useSkip = br.bit(128);
  const skipProba = useSkip ? br.literal(8) : 0;
  const strengths = filterStrengths(seg, filter);
  const filterType = filter.level === 0 ? 0 : filter.simple ? 1 : 2;

  const mbw = (width + 15) >> 4;
  const mbh = (height + 15) >> 4;
  const planes = { y: makePlane(mbw * 16, mbh * 16), u: makePlane(mbw * 8, mbh * 8), v: makePlane(mbw * 8, mbh * 8) };
  const infos = new Array(mbw * mbh);
  const intraTop = new Uint8Array(mbw * 4);
  const nzTop = Array.from({ length: mbw }, () => ({ y: [0, 0, 0, 0], u: [0, 0], v: [0, 0], dc: 0 }));
  const coeff = new Int32Array(25 * 16);

  for (let mby = 0; mby < mbh; mby++) {
    const intraLeft = new Uint8Array(4);
    const nzLeft = { y: [0, 0, 0, 0], u: [0, 0], v: [0, 0], dc: 0 };
    const tokens = parts[mby & lastPart];
    for (let mbx = 0; mbx < mbw; mbx++) {
      // Modes, from the first partition.
      let segment = 0;
      if (seg.updateMap) segment = !br.bit(seg.proba[0]) ? br.bit(seg.proba[1]) : 2 + br.bit(seg.proba[2]);
      const skipFlag = useSkip ? br.bit(skipProba) : 0;
      const isI4 = !br.bit(145);
      const modes = new Uint8Array(16);
      if (!isI4) {
        const ymode = br.bit(156) ? (br.bit(128) ? TM_PRED : H_PRED) : (br.bit(163) ? V_PRED : DC_PRED);
        modes[0] = ymode;
        intraTop.fill(ymode, mbx * 4, mbx * 4 + 4);
        intraLeft.fill(ymode);
      } else {
        for (let y = 0; y < 4; y++) {
          let ymode = intraLeft[y];
          for (let x = 0; x < 4; x++) {
            const base = (intraTop[mbx * 4 + x] * 10 + ymode) * 9;
            let i = YMODES_INTRA4[br.bit(BMODES_PROBA[base])];
            while (i > 0) i = YMODES_INTRA4[2 * i + br.bit(BMODES_PROBA[base + i])];
            ymode = -i;
            intraTop[mbx * 4 + x] = ymode;
            modes[y * 4 + x] = ymode;
          }
          intraLeft[y] = ymode;
        }
      }
      const uvmode = !br.bit(142) ? DC_PRED : !br.bit(114) ? V_PRED : br.bit(183) ? TM_PRED : H_PRED;

      // Residuals, from this row's token partition.
      coeff.fill(0);
      const q = quant[segment];
      const top = nzTop[mbx];
      let anyNonZero = false;
      if (!skipFlag) {
        let first = 0;
        let type = 3;
        if (!isI4) {
          const dc = new Int32Array(16);
          const nz = coeffs(tokens, proba, 1, top.dc + nzLeft.dc, q.y2, 0, dc, 0);
          top.dc = nzLeft.dc = nz > 0 ? 1 : 0;
          inverseWht(dc, coeff);
          first = 1;
          type = 0;
        }
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const off = (y * 4 + x) * 16;
            const nz = coeffs(tokens, proba, type, top.y[x] + nzLeft.y[y], q.y1, first, coeff, off);
            const flag = nz > first ? 1 : 0;
            top.y[x] = nzLeft.y[y] = flag;
            if (nz > first || coeff[off] !== 0) anyNonZero = true;
          }
        }
        for (const [plane, base] of [['u', 16], ['v', 20]]) {
          for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
              const off = (base + y * 2 + x) * 16;
              const nz = coeffs(tokens, proba, 2, top[plane][x] + nzLeft[plane][y], q.uv, 0, coeff, off);
              top[plane][x] = nzLeft[plane][y] = nz > 0 ? 1 : 0;
              if (nz > 0) anyNonZero = true;
            }
          }
        }
      } else {
        top.y.fill(0); nzLeft.y.fill(0); top.u.fill(0); nzLeft.u.fill(0); top.v.fill(0); nzLeft.v.fill(0);
        if (!isI4) top.dc = nzLeft.dc = 0;
      }
      const info = { ...strengths[segment][isI4 ? 1 : 0] };
      info.inner = info.inner || (anyNonZero ? 1 : 0);
      infos[mby * mbw + mbx] = info;

      // Reconstruction (unfiltered; prediction reads unfiltered neighbours, as libwebp does).
      const Y = planes.y;
      const x0 = mbx * 16, y0 = mby * 16;
      if (!isI4) {
        predictBlock(Y, x0, y0, 16, modes[0], mby > 0, mbx > 0);
        for (let n = 0; n < 16; n++) inverseDct(coeff, n * 16, Y.data, (y0 + (n >> 2) * 4) * Y.width + x0 + (n & 3) * 4, Y.width);
      } else {
        // The macroblock's top-right samples, shared by the right column of 4x4 blocks.
        let topRight;
        if (mby === 0) topRight = [127, 127, 127, 127];
        else if (mbx < mbw - 1) topRight = [0, 1, 2, 3].map((i) => Y.get(x0 + 16 + i, y0 - 1));
        else topRight = new Array(4).fill(Y.get(x0 + 15, y0 - 1));
        for (let n = 0; n < 16; n++) {
          const bx = x0 + (n & 3) * 4, by = y0 + (n >> 2) * 4;
          const tr = (n & 3) === 3 ? topRight : (n < 4 ? [0, 1, 2, 3].map((i) => Y.get(bx + 4 + i, by - 1)) : [0, 1, 2, 3].map((i) => Y.get(bx + 4 + i, by - 1)));
          predict4(Y, bx, by, modes[n], tr);
          inverseDct(coeff, n * 16, Y.data, by * Y.width + bx, Y.width);
        }
      }
      for (const [name, base] of [['u', 16], ['v', 20]]) {
        const P = planes[name];
        const cx = mbx * 8, cy = mby * 8;
        predictBlock(P, cx, cy, 8, uvmode, mby > 0, mbx > 0);
        for (let n = 0; n < 4; n++) inverseDct(coeff, (base + n) * 16, P.data, (cy + (n >> 1) * 4) * P.width + cx + (n & 1) * 4, P.width);
      }
    }
  }

  if (filterType > 0) {
    for (let mby = 0; mby < mbh; mby++) {
      for (let mbx = 0; mbx < mbw; mbx++) filterMacroblock(planes, mbx, mby, infos[mby * mbw + mbx], filterType === 1);
    }
  }

  const data = new Uint8Array(width * height * 4);
  const Yd = planes.y.data, Ud = planes.u.data, Vd = planes.v.data;
  const ys = planes.y.width, cs = planes.u.width;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const yy = Yd[y * ys + x], u = Ud[(y >> 1) * cs + (x >> 1)], v = Vd[(y >> 1) * cs + (x >> 1)];
      const o = (y * width + x) * 4;
      data[o] = yuvClip(mulHi(yy, 19077) + mulHi(v, 26149) - 14234);
      data[o + 1] = yuvClip(mulHi(yy, 19077) - mulHi(u, 6419) - mulHi(v, 13320) + 8708);
      data[o + 2] = yuvClip(mulHi(yy, 19077) + mulHi(u, 33050) - 17685);
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}
