// Builds fonts/pixelqg-pixel.ttf from video-src/pixelfont.js (zero dependencies).
// Usage: node tools/build-font.js
const fs = require('fs');
const path = require('path');
const PF = require('../video-src/pixelfont.js');

const UPM = 1000;
const P = 125;            // one font pixel = 125 units -> crisp at 8/16/24/32/40/48 px
const ASC = 9 * P;        // two accent rows above the 7-row capital
const DESC = 2 * P;       // two descender rows (comma, cedilla)
const FAMILY = 'PixelQG Pixel';

// ---------- outlines: union of pixel squares traced into clean contours ----------
function outline(g) {
  const on = new Set();
  g.r.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') on.add(rx + ',' + (g.y + ry)); }));
  // Directed edges of each pixel square (clockwise in y-up font space); shared edges cancel.
  const edges = new Map();
  const key = (a, b) => a + '>' + b;
  const add = (a, b) => { const back = key(b, a); if (edges.has(back)) edges.delete(back); else edges.set(key(a, b), [a, b]); };
  for (const p of on) {
    const [px, row] = p.split(',').map(Number);
    const x0 = px * P, x1 = x0 + P, y1 = (7 - row) * P, y0 = y1 - P;
    const v = (x, y) => x + ':' + y;
    add(v(x0, y0), v(x0, y1)); add(v(x0, y1), v(x1, y1)); add(v(x1, y1), v(x1, y0)); add(v(x1, y0), v(x0, y0));
  }
  const out = new Map();
  for (const [k, [a, b]] of edges) { if (!out.has(a)) out.set(a, []); out.get(a).push(k); }
  const contours = [];
  while (edges.size) {
    const [startKey, [start]] = edges.entries().next().value;
    const pts = [];
    let cur = start, k = startKey;
    for (;;) {
      const [a, b] = edges.get(k);
      edges.delete(k);
      out.get(a).splice(out.get(a).indexOf(k), 1);
      pts.push(a.split(':').map(Number));
      cur = b;
      if (cur === start) break;
      k = out.get(cur)[0];
    }
    // drop collinear points
    const clean = pts.filter((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], c = pts[(i + 1) % pts.length];
      return !((a[0] === p[0] && p[0] === c[0]) || (a[1] === p[1] && p[1] === c[1]));
    });
    contours.push(clean);
  }
  return contours;
}

// ---------- binary helpers ----------
class Buf {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u16(v) { return this.u8(v >> 8).u8(v); }
  i16(v) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { return this.u16(Math.floor(v / 65536) & 0xffff).u16(v & 0xffff); }
  tag(s) { for (const c of s) this.u8(c.charCodeAt(0)); return this; }
  bytes(b) { for (const x of b) this.u8(x); return this; }
  pad4() { while (this.a.length % 4) this.u8(0); return this; }
  get length() { return this.a.length; }
  toBuffer() { return Buffer.from(this.a); }
}
const checksum = (buf) => {
  let sum = 0;
  const b = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
  for (let i = 0; i < b.length; i += 4) sum = (sum + b.readUInt32BE(i)) >>> 0;
  return sum;
};

// ---------- glyph set ----------
const chars = Object.keys(PF.glyphs).filter((c) => c !== ' ');
const glyphs = [{ name: '.notdef', notdef: true }, { name: 'space', ch: ' ' }].concat(chars.map((ch) => ({ name: 'g' + ch.codePointAt(0), ch })));
const cmap = new Map(); // codepoint -> glyph index
glyphs.forEach((g, i) => { if (g.ch) cmap.set(g.ch.codePointAt(0), i); });
for (const [alias, target] of Object.entries(PF.alias)) {
  const gi = cmap.get(target.codePointAt(0));
  if (gi != null && !cmap.has(alias.codePointAt(0))) cmap.set(alias.codePointAt(0), gi);
}

const glyf = new Buf(), loca = [], hmtx = new Buf();
let maxPts = 0, maxCtr = 0, xMinAll = 0, yMinAll = 0, xMaxAll = 0, yMaxAll = 0, advMax = 0, minLsb = 1e9, minRsb = 1e9, maxExt = 0;
for (const g of glyphs) {
  let contours, adv;
  if (g.notdef) {
    contours = [[[0, 0], [0, 7 * P], [4 * P, 7 * P], [4 * P, 0]], [[P, P], [3 * P, P], [3 * P, 6 * P], [P, 6 * P]]];
    adv = 5 * P;
  } else if (g.ch === ' ') {
    contours = []; adv = 4 * P;
  } else {
    const pg = PF.glyphs[g.ch];
    contours = outline(pg); adv = PF.advance(pg) * P;
  }
  loca.push(glyf.length);
  const pts = contours.flat();
  advMax = Math.max(advMax, adv);
  if (!pts.length) { hmtx.u16(adv).i16(0); continue; }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  xMinAll = Math.min(xMinAll, bb[0]); yMinAll = Math.min(yMinAll, bb[1]); xMaxAll = Math.max(xMaxAll, bb[2]); yMaxAll = Math.max(yMaxAll, bb[3]);
  minLsb = Math.min(minLsb, bb[0]); minRsb = Math.min(minRsb, adv - bb[2]); maxExt = Math.max(maxExt, bb[2]);
  maxPts = Math.max(maxPts, pts.length); maxCtr = Math.max(maxCtr, contours.length);
  glyf.i16(contours.length).i16(bb[0]).i16(bb[1]).i16(bb[2]).i16(bb[3]);
  let end = -1;
  for (const c of contours) { end += c.length; glyf.u16(end); }
  glyf.u16(0); // no instructions
  for (let i = 0; i < pts.length; i++) glyf.u8(1); // on-curve, 16-bit deltas
  let px = 0; for (const p of pts) { glyf.i16(p[0] - px); px = p[0]; }
  let py = 0; for (const p of pts) { glyf.i16(p[1] - py); py = p[1]; }
  glyf.pad4();
  hmtx.u16(adv).i16(bb[0]);
}
loca.push(glyf.length);
if (minLsb === 1e9) minLsb = 0;

