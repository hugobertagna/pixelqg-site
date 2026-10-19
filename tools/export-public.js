// Copies only the files a visitor needs into dist/ (what you upload to Netlify, GitHub Pages…).
// The sources (source-captures/ with the old wordmark, tools/, video-src/) stay out of it.
// Usage: node tools/export-public.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = ['index.html', 'config.js', 'favicon.png', 'apple-touch-icon.png', 'css', 'js', 'fonts', 'images', 'video', 'legal'];
fs.rmSync(DIST, { recursive: true, force: true });
for (const p of PUBLIC) fs.cpSync(path.join(ROOT, p), path.join(DIST, p), { recursive: true });
let total = 0;
const walk = (d) => { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); fs.statSync(q).isDirectory() ? walk(q) : (total += fs.statSync(q).size); } };
walk(DIST);
console.log(`dist/ ready: ${(total / 1048576).toFixed(1)} MB`);
