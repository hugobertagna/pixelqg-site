// Minimal Chrome DevTools Protocol driver for headless Microsoft Edge (zero dependencies, Node 22+).
// The browser runs with --headless=new: no window ever appears. Call browser.close() to kill it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(opts = {}) {
  const userDataDir = opts.userDataDir || path.join(os.tmpdir(), 'pixelqg-edge-' + process.pid);
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1',
    ...(opts.fileAccess === false ? [] : ['--allow-file-access-from-files']),
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-features=msEdgeSidebarV2,msHubApps,EdgeCollections,msUndersideButton',
    'about:blank',
  ];
  const proc = spawn(EDGE, args, { stdio: 'ignore', windowsHide: true });
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 200 && !port; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10) || null;
  }
  const browser = {
    port, proc, userDataDir,
    async newPage() { return Page.open(port); },
    close() {
      try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
      // Safety net: anything still holding our private profile dir.
      try {
        execFileSync('powershell', ['-NoProfile', '-Command',
          `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(userDataDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
        { stdio: 'ignore', windowsHide: true });
      } catch {}
      for (let i = 0; i < 20; i++) { try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; } catch { execFileSync('cmd', ['/c', 'ping -n 2 127.0.0.1 >nul'], { windowsHide: true }); } }
    },
  };
  if (!port) { browser.close(); throw new Error('Edge did not start (no DevToolsActivePort)'); }
  return browser;
}

class Page {
  static async open(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    const info = await res.json();
    const page = new Page(info.webSocketDebuggerUrl);
    await page.opened;
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    return page;
  }
  constructor(url) {
    this.id = 0; this.pending = new Map(); this.listeners = []; this.logs = [];
    this.ws = new WebSocket(url);
    this.opened = new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', rej); });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') this.logs.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
        if (msg.method === 'Runtime.exceptionThrown') this.logs.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
        for (const l of this.listeners) l(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  waitFor(method) { return new Promise((res) => { const l = (m) => { if (m.method === method) { this.listeners.splice(this.listeners.indexOf(l), 1); res(m.params); } }; this.listeners.push(l); }); }
  async viewport(width, height, mobile = false, scale = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  }
  async goto(url) {
    const loaded = this.waitFor('Page.loadEventFired');
    await this.send('Page.navigate', { url });
    await loaded;
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async screenshot(opts = {}) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, ...opts });
    return Buffer.from(r.data, 'base64');
  }
  close() { try { this.ws.close(); } catch {} }
}

const fileUrl = (p) => 'file:///' + path.resolve(p).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');

module.exports = { launch, fileUrl, sleep };
