// Headless check of the landing page: screenshots at 1440 px and 390 px + automatic checks.
// Usage: node tools/check-site.js [outDir] [page.html]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch, fileUrl } = require('../video-src/cdp.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'pixelqg-check'));
const PAGE = process.argv[3] || 'index.html';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  // No --allow-file-access-from-files: same conditions as someone double-clicking index.html.
  const b = await launch({ fileAccess: false });
  try {
    for (const [w, h, mobile, chunk] of [[1440, 900, false, 1800], [390, 844, true, 2200]]) {
      const p = await b.newPage();
      await p.send('Log.enable');
      const failed = [];
      p.listeners.push((m) => { if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') failed.push(m.params.entry.text + ' ' + (m.params.entry.url || '')); });
      await p.viewport(w, h, mobile);
      await p.goto(fileUrl(path.join(ROOT, PAGE)));
      const info = await p.eval(`(async () => {
        document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
        await Promise.all([...document.images].map((i) => i.decode().catch(() => null)));
        await document.fonts.ready;
        await new Promise((r) => setTimeout(r, 400));
        const de = document.documentElement;
        const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > de.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.hero, .final'); }).slice(0, 8).map((el) => el.tagName + '.' + el.className);
        const v = document.querySelector('.hero__video');
        return {
          height: de.scrollHeight, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, wide,
          pixelFont: document.fonts.check('16px "PixelQG Pixel"'),
          brokenImages: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')),
          heroVideo: v ? { readyState: v.readyState, paused: v.paused, error: v.error && v.error.code } : null,
          buyLinks: [...document.querySelectorAll('[data-buy]')].map((a) => a.getAttribute('href')),
        };
      })()`);
      console.log(`--- ${w}px`, JSON.stringify(info));
      if (failed.length) console.log('console/network errors:', failed);
      if (p.logs.length) console.log('page logs:', p.logs);
      await p.viewport(w, info.height, mobile);
      await p.eval('new Promise((r) => setTimeout(r, 300))');
      for (let y = 0, i = 0; y < info.height; y += chunk, i++) {
        const shot = await p.screenshot({ clip: { x: 0, y, width: w, height: Math.min(chunk, info.height - y), scale: 1 }, captureBeyondViewport: true });
        const file = path.join(OUT, `${path.basename(PAGE, '.html')}-${w}-${String(i).padStart(2, '0')}.png`);
        fs.writeFileSync(file, shot);
      }
      p.close();
    }
    console.log('screenshots in', OUT);
  } finally { b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
