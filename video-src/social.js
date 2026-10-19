/* PixelQG vertical clips for TikTok / Reels / Shorts (1080x1920, 30 fps, music only).
 * Same office, robots, pixel font and UI pieces as the explainer; deterministic per frame.
 * Text stays inside the safe zone (y 140..1480): the bottom of the screen is covered by app captions. */
(function (root) {
  const Q = root.Q, PF = root.PixelFont, O = root.Office, S = root.Story;
  const { C, AGENT, clamp, lerp, prog, ease, hash, rng, drawBot, box, plate, text, ptext } = Q;
  const VW = 1080, VH = 1920;
  const URL_TEXT = 'pixelqg-site.pages.dev';

  // ---------- backgrounds & transitions (vertical versions) ----------
  function bgGrid(ctx) {
    ctx.fillStyle = '#0a0c19'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#151933';
    for (let y = 20; y < VH; y += 40) for (let x = 20; x < VW; x += 40) ctx.fillRect(x, y, 4, 4);
  }
  const STARS = (() => { const r = rng(77); return Array.from({ length: 240 }, () => ({ x: r() * VW, y: r() * VH * 0.85, s: r() < 0.15 ? 6 : r() < 0.5 ? 4 : 3, ph: r() * 6.28, sp: 0.6 + r() * 2.4 })); })();
  function sky(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, C.night0); g.addColorStop(0.7, C.night1); g.addColorStop(1, '#151a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (const st of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(t * st.sp + st.ph);
      ctx.fillStyle = `rgba(220,226,255,${Math.round(tw * 4) / 4})`;
      ctx.fillRect(Math.round(st.x / 4) * 4, Math.round(st.y / 4) * 4, st.s, st.s);
    }
    Q.skyline(ctx, t, VH - 400, 4);
  }
  function wipe(ctx, a, b, p, block = 60, seed = 11) {
    ctx.drawImage(a, 0, 0);
    const nx = Math.ceil(VW / block), ny = Math.ceil(VH / block);
    for (let by = 0; by < ny; by++) for (let bx = 0; bx < nx; bx++) {
      const order = (by / ny) * 0.62 + (bx / nx) * 0.18 + hash(bx, by, seed) * 0.2;
      if (order < p) ctx.drawImage(b, bx * block, by * block, block, block, bx * block, by * block, block, block);
    }
  }
  function mosaic(ctx, src, size) {
    if (size <= 1) { ctx.drawImage(src, 0, 0); return; }
    const w = Math.max(1, Math.round(VW / size)), h = Math.max(1, Math.round(VH / size));
    const { canvas: small, ctx: sctx } = Q.buffer('vmosaic-' + w, w, h);
    sctx.imageSmoothingEnabled = true; sctx.clearRect(0, 0, w, h); sctx.drawImage(src, 0, 0, w, h);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, w, h, 0, 0, VW, VH);
  }
  // Fits a pixel-font line into maxW by choosing the biggest integer pixel size (capped).
  const fit = (str, maxW, cap) => Math.max(2, Math.min(cap, Math.floor(maxW / PF.measure(str))));
  function signPlate(ctx, str, cx, y, color, s = 5, a = 1) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const w = PF.measure(str) * s + 8 * s, h = 7 * s + 8 * s;
    plate(ctx, cx - w / 2, y, w, h, '#0f1120', color, s);
    PF.draw(ctx, str, cx, y + 4 * s, s, color, { align: 'center' });
    ctx.restore();
    return h;
  }
  function centered(ctx, str, y, o = {}) {
    text(ctx, str, VW / 2, y, { size: o.size || 40, weight: o.weight || 600, color: o.color || C.dim, align: 'center', mono: o.mono });
  }

  // ---------- shared end card: « PixelQG · essai gratuit 7 jours · pixelqg-site.pages.dev » ----------
  function endCard(ctx, t, t0) {
    sky(ctx, t);
    ctx.fillStyle = 'rgba(6,7,15,0.3)'; ctx.fillRect(0, 0, VW, VH);
    const bp = prog(t, t0 + 0.1, t0 + 0.6);
    if (bp > 0) drawBot(ctx, VW / 2, Math.round(lerp(VH * 0.4, 470, ease.back(bp)) - Math.max(0, Math.sin((t - t0) * 6)) * 10 * (t - t0 > 1 && t - t0 < 1.6 ? 1 : 0)), 12, { color: C.cyan, smile: true, antenna: Math.floor(t * 3) % 2 ? C.lamp : '#fff2c0' });
    const tp = ease.out(prog(t, t0 + 0.2, t0 + 0.7));
    if (tp > 0) {
      ctx.save(); ctx.globalAlpha = tp; ctx.translate(0, (1 - tp) * 30);
      const s = 18, tw = PF.measure('PIXELQG') * s, tx = VW / 2 - tw / 2, y = 560;
      PF.draw(ctx, 'PIXEL', tx + 8, y + 8, s, '#05060c'); PF.draw(ctx, 'PIXEL', tx, y, s, C.ink);
      const qx = tx + PF.measure('PIXEL') * s + s;
      PF.draw(ctx, 'QG', qx + 8, y + 8, s, '#05060c'); PF.draw(ctx, 'QG', qx, y, s, C.lamp);
      ctx.restore();
    }
    const ep = prog(t, t0 + 0.7, t0 + 1.1);
    if (ep > 0) {
      const k = ease.back(ep);
      ctx.save(); ctx.translate(VW / 2, 860); ctx.scale(k, k);
      const s = 8, l1 = 'ESSAI GRATUIT', l2 = '7 JOURS', w = PF.measure(l1) * s + 16 * s, h = 2 * 7 * s + 14 * s;
      plate(ctx, -w / 2 + 10, -h / 2 + 10, w, h, '#05060c', null, s);
      plate(ctx, -w / 2, -h / 2, w, h, C.lamp, '#fff1c2', s);
      PF.draw(ctx, l1, 0, -h / 2 + 5 * s, s, '#1a1206', { align: 'center' });
      PF.draw(ctx, l2, 0, -h / 2 + 5 * s + 10 * s, s, '#1a1206', { align: 'center' });
      ctx.restore();
    }
    const up = prog(t, t0 + 1.2, t0 + 1.6);
    if (up > 0) {
      ctx.save(); ctx.globalAlpha = up;
      centered(ctx, URL_TEXT, 1110, { size: 58, weight: 700, color: C.cyan });
      centered(ctx, 'Windows 10/11 · compatible avec Claude Code', 1185, { size: 32, weight: 600, color: C.dim });
      ctx.restore();
    }
    const mp = prog(t, t0 + 1.0, t0 + 1.4);
    if (mp > 0) {
      ctx.globalAlpha = mp;
      const cols = [AGENT.blue, AGENT.green, AGENT.purple, AGENT.yellow, AGENT.pink, AGENT.teal];
      for (let i = 0; i < 6; i++) {
        const span = VW + 300, x = ((t - t0) * 140 + i * (span / 6)) % span - 150, step = Math.floor((t * 140 + i * 37) / 18) % 2;
        drawBot(ctx, Math.round(x), 1400 - step * 5, 5, { color: cols[i], frame: 1 + step, look: 1 });
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- clip A: « Tes agents IA bossent… à l'aveugle » → PixelQG ----------
  const WINS = [
    { x: 40, y: 130, w: 700, h: 380, t: 0.15, n: 1 }, { x: 340, y: 430, w: 700, h: 380, t: 0.5, n: 2 },
    { x: 60, y: 1110, w: 700, h: 380, t: 0.85, n: 3 }, { x: 330, y: 1400, w: 700, h: 400, t: 1.2, n: 4 },
  ];
  function a1(ctx, t) {
    bgGrid(ctx);
    const shake = t > 5.0 ? (hash(Math.floor(t * 30)) - 0.5) * 12 * prog(t, 5.0, 6.0) : 0;
    for (const w of WINS) {
      const p = prog(t, w.t, w.t + 0.35);
      if (p <= 0) continue;
      ctx.save(); ctx.globalAlpha = clamp(p * 1.5);
      const k = lerp(0.9, 1, ease.back(p));
      ctx.translate(w.x + w.w / 2 + shake * (w.n % 2 ? 1 : -1), w.y + w.h / 2); ctx.scale(k, k); ctx.translate(-w.w / 2, -w.h / 2);
      S.ui.windowFrame(ctx, 0, 0, w.w, w.h, `Agent ${w.n} — Invite de commandes`, { body: '#0c0d18' });
      ctx.save(); ctx.beginPath(); ctx.rect(0, 50, w.w, w.h - 54); ctx.clip();
      const n = Math.floor((t - w.t) * (6 + w.n)), maxLines = Math.floor((w.h - 70) / 30), first = Math.max(0, n - maxLines);
      for (let i = first; i < n; i++) {
        const [str, col] = S.LOG[(i + w.n * 5) % S.LOG.length];
        text(ctx, str, 22, 84 + (i - first) * 30, { size: 21, weight: 400, mono: true, color: col });
      }
      ctx.restore(); ctx.restore();
    }
    const band = prog(t, 0.8, 1.2);
    if (band > 0) {
      ctx.fillStyle = `rgba(6,7,15,${0.88 * ease.out(band)})`;
      ctx.fillRect(0, 740, VW, 420);
      const l1 = 'TES AGENTS IA', l2 = 'BOSSENT…', l3 = '…À L’AVEUGLE.';
      ptext(ctx, l1, VW / 2, 790, 11, C.ink, { align: 'center', chars: Math.floor(prog(t, 0.9, 1.6) * l1.length) });
      ptext(ctx, l2, VW / 2, 895, 11, C.ink, { align: 'center', chars: Math.floor(prog(t, 1.6, 2.1) * l2.length) });
      ptext(ctx, l3, VW / 2, 1030, fit(l3, 960, 12), C.lamp, { align: 'center', chars: Math.floor(prog(t, 2.3, 3.0) * l3.length), shadow: 6 });
    }
    const chips = [
      { s: 'QUI FAIT QUOI ?', x: 70, y: 590, t: 3.2, c: C.pink }, { s: 'ÇA AVANCE ?', x: 560, y: 1200, t: 3.7, c: C.cyan },
      { s: 'ÇA COÛTE COMBIEN ?', x: 150, y: 1330, t: 4.2, c: C.lamp },
    ];
    for (const ch of chips) {
      const p = prog(t, ch.t, ch.t + 0.4);
      if (p <= 0) continue;
      const k = ease.back(p), s = 6, w = PF.measure(ch.s) * s + 10 * s, h = 7 * s + 8 * s;
      ctx.save(); ctx.translate(ch.x + w / 2, ch.y + h / 2); ctx.scale(k, k); ctx.rotate((hash(ch.t * 10) - 0.5) * 0.08);
      plate(ctx, -w / 2, -h / 2, w, h, '#0f1120', ch.c, s);
      PF.draw(ctx, ch.s, 0, -h / 2 + 4 * s, s, ch.c, { align: 'center' });
      ctx.restore();
    }
    const out = prog(t, 6.0, 6.6);
    if (out > 0) { ctx.fillStyle = `rgba(0,0,0,${ease.in(out)})`; ctx.fillRect(0, 0, VW, VH); }
    const inn = 1 - prog(t, 0, 0.3);
    if (inn > 0) { ctx.fillStyle = `rgba(0,0,0,${inn})`; ctx.fillRect(0, 0, VW, VH); }
  }
  const TITLE = (() => {
    const s = 20, out = [];
    let x = Math.round(VW / 2 - (PF.measure('PIXELQG') * s) / 2), col = 0;
    for (const ch of 'PIXELQG') {
      const g = PF.lookup(ch);
      g.r.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') out.push({ x: x + rx * s, y: 640 + (g.y + ry) * s, col: col + rx, ch }); }));
      x += PF.advance(g) * s; col += PF.advance(g);
    }
    return out;
  })();
  function a2(ctx, t) {
    sky(ctx, t);
    const mp = prog(t, 6.9, 7.5);
    if (mp > 0) drawBot(ctx, VW / 2, Math.round(lerp(VH * 0.45, 600, ease.back(mp))), 12, { color: C.cyan, look: t > 7.7 && t < 8.4 ? 1 : 0, antenna: Math.floor(t * 3) % 2 ? C.lamp : '#fff2c0', smile: t > 9 });
    const s = 20;
    for (const pass of [0, 1]) for (const p of TITLE) {
      const d = 6.95 + (p.col / 39) * 0.55 + hash(p.x, p.y) * 0.25, k = prog(t, d, d + 0.45);
      if (k <= 0) continue;
      const yo = Math.round((1 - ease.out(k)) * -280);
      ctx.globalAlpha = clamp(k * 2.5);
      if (pass === 0) { ctx.fillStyle = '#05060c'; ctx.fillRect(p.x + 9, p.y + yo + 9, s, s); }
      else { ctx.fillStyle = p.ch === 'Q' || p.ch === 'G' ? C.lamp : C.ink; ctx.fillRect(p.x, p.y + yo, s, s); }
    }
    ctx.globalAlpha = 1;
    const t1 = 'CHAQUE AGENT IA', t2 = 'DEVIENT UN PIX.';
    if (t > 8.0) {
      ptext(ctx, t1, VW / 2, 850, 6, C.ink, { align: 'center', chars: Math.floor(prog(t, 8.0, 8.5) * t1.length) });
      ptext(ctx, t2, VW / 2, 915, 6, C.ink, { align: 'center', chars: Math.floor(prog(t, 8.5, 8.9) * t2.length) });
    }
    const op = ease.out(prog(t, 8.7, 9.3));
    if (op > 0) {
      const x = 60, y = 1010 + (1 - op) * 80, w = 960, h = 46 + 600;
      ctx.save(); ctx.globalAlpha = clamp(op * 1.5);
      S.ui.windowFrame(ctx, x, y, w, h, 'PixelQG', { icon: true });
      O.draw(ctx, 8 + t, { cx: 200, cy: 125, zoom: 2.4, ax: x + w / 2, ay: y + 48 + 300 }, S.LOOP_AGENTS, { clip: [x + 2, y + 48, w - 4, h - 50], labelScale: 2 });
      ctx.restore();
    }
  }

  // ---------- clip B: tour of the office ----------
  const OV = { cx: 200, cy: 125, zoom: 2.6, ax: 540, ay: 1060 };
  const R = (k, cx, cy, zoom = 6.2) => ({ cx, cy, zoom, ax: 540, ay: 1060, spot: O.roomSpot(k, 0.7) });
  const CAM_B = [
    { t: 0, ...OV }, { t: 1.95, ...OV },
    { t: 2.4, ...R('lib', 68, 62) }, { t: 3.4, ...R('lib', 68, 62) },
    { t: 3.85, ...R('srv', 332, 44) }, { t: 4.8, ...R('srv', 332, 44) },
    { t: 5.25, ...R('web', 332, 124) }, { t: 6.2, ...R('web', 332, 124) },
    { t: 6.65, ...R('meet', 68, 184, 5.8) }, { t: 7.5, ...R('meet', 68, 184, 5.8) },
    { t: 7.95, ...R('cafe', 332, 205) }, { t: 9.0, ...R('cafe', 332, 205) },
    { t: 9.8, ...OV, spot: { x: 0, y: 0, w: 400, h: 250, a: 0 } }, { t: 12.4, ...OV },
  ];
  const HEAD_B = [
    { a: 0, b: 2.3, k: null, lines: ['CHAQUE AGENT IA', 'DEVIENT UN PIX'], sub: 'Ton pix va dans la salle de ce qu’il fait.' },
    { a: 2.3, b: 3.75, k: 'lib', lines: ['TON PIX LIT', 'DU CODE'], sub: 'Lecture et recherche dans tes fichiers' },
    { a: 3.75, b: 5.15, k: 'srv', lines: ['IL LANCE', 'DES COMMANDES'], sub: 'Build, tests, scripts' },
    { a: 5.15, b: 6.55, k: 'web', lines: ['IL CHERCHE', 'SUR LE WEB'], sub: 'Recherches et pages web' },
    { a: 6.55, b: 7.85, k: 'meet', lines: ['IL DÉLÈGUE', 'À UN SOUS-PIX'], sub: 'Le sous-pix prend le relais' },
    { a: 7.85, b: 9.4, k: 'cafe', lines: ['MISSION', 'TERMINÉE'], sub: 'Pause café bien méritée' },
    { a: 9.4, b: 12.6, k: null, lines: ['TOUT EST MESURÉ', 'EN DIRECT'], sub: null, hud: true },
  ];
  function b1(ctx, t) {
    ctx.fillStyle = '#0b0d1b'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#151933';
    for (let y = 20; y < VH; y += 40) for (let x = 20; x < VW; x += 40) ctx.fillRect(x, y, 4, 4);
    const cam = O.camAt(CAM_B, t);
    O.draw(ctx, 8 + t, cam, S.LOOP_AGENTS, { labelScale: cam.zoom >= 5 ? 3 : 2 });
    // header panel
    const hd = HEAD_B.find((h) => t >= h.a && t < h.b);
    if (!hd) return;
    const g = ctx.createLinearGradient(0, 0, 0, 620);
    g.addColorStop(0, 'rgba(8,9,20,0.96)'); g.addColorStop(0.8, 'rgba(8,9,20,0.9)'); g.addColorStop(1, 'rgba(8,9,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 620);
    const p = prog(t, hd.a, hd.a + 0.3), a = clamp(p * 2) * (1 - prog(t, hd.b - 0.15, hd.b));
    ctx.save(); ctx.globalAlpha = a;
    const dy = (1 - ease.out(p)) * -30;
    let y = 170 + dy;
    if (hd.k) { const r = O.ROOMS[hd.k]; y += signPlate(ctx, r.name, VW / 2, y, r.sign, 5) + 30; }
    for (const ln of hd.lines) { ptext(ctx, ln, VW / 2, y, fit(ln, 940, 10), C.ink, { align: 'center' }); y += 92; }
    if (hd.sub) centered(ctx, hd.sub, y + 30, { size: 40 });
    if (hd.hud) {
      const cnt = ease.outQuint(prog(t, 9.6, 11.2));
      const tiles = [['TOKENS', (cnt * 1.24).toFixed(2).replace('.', ',') + ' M'], ['COÛT', '$' + (cnt * 0.86).toFixed(2).replace('.', ',')], ['PIX ACTIFS', Math.round(cnt * 6) + ' / 8']];
      tiles.forEach(([lab, val], i) => {
        const tp = prog(t, 9.6 + i * 0.12, 10.0 + i * 0.12);
        if (tp <= 0) return;
        const x = 60 + i * 330, ty = 420 + (1 - ease.back(tp)) * -30;
        ctx.save(); ctx.globalAlpha = a * clamp(tp * 2);
        box(ctx, x, ty, 300, 130, { r: 10, fill: C.panel, stroke: C.line2, lw: 2 });
        text(ctx, lab, x + 22, ty + 42, { size: 22, weight: 700, color: C.mute, spacing: 2 });
        PF.draw(ctx, val, x + 22, ty + 66, 5, i === 1 ? C.lamp : C.ink);
        ctx.restore();
      });
    }
    ctx.restore();
  }

  // ---------- clip C: integrated terminal + Workshop ----------
  const KIWI = O.agent({
    name: 'KIWI', color: '#8f9dff', spawn: 10.5, start: O.SPOT.entrance,
    legs: [{ at: 11.0, path: [[200, O.HALL], [200, 150], O.desk(1, 2)], speed: 60 }],
    says: [[10.5, 'SESSION TERMINAL'], [12.8, 'RÉFLÉCHIT…']],
  });
  const C_AGENTS = S.LOOP_AGENTS.concat([KIWI]);
  function c1(ctx, t) {
    bgGrid(ctx);
    signPlate(ctx, 'TERMINAL INTÉGRÉ', VW / 2, 150, C.cyan, 6, clamp(prog(t, 0.1, 0.4) * 2));
    const cp = prog(t, 0.3, 0.7);
    if (cp > 0) { ctx.save(); ctx.globalAlpha = cp; centered(ctx, 'Tape claude : la session rejoint le bureau.', 300, { size: 38 }); ctx.restore(); }
    const tp = ease.out(prog(t, 0.2, 0.7));
    const tx = 60, ty = 360 + (1 - tp) * 40, tw = 960, th = 500;
    ctx.save(); ctx.globalAlpha = clamp(tp * 1.5);
    S.ui.windowFrame(ctx, tx, ty, tw, th, 'Terminal 1', { body: '#0c0d18' });
    const prompt = 'C:\\Users\\alex\\mon-site>';
    text(ctx, prompt, tx + 30, ty + 120, { size: 34, weight: 400, mono: true, color: '#d6dbff' });
    ctx.font = `400 34px ${Q.MONO}`;
    const pw = ctx.measureText(prompt).width;
    const cmd = 'claude'.slice(0, Math.floor(prog(t, 1.0, 1.6) * 6));
    text(ctx, cmd, tx + 30 + pw, ty + 120, { size: 34, weight: 700, mono: true, color: C.lamp });
    if (t < 1.9 && Math.floor(t * 3) % 2) { ctx.fillStyle = '#d6dbff'; ctx.fillRect(tx + 32 + pw + ctx.measureText(cmd).width, ty + 92, 16, 34); }
    const L = (str, i, col, size = 34) => text(ctx, str, tx + 30, ty + 120 + i * 62, { size, weight: 400, mono: true, color: col });
    if (t > 2.0) L('↳ Session détectée par le QG', 1.2, C.cyan);
    if (t > 2.5) L('● KIWI a rejoint le bureau', 2.3, '#58f08a');
    if (t > 3.2) L('  Le HUD suit ses tokens', 3.6, C.mute, 30);
    if (t > 3.4) L('  et son coût, en direct.', 4.2, C.mute, 30);
    ctx.restore();
    const op = ease.out(prog(t, 0.5, 1.0));
    const ox = 60, oy = 910 + (1 - op) * 40, ow = 960, oh = 600;
    ctx.save(); ctx.globalAlpha = clamp(op * 1.5);
    S.ui.windowFrame(ctx, ox, oy, ow, oh, 'Bureau', { icon: true });
    O.draw(ctx, 8 + t, { cx: 200, cy: 184, zoom: 4.4, ax: ox + ow / 2, ay: oy + 48 + (oh - 48) / 2 }, C_AGENTS, { clip: [ox + 2, oy + 48, ow - 4, oh - 50], labelScale: 3, only: [KIWI.id] });
    ctx.restore();
  }
  const CARDS = [
    { title: 'Skills pour écrire des tests', by: 'Marie', date: '12 oct.', desc: 'Jest, Vitest et Playwright : tes pix écrivent des tests propres.', tags: ['TESTS', 'JAVASCRIPT'], repo: 'github.com/marie/skills-tests' },
    { title: 'Agent rédacteur de documentation', by: 'Hugo', date: '9 oct.', desc: 'Il lit ton code et rédige un README clair, avec exemples.', tags: ['DOCS', 'MARKDOWN'] },
    { title: 'Pack React et Next.js', by: 'PixelFan', date: '3 oct.', desc: 'Composants, hooks et bonnes pratiques pour tes pix.', tags: ['REACT'] },
  ];
  function c2(ctx, t) {
    bgGrid(ctx);
    signPlate(ctx, 'WORKSHOP', VW / 2, 150, C.green, 6, clamp(prog(t, 6.6, 6.9) * 2));
    const cp = prog(t, 6.8, 7.2);
    if (cp > 0) { ctx.save(); ctx.globalAlpha = cp; centered(ctx, 'Les skills partagés par la communauté.', 300, { size: 38 }); ctx.restore(); }
    CARDS.forEach((cd, i) => {
      const p = ease.out(prog(t, 6.9 + i * 0.15, 7.4 + i * 0.15));
      if (p <= 0) return;
      const x = 60, y = 350 + i * 280 + (1 - p) * 60, w = 960, h = 256;
      ctx.save(); ctx.globalAlpha = clamp(p * 1.5);
      box(ctx, x, y, w, h, { r: 12, fill: C.panel, stroke: C.line, lw: 2 });
      text(ctx, cd.title, x + 30, y + 56, { size: 38, weight: 700 });
      text(ctx, `par ${cd.by} · ${cd.date}`, x + 30, y + 96, { size: 26, weight: 500, color: C.mute });
      text(ctx, cd.desc, x + 30, y + 140, { size: 28, weight: 500, color: C.dim });
      let px = x + 30;
      for (const tg of cd.tags) px += S.ui.pill(ctx, '#' + tg, px, y + 168, C.dim, 3) + 12;
      // buttons on the first card
      if (i === 0) {
        const copied = t >= 8.45;
        const bw = 330, bx = x + w - bw - 30, by = y + 166, press = t >= 8.4 && t < 8.55;
        box(ctx, bx, by + (press ? 3 : 0), bw, 60, { r: 6, fill: copied ? 'rgba(88,240,138,0.15)' : C.panel2, stroke: copied ? '#58f08a' : C.line2, lw: 2 });
        PF.draw(ctx, copied ? 'LIEN COPIÉ ✓' : 'COPIER LE LIEN', bx + bw / 2, by + 20 + (press ? 3 : 0), 3, copied ? '#58f08a' : C.ink, { align: 'center' });
      }
      ctx.restore();
    });
    const curp = ease.inOut(prog(t, 7.6, 8.3));
    if (t > 7.5 && t < 9.2) S.ui.cursor(ctx, lerp(900, 840, curp), lerp(1500, 560, curp) + (t >= 8.4 && t < 8.55 ? 3 : 0), 5);
    // the app's library panel slides up
    const lp = ease.out(prog(t, 9.0, 9.5));
    if (lp > 0) {
      const x = 40, y = 1040 + (1 - lp) * 900, w = 1000, h = 470;
      S.ui.windowFrame(ctx, x, y, w, h, 'PixelQG — Bibliothèque', { icon: true });
      S.ui.label(ctx, 'LIEN GITHUB', x + 30, y + 100);
      S.ui.field(ctx, x + 30, y + 118, 640, 70, { focus: t < 10.0 });
      if (t > 9.6) text(ctx, CARDS[0].repo, x + 52, y + 165, { size: 28, weight: 500, mono: true });
      const press = t >= 10.0 && t < 10.18;
      box(ctx, x + 690, y + 118 + (press ? 3 : 0), 280, 70, { r: 10, fill: press ? C.lampD : C.lamp });
      text(ctx, 'Lier le dépôt', x + 830, y + 165 + (press ? 3 : 0), { size: 30, weight: 700, color: '#1a1206', align: 'center' });
      const rp = prog(t, 10.3, 10.6);
      if (rp > 0) {
        ctx.save(); ctx.globalAlpha = rp;
        const cy = y + 220;
        box(ctx, x + 30, cy, 940, 130, { r: 12, fill: C.panel2, stroke: C.line, lw: 2 });
        ctx.fillStyle = '#58f08a'; ctx.fillRect(x + 30, cy + 12, 6, 106);
        text(ctx, 'marie/skills-tests', x + 60, cy + 54, { size: 32, weight: 700, mono: true });
        const ready = t >= 11.0;
        if (!ready) { box(ctx, x + 60, cy + 80, 620, 16, { r: 8, fill: '#0b0d1a' }); box(ctx, x + 60, cy + 80, Math.max(16, 620 * ease.inOut(prog(t, 10.4, 11.0))), 16, { r: 8, fill: C.cyan }); }
        else text(ctx, '20 skills · prêts pour tes pix', x + 60, cy + 100, { size: 28, weight: 500, color: C.dim });
        S.ui.pill(ctx, ready ? 'PRÊT' : 'CLONAGE…', x + 770, cy + 30, ready ? '#58f08a' : C.cyan, 3);
        ctx.restore();
        const sp = prog(t, 11.0, 11.6);
        if (sp > 0 && sp < 1) for (let i = 0; i < 12; i++) {
          const th = (i / 12) * Math.PI * 2, r = 40 + ease.out(sp) * 130;
          ctx.globalAlpha = 1 - sp; ctx.fillStyle = i % 2 ? '#58f08a' : C.lamp;
          ctx.fillRect(Math.round(x + 840 + Math.cos(th) * r), Math.round(cy + 50 + Math.sin(th) * r * 0.6), 9, 9);
        }
        ctx.globalAlpha = 1;
      }
      if (t > 11.3) ptext(ctx, '→ TES PIX S’EN SERVENT', VW / 2, y + 395, fit('→ TES PIX S’EN SERVENT', 900, 5), C.lamp, { align: 'center', chars: Math.floor(prog(t, 11.3, 11.9) * 25) });
    }
  }

  // ---------- timelines ----------
  const CLIPS = {
    a: { name: 'aveugle', duration: 15, posterAt: 10.6, grooveAt: 6.6,
      scenes: [{ a: 0, b: 6.9, draw: a1 }, { a: 6.3, b: 12.0, draw: a2 }, { a: 11.4, b: 99, draw: (c, t) => endCard(c, t, 11.6) }],
      trans: [{ a: 6.3, b: 6.9, type: 'mosaic' }, { a: 11.4, b: 12.0, type: 'wipe' }] },
    b: { name: 'bureau', duration: 15.6, posterAt: 2.9, grooveAt: 0,
      scenes: [{ a: 0, b: 12.6, draw: b1 }, { a: 12.0, b: 99, draw: (c, t) => endCard(c, t, 12.2) }],
      trans: [{ a: 12.0, b: 12.6, type: 'wipe' }] },
    c: { name: 'terminal-workshop', duration: 15.6, posterAt: 8.7, grooveAt: 0,
      scenes: [{ a: 0, b: 7.0, draw: c1 }, { a: 6.4, b: 12.6, draw: c2 }, { a: 12.0, b: 99, draw: (c, t) => endCard(c, t, 12.2) }],
      trans: [{ a: 6.4, b: 7.0, type: 'wipe' }, { a: 12.0, b: 12.6, type: 'wipe' }] },
  };

  function render(ctx, key, t) {
    const clip = CLIPS[key];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    const tr = clip.trans.find((x) => t >= x.a && t < x.b);
    if (tr) {
      const i = clip.scenes.findIndex((s) => tr.a >= s.a && tr.a < s.b);
      const from = clip.scenes[i], to = clip.scenes[i + 1];
      const A = Q.buffer('vA', VW, VH), B = Q.buffer('vB', VW, VH);
      from.draw(A.ctx, t); to.draw(B.ctx, t);
      const p = prog(t, tr.a, tr.b);
      if (tr.type === 'wipe') wipe(ctx, A.canvas, B.canvas, ease.inOut(p) * 1.02);
      else {
        const half = p < 0.5, k = half ? p * 2 : (1 - p) * 2;
        mosaic(ctx, half ? A.canvas : B.canvas, 1 + Math.round(ease.in(k) * 40));
        ctx.fillStyle = `rgba(0,0,0,${k * 0.9})`; ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }
    const sc = clip.scenes.filter((s) => t >= s.a && t < s.b).pop() || clip.scenes[clip.scenes.length - 1];
    sc.draw(ctx, t);
  }

  root.Social = { VW, VH, CLIPS, render };
})(window);
