// Renders the PixelQG explainer frame by frame in headless Microsoft Edge, then encodes with ffmpeg.
//
//   node video-src/render.js                 -> video/pixelqg-demo.mp4 + poster + og image
//   node video-src/render.js --mode loop     -> video/hero-loop.mp4 + poster (8 s seamless loop)
//   node video-src/render.js --mode social-a -> social/pixelqg-aveugle.mp4 (vertical 1080x1920, also social-b, social-c)
//   node video-src/render.js --stills 3,10.9,22.5 --out some/dir   -> PNG stills only (quick check)
//
// Options: --workers N (parallel headless browsers, default 4), --keep (keep PNG frames), --crf N, --mute (no soundtrack)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, fileUrl } = require('./cdp.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const MODE = opt('mode', 'main');
const WORKERS = parseInt(opt('workers', '4'), 10);
const STILLS = opt('stills', null);
const FRAMES_DIR = path.join(os.tmpdir(), 'pixelqg-frames-' + MODE);
const OUT_DIR = path.join(ROOT, 'video');

async function openWorker(id) {
  const browser = await launch({ userDataDir: path.join(os.tmpdir(), `pixelqg-render-${process.pid}-${id}`) });
  const page = await browser.newPage();
  const url = fileUrl(path.join(__dirname, 'index.html')) + '?mode=' + MODE;
  await page.goto(url);
  const info = await page.eval('window.ready');
  await page.viewport(info.width, info.height);
  return { browser, page, info };
}

async function capture(w, i) {
  await w.page.eval(`window.renderFrame(${i})`);
  return w.page.screenshot({ clip: { x: 0, y: 0, width: w.info.width, height: w.info.height, scale: 1 } });
}

function ffmpeg(a) { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit', windowsHide: true }); }

(async () => {
  const workers = [];
  const cleanup = () => { for (const w of workers) w.browser.close(); };
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  try {
    if (STILLS) {
      const out = path.resolve(opt('out', path.join(os.tmpdir(), 'pixelqg-stills')));
      fs.mkdirSync(out, { recursive: true });
      const w = await openWorker(0); workers.push(w);
      for (const s of String(STILLS).split(',')) {
        const t = parseFloat(s);
        const file = path.join(out, `${MODE}-${t.toFixed(2)}.png`);
        fs.writeFileSync(file, await capture(w, Math.round(t * w.info.fps)));
        console.log(file);
      }
      if (w.page.logs.length) console.log(w.page.logs.join('\n'));
      return;
    }

    for (let i = 0; i < WORKERS; i++) workers.push(await openWorker(i));
    const workers0 = workers[0].info;
    const { fps, duration, width, height } = workers0;
    const total = Math.round(duration * fps);
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
    console.log(`${MODE}: ${total} frames ${width}x${height} @${fps} with ${WORKERS} headless Edge workers`);
    let next = 0, done = 0;
    const t0 = Date.now();
    await Promise.all(workers.map(async (w) => {
      while (next < total) {
        const i = next++;
        fs.writeFileSync(path.join(FRAMES_DIR, `f_${String(i).padStart(5, '0')}.png`), await capture(w, i));
        if (++done % 150 === 0) console.log(`  ${done}/${total} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      }
    }));
    for (const w of workers) if (w.page.logs.length) console.log(w.page.logs.join('\n'));
    cleanup(); workers.length = 0;

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const input = ['-framerate', String(fps), '-i', path.join(FRAMES_DIR, 'f_%05d.png')];
    const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart'];
    if (MODE.startsWith('social-')) {
      // Vertical clip: music bed only (no sound effects, no voice), kept out of the deployed site.
      const socialDir = path.join(ROOT, 'social');
      fs.mkdirSync(socialDir, { recursive: true });
      const audio = path.join(os.tmpdir(), `pixelqg-music-${MODE}.wav`);
      const withAudio = [];
      if (!opt('mute', false)) {
        execFileSync(process.execPath, [path.join(__dirname, 'soundtrack.js'), audio, '--music-only', '--duration', String(duration), '--groove-at', String(workers0.grooveAt || 0)], { stdio: 'inherit', windowsHide: true });
        withAudio.push('-i', audio, '-c:a', 'aac', '-b:a', '128k', '-shortest');
      }
      const base = path.join(socialDir, 'pixelqg-' + workers0.name);
      ffmpeg([...input, ...withAudio, ...x264, '-crf', String(opt('crf', '20')), base + '.mp4']);
      const posterFrame = path.join(FRAMES_DIR, `f_${String(Math.round(workers0.posterAt * fps)).padStart(5, '0')}.png`);
      ffmpeg(['-i', posterFrame, '-q:v', '3', base + '.jpg']);
      for (const f of fs.readdirSync(socialDir)) console.log(`social/${f}  ${(fs.statSync(path.join(socialDir, f)).size / 1048576).toFixed(2)} MB`);
    } else if (MODE === 'loop') {
      ffmpeg([...input, ...x264, '-crf', String(opt('crf', '23')), path.join(OUT_DIR, 'hero-loop.mp4')]);
      ffmpeg(['-i', path.join(FRAMES_DIR, 'f_00000.png'), '-c:v', 'libwebp', '-quality', '88', path.join(OUT_DIR, 'hero-loop-poster.webp')]);
    } else {
      const audio = path.join(os.tmpdir(), 'pixelqg-soundtrack.wav');
      if (!opt('mute', false)) execFileSync(process.execPath, [path.join(__dirname, 'soundtrack.js'), audio], { stdio: 'inherit', windowsHide: true });
      const withAudio = !opt('mute', false) && fs.existsSync(audio) ? ['-i', audio, '-c:a', 'aac', '-b:a', '96k', '-shortest'] : [];
      ffmpeg([...input, ...withAudio, ...x264, '-crf', String(opt('crf', '21')), path.join(OUT_DIR, 'pixelqg-demo.mp4')]);
      const posterFrame = path.join(FRAMES_DIR, `f_${String(Math.round(10.9 * fps)).padStart(5, '0')}.png`);
      ffmpeg(['-i', posterFrame, '-c:v', 'libwebp', '-quality', '85', path.join(OUT_DIR, 'pixelqg-demo-poster.webp')]);
      ffmpeg(['-i', posterFrame, '-vf', 'scale=1200:-1:flags=lanczos,crop=1200:630', '-q:v', '3', path.join(ROOT, 'images', 'og-image.jpg')]);
    }
    if (!opt('keep', false)) fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    for (const f of fs.readdirSync(OUT_DIR)) console.log(`${f}  ${(fs.statSync(path.join(OUT_DIR, f)).size / 1048576).toFixed(2)} MB`);
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } finally {
    cleanup();
  }
})().catch((e) => { console.error(e); process.exit(1); });
