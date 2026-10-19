/* The PixelQG office: a 400x250 world-pixel map drawn once, animated props, agents and camera. */
(function (root) {
  const { C, AGENT, hash, rng, clamp, lerp, prog, ease, shade, mix, alpha, drawBot } = root.Q;
  const PF = root.PixelFont;
  const WW = 400, WH = 250, WALL = 12;

  const ROOMS = {
    lib: { x: 6, y: 6, w: 124, h: 112, name: 'BIBLIOTHÈQUE', sign: C.green },
    meet: { x: 6, y: 124, w: 124, h: 120, name: 'SALLE DE RÉUNION', sign: C.violet },
    open: { x: 136, y: 6, w: 128, h: 238, name: 'OPEN SPACE', sign: '#ff9a4a' },
    srv: { x: 270, y: 6, w: 124, h: 76, name: 'SALLE SERVEURS', sign: C.cyan },
    web: { x: 270, y: 88, w: 124, h: 72, name: 'LABO WEB', sign: '#4aa3ff' },
    cafe: { x: 270, y: 166, w: 124, h: 78, name: 'CAFÉTÉRIA', sign: C.lamp },
  };
  const DESK_X = [162, 200, 238], DESK_Y = [30, 74, 118];
  const desk = (c, r) => [DESK_X[c], DESK_Y[r] + 20];
  const SPOT = {
    entrance: [200, 238], lib: [68, 86], lib2: [100, 100], meetW: [26, 196], meetE: [110, 196],
    srv: [332, 64], web: [314, 148], cafe1: [358, 222], cafe2: [380, 222], cafeTable: [304, 226],
  };
  // Door waypoints: [inside side room, inside open space]
  const DOOR = {
    lib: [[118, 74], [144, 74]], meet: [[118, 204], [144, 204]],
    srv: [[282, 52], [256, 52]], web: [[282, 132], [256, 132]], cafe: [[282, 212], [256, 212]],
  };
  const LANE_L = 144, LANE_R = 256, HALL = 214;

  // ---------- static background ----------
  let bgCanvas = null;
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  function floor(c, r, kind) {
    const fx = r.x, fy = r.y + WALL, fw = r.w, fh = r.h - WALL;
    const R = rng(fx * 31 + fy);
    if (kind === 'carpet') {
      px(c, fx, fy, fw, fh, '#2b674c');
      for (let y = fy; y < fy + fh; y += 4) for (let x = fx + ((y / 4) % 2) * 2; x < fx + fw; x += 4) px(c, x, y, 2, 2, '#296148');
    } else if (kind === 'slate') {
      px(c, fx, fy, fw, fh, '#383d66');
      for (let y = fy + 2; y < fy + fh; y += 5) for (let x = fx + 2; x < fx + fw; x += 5) px(c, x, y, 1, 1, '#434a7a');
    } else if (kind === 'wood') {
      for (let y = fy; y < fy + fh; y += 4) {
        let x = fx - Math.floor(R() * 14);
        while (x < fx + fw) {
          const len = 12 + Math.floor(R() * 14);
          const col = ['#8a5a3a', '#83543a', '#91603e', '#7d5136'][Math.floor(R() * 4)];
          px(c, Math.max(x, fx), y, Math.min(len, fx + fw - Math.max(x, fx)), 4, col);
          if (x + len < fx + fw) px(c, x + len - 1, y, 1, 4, '#5f3c26');
          x += len;
        }
        px(c, fx, y + 3, fw, 1, '#6a4329');
      }
    } else if (kind === 'metal') {
      px(c, fx, fy, fw, fh, '#3a4257');
      for (let y = fy; y < fy + fh; y += 10) px(c, fx, y, fw, 1, '#2e3547');
      for (let x = fx; x < fx + fw; x += 10) px(c, x, fy, 1, fh, '#2e3547');
      for (let y = fy + 1; y < fy + fh; y += 10) px(c, fx, y, fw, 1, '#454e66');
    } else if (kind === 'grid') {
      px(c, fx, fy, fw, fh, '#111a44');
      for (let y = fy; y < fy + fh; y += 8) px(c, fx, y, fw, 1, '#1b2a63');
      for (let x = fx; x < fx + fw; x += 8) px(c, x, fy, 1, fh, '#1b2a63');
    } else if (kind === 'checker') {
      for (let y = fy; y < fy + fh; y += 8) for (let x = fx; x < fx + fw; x += 8) px(c, x, y, Math.min(8, fx + fw - x), Math.min(8, fy + fh - y), ((x - fx) / 8 + (y - fy) / 8) % 2 ? '#c4a97f' : '#d8c29a');
    }
  }
  function wall(c, r, col) {
    px(c, r.x, r.y, r.w, WALL, col);
    px(c, r.x, r.y, r.w, 1, shade(col, 1.3));
    px(c, r.x, r.y + WALL - 2, r.w, 2, shade(col, 0.6));
  }
  function sign(c, r, cx) {
    const w = PF.measure(r.name) + 6, x = Math.round(cx - w / 2), y = r.y + 1;
    px(c, x, y, w, 11, '#0f1120'); px(c, x, y, w, 1, r.sign); px(c, x, y + 10, w, 1, r.sign); px(c, x, y, 1, 11, r.sign); px(c, x + w - 1, y, 1, 11, r.sign);
    PF.draw(c, r.name, x + 3, y + 3, 1, r.sign);
  }
  function shelf(c, x, y, w, h, seed) {
    const R = rng(seed);
    px(c, x, y, w, h, '#5a3a24'); px(c, x + 1, y + 1, w - 2, h - 2, '#3b2618');
    for (let sy = y + 1; sy < y + h - 1; sy += 5) {
      let bx = x + 1;
      while (bx < x + w - 2) {
        const bw = 1 + Math.floor(R() * 2), bh = 3 + Math.floor(R() * 2);
        px(c, bx, sy + 4 - bh, bw, bh, ['#e85d5d', '#4aa3ff', '#ffc84a', '#6fd36a', '#b07cff', '#ff9a4a', '#3fd4c4', '#e8e2d0'][Math.floor(R() * 8)]);
        bx += bw + (R() < 0.2 ? 1 : 0);
      }
      px(c, x + 1, sy + 4, w - 2, 1, '#6e472c');
    }
  }
  function plant(c, x, y) {
    px(c, x - 2, y - 3, 5, 3, '#b4643a'); px(c, x - 2, y - 3, 5, 1, '#d07a48');
    const L = [[0, -5], [-2, -6], [2, -6], [-1, -8], [1, -8], [0, -10], [-3, -8], [3, -8], [0, -7]];
    for (const [dx, dy] of L) px(c, x + dx, y + dy, 1, 2, dy < -7 ? '#7fd36a' : '#3f9a4a');
  }
  function rug(c, x, y, w, h, base, border, dot) {
    px(c, x, y, w, h, border); px(c, x + 2, y + 2, w - 4, h - 4, base);
    for (let yy = y + 4; yy < y + h - 3; yy += 4) for (let xx = x + 4; xx < x + w - 3; xx += 4) px(c, xx, yy, 1, 1, dot);
    for (let xx = x + 1; xx < x + w - 1; xx += 3) { px(c, xx, y + 1, 1, 1, dot); px(c, xx, y + h - 2, 1, 1, dot); }
  }
  function deskAt(c, cx, top) {
    px(c, cx - 3, top + 11, 7, 6, '#2d3358'); px(c, cx - 3, top + 11, 7, 2, '#3c447a'); // chair
    px(c, cx - 11, top, 22, 8, '#a8743f'); px(c, cx - 11, top, 22, 1, '#c48d52'); px(c, cx - 11, top + 7, 22, 2, '#6d4a2b');
    px(c, cx - 5, top - 5, 10, 7, '#0f111c'); px(c, cx - 1, top + 2, 2, 1, '#0f111c'); // monitor
    px(c, cx - 4, top + 4, 8, 2, '#d4d8e6'); // keyboard
    if ((cx + top) % 3 === 0) { px(c, cx + 7, top - 2, 1, 4, '#3a3a3a'); px(c, cx + 6, top - 3, 3, 1, '#ffd36b'); }
    else { px(c, cx + 6, top + 1, 3, 3, '#e8e2d0'); px(c, cx + 7, top + 2, 1, 1, '#7a4a2a'); }
  }
  function buildBackground() {
    const cv = document.createElement('canvas'); cv.width = WW; cv.height = WH;
    const c = cv.getContext('2d');
    px(c, 0, 0, WW, WH, '#0c0e1f');
    px(c, 2, 2, WW - 4, WH - 4, '#191c35');
    const R = ROOMS;
    // room frames
    for (const r of Object.values(R)) px(c, r.x - 2, r.y - 2, r.w + 4, r.h + 4, '#0b0c18');
    // corridors through the frames
    const corridor = (x, y, w, h) => { px(c, x, y, w, h, '#4b506f'); for (let i = x; i < x + w; i += 4) px(c, i, y, 1, h, '#41465f'); px(c, x, y, w, 1, '#2a2d44'); px(c, x, y + h - 1, w, 1, '#2a2d44'); };
    corridor(128, 67, 10, 14); corridor(128, 197, 10, 14); corridor(262, 45, 10, 14); corridor(262, 125, 10, 14); corridor(262, 205, 10, 14);

    floor(c, R.lib, 'carpet'); floor(c, R.meet, 'slate'); floor(c, R.open, 'wood');
    floor(c, R.srv, 'metal'); floor(c, R.web, 'grid'); floor(c, R.cafe, 'checker');
    // entrance tiles
    for (let y = 206; y < 244; y += 8) for (let x = 136; x < 264; x += 8) { px(c, x, y, 8, 8, ((x + y) / 8) % 2 ? '#c3c6d4' : '#cfd2de'); px(c, x, y, 8, 1, '#b2b5c4'); }
    // walls
    wall(c, R.lib, '#2a2e4a'); wall(c, R.meet, '#2a2e4a'); wall(c, R.open, '#2a2e4a');
    wall(c, R.srv, '#232839'); wall(c, R.web, '#1b2246'); wall(c, R.cafe, '#3a2f3e');

    // --- library
    shelf(c, 9, 7, 22, 10, 1); shelf(c, 106, 7, 22, 10, 2);
    shelf(c, 9, 20, 16, 14, 3); shelf(c, 112, 20, 16, 14, 4);
    rug(c, 36, 54, 64, 40, '#7a4b2c', '#c9944a', '#e3b062');
    px(c, 46, 62, 44, 14, '#6d4a2b'); px(c, 46, 62, 44, 2, '#a8743f'); px(c, 46, 74, 44, 2, '#4f341f');
    px(c, 56, 64, 8, 5, '#e8e2d0'); px(c, 60, 64, 1, 5, '#b9b2a0'); px(c, 72, 65, 6, 2, '#4aa3ff'); px(c, 72, 67, 6, 2, '#ff6b5e'); px(c, 50, 60, 2, 6, '#3a3a3a'); px(c, 49, 59, 4, 2, '#ffd36b');
    px(c, 12, 88, 10, 9, '#a23a3a'); px(c, 12, 88, 10, 3, '#c24b4b'); px(c, 11, 90, 1, 7, '#7e2c2c'); px(c, 22, 90, 1, 7, '#7e2c2c'); // armchair
    px(c, 14, 60, 1, 16, '#3a3a3a'); px(c, 12, 58, 5, 3, '#ffd36b'); // floor lamp
    px(c, 114, 92, 6, 6, '#3f7ad0'); px(c, 115, 93, 2, 2, '#6fd36a'); px(c, 116, 98, 2, 3, '#5a3a24'); // globe
    plant(c, 122, 114); plant(c, 12, 114);
    sign(c, R.lib, 68);

    // --- meeting room
    rug(c, 18, 148, 100, 90, '#2f3460', '#5560a6', '#6b77c2');
    px(c, 38, 176, 60, 22, '#6d4a2b'); px(c, 38, 176, 60, 2, '#a8743f'); px(c, 38, 196, 60, 2, '#4f341f');
    for (const [lx, ly] of [[44, 180], [62, 186], [80, 180]]) { px(c, lx, ly, 9, 6, '#20253f'); px(c, lx + 1, ly + 1, 7, 4, '#3d6fa8'); }
    px(c, 70, 179, 5, 6, '#e8e2d0'); px(c, 54, 188, 5, 6, '#e8e2d0');
    plant(c, 122, 240); plant(c, 12, 240); plant(c, 122, 146);
    sign(c, R.meet, 68);

    // --- open space
    for (const wx of [142, 230]) { px(c, wx, 8, 26, 7, '#0e1638'); for (let i = 0; i < 6; i++) px(c, wx + 2 + i * 4, 9 + (i % 3) * 2, 1, 1, '#cfd8ff'); px(c, wx, 8, 26, 1, '#3a4170'); }
    px(c, 172, 9, 5, 5, '#e8e2d0'); px(c, 174, 10, 1, 2, '#11131f'); px(c, 174, 11, 2, 1, '#11131f'); // clock
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) deskAt(c, DESK_X[col], DESK_Y[r]);
    rug(c, 162, 160, 76, 38, '#7e3446', '#b0546a', '#d0788b');
    plant(c, 141, 30); plant(c, 259, 30); plant(c, 141, 150); plant(c, 259, 150); plant(c, 146, 238); plant(c, 254, 238);
    px(c, 178, 228, 44, 14, '#5a3a24'); px(c, 179, 229, 42, 12, '#3b2618');
    PF.draw(c, 'ENTRÉE', 200 - Math.floor(PF.measure('ENTRÉE') / 2), 232, 1, '#ffc84a');
    px(c, 188, 244, 24, 6, '#6b6f85'); for (let y = 245; y < 250; y += 2) px(c, 188, y, 24, 1, '#55596d');
    sign(c, R.open, 200);

    // --- server room
    const rack = (x, y, w, h) => { px(c, x, y, w, h, '#151927'); px(c, x, y, w, 1, '#3a4260'); px(c, x, y + h - 1, w, 1, '#0b0d16'); for (let yy = y + 2; yy < y + h - 1; yy += 3) px(c, x + 1, yy, w - 2, 1, '#202638'); };
    for (const rx of [276, 290, 360, 374]) rack(rx, 20, 12, 20);
    for (const rx of [280, 294, 356, 370]) rack(rx, 46, 12, 20);
    px(c, 318, 40, 28, 10, '#2e3550'); px(c, 318, 40, 28, 1, '#46507a'); px(c, 324, 33, 16, 8, '#0f111c'); px(c, 325, 34, 14, 6, '#0e3a2c'); // console
    sign(c, R.srv, 332);

    // --- web lab
    px(c, 273, 89, 58, 10, '#0c1330'); px(c, 273, 89, 58, 1, '#2a3a7a');
    const R2 = rng(77);
    const blobs = [[278, 92, 9, 4], [290, 91, 7, 5], [302, 93, 12, 3], [318, 92, 8, 4], [306, 96, 5, 2], [283, 96, 4, 2]];
    for (const [bx, by, bw, bh] of blobs) for (let i = 0; i < bw * bh; i++) if (R2() < 0.8) px(c, bx + (i % bw), by + Math.floor(i / bw), 1, 1, '#2fa36b');
    px(c, 322, 122, 20, 8, '#22305e'); px(c, 322, 122, 20, 1, '#3e5296'); px(c, 326, 130, 12, 4, '#1a2448');
    plant(c, 276, 156); plant(c, 388, 156);
    px(c, 384, 104, 2, 30, '#8790b0'); px(c, 381, 104, 8, 2, '#c9cfe6'); // antenna mast
    sign(c, R.web, 362);

    // --- cafeteria
    px(c, 274, 178, 10, 18, '#e9edf5'); px(c, 274, 186, 10, 1, '#b8bfd0'); px(c, 282, 181, 1, 3, '#8890a8'); // fridge
    px(c, 286, 178, 10, 18, '#c8343c'); px(c, 288, 180, 6, 10, '#2a1f2a'); for (let i = 0; i < 6; i++) px(c, 288 + (i % 3) * 2, 181 + Math.floor(i / 3) * 4, 1, 2, ['#ffc84a', '#4aa3ff', '#6fd36a'][i % 3]);
    px(c, 298, 184, 30, 8, '#7a5230'); px(c, 298, 184, 30, 2, '#e8e2d0'); px(c, 302, 179, 5, 6, '#2b2b33'); px(c, 303, 180, 3, 2, '#ff6b5e'); px(c, 312, 182, 3, 2, '#ffffff'); px(c, 318, 182, 3, 2, '#ffc84a');
    rug(c, 340, 198, 50, 42, '#8a5a3a', '#b98a55', '#d4a86a');
    px(c, 344, 204, 42, 12, '#5b4bc0'); px(c, 344, 204, 42, 3, '#7a6ae0'); px(c, 346, 207, 6, 4, '#ffc84a'); px(c, 378, 207, 6, 4, '#3fd4c4'); // sofa
    px(c, 354, 228, 22, 6, '#6d4a2b'); px(c, 354, 228, 22, 1, '#a8743f'); px(c, 360, 229, 6, 2, '#4aa3ff');
    px(c, 300, 220, 8, 4, '#e8e2d0'); px(c, 303, 224, 2, 6, '#8890a8'); px(c, 292, 226, 4, 3, '#b4643a'); px(c, 312, 226, 4, 3, '#b4643a');
    plant(c, 388, 194); plant(c, 276, 240);
    sign(c, R.cafe, 362);
    return cv;
  }

  // ---------- animated props ----------
  function props(c, t) {
    // server LEDs
    const racks = [[276, 20], [290, 20], [360, 20], [374, 20], [280, 46], [294, 46], [356, 46], [370, 46]];
    racks.forEach(([x, y], i) => {
      for (let k = 0; k < 6; k++) {
        const on = hash(i * 7 + k, Math.floor(t * 6 + i * 0.37)) > 0.35;
        if (on) { c.fillStyle = k % 3 === 0 ? '#ffc84a' : '#58f08a'; c.fillRect(x + 2 + (k % 2) * 6, y + 3 + Math.floor(k / 2) * 6, 2, 1); }
      }
    });
    // console scrolling lines
    for (let i = 0; i < 3; i++) { c.fillStyle = '#58f08a'; c.fillRect(326, 35 + i * 2, 4 + Math.floor(hash(i, Math.floor(t * 5)) * 9), 1); }
    // hologram globe
    const gx = 332, gy = 112, ph = t * 1.6;
    c.fillStyle = 'rgba(79,227,211,0.18)'; c.fillRect(gx - 9, gy - 8, 18, 18);
    for (let a = 0; a < 40; a++) {
      const th = (a / 40) * Math.PI * 2;
      c.fillStyle = '#4fe3d3';
      c.fillRect(Math.round(gx + Math.cos(th) * 7), Math.round(gy + Math.sin(th) * 7), 1, 1);
    }
    for (let m = 0; m < 3; m++) {
      const k = Math.cos(ph + (m * Math.PI) / 3);
      for (let a = 0; a < 16; a++) {
        const th = (a / 16) * Math.PI * 2;
        c.fillStyle = m === 0 ? '#a6fff2' : '#4fe3d3';
        c.fillRect(Math.round(gx + Math.cos(th) * 7 * k), Math.round(gy + Math.sin(th) * 7), 1, 1);
      }
    }
    c.fillStyle = 'rgba(79,227,211,0.35)'; c.fillRect(gx - 1, gy + 8, 2, 4);
    // map blip
    const bx = 276 + ((t * 14) % 52);
    c.fillStyle = '#ffc84a'; c.fillRect(Math.round(bx), 93 + Math.round(Math.sin(t * 2) * 2), 1, 1);
    // coffee steam
    for (let i = 0; i < 3; i++) {
      const s = (t * 0.8 + i / 3) % 1;
      c.fillStyle = `rgba(255,255,255,${0.6 * (1 - s)})`;
      c.fillRect(304 + Math.round(Math.sin(s * 6 + i) * 1), 178 - Math.round(s * 6), 1, 1);
    }
  }

  // ---------- agents ----------
  // agent: { id, name, color, spawn, start:[x,y], legs:[{at, path:[[x,y]...], speed}], says:[[t,text]], parent, despawn }
  function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function alongPath(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const sl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= sl || i === pts.length - 1) {
        const k = sl ? clamp(d / sl) : 1;
        return { x: lerp(pts[i - 1][0], pts[i][0], k), y: lerp(pts[i - 1][1], pts[i][1], k), dx: pts[i][0] - pts[i - 1][0], dy: pts[i][1] - pts[i - 1][1] };
      }
      d -= sl;
    }
    return { x: pts[0][0], y: pts[0][1], dx: 0, dy: 0 };
  }
  function agentState(a, t) {
    if (t < a.spawn || (a.despawn != null && t >= a.despawn)) return null;
    let x = a.start[0], y = a.start[1], moving = false, look = 0, dist = 0;
    for (const leg of a.legs || []) {
      if (t < leg.at) break;
      const pts = [[x, y], ...leg.path];
      const L = pathLen(pts);
      const speed = leg.speed || (leg.dur ? L / leg.dur : 80);
      const d = (t - leg.at) * speed;
      if (d < L) { const p = alongPath(pts, d); x = p.x; y = p.y; moving = true; look = Math.sign(p.dx); dist = d; break; }
      x = pts[pts.length - 1][0]; y = pts[pts.length - 1][1];
    }
    let say = null, sayT = 0, done = false;
    for (const [st, s, flag] of a.says || []) if (t >= st) { say = s; sayT = st; done = flag === 'done'; }
    const seed = a.id * 13;
    const bob = moving ? Math.floor(dist / 3) % 2 : done ? Math.floor(t * 1.4 + seed) % 2 : Math.floor(t * 3 + seed) % 2 === 0 && hash(seed, Math.floor(t * 3)) < 0.5 ? 1 : 0;
    const frame = moving ? 1 + (Math.floor(dist / 4) % 2) : 0;
    const blink = !moving && hash(seed, Math.floor(t * 5)) < 0.05;
    const spawnK = prog(t, a.spawn, a.spawn + 0.45);
    return { a, x, y, moving, look, frame, bob, blink, say, sayT, done, spawnK };
  }

  // ---------- rendering ----------
  let world = null;
  function renderWorld(t, agents) {
    if (!bgCanvas) bgCanvas = buildBackground();
    if (!world) { world = document.createElement('canvas'); world.width = WW; world.height = WH; }
    const c = world.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(bgCanvas, 0, 0);
    props(c, t);
    const states = agents.map((a) => agentState(a, t)).filter(Boolean).sort((p, q) => p.y - q.y);
    // screens light up where someone works at a desk
    for (const s of states) {
      if (s.moving) continue;
      for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
        const [dx, dy] = desk(col, r);
        if (Math.abs(s.x - dx) < 4 && Math.abs(s.y - dy) < 4) {
          const top = DESK_Y[r];
          c.fillStyle = '#163b5c'; c.fillRect(dx - 4, top - 4, 8, 5);
          for (let i = 0; i < 3; i++) { c.fillStyle = i === 1 ? '#ffc84a' : '#4fe3d3'; c.fillRect(dx - 3, top - 3 + i * 1.5 | 0, 2 + Math.floor(hash(i, Math.floor(t * 4) + r * 9 + col) * 5), 1); }
        }
      }
    }
    for (const s of states) {
      const k = ease.back(s.spawnK);
      if (s.spawnK < 1) {
        // spawn sparkle ring
        const rr = 3 + s.spawnK * 12;
        for (let i = 0; i < 10; i++) {
          const th = (i / 10) * Math.PI * 2 + s.spawnK;
          c.fillStyle = i % 2 ? '#ffffff' : s.a.colorHex;
          c.fillRect(Math.round(s.x + Math.cos(th) * rr), Math.round(s.y - 7 + Math.sin(th) * rr * 0.7), 1, 1);
        }
      }
      if (k <= 0.05) continue;
      c.save();
      const yoff = Math.round((1 - Math.min(1, k)) * -10);
      c.globalAlpha = clamp(s.spawnK * 3);
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(Math.round(s.x) - 4, Math.round(s.y) - 1, 9, 2);
      drawBot(c, Math.round(s.x), Math.round(s.y) + yoff, 1, {
        color: s.a.colorHex, frame: s.frame, look: s.look, blink: s.blink, bob: s.bob,
        antenna: s.done ? '#58f08a' : Math.floor(t * 2 + s.a.id) % 2 ? '#ffc84a' : '#ffefb0', smile: s.done,
      });
      c.restore();
    }
    return { canvas: world, states };
  }

  function camAt(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) {
      const k0 = keys[i - 1], k1 = keys[i];
      if (t <= k1.t) {
        const p = ease.inOut(prog(t, k0.t, k1.t));
        const z = Math.exp(lerp(Math.log(k0.zoom), Math.log(k1.zoom), p));
        const o = { t, zoom: z };
        for (const f of ['cx', 'cy', 'ax', 'ay']) o[f] = lerp(k0[f], k1[f], p);
        const s0 = k0.spot || { x: 0, y: 0, w: WW, h: WH, a: 0 }, s1 = k1.spot || { x: 0, y: 0, w: WW, h: WH, a: 0 };
        o.spot = { x: lerp(s0.x, s1.x, p), y: lerp(s0.y, s1.y, p), w: lerp(s0.w, s1.w, p), h: lerp(s0.h, s1.h, p), a: lerp(s0.a, s1.a, p) };
        return o;
      }
    }
    return keys[keys.length - 1];
  }
  const roomSpot = (k, a = 0.62) => { const r = ROOMS[k]; return { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6, a }; };

  /**
   * Draws the office through a camera. cam: {cx, cy, zoom, ax, ay, spot}
   * opts: { clip:[x,y,w,h], labels: true, labelScale }
   */
  function draw(ctx, t, cam, agents, opts = {}) {
    const { canvas, states } = renderWorld(t, agents);
    const z = cam.zoom;
    const ox = cam.ax - cam.cx * z, oy = cam.ay - cam.cy * z;
    ctx.save();
    if (opts.clip) { ctx.beginPath(); ctx.rect(...opts.clip); ctx.clip(); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, Math.round(ox), Math.round(oy), Math.round(WW * z), Math.round(WH * z));
    const S = (wx, wy) => [ox + wx * z, oy + wy * z];
    if (cam.spot && cam.spot.a > 0.01) {
      const [sx, sy] = S(cam.spot.x, cam.spot.y);
      ctx.fillStyle = `rgba(5,6,14,${cam.spot.a})`;
      ctx.beginPath(); ctx.rect(-10, -10, ctx.canvas.width + 20, ctx.canvas.height + 20); ctx.rect(sx, sy, cam.spot.w * z, cam.spot.h * z); ctx.fill('evenodd');
    }
    if (opts.labels !== false) {
      const ls = opts.labelScale || (z >= 6 ? 3 : 2);
      // sub-agent links
      for (const s of states) {
        if (!s.a.parent || (opts.only && !opts.only.includes(s.a.id))) continue;
        const p = states.find((q) => q.a.id === s.a.parent);
        if (!p) continue;
        const [x1, y1] = S(p.x, p.y - 8), [x2, y2] = S(s.x, s.y - 8);
        ctx.save(); ctx.setLineDash([ls * 3, ls * 3]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = alpha(C.pink, 0.85); ctx.lineWidth = ls; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      }
      const sp = cam.spot && cam.spot.a > 0.3 ? cam.spot : null;
      for (const s of states) {
        if (s.spawnK < 0.6) continue;
        if (opts.only && !opts.only.includes(s.a.id)) continue;
        if (sp && (s.x < sp.x || s.x > sp.x + sp.w || s.y < sp.y || s.y > sp.y + sp.h)) continue;
        const [hx, hy] = S(s.x, s.y - 16 + (s.bob ? -1 : 0));
        // nameplate
        const nw = PF.measure(s.a.name) * ls + ls * 4, nh = 7 * ls + ls * 4;
        const nx = Math.round(hx - nw / 2), ny = Math.round(hy - nh - ls * 2);
        ctx.fillStyle = s.a.colorHex; ctx.fillRect(nx, ny, nw, nh);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(nx, ny + nh - ls, nw, ls);
        PF.draw(ctx, s.a.name, nx + ls * 2, ny + ls * 2, ls, '#0b0d1a');
        // speech bubble
        if (s.say && !opts.noBubbles) {
          const chars = Math.floor((t - s.sayT) * 40);
          const bw = PF.measure(s.say) * ls + ls * 6, bh = 7 * ls + ls * 6;
          const bx = Math.round(hx - bw / 2), by = Math.round(ny - bh - ls * 3);
          const done = s.done;
          ctx.fillStyle = '#0b0d1a'; ctx.fillRect(bx - ls, by - ls, bw + 2 * ls, bh + 2 * ls);
          ctx.fillStyle = done ? '#dfffe6' : '#fffaf0'; ctx.fillRect(bx, by, bw, bh);
          ctx.fillRect(Math.round(hx - ls), by + bh, ls * 2, ls * 2);
          PF.draw(ctx, s.say, bx + ls * 3, by + ls * 3, ls, done ? '#14612b' : '#151826', { chars });
        }
      }
    }
    ctx.restore();
    return { states, toScreen: S };
  }

  // Build agent objects with resolved colors and ids.
  let nextId = 1;
  function agent(def) { return { id: nextId++, colorHex: AGENT[def.color] || def.color, legs: [], says: [], ...def }; }

  // Common routes (excluding the starting point).
  const E = SPOT.entrance;
  const route = {
    entranceTo: {
      lib: [[200, HALL], [LANE_L, HALL], [LANE_L, 74], DOOR.lib[0], SPOT.lib],
      meet: [[200, HALL], [LANE_L, HALL], [LANE_L, 204], DOOR.meet[0], [26, 214], SPOT.meetW],
      srv: [[200, HALL], [LANE_R, HALL], [LANE_R, 52], DOOR.srv[0], SPOT.srv],
      web: [[200, HALL], [LANE_R, HALL], [LANE_R, 132], DOOR.web[0], SPOT.web],
      cafe: [[200, HALL], [LANE_R, HALL], DOOR.cafe[1], DOOR.cafe[0], [330, 222], SPOT.cafe1],
    },
  };

  root.Office = { WW, WH, ROOMS, SPOT, DOOR, DESK_X, DESK_Y, desk, LANE_L, LANE_R, HALL, E, route, roomSpot, camAt, draw, agent, agentState, renderWorld };
})(window);
