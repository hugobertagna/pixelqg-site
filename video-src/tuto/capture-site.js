// Headless capture of the PixelQG site (top of index.html), for step 1 of the installation tutorial.
// Usage: node video-src/tuto/capture-site.js   →   video-src/tuto/shots/site.png + site-shot.js
// No window appears (headless Edge). The shot is the local index.html, i.e. what the live site serves.
const fs = require('fs');
const path = require('path');
const { launch, fileUrl, sleep } = require('../cdp.js');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await launch({ fileAccess: false });
  try {
    const p = await b.newPage();
    await p.viewport(1920, 1080);
    await p.goto(fileUrl(path.join(ROOT, 'index.html')));
    const info = await p.eval(`(async () => {
      await document.fonts.ready;
      // Only the images above the fold (lazy ones further down never load in this shot).
      await Promise.all([...document.images].filter((i) => i.loading !== 'lazy').map((i) => Promise.race([i.decode().catch(() => null), new Promise((r) => setTimeout(r, 3000))])));
      // A fixed frame of the hero loop, so the picture does not depend on timing.
      const v = document.querySelector('.hero__video');
      if (v) {
        v.pause();
        await new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = 2.4; setTimeout(r, 3000); });
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 500));
      const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      return { nav: rect('.nav__cta'), href: document.querySelector('.nav__cta').href };
    })()`);
    if (!/PixelQG-Setup-[\d.]+\.exe$/.test(info.href)) throw new Error('the « Télécharger » button is not a direct download: ' + info.href);
    fs.writeFileSync(path.join(OUT, 'site.png'), await p.screenshot());
    fs.writeFileSync(path.join(OUT, 'site-shot.js'), '// Written by capture-site.js: where the « Télécharger » button is on site.png.\nwindow.TUTO_SITE = ' + JSON.stringify({ nav: info.nav }) + ';\n');
    console.log('site.png', JSON.stringify(info.nav));
    p.close();
  } finally {
    b.close();
  }
})().catch((e) => { console.error('ERR', e.message); process.exitCode = 1; });
