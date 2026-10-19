// Crops the real app captures (source-captures/) into WebP images for the site (images/).
// The old wordmark in the top bar (x 4..194, y 0..61) is painted over with the bar's own
// gradient before any crop, so it can never leak. Usage: node tools/build-images.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'source-captures'); // already cleaned by tools/sanitize-captures.js
const OUT = path.join(ROOT, 'images');
fs.mkdirSync(OUT, { recursive: true });

// [output name, source, crop "w:h:x:y" or null for the whole capture, max width]
const JOBS = [
  ['app-full', 'final-1920.png', null, 1920],
  ['app-launch', 'final-desk.png', null, 1600],
  ['office-busy', 'final-1920.png', '1352:838:98:92', 1352],
  ['office-clean', 'live-3.png', '1268:794:12:20', 1268],
  ['hud', 'final-1920.png', '500:54:537:4', 500],
  ['roster', 'final-1920.png', '358:948:1545:78', 358],
  ['launch-form', 'final-desk.png', '1196:300:16:686', 1196],
  ['terminal', 'e2e-term.png', '1196:416:16:560', 1196, 'drawbox=x=34:y=756:w=260:h=56:color=0x14151f:t=fill'],
  ['library', 'e2e-lib.png', '1196:360:16:626', 1196],
  ['agent-card', 'game-zoom.png', '360:552:1064:338', 360],
  ['follow-office', 'gf-follow.png', '1194:548:16:76', 1194],
  ['subagent-card', 'gf-follow.png', '360:572:1225:414', 360],
  ['room-bibliotheque', 'final-1920.png', '374:374:128:122', 374],
  ['room-reunion', 'final-1920.png', '374:404:128:520', 374],
  ['room-serveurs', 'live-3.png', '350:236:902:48', 350],
  ['room-labo', 'live-3.png', '350:232:902:282', 350],
  ['room-cafeteria', 'launch.png', '390:296:727:284', 390],
  ['room-openspace', 'final-1920.png', '496:520:527:122', 496],
];

const MASK = '[0:v]split=2[a][b];[b]crop=1:62:196:0,scale=191:62:flags=neighbor[p];[a][p]overlay=4:0[m]';

function ffmpeg(args) { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true }); }

for (const [name, src, crop, maxW, extra] of JOBS) {
  const input = path.join(SRC, src);
  let chain = MASK + (extra ? ';[m]' + extra + '[m2]' : ';[m]null[m2]');
  chain += crop ? `;[m2]crop=${crop}[c]` : ';[m2]null[c]';
  chain += `;[c]scale='min(${maxW},iw)':-2:flags=neighbor[o]`;
  const lossless = path.join(OUT, name + '.ll.webp');
  const lossy = path.join(OUT, name + '.webp');
  ffmpeg(['-i', input, '-filter_complex', chain, '-map', '[o]', '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', lossless]);
  ffmpeg(['-i', input, '-filter_complex', chain, '-map', '[o]', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', lossy]);
  const a = fs.statSync(lossless).size, b = fs.statSync(lossy).size;
  // Pixel art often compresses better losslessly; keep lossless unless it is much heavier.
  if (a <= b * 1.35) fs.renameSync(lossless, lossy); else fs.unlinkSync(lossless);
  console.log(`${name}.webp  ${(fs.statSync(lossy).size / 1024).toFixed(0)} KB  ${a <= b * 1.35 ? 'lossless' : 'q90'}`);
}