const tables = {};
tables.glyf = glyf.toBuffer();
const locaB = new Buf(); loca.forEach((o) => locaB.u32(o)); tables.loca = locaB.toBuffer();
tables.hmtx = hmtx.toBuffer();

tables.head = new Buf().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x0009).u16(UPM)
  .u32(0).u32(0xe2a1b400).u32(0).u32(0xe2a1b400) // created / modified (2024)
  .i16(xMinAll).i16(yMinAll).i16(xMaxAll).i16(yMaxAll).u16(0).u16(8).i16(2).i16(1).i16(0).toBuffer();

tables.hhea = new Buf().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(advMax).i16(minLsb).i16(minRsb).i16(maxExt)
  .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(glyphs.length).toBuffer();

tables.maxp = new Buf().u32(0x00010000).u16(glyphs.length).u16(maxPts).u16(maxCtr).u16(0).u16(0)
  .u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).toBuffer();

const codes = [...cmap.keys()].sort((a, b) => a - b);
const os2 = new Buf().u16(4).i16(Math.round(6 * P)).u16(400).u16(5).u16(0)
  .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(P).i16(3 * P)
  .i16(0).bytes([2, 0, 5, 9, 0, 0, 0, 0, 0, 0])
  .u32(0x00000003).u32(0).u32(0).u32(0).tag('PXQG').u16(0x0040)
  .u16(Math.min(codes[0], 0xffff)).u16(Math.min(codes[codes.length - 1], 0xffff))
  .i16(ASC).i16(-DESC).i16(0).u16(ASC).u16(DESC).u32(0x00000001).u32(0)
  .i16(7 * P).i16(7 * P).u16(0).u16(32).u16(1);
tables['OS/2'] = os2.toBuffer();

// cmap format 4: one segment per codepoint (BMP only)
const segs = codes.filter((c) => c <= 0xfffe).map((c) => ({ start: c, end: c, delta: (cmap.get(c) - c + 65536) % 65536 }));
segs.push({ start: 0xffff, end: 0xffff, delta: 1 });
const segX2 = segs.length * 2;
const sr = 2 * Math.pow(2, Math.floor(Math.log2(segs.length)));
const f4 = new Buf().u16(4).u16(0).u16(0).u16(segX2).u16(sr).u16(Math.log2(sr / 2)).u16(segX2 - sr);
segs.forEach((s) => f4.u16(s.end)); f4.u16(0);
segs.forEach((s) => f4.u16(s.start));
segs.forEach((s) => f4.u16(s.delta));
segs.forEach(() => f4.u16(0));
const f4b = f4.toBuffer(); f4b.writeUInt16BE(f4b.length, 2);
tables.cmap = Buffer.concat([new Buf().u16(0).u16(1).u16(3).u16(1).u32(12).toBuffer(), f4b]);

const names = { 0: '© 2026 PixelQG', 1: FAMILY, 2: 'Regular', 3: 'PixelQG Pixel Regular 1.000', 4: 'PixelQG Pixel Regular', 5: 'Version 1.000', 6: 'PixelQGPixel-Regular' };
const nameRecs = new Buf(), nameStr = new Buf();
const ids = Object.keys(names).map(Number);
for (const id of ids) {
  const s = Buffer.from(names[id], 'utf16le').swap16();
  nameRecs.u16(3).u16(1).u16(0x409).u16(id).u16(s.length).u16(nameStr.length);
  nameStr.bytes(s);
}
tables.name = Buffer.concat([new Buf().u16(0).u16(ids.length).u16(6 + 12 * ids.length).toBuffer(), nameRecs.toBuffer(), nameStr.toBuffer()]);
tables.post = new Buf().u32(0x00030000).u32(0).i16(-P).i16(P).u32(0).u32(0).u32(0).u32(0).u32(0).toBuffer();

// ---------- sfnt assembly ----------
const tags = Object.keys(tables).sort();
const n = tags.length;
const es = Math.floor(Math.log2(n)), srch = Math.pow(2, es) * 16;
const header = new Buf().u32(0x00010000).u16(n).u16(srch).u16(es).u16(n * 16 - srch);
let offset = 12 + 16 * n;
const bodies = [];
for (const t of tags) {
  const data = tables[t];
  header.tag(t.padEnd(4, ' ')).u32(checksum(data)).u32(offset).u32(data.length);
  const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
  bodies.push({ t, offset, padded });
  offset += padded.length;
}
const font = Buffer.concat([header.toBuffer(), ...bodies.map((b) => b.padded)]);
const headOff = bodies.find((b) => b.t === 'head').offset;
font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOff + 8);

const outFile = path.join(__dirname, '..', 'fonts', 'pixelqg-pixel.ttf');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, font);
console.log(`wrote ${outFile} (${font.length} bytes, ${glyphs.length} glyphs, ${cmap.size} codepoints)`);
