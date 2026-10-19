// Starts the PixelQG app hidden, in demo mode, under a fake Windows profile (C:\Users\alex),
// so no real username or e-mail can leak into the site captures. Used by capture-app.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const FAKE_PROFILE = 'C:\\Users\\alex';
const TERMINAL_CWD = 'C:\\Users\\Public\\Projets\\demo';

async function startApp({ appDir, port = 4601 }) {
  const home = path.join(os.tmpdir(), 'pixelqg-capture-home');
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(TERMINAL_CWD, { recursive: true });
  const env = {
    ...process.env,
    USERPROFILE: FAKE_PROFILE, HOMEDRIVE: 'C:', HOMEPATH: '\\Users\\alex', HOME: FAKE_PROFILE,
    USERNAME: 'alex', PIXELQG_HOME: home,
    CLAUDE_BIN: path.join(appDir, 'server', 'test', 'fake-claude.js'),
  };
  const proc = spawn(process.execPath, [path.join('server', 'server.js'), '--demo', '--no-observe', '--port', String(port)], {
    cwd: appDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(url); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 150));
    if (proc.exitCode != null) throw new Error('app exited:\n' + log);
  }
  return {
    url, home, proc, log: () => log,
    stop() {
      try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
      fs.rmSync(home, { recursive: true, force: true });
    },
  };
}

module.exports = { startApp, FAKE_PROFILE, TERMINAL_CWD };
