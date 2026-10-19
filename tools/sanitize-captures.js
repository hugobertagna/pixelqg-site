// Replaces the Windows user folder shown in the app captures with a neutral one (C:\Users\alex),
// reading raw captures from raw-captures/ and writing the cleaned copies to source-captures/. Each path is located inside a search box, the original text is
// matched against JetBrains Mono (the app's monospace font) to find size, weight and position, then
// it is painted over with the field background and redrawn with the replacement text.
// Usage: put the raw app captures in raw-captures/, run node tools/sanitize-captures.js,
// check the result, delete raw-captures/, then run node tools/build-images.js.
const fs = require('fs');
const path = require('path');
const { launch } = require('../video-src/cdp.js');

const SRC = path.join(__dirname, '..', 'raw-captures');
const OUT = path.join(__dirname, '..', 'source-captures');
const USER = process.env.USERNAME || '';
const OLD = 'C:\\Users\\' + USER;
const NEW = 'C:\\Users\\alex';

// [file, search box x,y,w,h, original suffix after the user folder, replacement (null = erase only), cursor]
const FORM = [652, 943, 540, 26, '', NEW];
const JOBS = {
  'final-desk.png': [FORM],
  'e2e-launcher.png': [FORM],
  'gf-follow.png': [FORM, [1240, 756, 328, 20, '\\Projets\\outil-facturation', NEW + '\\Projets\\outil-facturation']],
  'launch.png': [FORM, [1240, 698, 320, 20, '', NEW]],
  'game-zoom.png': [[570, 842, 440, 24, '', NEW], [1080, 616, 320, 20, '', NEW]],
  'e2e-term.png': [
    [34, 639, 236, 24, '', NEW],
    [34, 709, 240, 20, '', NEW],
    [34, 756, 300, 56, null, null],
    [34, 810, 150, 22, '>', NEW + '>', true],
  ],
};

