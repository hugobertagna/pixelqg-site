/* PixelQG explainer storyboard. renderAt(t) draws the frame at time t (seconds), deterministically. */
(function (root) {
  const { W, H, C, AGENT, clamp, lerp, prog, ease, hash, drawBot, box, plate, text, ptext, buffer, pixelWipe, mosaic, sky, skyline, alpha, mix, shade, MONO } = root.Q;
  const PF = root.PixelFont;
  const O = root.Office;
  const DURATION = 65;
  const LOOP_DURATION = 8;

  // ---------- assets ----------
  const IMG = {};
  function loadImages() {
    const list = { appFull: '../images/app-full.webp' };
    return Promise.all(Object.entries(list).map(([k, src]) => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => rej(new Error('image ' + src)); i.src = src;
    })));
  }

  // ---------- small UI pieces ----------
  function bgGrid(ctx) {
    ctx.fillStyle = '#0a0c19'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#151933';
    for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) ctx.fillRect(x, y, 4, 4);
  }
  function stepChip(ctx, n, label, x, y, p, s = 6) {
    if (p <= 0) return;
    const k = ease.out(p);
    ctx.save(); ctx.globalAlpha = clamp(p * 2);
    const dx = Math.round((1 - k) * -60);
    const size = 11 * s;
    plate(ctx, x + dx, y, size, size, C.lamp, null, s);
    PF.draw(ctx, String(n), x + dx + size / 2, y + 2 * s, s, '#1a1206', { align: 'center' });
    ptext(ctx, label, x + dx + size + 3 * s, y + 2 * s, s, C.ink);
    ctx.restore();
  }
  function caption(ctx, str, y, a = 1, size = 34, color = C.dim) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    text(ctx, str, W / 2, y, { size, weight: 600, color, align: 'center' });
    ctx.restore();
  }
  function wrap(ctx, str, maxW, size, weight = 500) {
    ctx.font = `${weight} ${size}px ${root.Q.FONT}`;
    const words = str.split(' '); const lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line);
    return lines;
  }
  const CURSOR = [
    'K..........', 'KK.........', 'KWK........', 'KWWK.......', 'KWWWK......', 'KWWWWK.....', 'KWWWWWK....', 'KWWWWWWK...',
    'KWWWWWWWK..', 'KWWWWWWWWK.', 'KWWWWWKKKKK', 'KWWKWWK....', 'KWK.KWWK...', 'KK..KWWK...', 'K....KWWK..', '.....KKKK..',
  ];
  function cursor(ctx, x, y, s = 4) {
    for (let r = 0; r < CURSOR.length; r++) for (let c = 0; c < CURSOR[r].length; c++) {
      const k = CURSOR[r][c]; if (k === '.') continue;
      ctx.fillStyle = k === 'K' ? '#0a0b16' : '#ffffff'; ctx.fillRect(Math.round(x + c * s), Math.round(y + r * s), s, s);
    }
  }
  function field(ctx, x, y, w, h, o = {}) {
    box(ctx, x, y, w, h, { r: 8, fill: C.field, stroke: o.focus ? C.lamp : C.line2, lw: o.focus ? 3 : 2 });
  }
  function label(ctx, str, x, y) { text(ctx, str, x, y, { size: 19, weight: 700, color: C.mute, spacing: 2 }); }
  function pill(ctx, str, x, y, color, s = 2, fill) {
    const w = PF.measure(str) * s + 8 * s, h = 7 * s + 6 * s;
    ctx.fillStyle = fill || alpha(color, 0.14); ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = s; ctx.strokeRect(x + s / 2, y + s / 2, w - s, h - s);
    PF.draw(ctx, str, x + 4 * s, y + 3 * s, s, color);
    return w;
  }
  function windowFrame(ctx, x, y, w, h, title, o = {}) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    box(ctx, x, y, w, h, { r: 12, fill: o.body || '#0f1120' });
    ctx.restore();
    box(ctx, x, y, w, h, { r: 12, stroke: C.line2, lw: 2 });
    ctx.save(); ctx.beginPath(); root.Q.rrect(ctx, x, y, w, 46, 12); ctx.rect(x, y + 20, w, 26); ctx.clip();
    ctx.fillStyle = o.bar || '#1b1f38'; ctx.fillRect(x, y, w, 46); ctx.restore();
    ctx.fillStyle = C.line2; ctx.fillRect(x, y + 46, w, 2);
    if (o.icon) drawBot(ctx, x + 30, y + 38, 2, { color: C.lamp });
    text(ctx, title, x + (o.icon ? 52 : 22), y + 31, { size: 22, weight: 600, color: C.dim, mono: !!o.mono });
    // window buttons (Windows style)
    const bx = x + w - 30;
    ctx.strokeStyle = C.mute; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 6, y + 17); ctx.lineTo(bx + 6, y + 29); ctx.moveTo(bx + 6, y + 17); ctx.lineTo(bx - 6, y + 29); ctx.stroke();
    ctx.strokeRect(bx - 56, y + 17, 12, 12);
    ctx.beginPath(); ctx.moveTo(bx - 106, y + 23); ctx.lineTo(bx - 94, y + 23); ctx.stroke();
  }

  // ---------- agents of the main story ----------
  const A = O.agent, D = O.desk, S = O.SPOT, RT = O.route.entranceTo, LL = O.LANE_L, LR = O.LANE_R, HALL = O.HALL;
  const ATLAS = A({ name: 'ATLAS', color: 'lime', spawn: -1, start: D(2, 0), says: [[-1, 'RÉFLÉCHIT…']] });
  const VEGA = A({ name: 'VEGA', color: 'orange', spawn: -1, start: S.cafeTable, says: [[-1, 'PAUSE CAFÉ', 'done']] });
  const NOVA = A({
    name: 'NOVA', color: 'blue', spawn: 17.75, start: S.entrance,
    legs: [{ at: 18.15, path: RT.lib, speed: 85 }, { at: 36.2, path: [O.DOOR.lib[0], [LL, 74], [LL, 50], D(0, 0)], speed: 80 }],
    says: [[17.75, 'C’EST PARTI !'], [21.7, 'LIT SERVER.JS'], [25.4, 'LIT ROUTES/API.JS'], [36.2, 'RÉDIGE NOTES.MD']],
  });
  const PIXEL = A({
    name: 'PIXEL', color: 'green', spawn: 18.4, start: S.entrance, legs: [{ at: 18.8, path: RT.srv, speed: 88 }],
    says: [[18.4, 'DÉMARRE…'], [22.4, 'EXÉCUTE NPM TEST'], [25.9, '42 TESTS OK']],
  });
  const ORION = A({
    name: 'ORION', color: 'purple', spawn: 19.0, start: S.entrance, legs: [{ at: 19.35, path: RT.web, speed: 85 }],
    says: [[19.0, 'DÉMARRE…'], [22.0, 'CHERCHE « DOCS API »'], [28.0, 'LIT LA DOC EN LIGNE']],
  });
  const LUNA = A({
    name: 'LUNA', color: 'pink', spawn: 19.6, start: S.entrance, legs: [{ at: 19.95, path: RT.meet, speed: 85 }],
    says: [[19.6, 'DÉMARRE…'], [22.6, 'PLANIFIE…'], [29.3, 'DÉLÈGUE : LES TESTS']],
  });
  const MOCHI = A({
    name: 'MOCHI', color: 'yellow', spawn: 29.75, start: S.meetE, parent: LUNA.id,
    legs: [{ at: 30.8, path: [O.DOOR.meet[0], O.DOOR.meet[1], [LL, 138], D(0, 2)], speed: 80 }],
    says: [[29.75, 'SOUS-AGENT'], [32.8, 'ÉCRIT LES TESTS']],
  });
  const ZEPHYR = A({
    name: 'ZÉPHYR', color: 'teal', spawn: 20.2, start: S.entrance,
    legs: [
      { at: 20.5, path: [[200, HALL], [LR, HALL], [LR, 94], D(1, 1)], speed: 85 },
      { at: 28.5, path: [[LR, 94], [LR, 212], O.DOOR.cafe[0], [330, 222], S.cafe2], speed: 88 },
    ],
    says: [[20.2, 'DÉMARRE…'], [23.6, 'RÉDIGE LE RÉSUMÉ'], [32.0, 'TERMINÉ ✓', 'done']],
  });
  const KIWI = A({
    name: 'KIWI', color: '#8f9dff', spawn: 43.7, start: S.entrance, legs: [{ at: 44.2, path: [[200, HALL], [LR, HALL], [LR, 138], D(2, 2)], speed: 70 }],
    says: [[43.7, 'SESSION TERMINAL'], [46.0, 'RÉFLÉCHIT…']],
  });
  const MAIN_AGENTS = [ATLAS, VEGA, NOVA, PIXEL, ORION, LUNA, MOCHI, ZEPHYR, KIWI];

  const spot = O.roomSpot;
  const OV = { cx: 200, cy: 125, zoom: 3.6, ax: 960, ay: 470 };
  const room = (k, cx, cy) => ({ cx, cy, zoom: 7, ax: 600, ay: 560, spot: spot(k) });
  const CAM = [
    { t: 17.0, cx: 200, cy: 206, zoom: 8, ax: 960, ay: 560 },
    { t: 18.7, cx: 200, cy: 204, zoom: 8, ax: 960, ay: 560 },
    { t: 20.2, ...OV }, { t: 21.3, ...OV },
    { t: 21.9, ...room('lib', 68, 62) }, { t: 23.7, ...room('lib', 68, 62) },
    { t: 24.3, ...room('srv', 332, 44) }, { t: 26.1, ...room('srv', 332, 44) },
    { t: 26.7, ...room('web', 332, 124) }, { t: 28.5, ...room('web', 332, 124) },
    { t: 29.1, ...room('meet', 68, 184) }, { t: 30.9, ...room('meet', 68, 184) },
    { t: 31.5, ...room('cafe', 332, 205) }, { t: 33.9, ...room('cafe', 332, 205) },
    { t: 34.9, cx: 200, cy: 125, zoom: 3, ax: 690, ay: 640, spot: { x: 0, y: 0, w: 400, h: 250, a: 0 } },
    { t: 41.8, cx: 200, cy: 125, zoom: 3, ax: 690, ay: 640 },
  ];
  const ROOM_CAPS = [
    { a: 21.9, b: 23.95, k: 'lib', title: ['IL LIT DU CODE'], sub: 'Lecture et recherche dans tes fichiers.', tools: 'Read · Grep · Glob' },
    { a: 24.3, b: 26.35, k: 'srv', title: ['IL LANCE', 'DES COMMANDES'], sub: 'Build, tests, scripts : direction la salle serveurs.', tools: 'Bash · npm · git' },
    { a: 26.7, b: 28.75, k: 'web', title: ['IL CHERCHE', 'SUR LE WEB'], sub: 'Recherches et lecture de pages web.', tools: 'WebSearch · WebFetch' },
    { a: 29.1, b: 31.15, k: 'meet', title: ['IL DÉLÈGUE'], sub: 'Il confie une partie du travail à un sous-agent… qui apparaît à côté de lui.', tools: 'Task → sous-agent' },
    { a: 31.5, b: 34.3, k: 'cafe', title: ['MISSION', 'TERMINÉE'], sub: 'Travail fini : pause café bien méritée.', tools: 'Statut : terminé ✓' },
  ];

  // ---------- S1: the problem ----------
  const LOG = [
    ['› Read src/server.js', '#7fd8ff'], ['  142 lignes lues', '#7c84b3'], ['› Grep "TODO" --type ts', '#7fd8ff'], ['  7 résultats', '#7c84b3'],
    ['› Bash npm test', '#ffd36b'], ['  ✓ 38 passed   ✗ 4 failed', '#ff8b7e'], ['› Edit src/api/routes.ts', '#9dff9a'], ['  +12 −3', '#7c84b3'],
    ['› WebFetch docs.exemple.dev', '#c7a6ff'], ['  … réflexion', '#7c84b3'], ['› Task : écrire les tests', '#ff9ccb'], ['› Bash git status', '#ffd36b'],
    ['  modified: 6 files', '#7c84b3'], ['› Read package.json', '#7fd8ff'], ['› Glob **/*.config.js', '#7fd8ff'], ['  3 fichiers', '#7c84b3'],
    ['› Bash npm run build', '#ffd36b'], ['  ⚠ 2 warnings', '#ffb86b'], ['  tokens : 18 230', '#7c84b3'], ['› Edit README.md', '#9dff9a'],
  ];
  const WINS = [
    { x: 110, y: 120, w: 720, h: 390, t: 0.25, n: 1 }, { x: 1080, y: 90, w: 720, h: 380, t: 0.6, n: 2 },
    { x: 230, y: 610, w: 660, h: 380, t: 0.95, n: 3 }, { x: 1010, y: 560, w: 780, h: 420, t: 1.3, n: 4 },
    { x: 600, y: 330, w: 700, h: 400, t: 1.7, n: 5 },
  ];
  function s1(ctx, t) {
    bgGrid(ctx);
    const shake = t > 5.4 ? (hash(Math.floor(t * 30)) - 0.5) * 10 * prog(t, 5.4, 6.6) : 0;
    for (const w of WINS) {
      const p = prog(t, w.t, w.t + 0.35);
      if (p <= 0) continue;
      ctx.save();
      ctx.globalAlpha = clamp(p * 1.5);
      const k = lerp(0.9, 1, ease.back(p));
      ctx.translate(w.x + w.w / 2 + shake * (w.n % 2 ? 1 : -1), w.y + w.h / 2);
      ctx.scale(k, k); ctx.translate(-w.w / 2, -w.h / 2);
      windowFrame(ctx, 0, 0, w.w, w.h, `Agent ${w.n} — Invite de commandes`, { body: '#0c0d18' });
      ctx.save(); ctx.beginPath(); ctx.rect(0, 50, w.w, w.h - 54); ctx.clip();
      const n = Math.floor((t - w.t) * (6 + w.n));
      const maxLines = Math.floor((w.h - 70) / 30);
      const first = Math.max(0, n - maxLines);
      for (let i = first; i < n; i++) {
        const [str, col] = LOG[(i + w.n * 5) % LOG.length];
        text(ctx, str, 22, 84 + (i - first) * 30, { size: 21, weight: 400, mono: true, color: col });
      }
      if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#d6dbff'; ctx.fillRect(22, 84 + (n - first) * 30 - 18, 11, 22); }
      ctx.restore();
      ctx.restore();
    }
    // headline band
    const bandP = prog(t, 0.9, 1.3);
    if (bandP > 0) {
      ctx.fillStyle = `rgba(6,7,15,${0.86 * ease.out(bandP)})`;
      ctx.fillRect(0, 360, W, 330);
      const l1 = 'TES AGENTS IA BOSSENT…', l2 = '…À L’AVEUGLE.';
      ptext(ctx, l1, W / 2, 410, 9, C.ink, { align: 'center', chars: Math.floor(prog(t, 1.0, 2.0) * l1.length) });
      ptext(ctx, l2, W / 2, 530, 13, C.lamp, { align: 'center', chars: Math.floor(prog(t, 2.3, 3.0) * l2.length), shadow: 6 });
    }
    const chips = [
      { s: 'QUI FAIT QUOI ?', x: 250, y: 250, t: 3.6, c: C.pink }, { s: 'ÇA AVANCE ?', x: 1330, y: 270, t: 4.1, c: C.cyan },
      { s: 'ÇA COÛTE COMBIEN ?', x: 740, y: 770, t: 4.6, c: C.lamp },
    ];
    for (const ch of chips) {
      const p = prog(t, ch.t, ch.t + 0.4);
      if (p <= 0) continue;
      const k = ease.back(p), s = 6;
      const w = PF.measure(ch.s) * s + 10 * s, h = 7 * s + 8 * s;
      ctx.save(); ctx.translate(ch.x + w / 2, ch.y + h / 2); ctx.scale(k, k); ctx.rotate((hash(ch.t * 10) - 0.5) * 0.08);
      plate(ctx, -w / 2, -h / 2, w, h, '#0f1120', ch.c, s);
      PF.draw(ctx, ch.s, 0, -h / 2 + 4 * s, s, ch.c, { align: 'center' });
      ctx.restore();
    }
    const out = prog(t, 6.3, 7.0);
    if (out > 0) { ctx.fillStyle = `rgba(0,0,0,${ease.in(out)})`; ctx.fillRect(0, 0, W, H); }
    const inn = 1 - prog(t, 0, 0.4);
    if (inn > 0) { ctx.fillStyle = `rgba(0,0,0,${inn})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- S2: title ----------
  function titlePixels(str, s, cx, y) {
    const out = [];
    let x = Math.round(cx - (PF.measure(str) * s) / 2);
    let col = 0;
    for (const ch of str) {
      const g = PF.lookup(ch);
      g.r.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') out.push({ x: x + rx * s, y: y + (g.y + ry) * s, col: col + rx, ch }); }));
      x += PF.advance(g) * s; col += PF.advance(g);
    }
    return out;
  }
  const TITLE = titlePixels('PIXELQG', 22, W / 2, 330);
  const TITLE_COLS = 39;
  function drawTitle(ctx, t, t0, o = {}) {
    const s = 22;
    for (const pass of [0, 1]) {
      for (const p of TITLE) {
        const d = t0 + (p.col / TITLE_COLS) * 0.55 + hash(p.x, p.y) * 0.25;
        const k = prog(t, d, d + 0.45);
        if (k <= 0) continue;
        const yo = (1 - ease.out(k)) * -280;
        ctx.globalAlpha = clamp(k * 2.5);
        if (pass === 0) { ctx.fillStyle = '#05060c'; ctx.fillRect(p.x + 10, Math.round(p.y + yo) + 10, s, s); }
        else { ctx.fillStyle = p.ch === 'Q' || p.ch === 'G' ? C.lamp : C.ink; ctx.fillRect(p.x, Math.round(p.y + yo), s, s); }
      }
    }
    ctx.globalAlpha = 1;
  }
  function s2(ctx, t) {
    sky(ctx, t);
    skyline(ctx, t, H - 300, 4);
    const glow = ctx.createRadialGradient(W / 2, 420, 50, W / 2, 420, 700);
    glow.addColorStop(0, 'rgba(255,200,74,0.10)'); glow.addColorStop(1, 'rgba(255,200,74,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // mascot hop
    const mp = prog(t, 8.2, 8.8);
    if (mp > 0) {
      const y = lerp(H + 50, 290, ease.back(mp));
      const hop = t > 9.4 ? Math.max(0, Math.sin((t - 9.4) * 5)) * 14 * (t < 10.1 ? 1 : 0) : 0;
      drawBot(ctx, W / 2, Math.round(y - hop), 12, { color: C.cyan, look: t > 9.0 && t < 9.8 ? 1 : 0, blink: Math.floor(t * 4) === 43, antenna: Math.floor(t * 3) % 2 ? C.lamp : '#fff2c0', smile: t > 10.2 });
    }
    drawTitle(ctx, t, 7.55);
    const tag = 'TON QG D’AGENTS IA, EN PIXEL ART.';
    if (t > 9.2) ptext(ctx, tag, W / 2, 560, 5, C.ink, { align: 'center', chars: Math.floor(prog(t, 9.2, 10.1) * tag.length) });
    const bp = prog(t, 10.3, 10.7);
    if (bp > 0) {
      ctx.save(); ctx.globalAlpha = bp;
      const w = 470, x = W / 2 - w / 2, y = 640 + (1 - ease.out(bp)) * 20;
      box(ctx, x, y, w, 58, { r: 29, fill: 'rgba(79,227,211,0.10)', stroke: C.cyan, lw: 2 });
      text(ctx, 'Compatible avec Claude Code', W / 2, y + 39, { size: 28, weight: 600, color: C.cyan, align: 'center' });
      ctx.restore();
    }
  }

  // ---------- S3: launch an agent ----------
  const MISSION = 'Analyse ce projet et résume son architecture dans NOTES.md';
  const SWATCHES = ['#ff9a4a', '#4aa3ff', '#6fd36a', '#b07cff', '#ffc84a', '#ff6fae', '#3fd4c4', '#c6e65a', '#8f9dff', '#ff6b5e'];
  function s3(ctx, t) {
    bgGrid(ctx);
    stepChip(ctx, 1, 'LANCE UN AGENT', 120, 70, prog(t, 11.9, 12.4));
    const pp = prog(t, 12.0, 12.5);
    const out = prog(t, 16.4, 16.9);
    ctx.save();
    ctx.globalAlpha = clamp(pp * 2) * (1 - out * 0.35);
    const px0 = 260, py0 = 200 + (1 - ease.out(pp)) * 40, pw = 1400, ph = 700;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    box(ctx, px0, py0, pw, ph, { r: 14, fill: C.panel }); ctx.restore();
    box(ctx, px0, py0, pw, ph, { r: 14, stroke: C.line2, lw: 2 });
    PF.draw(ctx, 'NOUVEL AGENT', px0 + 40, py0 + 36, 4, C.ink);
    text(ctx, 'Ctrl + Entrée pour lancer', px0 + pw - 40, py0 + 60, { size: 22, weight: 500, color: C.mute, align: 'right' });
    ctx.fillStyle = C.line; ctx.fillRect(px0, py0 + 96, pw, 2);
    // mission
    const lx = px0 + 40, ty = py0 + 140;
    label(ctx, 'MISSION', lx, ty);
    field(ctx, lx, ty + 16, 700, 330, { focus: t < 14.3 });
    const typed = MISSION.slice(0, Math.floor(prog(t, 12.6, 14.2) * MISSION.length));
    const lines = wrap(ctx, typed || ' ', 640, 32, 500);
    lines.forEach((ln, i) => text(ctx, ln, lx + 26, ty + 66 + i * 44, { size: 32, weight: 500, color: C.ink }));
    if (t < 14.3 && Math.floor(t * 3) % 2) {
      ctx.font = `500 32px ${root.Q.FONT}`;
      const lw = ctx.measureText(lines[lines.length - 1]).width;
      ctx.fillStyle = C.lamp; ctx.fillRect(lx + 28 + lw, ty + 66 + (lines.length - 1) * 44 - 28, 3, 34);
    }
    // right column
    const rx = px0 + 790, rw = 570;
    label(ctx, 'NOM', rx, ty);
    field(ctx, rx, ty + 16, rw, 62, { focus: t >= 14.3 && t < 14.9 });
    const name = 'Nova'.slice(0, Math.floor(prog(t, 14.35, 14.7) * 4));
    text(ctx, name || 'Nom (automatique)', rx + 22, ty + 58, { size: 28, weight: 500, color: name ? C.ink : C.mute });
    label(ctx, 'MODÈLE', rx, ty + 112); label(ctx, 'EFFORT', rx + rw / 2 + 10, ty + 112);
    field(ctx, rx, ty + 128, rw / 2 - 10, 58); field(ctx, rx + rw / 2 + 10, ty + 128, rw / 2 - 10, 58);
    text(ctx, 'Par défaut  ▾', rx + 20, ty + 167, { size: 26, weight: 500 }); text(ctx, 'Par défaut  ▾', rx + rw / 2 + 30, ty + 167, { size: 26, weight: 500 });
    label(ctx, 'PERMISSIONS', rx, ty + 222);
    field(ctx, rx, ty + 238, rw, 58);
    text(ctx, 'Prudent — lecture seule  ▾', rx + 20, ty + 277, { size: 26, weight: 500 });
    label(ctx, 'COULEUR', rx, ty + 334);
    const sel = lerp(0, 1, ease.inOut(prog(t, 14.8, 15.1)));
    SWATCHES.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(rx + i * 56, ty + 352, 44, 44); });
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.strokeRect(rx + sel * 56 - 6, ty + 346, 56, 56);
    label(ctx, 'DOSSIER DE TRAVAIL', rx, ty + 444);
    field(ctx, rx, ty + 460, rw, 58);
    text(ctx, 'C:\\Projets\\mon-site', rx + 20, ty + 498, { size: 25, weight: 500, mono: true });
    // launch button
    const press = t >= 15.95 && t < 16.2;
    const bx = lx + 380, by = ty + 400 + (press ? 4 : 0), bw = 320, bh = 76;
    if (!press) { ctx.fillStyle = C.lampD; root.Q.rrect(ctx, bx, ty + 406, bw, bh, 10); ctx.fill(); }
    box(ctx, bx, by, bw, bh, { r: 10, fill: press ? C.lampD : C.lamp });
    text(ctx, 'Lancer l’agent', bx + bw / 2, by + 49, { size: 30, weight: 700, color: '#1a1206', align: 'center' });
    ctx.restore();
    // click burst + bot popping out of the button
    const burst = prog(t, 16.0, 16.5);
    if (burst > 0 && burst < 1) {
      for (let i = 0; i < 14; i++) {
        const th = (i / 14) * Math.PI * 2, r = 30 + ease.out(burst) * 140;
        ctx.fillStyle = i % 2 ? C.lamp : '#4aa3ff';
        ctx.globalAlpha = 1 - burst; ctx.fillRect(Math.round(lx + 540 + Math.cos(th) * r), Math.round(ty + 438 + Math.sin(th) * r * 0.6), 8, 8);
      }
      ctx.globalAlpha = 1;
    }
    const bp = prog(t, 16.15, 16.9);
    if (bp > 0) {
      const bx2 = lerp(lx + 540, W / 2 + 120, ease.out(bp)), by2 = lerp(ty + 470, 900, ease.out(bp)) - Math.sin(bp * Math.PI) * 260;
      drawBot(ctx, Math.round(bx2), Math.round(by2), 9, { color: '#4aa3ff', look: 1, smile: true });
    }
    // cursor
    const cp = ease.inOut(prog(t, 15.1, 15.85));
    if (t > 14.9 && t < 16.6) cursor(ctx, lerp(1560, lx + 540, cp), lerp(1000, ty + 440, cp) + (press ? 3 : 0));
    caption(ctx, 'Décris la mission, choisis une couleur… et lance.', 1000, prog(t, 12.4, 12.9) * (1 - out));
  }

  // ---------- S4 + S5: the office, rooms tour and live stats ----------
  function roomCaption(ctx, t, rc) {
    const pin = prog(t, rc.a + 0.15, rc.a + 0.55), pout = prog(t, rc.b - 0.3, rc.b);
    if (pin <= 0 || pout >= 1) return;
    const r = O.ROOMS[rc.k];
    const dx = (1 - ease.out(pin)) * 80 + ease.in(pout) * 80;
    ctx.save(); ctx.globalAlpha = clamp(pin * 1.6) * (1 - pout);
    ctx.save(); ctx.globalAlpha = clamp(pin * 1.6) * (1 - pout) * 0.9;
    const g = ctx.createLinearGradient(1060, 0, 1180, 0); g.addColorStop(0, 'rgba(8,9,20,0)'); g.addColorStop(1, 'rgba(8,9,20,1)');
    ctx.fillStyle = g; ctx.fillRect(1060, 0, 860, H); ctx.restore();
    const x0 = 1120 + dx;
    let y = 300;
    const sw = PF.measure(r.name) * 4 + 40;
    plate(ctx, x0, y, sw, 64, '#0f1120', r.sign, 4);
    PF.draw(ctx, r.name, x0 + 20, y + 22, 4, r.sign);
    y += 112;
    for (const ln of rc.title) { ptext(ctx, ln, x0, y, 8, C.ink); y += 80; }
    y += 30;
    const lines = wrap(ctx, rc.sub, 720, 36, 500);
    for (const ln of lines) { text(ctx, ln, x0, y, { size: 36, weight: 500, color: C.dim }); y += 50; }
    y += 20;
    text(ctx, rc.tools, x0, y, { size: 28, weight: 500, color: r.sign, mono: true });
    ctx.restore();
  }
  const ROSTER = [
    { a: NOVA, act: 'Rédige NOTES.md', st: 'TRAVAILLE', tok: 48.2, rate: 1.9, cost: 0.12, time: 134 },
    { a: PIXEL, act: 'Exécute npm test', st: 'TRAVAILLE', tok: 61.7, rate: 2.4, cost: 0.17, time: 128 },
    { a: ORION, act: 'Cherche « docs API »', st: 'TRAVAILLE', tok: 39.9, rate: 1.6, cost: 0.09, time: 121 },
    { a: LUNA, act: 'Délègue : les tests', st: 'TRAVAILLE', tok: 72.4, rate: 2.1, cost: 0.21, time: 119 },
    { a: MOCHI, act: 'Écrit les tests', st: 'SOUS-AGENT', tok: 18.3, rate: 2.8, cost: 0.05, time: 41, sub: true },
    { a: ZEPHYR, act: 'Terminé ✓', st: 'TERMINÉ ✓', tok: 52.6, rate: 0, cost: 0.14, time: 96 },
  ];
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const frNum = (v, d) => v.toFixed(d).replace('.', ',');
  function statsOverlay(ctx, t) {
    const base = 34.6;
    if (t < base) return;
    ptext(ctx, 'TOUT EST MESURÉ, EN DIRECT.', 92, 52, 6, C.ink, { chars: Math.floor(prog(t, base, base + 0.8) * 27) });
    const cnt = ease.outQuint(prog(t, base + 0.3, base + 2.6));
    const tiles = [
      ['AGENTS ACTIFS', `${Math.round(cnt * 6)} / 8`],
      ['TOKENS TOTAUX', `${frNum(cnt * 1.24 + Math.max(0, t - base - 2.6) * 0.004, 2)} M`],
      ['COÛT TOTAL', `$${frNum(cnt * 0.86 + Math.max(0, t - base - 2.6) * 0.003, 2)}`],
      ['TEMPS CUMULÉ', mmss(cnt * 872 + Math.max(0, t - base - 2.6) * 6)],
    ];
    tiles.forEach(([lab, val], i) => {
      const p = prog(t, base + 0.15 + i * 0.1, base + 0.55 + i * 0.1);
      if (p <= 0) return;
      const x = 92 + i * 302, y = 118 + (1 - ease.back(p)) * -40;
      ctx.save(); ctx.globalAlpha = clamp(p * 2);
      box(ctx, x, y, 286, 118, { r: 10, fill: C.panel, stroke: C.line2, lw: 2 });
      text(ctx, lab, x + 22, y + 38, { size: 19, weight: 700, color: C.mute, spacing: 2 });
      PF.draw(ctx, val, x + 22, y + 60, 5, i === 2 ? C.lamp : C.ink);
      ctx.restore();
    });
    // roster
    const rp = prog(t, base + 0.2, base + 0.7);
    if (rp > 0) {
      ctx.save(); ctx.globalAlpha = clamp(rp * 2);
      const x0 = 1340, y0 = 52;
      box(ctx, x0, y0, 500, 974, { r: 12, fill: '#10132a', stroke: C.line2, lw: 2 });
      PF.draw(ctx, 'ÉQUIPE', x0 + 28, y0 + 34, 4, C.ink);
      pill(ctx, '8', x0 + 210, y0 + 30, C.dim, 3);
      ctx.restore();
      ROSTER.forEach((r, i) => {
        const p = prog(t, base + 0.35 + i * 0.12, base + 0.8 + i * 0.12);
        if (p <= 0) return;
        const ind = r.sub ? 34 : 0;
        const x = x0 + 18 + ind + (1 - ease.out(p)) * 120, y = y0 + 100 + i * 144, w = 464 - ind;
        ctx.save(); ctx.globalAlpha = clamp(p * 2);
        box(ctx, x, y, w, 130, { r: 10, fill: C.panel2 });
        ctx.fillStyle = r.a.colorHex; ctx.fillRect(x, y + 10, 6, 110);
        if (r.sub) { ctx.fillStyle = C.line2; ctx.fillRect(x - 22, y - 20, 3, 84); ctx.fillRect(x - 22, y + 62, 16, 3); }
        drawBot(ctx, x + 50, y + 82, 4, { color: r.a.colorHex, smile: r.st.includes('✓'), antenna: r.st.includes('✓') ? '#58f08a' : C.lamp, blink: hash(i, Math.floor(t * 4)) < 0.06 });
        text(ctx, r.a.name.charAt(0) + r.a.name.slice(1).toLowerCase(), x + 96, y + 40, { size: 28, weight: 700 });
        const stc = r.st.includes('✓') ? '#58f08a' : r.sub ? C.lamp : C.cyan;
        pill(ctx, r.st, x + w - PF.measure(r.st) * 2 - 30, y + 16, stc, 2);
        text(ctx, r.act, x + 96, y + 76, { size: 24, weight: 500, color: C.dim });
        const el = t - base;
        const tok = r.tok + r.rate * Math.max(0, el);
        text(ctx, `${mmss(r.time + (r.rate ? el : 0))}   ${frNum(tok, 1)} k   $${frNum(r.cost + r.rate * el * 0.0011, 2)}`, x + 96, y + 112, { size: 21, weight: 500, color: C.mute, mono: true });
        ctx.restore();
      });
    }
  }
  function s4(ctx, t) {
    ctx.fillStyle = '#0b0d1b'; ctx.fillRect(0, 0, W, H);
    const cam = O.camAt(CAM, t);
    O.draw(ctx, t, cam, MAIN_AGENTS, { labelScale: cam.zoom >= 5.5 ? 3 : 2 });
    // overview caption
    const ov = prog(t, 19.3, 19.7) * (1 - prog(t, 21.2, 21.6));
    if (ov > 0) {
      ctx.save(); ctx.globalAlpha = ov;
      ctx.fillStyle = 'rgba(8,9,20,0.85)'; ctx.fillRect(0, 944, W, 136);
      const s = 6, lab = 'REGARDE-LE BOSSER', w = 11 * s + 3 * s + PF.measure(lab) * s;
      stepChip(ctx, 2, lab, W / 2 - w / 2, 962, 1, s);
      text(ctx, 'Chaque action l’emmène dans une salle du QG.', W / 2, 1060, { size: 30, weight: 500, color: C.dim, align: 'center' });
      ctx.restore();
    }
    if (t > 21.6 && t < 34.4) stepChip(ctx, 2, 'REGARDE-LE BOSSER', 40, 40, prog(t, 21.6, 22.0) * (1 - prog(t, 34.0, 34.4)), 4);
    for (const rc of ROOM_CAPS) roomCaption(ctx, t, rc);
    statsOverlay(ctx, t);
  }

  // ---------- S6a: integrated terminal ----------
  function s6a(ctx, t) {
    bgGrid(ctx);
    stepChip(ctx, 3, 'TERMINAL INTÉGRÉ', 100, 70, prog(t, 41.5, 41.9));
    const p = ease.out(prog(t, 41.6, 42.1));
    const tx = 100, ty = 200 + (1 - p) * 40, tw = 900, th = 680;
    ctx.save(); ctx.globalAlpha = clamp(p * 1.5);
    windowFrame(ctx, tx, ty, tw, th, 'Terminal 1', { body: '#0c0d18', mono: false });
    const L = (str, i, col = '#d6dbff', size = 28) => text(ctx, str, tx + 30, ty + 110 + i * 46, { size, weight: 400, mono: true, color: col });
    L('C:\\Projets\\mon-site>', 0);
    ctx.font = `400 28px ${MONO}`;
    const pw = ctx.measureText('C:\\Projets\\mon-site>').width;
    const cmd = 'claude'.slice(0, Math.floor(prog(t, 42.2, 42.75) * 6));
    text(ctx, cmd, tx + 30 + pw, ty + 110, { size: 28, weight: 700, mono: true, color: C.lamp });
    if (t < 43.0 && Math.floor(t * 3) % 2) { ctx.fillStyle = '#d6dbff'; ctx.fillRect(tx + 32 + pw + ctx.measureText(cmd).width, ty + 88, 14, 28); }
    if (t > 43.2) L('↳ Session détectée par le QG', 1.2, C.cyan);
    if (t > 43.6) L('● KIWI a rejoint le bureau', 2.2, '#58f08a');
    if (t > 44.1) L('  Il apparaît à l’entrée avec sa couleur,', 3.4, C.mute, 25);
    if (t > 44.3) L('  et le HUD suit ses tokens et son coût.', 4.1, C.mute, 25);
    ctx.restore();
    // mini office
    const op = ease.out(prog(t, 41.8, 42.3));
    const ox = 1060, oy = 200 + (1 - op) * 40, ow = 760, oh = 680;
    ctx.save(); ctx.globalAlpha = clamp(op * 1.5);
    windowFrame(ctx, ox, oy, ow, oh, 'Bureau', { icon: true });
    O.draw(ctx, t, { cx: 206, cy: 176, zoom: 5, ax: ox + ow / 2, ay: oy + 48 + (oh - 48) / 2 }, MAIN_AGENTS, { clip: [ox + 2, oy + 48, ow - 4, oh - 50], labelScale: 2, only: [KIWI.id] });
    ctx.restore();
    caption(ctx, 'Tape claude dans le terminal intégré : la session apparaît au bureau.', 990, prog(t, 42.2, 42.7));
  }

  // ---------- S6b: GitHub skills library ----------
  function s6b(ctx, t) {
    bgGrid(ctx);
    stepChip(ctx, 4, 'BIBLIOTHÈQUE DE SKILLS', 100, 70, prog(t, 46.5, 46.9));
    const p = ease.out(prog(t, 46.5, 47.0));
    const x0 = 160, y0 = 200 + (1 - p) * 40, w0 = 1600, h0 = 700;
    ctx.save(); ctx.globalAlpha = clamp(p * 1.5);
    box(ctx, x0, y0, w0, h0, { r: 14, fill: C.panel, stroke: C.line2, lw: 2 });
    label(ctx, 'LIEN GITHUB', x0 + 40, y0 + 60);
    const url = 'github.com/exemple/skills-pro';
    const typed = url.slice(0, Math.floor(prog(t, 47.0, 48.0) * url.length));
    field(ctx, x0 + 40, y0 + 76, 1230, 70, { focus: t < 48.3 });
    text(ctx, typed || 'Colle le lien d’un dépôt public…', x0 + 64, y0 + 122, { size: 28, weight: 500, mono: !!typed, color: typed ? C.ink : C.mute });
    const press = t >= 48.15 && t < 48.35;
    box(ctx, x0 + 1290, y0 + 76 + (press ? 3 : 0), 270, 70, { r: 10, fill: press ? C.lampD : C.lamp });
    text(ctx, 'Lier le dépôt', x0 + 1425, y0 + 122 + (press ? 3 : 0), { size: 28, weight: 700, color: '#1a1206', align: 'center' });
    // safety line with a tiny pixel shield
    const sx = x0 + 40, sy = y0 + 176;
    ctx.fillStyle = C.lamp; ctx.fillRect(sx, sy, 16, 12); ctx.fillRect(sx + 2, sy + 12, 12, 4); ctx.fillRect(sx + 5, sy + 16, 6, 3);
    text(ctx, 'Seuls les skills et les agents sont chargés : jamais de hooks ni de serveurs MCP.', sx + 28, sy + 17, { size: 23, weight: 500, color: C.dim });
    // repo cards
    const card = (x, y, w, name, chip, chipC, info, pBar) => {
      box(ctx, x, y, w, 210, { r: 12, fill: C.panel2, stroke: C.line, lw: 2 });
      ctx.fillStyle = chipC; ctx.fillRect(x, y + 14, 6, 182);
      text(ctx, name, x + 32, y + 56, { size: 28, weight: 700, mono: true });
      pill(ctx, chip, x + w - PF.measure(chip) * 3 - 50, y + 26, chipC, 3);
      text(ctx, info, x + 32, y + 110, { size: 26, weight: 500, color: C.dim });
      if (pBar != null) {
        box(ctx, x + 32, y + 140, w - 64, 16, { r: 8, fill: '#0b0d1a' });
        box(ctx, x + 32, y + 140, Math.max(16, (w - 64) * pBar), 16, { r: 8, fill: C.cyan });
      } else {
        box(ctx, x + 32, y + 138, 64, 34, { r: 17, fill: '#2f7d48' }); ctx.fillStyle = '#dfffe6'; ctx.beginPath(); ctx.arc(x + 79, y + 155, 12, 0, 7); ctx.fill();
        text(ctx, 'Actif', x + 110, y + 164, { size: 24, weight: 600, color: C.dim });
      }
    };
    card(x0 + 40, y0 + 240, 740, 'exemple/agents-team', 'PRÊT', '#58f08a', '48 agents · chargés dans tes agents', null);
    const cp = prog(t, 48.35, 48.75);
    if (cp > 0) {
      ctx.save(); ctx.globalAlpha = clamp(cp * 2); ctx.translate(0, (1 - ease.out(cp)) * 40);
      const clone = prog(t, 48.5, 49.7);
      if (clone < 1) card(x0 + 820, y0 + 240, 740, 'exemple/skills-pro', 'CLONAGE…', C.cyan, 'Récupération du dépôt…', ease.inOut(clone));
      else card(x0 + 820, y0 + 240, 740, 'exemple/skills-pro', 'PRÊT', '#58f08a', '20 skills · prêts à servir', null);
      ctx.restore();
      const sp = prog(t, 49.7, 50.3);
      if (sp > 0 && sp < 1) for (let i = 0; i < 12; i++) {
        const th = (i / 12) * Math.PI * 2, r = 40 + ease.out(sp) * 120;
        ctx.globalAlpha = 1 - sp; ctx.fillStyle = i % 2 ? '#58f08a' : C.lamp;
        ctx.fillRect(Math.round(x0 + 1440 + Math.cos(th) * r), Math.round(y0 + 266 + Math.sin(th) * r * 0.6), 8, 8);
      }
      ctx.globalAlpha = 1;
    }
    const fp = prog(t, 50.0, 50.4);
    if (fp > 0) {
      ctx.globalAlpha = fp;
      ptext(ctx, '→ CHARGÉS DANS TES PROCHAINS AGENTS', x0 + 40, y0 + 520, 5, C.lamp);
      for (let i = 0; i < 6; i++) {
        const bt = t - 50.0 - i * 0.12;
        if (bt < 0) continue;
        drawBot(ctx, x0 + 120 + i * 120, y0 + 662 - Math.max(0, Math.sin(bt * 7)) * 12 * (bt < 1.4 ? 1 : 0), 5, { color: Object.values(AGENT)[i], smile: true });
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    caption(ctx, 'Clone des dépôts GitHub publics de skills et d’agents : tes agents s’en servent.', 990, prog(t, 46.9, 47.4));
  }

  // ---------- S7: the real software ----------
  function s7(ctx, t) {
    sky(ctx, t, { starAlpha: 0.6 });
    const p = ease.out(prog(t, 51.8, 52.4));
    ptext(ctx, 'LE VRAI LOGICIEL.', W / 2, 42, 6, C.ink, { align: 'center', chars: Math.floor(prog(t, 51.9, 52.6) * 17) });
    const fx = 200, fy = 116 + (1 - p) * 40, fw = 1520, fh = 870;
    windowFrame(ctx, fx, fy, fw, fh, 'PixelQG', { icon: true });
    const img = IMG.appFull;
    if (img) {
      const vx = fx + 2, vy = fy + 48, vw = fw - 4, vh = fh - 50;
      ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
      const k = ease.inOut(prog(t, 52.0, 57.6));
      const fit = Math.max(vw / img.width, vh / img.height);
      const sc = lerp(fit, fit * 1.18, k);
      const fxp = lerp(img.width / 2, 1080, k), fyp = lerp(img.height / 2, 430, k);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, vx + vw / 2 - fxp * sc, vy + vh / 2 - fyp * sc, img.width * sc, img.height * sc);
      ctx.restore();
    }
    caption(ctx, 'Une app Windows qui tourne en local, sur ton PC.', 1046, prog(t, 52.4, 52.9), 30);
  }

  // ---------- S8: call to action ----------
  function s8(ctx, t) {
    sky(ctx, t);
    skyline(ctx, t, H - 300, 4);
    ctx.fillStyle = 'rgba(6,7,15,0.35)'; ctx.fillRect(0, 0, W, H);
    // static title (already introduced) slides in
    const tp = ease.out(prog(t, 57.6, 58.1));
    ctx.save(); ctx.globalAlpha = tp; ctx.translate(0, (1 - tp) * -40);
    const s = 16, tw = PF.measure('PIXELQG') * s, tx = W / 2 - tw / 2;
    PF.draw(ctx, 'PIXEL', tx + 8, 128, s, '#05060c'); PF.draw(ctx, 'PIXEL', tx, 120, s, C.ink);
    const qx = tx + PF.measure('PIXEL') * s + s;
    PF.draw(ctx, 'QG', qx + 8, 128, s, '#05060c'); PF.draw(ctx, 'QG', qx, 120, s, C.lamp);
    ctx.restore();
    // price sticker
    const pp = prog(t, 58.2, 58.75);
    if (pp > 0) {
      const k = ease.back(pp);
      ctx.save(); ctx.translate(W / 2, 450); ctx.scale(k, k);
      const pw = 600, ph = 250;
      plate(ctx, -pw / 2 + 12, -ph / 2 + 12, pw, ph, '#05060c', null, 10);
      plate(ctx, -pw / 2, -ph / 2, pw, ph, C.lamp, '#fff1c2', 10);
      PF.draw(ctx, '10 €', 0 + 6, -77 + 6, 22, C.lampD, { align: 'center' });
      PF.draw(ctx, '10 €', 0, -77, 22, '#1a1206', { align: 'center' });
      ctx.restore();
    }
    const lp = prog(t, 58.8, 59.3);
    if (lp > 0) {
      ctx.save(); ctx.globalAlpha = lp;
      ptext(ctx, 'PAIEMENT UNIQUE · PAS D’ABONNEMENT', W / 2, 628, 5, C.ink, { align: 'center' });
      text(ctx, 'Windows 10/11  ·  Compatible avec Claude Code', W / 2, 740, { size: 34, weight: 600, color: C.cyan, align: 'center' });
      ctx.restore();
    }
    // marching bots
    const cols = ['#4aa3ff', '#6fd36a', '#b07cff', '#ffc84a', '#ff6fae', '#3fd4c4', '#ff9a4a', '#c6e65a'];
    const mp = prog(t, 59.2, 59.6);
    if (mp > 0) {
      ctx.globalAlpha = mp;
      for (let i = 0; i < 8; i++) {
        const span = W + 400;
        const x = ((t - 59.2) * 150 + i * (span / 8)) % span - 200;
        const step = Math.floor((t * 150 + i * 37) / 18) % 2;
        drawBot(ctx, Math.round(x), 975 - step * 5, 5, { color: cols[i], frame: 1 + step, look: 1, bob: 0 });
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(6,7,15,0.88)'; ctx.fillRect(0, 1012, W, 68);
    caption(ctx, 'PixelQG n’est pas affilié à Anthropic. Claude et Claude Code sont des marques d’Anthropic.', 1050, prog(t, 59.4, 59.9), 21, C.mute);
  }

  // ---------- timeline ----------
  const SCENES = [
    { id: 's1', a: 0, b: 7.6, draw: s1 }, { id: 's2', a: 7.0, b: 12.2, draw: s2 }, { id: 's3', a: 11.6, b: 17.6, draw: s3 },
    { id: 's4', a: 17.0, b: 41.8, draw: s4 }, { id: 's6a', a: 41.2, b: 46.8, draw: s6a }, { id: 's6b', a: 46.2, b: 52.0, draw: s6b },
    { id: 's7', a: 51.4, b: 57.8, draw: s7 }, { id: 's8', a: 57.2, b: DURATION + 1, draw: s8 },
  ];
  const TRANS = [
    { from: 's1', to: 's2', a: 7.0, b: 7.6, type: 'mosaic' }, { from: 's2', to: 's3', a: 11.6, b: 12.2, type: 'wipe' },
    { from: 's3', to: 's4', a: 17.0, b: 17.6, type: 'wipe' }, { from: 's4', to: 's6a', a: 41.2, b: 41.8, type: 'wipe' },
    { from: 's6a', to: 's6b', a: 46.2, b: 46.8, type: 'wipe' }, { from: 's6b', to: 's7', a: 51.4, b: 52.0, type: 'wipe' },
    { from: 's7', to: 's8', a: 57.2, b: 57.8, type: 'mosaic' },
  ];
  const sceneById = (id) => SCENES.find((s) => s.id === id);

  function renderMain(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    const tr = TRANS.find((x) => t >= x.a && t < x.b);
    if (tr) {
      const A = buffer('A'), B = buffer('B');
      sceneById(tr.from).draw(A.ctx, t); sceneById(tr.to).draw(B.ctx, t);
      const p = prog(t, tr.a, tr.b);
      if (tr.type === 'wipe') pixelWipe(ctx, A.canvas, B.canvas, ease.inOut(p) * 1.02);
      else {
        const half = p < 0.5;
        const k = half ? p * 2 : (1 - p) * 2;
        mosaic(ctx, half ? A.canvas : B.canvas, 1 + Math.round(ease.in(k) * 40));
        ctx.fillStyle = `rgba(0,0,0,${k * 0.9})`; ctx.fillRect(0, 0, W, H);
      }
      return;
    }
    const sc = SCENES.find((s) => t >= s.a && t < s.b) || SCENES[SCENES.length - 1];
    sc.draw(ctx, t);
  }

  // ---------- hero loop (8 s, seamless) ----------
  function loopAgent(def) {
    const { A: pA, B: pB, to, back, phase, ta, tb, doneB } = def;
    const legs = [], says = [];
    for (let k = 0; k < 3; k++) {
      const t0 = phase + k * LOOP_DURATION;
      legs.push({ at: t0, path: to, speed: 92 });
      legs.push({ at: t0 + 4, path: back, speed: 92 });
      says.push([t0 - 4 + 1.9, ta]); says.push([t0 + 1.9, tb, doneB ? 'done' : undefined]);
    }
    return A({ name: def.name, color: def.color, spawn: -99, start: pA, legs, says });
  }
  const rev = (pts, end) => pts.slice(0, -1).reverse().concat([end]);
  const LOOP_AGENTS = [
    A({ name: 'ATLAS', color: 'lime', spawn: -99, start: D(1, 1), says: [[-99, '…']] }),
    A({ name: 'VEGA', color: 'orange', spawn: -99, start: S.cafeTable, says: [[-99, 'PAUSE CAFÉ', 'done']] }),
    (() => { const to = [[LL, 50], [LL, 74], O.DOOR.lib[0], S.lib]; return loopAgent({ name: 'NOVA', color: 'blue', A: D(0, 0), B: S.lib, to, back: rev(to, D(0, 0)), phase: 0.3, ta: '…', tb: 'LIT SERVER.JS' }); })(),
    (() => { const to = [[LR, 50], [LR, 52], O.DOOR.srv[0], S.srv]; return loopAgent({ name: 'PIXEL', color: 'green', A: D(2, 0), B: S.srv, to, back: rev(to, D(2, 0)), phase: 1.4, ta: '…', tb: 'NPM TEST' }); })(),
    (() => { const to = [[LR, 94], [LR, 132], O.DOOR.web[0], S.web]; return loopAgent({ name: 'ORION', color: 'purple', A: D(2, 1), B: S.web, to, back: rev(to, D(2, 1)), phase: 2.5, ta: '…', tb: 'CHERCHE SUR LE WEB' }); })(),
    (() => { const to = [[LL, 94], [LL, 204], O.DOOR.meet[0], S.meetE]; return loopAgent({ name: 'LUNA', color: 'pink', A: D(0, 1), B: S.meetE, to, back: rev(to, D(0, 1)), phase: 3.6, ta: '…', tb: 'DÉLÈGUE' }); })(),
    (() => { const to = [[LR, 138], [LR, 212], O.DOOR.cafe[0], [330, 222], S.cafe2]; return loopAgent({ name: 'ZÉPHYR', color: 'teal', A: D(2, 2), B: S.cafe2, to, back: rev(to, D(2, 2)), phase: 4.7, ta: '…', tb: 'TERMINÉ ✓', doneB: true }); })(),
    (() => { const to = [[LL, 138], [LL, 74], O.DOOR.lib[0], S.lib2]; return loopAgent({ name: 'MOCHI', color: 'yellow', A: D(0, 2), B: S.lib2, to, back: rev(to, D(0, 2)), phase: 5.8, ta: '…', tb: 'LIT LA DOC' }); })(),
  ];
  function renderLoop(ctx, t) {
    const tt = LOOP_DURATION + (t % LOOP_DURATION);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0e1f'; ctx.fillRect(0, 0, 1200, 750);
    O.draw(ctx, tt, { cx: 200, cy: 125, zoom: 3, ax: 600, ay: 375 }, LOOP_AGENTS, { labelScale: 2 });
  }

  root.Story = {
    DURATION, LOOP_DURATION, loadImages, renderMain, renderLoop,
    // shared with social.js (vertical clips)
    ui: { stepChip, windowFrame, cursor, pill, field, label, wrap }, LOG, LOOP_AGENTS,
  };
})(window);
