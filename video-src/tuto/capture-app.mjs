// Hidden capture of the real PixelQG app with a fake profile, for the installation tutorial.
// Usage: node video-src/tuto/capture-app.mjs   →   video-src/tuto/shots/app-*.png, type/*.jpg, walk/*.jpg, app-shots.js
// The tutorial (video-src/tuto.js) uses these real captures as soon as app-shots.js exists.
//
// Adapted from the README capture of the app: the app's server runs hidden with a fake profile
// (USERPROFILE=C:\Users\alex, a throwaway PIXELQG_HOME, a fake Claude Code CLI), headless Edge
// drives it, and the script aborts if the real user name or an e-mail shows up in the page.
// Nothing is written in the app folder; everything started here is killed at the end.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { launch, sleep } = require('../cdp.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
// The app's repository, next to this site's folder (or PIXELQG_APP). Only read, never written.
const APP = process.env.PIXELQG_APP || path.resolve(HERE, '..', '..', '..', 'pixelqg-app');
// What must never show up in a picture: the Windows user name (read at run time) and e-mail addresses.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SECRET = [os.userInfo().username, '@gmail', '@eleve'].filter(Boolean).map(esc).join('|');
const OUT = path.join(HERE, 'shots');
const PORT = 4612;
const CWD = 'C:\\Users\\Public\\Projets\\mon-site';
const FAKE_CLI = 'C:\\Users\\Public\\pixelqg-capture\\fake-claude.js';
const MISSION = 'Ajoute une page « À propos » au site, puis vérifie qu\u2019elle s\u2019affiche bien sur mobile.';
const NAME = 'Nova';

for (const d of ['type', 'walk']) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}
fs.mkdirSync(CWD, { recursive: true });
const home = fs.mkdtempSync(path.join('C:\\', 'Users', 'Public', 'pixelqg-capture', 'home-'));
const env = { ...process.env, USERPROFILE: 'C:\\Users\\alex', HOMEDRIVE: 'C:', HOMEPATH: '\\Users\\alex', PIXELQG_HOME: home, CLAUDE_BIN: FAKE_CLI };
const server = spawn(process.execPath, ['server/server.js', '--no-observe', '--port', String(PORT)], { cwd: APP, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

let browser;
const LEAK = `(() => {
  const t = document.body.innerText + ' ' + [...document.querySelectorAll('input,textarea,select')].map((e) => e.value).join(' ') + ' ' + [...document.querySelectorAll('[title],[data-tip]')].map((e) => (e.title || '') + ' ' + (e.dataset.tip || '')).join(' ');
  const m = t.replace(/hugobertagna/gi, '').match(new RegExp('.{0,60}(' + ${JSON.stringify(SECRET)} + '|onedrive).{0,40}', 'i'));
  return m ? m[0] : null;
})()`;

try {
  let html;
  for (let i = 0; i < 60 && !html; i++) { try { html = await (await fetch(`http://127.0.0.1:${PORT}/`)).text(); } catch { await sleep(250); } }
  if (!html) throw new Error('the app server did not answer');

  browser = await launch({ fileAccess: false });
  const p = await browser.newPage();
  await p.viewport(1920, 1080);
  await p.goto(`http://127.0.0.1:${PORT}/`);
  await sleep(9000);
  const check = async (when) => { const leak = await p.eval(LEAK); if (leak) throw new Error(`personal data visible (${when}): ${leak}`); };
  const shot = async (name, opts = {}) => { fs.writeFileSync(path.join(OUT, name), await p.screenshot(opts)); console.log('SHOT', name); };
  await check('empty office');
  await shot('app-empty.png');

  // « Nouveau pix » window, opened from the toolbar like a user would.
  await p.eval(`document.getElementById('tb-agent').click()`);
  await sleep(900);
  const setField = (id, value) => p.eval(`(() => {
    const el = document.getElementById(${JSON.stringify(id)});
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  })()`);
  const defaults = await p.eval(`({ cwd: document.getElementById('f-cwd').value, name: document.getElementById('f-name').value })`);
  console.log('form defaults', JSON.stringify(defaults));
  await setField('f-cwd', CWD);
  await p.eval(`document.getElementById('f-prompt').focus()`);
  const win = await p.eval(`(() => { const r = document.getElementById('win-agent').getBoundingClientRect(); return { x: Math.floor(r.x), y: Math.floor(r.y), w: Math.ceil(r.width), h: Math.ceil(r.height) }; })()`);
  await check('new pix window');
  await shot('app-form-empty.png');

  // The mission typed a few characters at a time: one picture of the window per step.
  const chars = [...MISSION];
  const steps = [];
  for (let k = 0; k <= chars.length; k += 3) steps.push(k);
  if (steps[steps.length - 1] !== chars.length) steps.push(chars.length);
  for (let i = 0; i < steps.length; i++) {
    await setField('f-prompt', chars.slice(0, steps[i]).join(''));
    await sleep(60);
    fs.writeFileSync(path.join(OUT, 'type', String(i).padStart(3, '0') + '.jpg'), await p.screenshot({ format: 'jpeg', quality: 90, clip: { x: win.x, y: win.y, width: win.w, height: win.h, scale: 1 } }));
  }
  for (let i = 0; i <= 4; i++) {
    await setField('f-name', NAME.slice(0, i));
    await sleep(60);
    fs.writeFileSync(path.join(OUT, 'type', 'n' + i + '.jpg'), await p.screenshot({ format: 'jpeg', quality: 90, clip: { x: win.x, y: win.y, width: win.w, height: win.h, scale: 1 } }));
  }
  const submit = await p.eval(`(() => { const r = document.getElementById('f-submit').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  await check('mission typed');
  await shot('app-form.png');
  const tbAgent = await p.eval(`(() => { const r = document.getElementById('tb-agent').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  const meta = { window: win, submit, tbAgent, typeSteps: steps.length, nameSteps: 5 };

  // Launch, then film the new pix arriving: a screencast of the page for a few seconds.
  const frames = [];
  let t0 = null;
  p.listeners.push((m) => {
    if (m.method !== 'Page.screencastFrame') return;
    const { data, metadata, sessionId } = m.params;
    if (t0 === null) t0 = metadata.timestamp;
    const file = String(frames.length).padStart(4, '0') + '.jpg';
    fs.writeFileSync(path.join(OUT, 'walk', file), Buffer.from(data, 'base64'));
    frames.push({ file, t: +(metadata.timestamp - t0).toFixed(3) });
    p.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await p.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await sleep(300);
  await p.eval(`document.getElementById('f-submit').click()`);
  await sleep(16000);
  await p.send('Page.stopScreencast');
  await sleep(300);
  meta.walk = frames;
  fs.writeFileSync(path.join(OUT, 'app-shots.js'), '// Written by capture-app.mjs: positions and frame list of the real app captures.\nwindow.TUTO_APP = ' + JSON.stringify(meta) + ';\n');
  console.log('walk frames', frames.length, 'over', frames.length ? frames[frames.length - 1].t : 0, 's');
  await check('pix launched');
  await shot('app-working.png');
  p.close();
} catch (e) {
  console.error('ERR', e.message, log.slice(-600));
  process.exitCode = 1;
} finally {
  try { browser && browser.close(); } catch {}
  // The server and the fake CLI it started: the whole process tree.
  try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
  await sleep(800);
  try { fs.rmSync(home, { recursive: true, force: true }); } catch {}
}
