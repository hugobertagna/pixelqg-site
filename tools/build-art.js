// Exports small pixel-art assets for the site from the video code (same skyline, same mascot).
// Usage: node tools/build-art.js   -> images/skyline.png, images/bot-*.png, favicon.png, apple-touch-icon.png
const fs = require('fs');
const path = require('path');
const { launch, fileUrl } = require('../video-src/cdp.js');

const ROOT = path.join(__dirname, '..');
const save = (rel, dataUrl) => {
  const file = path.join(ROOT, rel);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(rel, fs.statSync(file).size, 'bytes');
};

(async () => {
  const b = await launch();
  try {
    const p = await b.newPage();
    await p.goto(fileUrl(path.join(ROOT, 'video-src', 'index.html')) + '?mode=loop');
    await p.eval('window.ready');
    const out = await p.eval(`(() => {
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
      const res = {};
      { const [c, x] = mk(480, 100); Q.skyline(x, 0, 0, 1); res.skyline = c.toDataURL('image/png'); }
      { const [c, x] = mk(256, 256); const r = Q.rng(5);
        for (let i = 0; i < 46; i++) { const s = r() < 0.18 ? 2 : 1; x.fillStyle = r() < 0.15 ? '#ffe7a6' : r() < 0.3 ? '#a9fff4' : '#cfd6ff'; x.globalAlpha = 0.35 + r() * 0.65; x.fillRect(Math.floor(r() * 254), Math.floor(r() * 254), s, s); }
        res.stars = c.toDataURL('image/png'); }
      for (const [name, col] of Object.entries({ amber: Q.C.lamp, cyan: Q.C.cyan, blue: Q.AGENT.blue, green: Q.AGENT.green, purple: Q.AGENT.purple, pink: Q.AGENT.pink, orange: Q.AGENT.orange, teal: Q.AGENT.teal })) {
        const [c, x] = mk(12, 15); Q.drawBot(x, 6, 15, 1, { color: col }); res['bot-' + name] = c.toDataURL('image/png');
      }
      { const [c, x] = mk(32, 32); Q.drawBot(x, 16, 31, 2, { color: Q.C.cyan }); res.favicon = c.toDataURL('image/png'); }
      { const [c, x] = mk(180, 180); x.fillStyle = '#0a0c19'; x.fillRect(0, 0, 180, 180); Q.drawBot(x, 90, 165, 10, { color: Q.C.cyan }); res.apple = c.toDataURL('image/png'); }
      return res;
    })()`);
    save('images/skyline.png', out.skyline);
    save('images/stars.png', out.stars);
    for (const k of Object.keys(out).filter((k) => k.startsWith('bot-'))) save(`images/${k}.png`, out[k]);
    save('favicon.png', out.favicon);
    save('apple-touch-icon.png', out.apple);
  } finally { b.close(); }
})();
