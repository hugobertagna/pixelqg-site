/* Shared helpers for the PixelQG explainer: math, easing, palette, mascot sprite, UI drawing. */
(function (root) {
  const W = 1920, H = 1080;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const ease = {
    linear: (t) => t,
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  };
  // Deterministic hash -> [0,1)
  const hash = (a, b = 0, c = 0) => {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const C = {
    night0: '#06070f', night1: '#0a0c19', night2: '#10132a', night3: '#171b38',
    panel: '#141729', panel2: '#1b1f36', field: '#0d0f1e', line: '#2c3256', line2: '#3a4170',
    ink: '#eef0ff', dim: '#a0a6d0', mute: '#6c7299',
    lamp: '#ffc84a', lampD: '#d99a16', cyan: '#4fe3d3', pink: '#ff6fae', green: '#6fd36a', red: '#ff6b5e', violet: '#a98bff',
    outline: '#0a0b16', screen: '#141a33', eye: '#a6fff2',
  };
  const AGENT = {
    blue: '#4aa3ff', green: '#6fd36a', purple: '#b07cff', yellow: '#ffc84a', pink: '#ff6fae',
    teal: '#3fd4c4', orange: '#ff9a4a', lime: '#c6e65a', gray: '#b3bad6', red: '#ff6b5e',
  };

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb = (a) => `rgb(${a.map((v) => Math.round(clamp(v, 0, 255))).join(',')})`;
  const shade = (h, k) => rgb(hex(h).map((v) => v * k));
  const mix = (h1, h2, k) => { const a = hex(h1), b = hex(h2); return rgb(a.map((v, i) => lerp(v, b[i], k))); };
  const alpha = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

  // ---------- mascot sprite: a little screen-headed office bot ----------
  const BOT = [
    '.....AA.....',
    '......G.....',
    '..KKKKKKKK..',
    '.KCHHCCCCCK.',
    '.KCSSSSSSCK.',
    '.KCSSSSSSCK.',
    '.KCSSSSSSCK.',
    '.KCSSSSSSCK.',
    '.KCCCCCCCCK.',
    '..KKKKKKKK..',
    '...KDDDDK...',
    '..KDDLLDDK..',
    '..KDDDDDDK..',
  ];
  const LEGS = [
    ['...KK..KK...', '...KK..KK...'],
    ['...KK..KK...', '..KK....KK..'],
    ['...KK..KK...', '....KK.KK...'],
  ];
  const BOT_W = 12, BOT_H = 15;
  /**
   * Draws the bot with its feet centred at (x, y). s = pixel size.
   * o: { color, frame (0 stand, 1/2 walk), look (-1..1), blink, antenna, bob }
   */
  function drawBot(ctx, x, y, s, o = {}) {
    const col = o.color || AGENT.blue;
    const pal = {
      K: C.outline, G: '#8790b0', C: col, D: shade(col, 0.68), H: mix(col, '#ffffff', 0.45), S: C.screen,
      A: o.antenna || C.lamp, L: o.light || mix(col, '#ffffff', 0.7),
    };
    const rows = BOT.concat(LEGS[o.frame || 0]);
    const ox = Math.round(x - (BOT_W * s) / 2), oy = Math.round(y - BOT_H * s - (o.bob || 0) * s);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const shift = r >= 13 ? (o.bob || 0) * s : 0; // feet stay on the floor
      for (let c = 0; c < row.length; c++) {
        const k = row[c];
        if (k === '.') continue;
        ctx.fillStyle = pal[k];
        ctx.fillRect(ox + c * s, oy + r * s + shift, s, s);
      }
    }
    // eyes on the screen face
    if (!o.blink) {
      const look = Math.round(clamp(o.look || 0, -1, 1));
      ctx.fillStyle = o.eye || C.eye;
      for (const ec of [4, 7]) ctx.fillRect(ox + (ec + look) * s, oy + 5 * s, s, 2 * s);
    } else {
      ctx.fillStyle = o.eye || C.eye;
      for (const ec of [4, 7]) ctx.fillRect(ox + ec * s, oy + 6 * s, s, s);
    }
    if (o.smile) { ctx.fillStyle = o.eye || C.eye; ctx.fillRect(ox + 5 * s, oy + 7 * s, 2 * s, s); }
  }

  // ---------- UI helpers ----------
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function box(ctx, x, y, w, h, o = {}) {
    rrect(ctx, x, y, w, h, o.r == null ? 10 : o.r);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) { ctx.lineWidth = o.lw || 2; ctx.strokeStyle = o.stroke; ctx.stroke(); }
  }
  // Pixel-style plate: square corners notched by one pixel step.
  function plate(ctx, x, y, w, h, fill, border, s = 4) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const notched = (x, y, w, h) => { ctx.fillRect(x + s, y, w - 2 * s, h); ctx.fillRect(x, y + s, w, h - 2 * s); };
    if (border) { ctx.fillStyle = border; notched(x, y, w, h); ctx.fillStyle = fill; notched(x + s, y + s, w - 2 * s, h - 2 * s); }
    else { ctx.fillStyle = fill; notched(x, y, w, h); }
  }
  const FONT = '"Segoe UI", "Segoe UI Variable", system-ui, sans-serif';
  const MONO = '"Cascadia Mono", "Cascadia Code", Consolas, monospace';
  function text(ctx, str, x, y, o = {}) {
    ctx.font = `${o.weight || 600} ${o.size || 28}px ${o.mono ? MONO : FONT}`;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.letterSpacing = o.spacing ? o.spacing + 'px' : '0px';
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.letterSpacing = '0px';
    return w;
  }
  const PF = () => root.PixelFont;
  // Pixel-font text with a hard drop shadow.
  function ptext(ctx, str, x, y, s, color, o = {}) {
    const sh = o.shadow === undefined ? Math.max(1, Math.round(s / 2)) : o.shadow;
    if (sh) PF().draw(ctx, str, x + sh, y + sh, s, o.shadowColor || C.night0, o);
    return PF().draw(ctx, str, x, y, s, color, o);
  }

  // ---------- offscreen buffers & transitions ----------
  const buffers = {};
  function buffer(name, w = W, h = H) {
    let b = buffers[name];
    if (!b) { b = document.createElement('canvas'); b.width = w; b.height = h; buffers[name] = b; }
    const ctx = b.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    return { canvas: b, ctx };
  }
  // Blocky diagonal reveal of B over A.
  function pixelWipe(ctx, a, b, p, block = 60, seed = 7) {
    ctx.drawImage(a, 0, 0);
    const nx = Math.ceil(W / block), ny = Math.ceil(H / block);
    for (let by = 0; by < ny; by++) for (let bx = 0; bx < nx; bx++) {
      const order = (bx / nx) * 0.62 + (by / ny) * 0.18 + hash(bx, by, seed) * 0.2;
      if (order < p) ctx.drawImage(b, bx * block, by * block, block, block, bx * block, by * block, block, block);
    }
  }
  function mosaic(ctx, src, size) {
    if (size <= 1) { ctx.drawImage(src, 0, 0); return; }
    const w = Math.max(1, Math.round(W / size)), h = Math.max(1, Math.round(H / size));
    const { canvas: small, ctx: sctx } = buffer('mosaic-' + w, w, h);
    sctx.imageSmoothingEnabled = true;
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(src, 0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, w, h, 0, 0, W, H);
  }

  // ---------- night sky & skyline ----------
  const STARS = (() => { const r = rng(42); return Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * H * 0.8, s: r() < 0.15 ? 6 : r() < 0.5 ? 4 : 3, ph: r() * 6.28, sp: 0.6 + r() * 2.4 })); })();
  function sky(ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.night0); g.addColorStop(0.7, C.night1); g.addColorStop(1, '#151a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const st of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(t * st.sp + st.ph);
      ctx.fillStyle = `rgba(220,226,255,${(Math.round(tw * 4) / 4) * (o.starAlpha ?? 1)})`;
      ctx.fillRect(Math.round(st.x / 4) * 4, Math.round(st.y / 4) * 4, st.s, st.s);
    }
  }
  let skylineCanvas = null;
  function skyline(ctx, t, y = H - 360, s = 4) {
    if (!skylineCanvas) {
      skylineCanvas = document.createElement('canvas');
      skylineCanvas.width = 480; skylineCanvas.height = 100;
      const c = skylineCanvas.getContext('2d');
      const r = rng(9);
      let x = 0;
      while (x < 480) {
        const bw = 18 + Math.floor(r() * 30), bh = 30 + Math.floor(r() * 64);
        c.fillStyle = r() < 0.5 ? '#121634' : '#0f1230';
        c.fillRect(x, 100 - bh, bw, bh);
        c.fillStyle = '#1c2150'; c.fillRect(x, 100 - bh, bw, 1);
        for (let wy = 100 - bh + 4; wy < 96; wy += 5) for (let wx = x + 3; wx < x + bw - 3; wx += 4) {
          if (r() < 0.22) { c.fillStyle = r() < 0.7 ? '#ffd36b' : '#7fe8ff'; c.fillRect(wx, wy, 2, 2); }
        }
        x += bw + Math.floor(r() * 4);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(skylineCanvas, 0, y, 480 * s, 100 * s);
  }

  root.Q = { W, H, clamp, lerp, prog, ease, hash, rng, C, AGENT, shade, mix, alpha, drawBot, BOT_W, BOT_H, rrect, box, plate, text, ptext, buffer, pixelWipe, mosaic, sky, skyline, FONT, MONO };
})(window);
