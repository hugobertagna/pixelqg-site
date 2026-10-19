// Generates the soundtrack WAV (temp folder by default, or the path given as argument): a soft chiptune bed + UI blips synced to the storyboard.
// Pure synthesis, zero dependencies. Usage: node video-src/soundtrack.js [out.wav]  (render.js calls it automatically)
const fs = require('fs');
const path = require('path');

const SR = 44100, DUR = 65;
const N = SR * DUR;
const music = new Float32Array(N), sfx = new Float32Array(N);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const waves = {
  square: (p, duty = 0.5) => ((p % 1) < duty ? 1 : -1),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  sine: (p) => Math.sin(2 * Math.PI * p),
};
// Adds a note. f can be a number or a function of time-in-note (for sweeps).
function tone(buf, t0, dur, f, { wave = 'square', duty = 0.5, amp = 0.2, a = 0.004, r = 0.08 } = {}) {
  const s0 = Math.floor(t0 * SR), n = Math.floor((dur + r) * SR);
  let ph = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue;
    const t = i / SR;
    const freq = typeof f === 'function' ? f(t) : f;
    ph += freq / SR;
    const env = t < a ? t / a : t < dur ? 1 - 0.35 * ((t - a) / Math.max(dur - a, 1e-3)) : 0.65 * Math.max(0, 1 - (t - dur) / r);
    buf[s0 + i] += waves[wave](ph, duty) * amp * env;
  }
}
function noise(buf, t0, dur, { amp = 0.1, decay = 30, lp = 0.5 } = {}) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  let y = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const t = i / SR;
    y += lp * ((rnd() * 2 - 1) - y);
    buf[s0 + i] += y * amp * Math.exp(-t * decay);
  }
}

// ---------- music bed ----------
const BEAT = 0.6; // 100 BPM
const CHORDS = [[57, 60, 64, 45], [53, 57, 60, 41], [48, 52, 55, 48], [55, 59, 62, 43]]; // Am F C G (+bass)
// Intro tension (0 - 7 s): low drone + clock ticks
tone(music, 0.2, 6.6, midi(33), { wave: 'tri', amp: 0.22, a: 2.5, r: 0.6 });
tone(music, 2.4, 4.4, midi(40), { wave: 'tri', amp: 0.08, a: 1.5, r: 0.6 });
for (let t = 0.6; t < 6.8; t += 0.3) noise(sfx, t, 0.04, { amp: 0.05 + 0.06 * (t / 7), decay: 120, lp: 0.9 });
// riser into the title
noise(sfx, 6.2, 1.3, { amp: 0.12, decay: -1.2, lp: 0.15 });
tone(sfx, 6.4, 1.1, (t) => 200 + t * 700, { wave: 'square', duty: 0.25, amp: 0.035, a: 0.6, r: 0.05 });
// groove from the title to the end
const START = 7.55, END = 65;
for (let bar = 0; START + bar * 4 * BEAT < END; bar++) {
  const c = CHORDS[bar % 4], t0 = START + bar * 4 * BEAT;
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (tb > END - 0.3) break;
    if (b % 2 === 0) tone(music, tb, BEAT * 0.9, midi(c[3] - 12), { wave: 'tri', amp: 0.2, r: 0.05 });
    else tone(music, tb, BEAT * 0.45, midi(c[3]), { wave: 'tri', amp: 0.12, r: 0.05 });
    noise(music, tb + BEAT / 2, 0.05, { amp: 0.035, decay: 90, lp: 0.95 });
    for (let s = 0; s < 4; s++) {
      const ts = tb + s * (BEAT / 4);
      const pat = [0, 1, 2, 1][s] + (b === 3 && s === 3 ? 1 : 0);
      const note = pat === 3 ? c[0] + 12 : c[pat] + 12;
      tone(music, ts, BEAT / 4 * 0.7, midi(note), { wave: 'square', duty: 0.25, amp: 0.045, r: 0.04 });
    }
  }
}
// ---------- sound effects synced to the storyboard ----------
const blip = (t, notes, amp = 0.06, step = 0.05) => notes.forEach((m, i) => tone(sfx, t + i * step, step * 0.9, midi(m), { wave: 'square', duty: 0.5, amp, r: 0.03 }));
const typing = (a, b, rate = 22) => { for (let t = a; t < b; t += 1 / rate + (rnd() - 0.5) * 0.02) noise(sfx, t, 0.02, { amp: 0.09, decay: 200, lp: 0.7 }); };
blip(7.6, [69, 72, 76, 81, 84], 0.05, 0.07); // title
typing(12.6, 14.2); typing(14.35, 14.7);
blip(15.0, [76], 0.04); // colour pick
tone(sfx, 16.0, 0.25, (t) => 300 + t * 2400, { wave: 'square', duty: 0.5, amp: 0.06, r: 0.05 }); // launch
for (const t of [17.75, 18.4, 19.0, 19.6, 20.2, 29.75, 43.7]) blip(t, [72, 79, 84], 0.04, 0.045); // spawns
for (const t of [21.9, 24.3, 26.7, 29.1, 31.5]) noise(sfx, t - 0.1, 0.35, { amp: 0.07, decay: 8, lp: 0.12 }); // camera whooshes
blip(32.0, [76, 79, 84, 88], 0.045, 0.06); // mission done
for (let i = 0; i < 18; i++) blip(35.0 + i * 0.12, [84 + (i % 3) * 2], 0.018, 0.03); // counters
typing(42.2, 42.75); blip(43.6, [79, 84], 0.04, 0.06);
typing(47.0, 48.0); blip(49.7, [72, 76, 79, 84], 0.045, 0.05);
for (const t of [11.6, 17.0, 41.2, 46.2, 51.4, 57.2]) noise(sfx, t, 0.5, { amp: 0.06, decay: 6, lp: 0.2 }); // transitions
tone(sfx, 58.2, 0.25, (t) => 120 - t * 200, { wave: 'tri', amp: 0.3, r: 0.1 }); // price stamp
blip(58.25, [81, 84, 88, 93], 0.05, 0.06);

// ---------- mix ----------
const out = new Int16Array(N);
let lp = 0, peak = 0;
const mix = new Float32Array(N);
for (let i = 0; i < N; i++) {
  lp += 0.35 * (music[i] - lp); // soften the square waves
  const t = i / SR;
  const fade = Math.min(1, t / 0.3) * Math.min(1, (DUR - t) / 1.6);
  mix[i] = (lp * 0.9 + sfx[i]) * fade;
  peak = Math.max(peak, Math.abs(mix[i]));
}
const gain = 0.5 / peak; // about -6 dBFS peak: a discreet bed
for (let i = 0; i < N; i++) out[i] = Math.max(-32767, Math.min(32767, Math.round(mix[i] * gain * 32767)));
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + N * 2, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(N * 2, 40);
const file = process.argv[2] || path.join(require('os').tmpdir(), 'pixelqg-soundtrack.wav');
fs.writeFileSync(file, Buffer.concat([hdr, Buffer.from(out.buffer)]));
console.log('wrote', file);
