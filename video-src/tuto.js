/* PixelQG installation tutorial (1920x1080, 63 s, music only). renderTuto(ctx, t) draws the frame at t, deterministically.
 *
 * Real pictures wherever possible:
 *   - step 1: the site, captured headless (tuto/capture-site.js → tuto/shots/site.png);
 *   - step 3: the installer window, from its /preview mode when tuto/shots/setup-start.png and setup-fin.png
 *     exist; otherwise redrawn from launcher/PixelQG-Setup.cs (same layout and texts) and labelled « illustration »;
 *   - step 5: the app with a fake profile (tuto/capture-app.mjs → tuto/shots/app-shots.js + frames) when present;
 *     otherwise the app's own README captures (tuto/assets/app-bureau.png, app-fiche.png).
 * The SmartScreen warning and the desktop cannot be captured: they are recreations, labelled « illustration ».
 */
(function (root) {
  const { W, H, C, clamp, lerp, prog, ease, drawBot, box, plate, text, ptext, buffer, pixelWipe, mosaic, sky, skyline, alpha, MONO } = root.Q;
  const PF = root.PixelFont;
  const { stepChip, cursor, windowFrame, wrap } = root.Story.ui;
  const DURATION = 63;
  const SITE = root.TUTO_SITE || { nav: { x: 1348, y: 12, w: 186, h: 40 } };
  const APP = root.TUTO_APP || null;
  const INSTALLER = 'PixelQG-Setup-1.0.0.exe';

  // ---------- assets ----------
  const IMG = {};
  const load = (k, src, optional) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => { IMG[k] = i; res(); };
    i.onerror = () => (optional ? res() : rej(new Error('image ' + src)));
    i.src = src;
  });
  function loadImages() {
    const jobs = [
      load('site', 'tuto/shots/site.png'), load('icon', 'tuto/assets/pixelqg-icon.png'),
      load('bureau', 'tuto/assets/app-bureau.png'), load('fiche', 'tuto/assets/app-fiche.png'),
      load('setupStart', 'tuto/shots/setup-start.png', true), load('setupFin', 'tuto/shots/setup-fin.png', true),
    ];
    if (APP) {
      jobs.push(load('appEmpty', 'tuto/shots/app-empty.png'), load('appFormEmpty', 'tuto/shots/app-form-empty.png'));
      for (let i = 0; i < APP.typeSteps; i++) jobs.push(load('type' + i, `tuto/shots/type/${String(i).padStart(3, '0')}.jpg`));
      for (let i = 0; i < APP.nameSteps; i++) jobs.push(load('name' + i, `tuto/shots/type/n${i}.jpg`));
      APP.walk.forEach((f, i) => jobs.push(load('walk' + i, 'tuto/shots/walk/' + f.file)));
    }
    return Promise.all(jobs);
  }

  // ---------- shared pieces ----------
  function bg(ctx) {
    ctx.fillStyle = '#0a0c19'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#151933';
    for (let y = 20; y < H; y += 40) for (let x = 20; x < W; x += 40) ctx.fillRect(x, y, 4, 4);
  }
  // Caption on a dark plate, above the taskbar of the desktop scenes.
  function say(ctx, str, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(a);
    ctx.font = `600 34px ${root.Q.FONT}`;
    const w = ctx.measureText(str).width;
    box(ctx, W / 2 - w / 2 - 30, 944, w + 60, 62, { r: 10, fill: 'rgba(6,7,15,0.86)', stroke: C.line2, lw: 2 });
    text(ctx, str, W / 2, 986, { size: 34, weight: 600, color: C.ink, align: 'center' });
    ctx.restore();
  }
  // Two captions in a row: the first until `t2`, then the second.
  function says(ctx, t, a1, s1, t2, s2, end = 1e9) {
    if (t < t2) say(ctx, s1, prog(t, a1, a1 + 0.35) * (1 - prog(t, t2 - 0.25, t2)));
    else say(ctx, s2, prog(t, t2, t2 + 0.35) * (1 - prog(t, end - 0.3, end)));
  }
  function chip(ctx, t, n, label, t0) { stepChip(ctx, n, label, 60, 30, prog(t, t0, t0 + 0.6), 6); }
  // Cursor along keyframes [t, x, y] (eased between keys).
  function path(keys, t) {
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) {
      const [ta, xa, ya] = keys[i - 1], [tb, xb, yb] = keys[i];
      if (t <= tb) { const k = ease.inOut(prog(t, ta, tb)); return [lerp(xa, xb, k), lerp(ya, yb, k)]; }
    }
    const l = keys[keys.length - 1];
    return [l[1], l[2]];
  }
  function ring(ctx, x, y, t, tc) {
    const p = prog(t, tc, tc + 0.5);
    if (p <= 0 || p >= 1) return;
    const r = Math.round(8 + 38 * ease.out(p));
    ctx.save(); ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = C.lamp; ctx.lineWidth = 5;
    ctx.strokeRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
    ctx.restore();
  }
  function pointer(ctx, t, keys, clicks = [], show = [0, 1e9]) {
    const a = prog(t, show[0], show[0] + 0.3) * (1 - prog(t, show[1] - 0.3, show[1]));
    if (a <= 0) return;
    const [x, y] = path(keys, t);
    for (const tc of clicks) ring(ctx, x, y, t, tc);
    ctx.save(); ctx.globalAlpha = a;
    const pressed = clicks.some((tc) => t >= tc && t < tc + 0.12);
    cursor(ctx, x + (pressed ? 1 : 0), y + (pressed ? 2 : 0), 3);
    ctx.restore();
  }
  function tag(ctx, str, x, y, align = 'right') {
    text(ctx, str, x, y, { size: 20, weight: 600, color: 'rgba(255,255,255,0.55)', align });
  }
  // Image into a viewport, scale `sc` around image point (fx, fy), clamped so the viewport stays covered.
  function view(ctx, img, v, fx, fy, sc) {
    const iw = img.width * sc, ih = img.height * sc;
    let ox = v.x + v.w / 2 - fx * sc, oy = v.y + v.h / 2 - fy * sc;
    ox = clamp(ox, v.x + v.w - iw, v.x); oy = clamp(oy, v.y + v.h - ih, v.y);
    ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, ox, oy, iw, ih);
    ctx.restore();
    return (ix, iy) => [ox + ix * sc, oy + iy * sc];
  }

  // ---------- neutral desktop (illustration) ----------
  function desktop(ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1b2346'); g.addColorStop(1, '#0d1024');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, c] of [[1350, 380, 760, 'rgba(78,110,210,0.32)'], [420, 860, 640, 'rgba(120,80,190,0.22)'], [1700, 980, 420, 'rgba(60,170,190,0.16)']]) {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    // taskbar: generic tiles only (no real product icons)
    ctx.fillStyle = 'rgba(16,18,34,0.94)'; ctx.fillRect(0, H - 56, W, 56);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, H - 56, W, 1);
    const tiles = ['#5b8def', '#e9b44c', '#7a8199', '#4fc1b9'];
    const n = tiles.length + (o.running ? 1 : 0);
    let tx = W / 2 - (n * 48) / 2;
    for (const c of tiles) { box(ctx, tx + 8, H - 46, 32, 32, { r: 6, fill: alpha(c, 0.85) }); tx += 48; }
    if (o.running && IMG.icon) {
      box(ctx, tx + 4, H - 50, 40, 40, { r: 6, fill: 'rgba(255,255,255,0.08)' });
      ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.icon, tx + 8, H - 46, 32, 32);
      ctx.fillStyle = '#7fb4ff'; ctx.fillRect(tx + 18, H - 6, 12, 3);
    }
    text(ctx, '10:24', W - 40, H - 32, { size: 16, weight: 500, color: '#e6e8f4', align: 'right' });
    text(ctx, '20/10/2026', W - 40, H - 12, { size: 14, weight: 500, color: '#c3c7da', align: 'right' });
    if (o.icon) desktopIcon(ctx, t, o.icon);
    if (o.tag !== false) tag(ctx, 'illustration', W - 32, H - 76);
  }
  const ICON = { x: 74, y: 150, size: 96 };
  function desktopIcon(ctx, t, o) {
    const { x, y, size } = ICON;
    if (o.selected) box(ctx, x - 14, y - 10, size + 28, size + 58, { r: 4, fill: 'rgba(110,160,255,0.28)', stroke: 'rgba(150,190,255,0.6)', lw: 2 });
    ctx.imageSmoothingEnabled = false;
    if (IMG.icon) ctx.drawImage(IMG.icon, x, y, size, size);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    text(ctx, 'PixelQG', x + size / 2, y + size + 30, { size: 20, weight: 500, color: '#ffffff', align: 'center' });
    ctx.restore();
  }

  // ---------- scene 0: title ----------
  function s0(ctx, t) {
    sky(ctx, t);
    skyline(ctx, t, H - 300, 4);
    ctx.fillStyle = 'rgba(6,7,15,0.35)'; ctx.fillRect(0, 0, W, H);
    const bp = ease.back(prog(t, 0.2, 0.8));
    if (bp > 0) {
      ctx.save(); ctx.translate(W / 2, 250); ctx.scale(bp, bp);
      drawBot(ctx, -6 * 8, -15 * 8, 8, { color: C.cyan, frame: Math.floor(t * 4) % 2 ? 1 : 2, look: 0, bob: 0, smile: t > 1.4 });
      ctx.restore();
    }
    ptext(ctx, 'INSTALLER', W / 2, 330, 12, C.ink, { align: 'center', chars: Math.floor(prog(t, 0.6, 1.3) * 9) });
    const tp = ease.out(prog(t, 1.3, 1.8));
    if (tp > 0) {
      ctx.save(); ctx.globalAlpha = tp; ctx.translate(0, (1 - tp) * 30);
      const s = 16, tw = PF.measure('PIXELQG') * s, tx = W / 2 - tw / 2;
      PF.draw(ctx, 'PIXEL', tx + 8, 458, s, '#05060c'); PF.draw(ctx, 'PIXEL', tx, 450, s, C.ink);
      const qx = tx + PF.measure('PIXEL') * s + s;
      PF.draw(ctx, 'QG', qx + 8, 458, s, '#05060c'); PF.draw(ctx, 'QG', qx, 450, s, C.lamp);
      ctx.restore();
    }
    const sp = prog(t, 2.0, 2.4);
    if (sp > 0) {
      ctx.save(); ctx.globalAlpha = sp;
      ptext(ctx, 'EN 1 MINUTE · WINDOWS 10/11', W / 2, 640, 6, C.cyan, { align: 'center' });
      ctx.restore();
    }
    say(ctx, 'Du téléchargement à ton premier pix, pas à pas.', prog(t, 2.4, 2.8));
  }

  // ---------- scene 1: download from the site (real capture) ----------
  const FR1 = { x: 210, y: 112, w: 1500, h: 800 };
  const V1 = { x: FR1.x + 2, y: FR1.y + 48, w: FR1.w - 4, h: FR1.h - 50 };
  function s1(ctx, t) {
    bg(ctx);
    windowFrame(ctx, FR1.x, FR1.y, FR1.w, FR1.h, 'pixelqg-site.pages.dev', { icon: true });
    const img = IMG.site;
    const nav = SITE.nav, bx = nav.x + nav.w / 2, by = nav.y + nav.h / 2;
    const fit = V1.w / img.width;
    const z = ease.inOut(prog(t, 5.6, 7.6));
    const map = view(ctx, img, V1, lerp(img.width / 2, bx - 300, z), lerp(V1.h / fit / 2, by + 200, z), lerp(fit, fit * 1.3, z));
    // button pressed
    const [px, py] = map(nav.x, nav.y), [qx, qy] = map(nav.x + nav.w, nav.y + nav.h);
    if (t >= 8.5 && t < 8.75) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(px, py, qx - px, qy - py); }
    const [cx, cy] = map(bx + 10, by + 6);
    pointer(ctx, t, [[4.8, V1.x + V1.w * 0.55, V1.y + V1.h * 0.75], [6.0, V1.x + V1.w * 0.6, V1.y + V1.h * 0.55], [8.2, cx, cy]], [8.5], [4.9, 99]);
    // download card (PixelQG style, not browser UI)
    const dp = prog(t, 8.9, 9.3);
    if (dp > 0) {
      const k = ease.out(dp);
      const w = 640, h = 156, x = V1.x + V1.w - w - 36, y = V1.y + 150 + (1 - k) * -30;
      ctx.save(); ctx.globalAlpha = k;
      plate(ctx, x + 8, y + 8, w, h, '#05060c', null, 6);
      plate(ctx, x, y, w, h, C.panel, C.lamp, 6);
      const done = t >= 11.0;
      const fill = ease.inOut(prog(t, 9.3, 11.0));
      ptext(ctx, done ? 'TÉLÉCHARGÉ ✓' : 'TÉLÉCHARGEMENT…', x + 32, y + 26, 4, done ? C.green : C.lamp);
      text(ctx, INSTALLER, x + 32, y + 98, { size: 30, weight: 600, color: C.ink, mono: true });
      text(ctx, '31,6 Mo', x + w - 32, y + 98, { size: 26, weight: 600, color: C.dim, align: 'right' });
      ctx.fillStyle = C.field; ctx.fillRect(x + 32, y + 118, w - 64, 14);
      ctx.fillStyle = done ? C.green : C.lamp; ctx.fillRect(x + 32, y + 118, Math.round((w - 64) * fill), 14);
      ctx.restore();
    }
    chip(ctx, t, 1, 'TÉLÉCHARGE L’INSTALLEUR', 4.4);
    says(ctx, t, 4.9, 'Sur le site, clique sur « Télécharger », en haut à droite.', 9.4, 'L’installeur arrive directement dans tes téléchargements.');
  }

  // ---------- scene 2: SmartScreen (recreation) ----------
  const SS = { x: 530, y: 170, w: 860, h: 640 };
  const SS_BODY = 'Microsoft Defender SmartScreen a empêché le démarrage d’une application non reconnue. L’exécution de cette application peut présenter un risque pour votre ordinateur.';
  function smartScreen(ctx, t, expanded, hover) {
    const { x, y, w, h } = SS;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#0d5fb2'; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // close
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w - 46, y + 26); ctx.lineTo(x + w - 30, y + 42); ctx.moveTo(x + w - 30, y + 26); ctx.lineTo(x + w - 46, y + 42); ctx.stroke();
    text(ctx, 'Windows a protégé votre ordinateur', x + 56, y + 116, { size: 44, weight: 300, color: '#ffffff' });
    const lines = wrap(ctx, SS_BODY, w - 112, 25, 400);
    lines.forEach((l, i) => text(ctx, l, x + 56, y + 188 + i * 38, { size: 25, weight: 400, color: '#ffffff' }));
    const ly = y + 188 + lines.length * 38 + 30;
    if (!expanded) {
      const lw = text(ctx, 'Informations complémentaires', x + 56, ly, { size: 25, weight: 600, color: '#ffffff' });
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 56, ly + 6, lw, 2);
    } else {
      text(ctx, 'Application :', x + 56, ly, { size: 25, weight: 400, color: '#ffffff' });
      text(ctx, INSTALLER, x + 250, ly, { size: 25, weight: 400, color: '#ffffff' });
      text(ctx, 'Éditeur :', x + 56, ly + 40, { size: 25, weight: 400, color: '#ffffff' });
      text(ctx, 'Éditeur inconnu', x + 250, ly + 40, { size: 25, weight: 400, color: '#ffffff' });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y + h - 104, w, 1);
    const btn = (label, bx, bw, hot) => {
      ctx.fillStyle = hot ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(bx, y + h - 78, bw, 54);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, y + h - 77, bw - 2, 52);
      text(ctx, label, bx + bw / 2, y + h - 42, { size: 24, weight: 500, color: '#ffffff', align: 'center' });
    };
    btn('Ne pas exécuter', x + w - 56 - 240, 240, false);
    if (expanded) btn('Exécuter quand même', x + w - 56 - 240 - 24 - 290, 290, hover);
    tag(ctx, 'illustration', x + 18, y + h - 12, 'left');
  }
  function s2(ctx, t) {
    desktop(ctx, t, { icon: null, tag: false });
    const a = prog(t, 13.0, 13.4) * (1 - prog(t, 20.9, 21.3));
    const expanded = t >= 16.75;
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      const k = lerp(0.96, 1, ease.out(prog(t, 13.0, 13.4)));
      ctx.translate(W / 2, SS.y + SS.h / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(SS.y + SS.h / 2));
      smartScreen(ctx, t, expanded, t >= 19.6 && t < 20.9);
      ctx.restore();
    }
    const ly = SS.y + 188 + wrap(ctx, SS_BODY, SS.w - 112, 25, 400).length * 38 + 30;
    const link = [SS.x + 56 + 180, ly - 8], run = [SS.x + SS.w - 56 - 240 - 24 - 145, SS.y + SS.h - 51];
    pointer(ctx, t, [[13.6, 1500, 900], [16.3, link[0], link[1]], [17.4, link[0], link[1]], [19.5, run[0], run[1]]], [16.65, 20.3], [13.6, 21.2]);
    chip(ctx, t, 2, 'LANCE-LE', 12.8);
    says(ctx, t, 13.4, 'Windows peut afficher cet avertissement : l’installeur n’est pas signé.', 16.75,
      'Clique sur « Informations complémentaires », puis « Exécuter quand même ».', 21.6);
  }

  // ---------- scene 3: the installer window ----------
  // Layout of launcher/PixelQG-Setup.cs (client 480x244), drawn at scale S.
  const S = 2, CLIENT = { w: 480, h: 244 }, TITLE_H = 31;
  const WIN = { w: CLIENT.w * S + 2, h: (CLIENT.h + TITLE_H) * S + 2 };
  WIN.x = Math.round((W - WIN.w) / 2); WIN.y = 200;
  const STATUS = {
    start: 'Clique sur « Installer » pour commencer.',
    copy: 'Copie des fichiers…',
    links: 'Création des raccourcis…',
    done: 'PixelQG est installé : son raccourci est sur ton bureau et dans le menu Démarrer.',
  };
  // Client-area point (installer coordinates) → screen.
  const cpt = (x, y) => [WIN.x + 1 + x * S, WIN.y + 1 + (TITLE_H + y) * S];
  function winButton(ctx, x, y, w, h, label, st) {
    ctx.fillStyle = st.disabled ? '#cccccc' : st.hot ? '#e5f1fb' : '#e1e1e1'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = st.disabled ? '#bfbfbf' : st.def || st.hot ? '#0078d7' : '#adadad'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (st.def && !st.disabled) ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    text(ctx, label, x + w / 2, y + h / 2 + 4, { size: 12, weight: 400, color: st.disabled ? '#a0a0a0' : '#000000', align: 'center' });
  }
  function drawnInstaller(ctx, st) {
    ctx.save();
    ctx.translate(WIN.x + 1, WIN.y + 1); ctx.scale(S, S);
    // title bar
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, CLIENT.w, TITLE_H + CLIENT.h);
    ctx.imageSmoothingEnabled = false;
    if (IMG.icon) ctx.drawImage(IMG.icon, 10, 8, 16, 16);
    text(ctx, 'Installer PixelQG', 34, 20, { size: 12, weight: 400, color: '#1a1a1a' });
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(CLIENT.w - 28, 11); ctx.lineTo(CLIENT.w - 18, 21); ctx.moveTo(CLIENT.w - 18, 11); ctx.lineTo(CLIENT.w - 28, 21); ctx.stroke();
    ctx.translate(0, TITLE_H);
    if (IMG.icon) ctx.drawImage(IMG.icon, 20, 18, 48, 48);
    text(ctx, 'Installer PixelQG', 80, 16, { size: 18.67, weight: 700, color: '#000000', baseline: 'top' });
    text(ctx, 'Version 1.0.0 · le bureau en pixel art de tes agents Claude Code', 82, 48, { size: 12, weight: 400, color: '#696969', baseline: 'top' });
    text(ctx, 'Dossier d’installation :', 20, 88, { size: 12, weight: 400, color: '#000000', baseline: 'top' });
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(20, 106, 440, 23);
    ctx.strokeStyle = '#7a7a7a'; ctx.strokeRect(20.5, 106.5, 439, 22);
    text(ctx, 'C:\\Users\\toi\\AppData\\Local\\Programs\\PixelQG', 24, 111, { size: 12, weight: 400, color: '#000000', baseline: 'top' });
    ctx.fillStyle = '#e6e6e6'; ctx.fillRect(20, 142, 440, 16);
    ctx.strokeStyle = '#bcbcbc'; ctx.strokeRect(20.5, 142.5, 439, 15);
    ctx.fillStyle = '#06b025'; ctx.fillRect(21, 143, Math.round(438 * st.progress), 14);
    wrap(ctx, st.status, 440, 12, 400).slice(0, 2).forEach((l, i) => text(ctx, l, 20, 166 + i * 16, { size: 12, weight: 400, color: '#000000', baseline: 'top' }));
    winButton(ctx, 244, 202, 120, 28, st.done ? 'Lancer PixelQG' : 'Installer', { def: true, disabled: st.busy, hot: st.hotMain });
    winButton(ctx, 370, 202, 90, 28, st.done ? 'Fermer' : 'Annuler', { disabled: st.busy, hot: st.hotClose });
    ctx.restore();
  }
  // The real /preview pictures (setup-start.png, setup-fin.png) with the moving parts drawn over them.
  function realInstaller(ctx, st) {
    const a = IMG.setupStart, b = IMG.setupFin;
    const dx = (a.width - CLIENT.w) / 2, dy = a.height - CLIENT.h - dx;
    const x0 = WIN.x + WIN.w / 2 - (a.width * S) / 2, y0 = WIN.y + WIN.h - a.height * S;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(st.done ? b : a, x0, y0, a.width * S, a.height * S);
    if (st.done) return;
    const at = (x, y) => [x0 + (dx + x) * S, y0 + (dy + y) * S];
    if (st.progress > 0) {
      const [px, py] = at(20, 142);
      ctx.drawImage(b, dx + 20, dy + 142, 440 * st.progress, 16, px, py, 440 * st.progress * S, 16 * S);
    }
    if (st.busy) {
      const [sx, sy] = at(20, 164);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 440 * S, 34 * S);
      text(ctx, st.status, sx, sy + 2 * S, { size: 12 * S, weight: 400, color: '#000000', baseline: 'top' });
      for (const [bx, bw] of [[244, 120], [370, 90]]) { const [qx, qy] = at(bx, 202); ctx.fillStyle = 'rgba(235,235,235,0.65)'; ctx.fillRect(qx, qy, bw * S, 28 * S); }
    }
  }
  const REAL_SETUP = () => !!(IMG.setupStart && IMG.setupFin);
  function s3(ctx, t) {
    desktop(ctx, t, { icon: null, tag: REAL_SETUP() });
    const a = prog(t, 21.6, 22.0) * (1 - prog(t, 31.9, 32.3));
    const main = cpt(244 + 60, 202 + 14), close = cpt(370 + 45, 202 + 14);
    const busy = t >= 24.6 && t < 29.0;
    const done = t >= 29.0;
    const st = {
      progress: done ? 1 : ease.inOut(prog(t, 24.7, 28.3)),
      status: done ? STATUS.done : t >= 28.3 ? STATUS.links : busy ? STATUS.copy : STATUS.start,
      busy, done, hotMain: !busy && !done && t >= 23.9, hotClose: done && t >= 30.9,
    };
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      ctx.shadowColor = 'transparent';
      if (REAL_SETUP()) realInstaller(ctx, st); else drawnInstaller(ctx, st);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(WIN.x + 0.5, WIN.y + 0.5, WIN.w - 1, WIN.h - 1);
      if (!REAL_SETUP()) tag(ctx, 'illustration', WIN.x + WIN.w, WIN.y + WIN.h + 30);
      ctx.restore();
    }
    pointer(ctx, t, [[22.2, 1450, 880], [23.9, main[0], main[1]], [29.6, main[0], main[1]], [30.8, close[0], close[1]]], [24.4, 31.5], [22.2, 32.2]);
    chip(ctx, t, 3, 'INSTALLE', 21.5);
    says(ctx, t, 22.2, 'Clique sur « Installer » : pas besoin de droits administrateur.', 29.0,
      'C’est installé, avec un raccourci sur ton bureau et dans le menu Démarrer.', 32.4);
  }

  // ---------- scene 4: the desktop shortcut ----------
  const FR5 = { x: 270, y: 100, w: 1380, h: 830 };
  const V5 = { x: FR5.x + 2, y: FR5.y + 48, w: FR5.w - 4, h: FR5.h - 50 };
  function s4(ctx, t) {
    desktop(ctx, t, { icon: { selected: t >= 35.3 }, running: t >= 36.4 });
    const ic = [ICON.x + ICON.size / 2 + 6, ICON.y + ICON.size / 2 + 8];
    pointer(ctx, t, [[32.6, 900, 640], [35.0, ic[0], ic[1]]], [35.3, 35.55], [32.6, 36.6]);
    chip(ctx, t, 4, 'OUVRE PIXELQG', 32.4);
    say(ctx, 'Double-clique sur le raccourci PixelQG de ton bureau.', prog(t, 32.9, 33.3) * (1 - prog(t, 36.3, 36.6)));
    // the app window grows out of the icon
    const k = ease.out(prog(t, 36.0, 37.0));
    if (k > 0) {
      const b = buffer('tuto-app');
      s5(b.ctx, 37.0, true);
      ctx.save(); ctx.globalAlpha = clamp(k * 1.6);
      ctx.imageSmoothingEnabled = true;
      const x = lerp(ic[0], 0, k), y = lerp(ic[1], 0, k), w = lerp(40, W, k), h = lerp(22, H, k);
      ctx.drawImage(b.canvas, x, y, w, h);
      ctx.restore();
    }
  }

  // ---------- scene 5: the app (real captures) ----------
  function appFrame(ctx) {
    bg(ctx);
    windowFrame(ctx, FR5.x, FR5.y, FR5.w, FR5.h, 'PixelQG', { icon: true });
  }
  const fit5 = (img) => V5.w / img.width;
  function s5Fallback(ctx, t, still) {
    appFrame(ctx);
    const office = IMG.bureau;
    const f = fit5(office);
    const z = ease.inOut(prog(t, 42.4, 44.4));
    if (t < 49.4) {
      const map = view(ctx, office, V5, lerp(office.width / 2, 1000, z), lerp(office.height / 2, 330, z), lerp(f, f * 2.1, z));
      if (!still) {
        const tb = map(1591, 35);
        pointer(ctx, t, [[37.2, V5.x + V5.w * 0.5, V5.y + V5.h * 0.6], [39.4, tb[0] + 6, tb[1] + 6], [41.6, tb[0] + 6, tb[1] + 6]], [39.8], [37.3, 42.0]);
      }
    }
    const fp = prog(t, 49.0, 49.6);
    if (fp > 0) {
      ctx.save(); ctx.globalAlpha = fp;
      const sheet = IMG.fiche, g = fit5(sheet), zz = ease.inOut(prog(t, 49.6, 52.0));
      view(ctx, sheet, V5, lerp(sheet.width / 2, 1500, zz), lerp(sheet.height / 2, 420, zz), lerp(g, g * 1.45, zz));
      ctx.restore();
    }
    if (still) return;
    chip(ctx, t, 5, 'LANCE TON PREMIER PIX', 37.2);
    if (t < 42.4) say(ctx, 'Clique sur « Nouveau pix », écris sa mission, puis « Lancer le pix ».', prog(t, 37.6, 38.0) * (1 - prog(t, 42.1, 42.4)));
    else says(ctx, t, 42.4, 'Ton pix entre dans le QG et file dans la bonne salle.', 49.2, 'Clique sur un pix pour voir sa mission, ses tokens et son coût.', 56.0);
  }
  function s5Real(ctx, t, still) {
    appFrame(ctx);
    const f = fit5(IMG.appEmpty);
    const toV = (ix, iy) => [V5.x + ix * f, V5.y + iy * f];
    const draw = (img) => { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, V5.x, V5.y, img.width * f, img.height * f); };
    const win = APP.window;
    if (t < 40.4) draw(IMG.appEmpty);
    else if (t < 47.4) {
      draw(IMG.appFormEmpty);
      const ti = Math.min(APP.typeSteps - 1, Math.floor(prog(t, 41.0, 44.8) * APP.typeSteps));
      const ni = Math.min(APP.nameSteps - 1, Math.floor(prog(t, 45.2, 45.8) * APP.nameSteps));
      const crop = t >= 45.2 ? IMG['name' + ni] : t >= 41.0 ? IMG['type' + ti] : null;
      if (crop) { const [wx, wy] = toV(win.x, win.y); ctx.drawImage(crop, wx, wy, win.w * f, win.h * f); }
    } else {
      // screencast of the launch: the frame shown at each moment of the real run
      const rt = t - 47.4;
      let i = 0;
      while (i + 1 < APP.walk.length && APP.walk[i + 1].t <= rt) i++;
      draw(IMG['walk' + i]);
    }
    if (still) return;
    const tb = toV(APP.tbAgent.x, APP.tbAgent.y), sb = toV(APP.submit.x, APP.submit.y);
    pointer(ctx, t, [[37.2, V5.x + V5.w * 0.5, V5.y + V5.h * 0.6], [39.6, tb[0], tb[1]], [40.6, tb[0], tb[1]], [41.2, sb[0] - 200, sb[1] - 160], [46.4, sb[0], sb[1]]], [40.0, 47.0], [37.3, 48.2]);
    chip(ctx, t, 5, 'LANCE TON PREMIER PIX', 37.2);
    if (t < 40.4) say(ctx, 'Le bureau est prêt. Clique sur « Nouveau pix ».', prog(t, 37.6, 38.0) * (1 - prog(t, 40.1, 40.4)));
    else says(ctx, t, 40.4, 'Écris sa mission, donne-lui un nom, puis « Lancer le pix ».', 47.4, 'Ton pix entre dans le QG et file dans la bonne salle.', 56.0);
  }
  function s5(ctx, t, still = false) { return APP ? s5Real(ctx, t, still) : s5Fallback(ctx, t, still); }

  // ---------- scene 6: end card ----------
  function s6(ctx, t) {
    sky(ctx, t);
    skyline(ctx, t, H - 300, 4);
    ctx.fillStyle = 'rgba(6,7,15,0.35)'; ctx.fillRect(0, 0, W, H);
    ptext(ctx, 'ET VOILÀ :', W / 2, 170, 10, C.lamp, { align: 'center', chars: Math.floor(prog(t, 56.6, 57.2) * 10) });
    ptext(ctx, 'TES PIX SONT AU BOULOT.', W / 2, 300, 10, C.ink, { align: 'center', chars: Math.floor(prog(t, 57.1, 58.3) * 23) });
    const lp = prog(t, 58.4, 58.9);
    if (lp > 0) {
      ctx.save(); ctx.globalAlpha = lp;
      text(ctx, 'pixelqg-site.pages.dev', W / 2, 520, { size: 56, weight: 700, color: C.cyan, align: 'center' });
      text(ctx, 'github.com/hugobertagna/pixelqg-app', W / 2, 600, { size: 40, weight: 600, color: C.ink, align: 'center' });
      text(ctx, 'Gratuit et open source · licence MIT · Windows 10/11', W / 2, 668, { size: 28, weight: 600, color: C.dim, align: 'center' });
      ctx.restore();
    }
    const cols = ['#4aa3ff', '#6fd36a', '#b07cff', '#ffc84a', '#ff6fae', '#3fd4c4', '#ff9a4a', '#c6e65a'];
    const mp = prog(t, 58.8, 59.2);
    if (mp > 0) {
      ctx.globalAlpha = mp;
      for (let i = 0; i < 8; i++) {
        const span = W + 400;
        const x = ((t - 58.8) * 150 + i * (span / 8)) % span - 200;
        const step = Math.floor((t * 150 + i * 37) / 18) % 2;
        drawBot(ctx, Math.round(x), 975 - step * 5, 5, { color: cols[i], frame: 1 + step, look: 1, bob: 0 });
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(6,7,15,0.88)'; ctx.fillRect(0, 1012, W, 68);
    ctx.save(); ctx.globalAlpha = prog(t, 59.0, 59.5);
    text(ctx, 'PixelQG n’est pas affilié à Anthropic. Claude et Claude Code sont des marques d’Anthropic.', W / 2, 1050, { size: 21, weight: 600, color: C.mute, align: 'center' });
    ctx.restore();
  }

  // ---------- timeline ----------
  const SCENES = [
    { id: 's0', a: 0, b: 4.4, draw: s0 }, { id: 's1', a: 3.8, b: 12.8, draw: s1 }, { id: 's2', a: 12.2, b: 21.6, draw: s2 },
    { id: 's3', a: 21.6, b: 32.4, draw: s3 }, { id: 's4', a: 32.4, b: 37.0, draw: s4 }, { id: 's5', a: 37.0, b: 56.6, draw: (c, t) => s5(c, t) },
    { id: 's6', a: 56.0, b: DURATION + 1, draw: s6 },
  ];
  const TRANS = [
    { from: 's0', to: 's1', a: 3.8, b: 4.4, type: 'mosaic' }, { from: 's1', to: 's2', a: 12.2, b: 12.8, type: 'wipe' },
    { from: 's5', to: 's6', a: 56.0, b: 56.6, type: 'mosaic' },
  ];
  const byId = (id) => SCENES.find((s) => s.id === id);
  function renderTuto(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    const tr = TRANS.find((x) => t >= x.a && t < x.b);
    if (tr) {
      const A = buffer('A'), B = buffer('B');
      byId(tr.from).draw(A.ctx, t); byId(tr.to).draw(B.ctx, t);
      const p = prog(t, tr.a, tr.b);
      if (tr.type === 'wipe') pixelWipe(ctx, A.canvas, B.canvas, ease.inOut(p) * 1.02);
      else {
        const half = p < 0.5, k = half ? p * 2 : (1 - p) * 2;
        mosaic(ctx, half ? A.canvas : B.canvas, 1 + Math.round(ease.in(k) * 40));
        ctx.fillStyle = `rgba(0,0,0,${k * 0.9})`; ctx.fillRect(0, 0, W, H);
      }
      return;
    }
    (SCENES.find((s) => t >= s.a && t < s.b) || SCENES[SCENES.length - 1]).draw(ctx, t);
  }

  root.Tuto = { DURATION, POSTER_AT: 2.4, loadImages, render: renderTuto, realApp: !!APP, realSetup: REAL_SETUP };
})(window);