(async () => {
  if (!USER || USER.toLowerCase() === 'alex') throw new Error('USERNAME is not set');
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(SRC)) if (f.endsWith('.png') && !JOBS[f]) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  const b = await launch();
  try {
    const p = await b.newPage();
    await p.goto('data:text/html,<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=block"><body>');
    await p.eval(`Promise.all(['400','500','600','700'].map((w) => document.fonts.load(w + ' 12px "JetBrains Mono"')))`);
    const ok = await p.eval(`document.fonts.check('500 12px "JetBrains Mono"')`);
    if (!ok) throw new Error('JetBrains Mono could not be loaded');
    for (const [file, jobs] of Object.entries(JOBS)) {
      const full = path.join(SRC, file);
      const dataUrl = 'data:image/png;base64,' + fs.readFileSync(full).toString('base64');
      const res = await p.eval(`(async () => {
        const img = new Image(); img.src = ${JSON.stringify(dataUrl)}; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
        const jobs = ${JSON.stringify(jobs)}, OLD = ${JSON.stringify(OLD)};
        const report = [];
        const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        for (const [bx, by, bw, bh, suffix, repl, cursor] of jobs) {
          const d = x.getImageData(bx, by, bw, bh).data;
          // background = most frequent colour of the box; never paint outside the box
          const counts = new Map(); let bgKey = '0,0,0', bgN = 0;
          for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; const n = (counts.get(k) || 0) + 1; counts.set(k, n); if (n > bgN) { bgN = n; bgKey = k; } }
          const bg = bgKey.split(',').map(Number), bgL = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
          x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
          let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, best = 0, fg = [0, 0, 0];
          for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
            const i = (yy * bw + xx) * 4, L = lum(d, i);
            if (Math.abs(L - bgL) > 30) { x0 = Math.min(x0, xx); y0 = Math.min(y0, yy); x1 = Math.max(x1, xx); y1 = Math.max(y1, yy); }
            if (Math.abs(L - bgL) > best) { best = Math.abs(L - bgL); fg = [d[i], d[i + 1], d[i + 2]]; }
          }
          if (x1 < 0) { x.restore(); report.push({ box: [bx, by], found: false }); continue; }
          const tb = { x: bx + x0, y: by + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
          const pad = 2;
          if (repl === null) {
            x.fillStyle = 'rgb(' + bg + ')'; x.fillRect(tb.x - pad, tb.y - pad, tb.w + 2 * pad, tb.h + 2 * pad);
            x.restore(); report.push({ box: [bx, by], erased: tb }); continue;
          }
          // Calibrate font size / weight / baseline on the original string.
          const orig = OLD + suffix;
          const region = x.getImageData(tb.x - pad, tb.y - pad, tb.w + 2 * pad, tb.h + 2 * pad);
          const t = document.createElement('canvas'); t.width = region.width; t.height = region.height;
          const tx = t.getContext('2d', { willReadFrequently: true });
          let fit = null;
          for (const size of [11, 11.5, 12, 12.5, 13, 13.5, 14]) for (const weight of [400, 500, 600]) {
            tx.font = weight + ' ' + size + 'px "JetBrains Mono"';
            const m = tx.measureText(orig);
            for (let dx = -1.5; dx <= 1.5; dx += 0.5) for (let dy = -1.5; dy <= 1.5; dy += 0.5) {
              tx.fillStyle = 'rgb(' + bg + ')'; tx.fillRect(0, 0, t.width, t.height);
              tx.fillStyle = 'rgb(' + fg + ')';
              const ox = pad - m.actualBoundingBoxLeft + dx, oy = pad + m.actualBoundingBoxAscent + dy;
              tx.fillText(orig, ox, oy);
              const a = tx.getImageData(0, 0, t.width, t.height).data;
              let err = 0;
              for (let i = 0; i < a.length; i += 4) err += Math.abs(lum(a, i) - lum(region.data, i));
              if (!fit || err < fit.err) fit = { err, size, weight, dx, dy, ox, oy };
            }
          }
          let cursorBox = null;
          if (cursor) {
            // the orange block cursor after the prompt (text anti-aliasing fringes are not orange)
            const orange = (i) => d[i] > 180 && d[i + 1] > 70 && d[i + 1] < 170 && d[i + 2] < 130;
            const colCount = (xx) => { let n = 0; for (let yy = 0; yy < bh; yy++) if (orange((yy * bw + xx) * 4)) n++; return n; };
            let cx1 = -1;
            for (let xx = bw - 1; xx >= 0; xx--) if (colCount(xx) >= 8) { cx1 = xx; break; }
            if (cx1 >= 0) {
              let cx0 = cx1; while (cx0 > 0 && colCount(cx0 - 1) >= 8) cx0--;
              let cy0 = 1e9, cy1 = -1, col = null;
              for (let yy = 0; yy < bh; yy++) { const i = (yy * bw + cx1) * 4; if (orange(i)) { cy0 = Math.min(cy0, yy); cy1 = Math.max(cy1, yy); col = [d[i], d[i + 1], d[i + 2]]; } }
              cursorBox = { w: cx1 - cx0 + 1, y: by + cy0, h: cy1 - cy0 + 1, col };
            }
          }
          // Repaint the background row by row from a clean column right of the text (handles gradients).
          const sx = Math.min(bx + bw - 1, tb.x + tb.w + 4);
          for (let yy = tb.y - pad; yy < tb.y + tb.h + pad; yy++) {
            const s = x.getImageData(sx, yy, 1, 1).data;
            x.fillStyle = 'rgb(' + s[0] + ',' + s[1] + ',' + s[2] + ')';
            x.fillRect(tb.x - pad, yy, tb.w + 2 * pad + 2, 1);
          }
          x.font = fit.weight + ' ' + fit.size + 'px "JetBrains Mono"';
          x.fillStyle = 'rgb(' + fg + ')';
          const px = tb.x - pad + fit.ox, py = tb.y - pad + fit.oy;
          x.fillText(repl, px, py);
          if (cursorBox) {
            const w = x.measureText(repl).width;
            x.fillStyle = 'rgb(' + cursorBox.col + ')';
            x.fillRect(Math.round(px + w + 1), cursorBox.y, cursorBox.w, cursorBox.h);
          }
          x.restore();
          report.push({ box: [bx, by], text: tb, size: fit.size, weight: fit.weight, err: Math.round(fit.err / (t.width * t.height)), cursor: !!cursorBox });
        }
        return { png: c.toDataURL('image/png'), report };
      })()`);
      fs.writeFileSync(path.join(OUT, file), Buffer.from(res.png.split(',')[1], 'base64'));
      console.log(file, JSON.stringify(res.report));
    }
  } finally { b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
