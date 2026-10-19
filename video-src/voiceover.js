// French voice-over for the PixelQG explainer: a few punchy lines spoken by a Windows (OneCore) voice,
// mixed over the chiptune bed with ducking and loudness normalisation.
//
//   node video-src/voiceover.js --samples        -> video-src/samples/voix-julie.mp3 + voix-paul.mp3 (line 1, 5 s)
//   node video-src/voiceover.js --list           -> installed French voices
// render.js uses buildVoiceTrack() and mixAudio().
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DEFAULT_VOICE = 'Microsoft Julie';
const RATE = '-8%'; // a touch slower than the default voice speed (a line can override it)
const GAP = 0.3; // minimum silence between two lines (s)

// t = when the matching text appears in scenes.js. "IA" is spelled I.A., "PixelQG" is Pixel Q.G.
// Lines 2 and 3 are spoken a little faster so they end before the next scene starts.
const LINES = [
  { t: 0.9, ssml: 'Tes agents I.A. bossent<break time="400ms"/> à l’aveugle.' },
  { t: 3.6, rate: '+4%', ssml: 'Qui fait quoi ?<break time="120ms"/> Ça avance ?<break time="120ms"/> Ça coûte combien ?' },
  { t: 7.9, rate: '+6%', ssml: 'Pixel Q.G.<break time="180ms"/> ton Q.G. d’agents I.A.,<break time="80ms"/> en pixel art.' },
  { t: 12.5, ssml: 'Décris la mission<break time="350ms"/> et lance.' },
  { t: 19.6, ssml: 'Chaque action l’emmène dans une salle du Q.G.' },
  { t: 29.3, ssml: 'Il délègue à un sous-agent.' },
  { t: 34.8, ssml: 'Tout est mesuré,<break time="200ms"/> en direct.' },
  { t: 42.0, ssml: 'Tape claude dans le terminal intégré.' },
  { t: 47.0, ssml: 'Ajoute des skills depuis GitHub.' },
  { t: 58.3, ssml: 'Pixel Q.G.<break time="350ms"/> Dix euros,<break time="200ms"/> paiement unique.' },
];

const fullVoiceName = (v) => (/^microsoft /i.test(v) ? v : 'Microsoft ' + v);
const speak = (body, rate = RATE) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR"><prosody rate="${rate}">${body}</prosody></speak>`;
const ffmpeg = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });

// Duration of a PCM WAV file in seconds (reads the fmt and data chunks).
function wavDuration(file) {
  const b = fs.readFileSync(file);
  let off = 12, byteRate = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = b.readUInt32LE(off + 16);
    if (id === 'data') return size / byteRate;
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk in ' + file);
}

// Synthesizes lines ({ ssml, rate }) with one voice; returns trimmed WAV paths.
function synthesize(lines, voice, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const jobs = lines.map((l, i) => ({ ssml: speak(l.ssml, l.rate), out: path.join(dir, `line-${String(i + 1).padStart(2, '0')}.wav`) }));
  const jobsFile = path.join(dir, 'jobs.json');
  fs.writeFileSync(jobsFile, JSON.stringify(jobs), 'utf8');
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'tts.ps1'), '-Jobs', jobsFile, '-Voice', fullVoiceName(voice)],
    { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  // OneCore pads every clip with silence: trim both ends so the timing below is the real speech.
  return jobs.map((j) => {
    const trimmed = j.out.replace(/\.wav$/, '-trim.wav');
    const cut = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03';
    ffmpeg(['-i', j.out, '-af', cut + ',areverse,' + cut + ',areverse', trimmed]);
    return trimmed;
  });
}

// Speaks every line and schedules them so that none overlaps the next.
function buildVoiceTrack(voice = DEFAULT_VOICE, duration = 65) {
  const dir = path.join(os.tmpdir(), 'pixelqg-voice-' + fullVoiceName(voice).replace(/\W+/g, '-').toLowerCase());
  const files = synthesize(LINES, voice, dir);
  const plan = [];
  let free = 0;
  LINES.forEach((l, i) => {
    const len = wavDuration(files[i]);
    const start = Math.max(l.t, free);
    plan.push({ file: files[i], target: l.t, start, end: start + len });
    free = start + len + GAP;
  });
  const last = plan[plan.length - 1];
  if (last.end > duration - 0.3) throw new Error(`voice-over too long: last line ends at ${last.end.toFixed(2)} s`);
  return plan;
}

// Mixes the music bed and the voice lines: music ducked under the voice, loudness -16 LUFS. Returns a WAV path.
function mixAudio(musicWav, plan, outWav, duration = 65) {
  const inputs = ['-i', musicWav];
  const parts = [];
  plan.forEach((p, i) => {
    inputs.push('-i', p.file);
    const ms = Math.round(p.start * 1000);
    parts.push(`[${i + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,adelay=${ms}|${ms}[v${i}]`);
  });
  const voiceIn = plan.map((_, i) => `[v${i}]`).join('');
  const graph = (loudnorm) => [
    ...parts,
    `${voiceIn}amix=inputs=${plan.length}:normalize=0:duration=longest,apad=whole_dur=${duration},volume=1.6,asplit=2[vk][vm]`,
    `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,volume=0.65[mus]`,
    `[mus][vk]sidechaincompress=threshold=0.015:ratio=8:attack=15:release=450:knee=4[duck]`,
    `[duck][vm]amix=inputs=2:normalize=0:duration=first,atrim=0:${duration},${loudnorm}[out]`,
  ].join(';');
  // Two-pass loudness normalisation (EBU R128): measure, then apply linearly.
  const stats = loudnormStats(['-hide_banner', '-y', ...inputs, '-filter_complex', graph('loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json'), '-map', '[out]', '-f', 'null', '-']);
  const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=false,aresample=48000`;
  const raw = outWav.replace(/\.wav$/, '-raw.wav');
  ffmpeg([...inputs, '-filter_complex', graph(ln), '-map', '[out]', '-ac', '2', '-c:a', 'pcm_s16le', raw]);
  // loudnorm tends to land ~1 LU short: finish with a static gain to hit -16 LUFS (peaks stay below -1 dBTP).
  const gain = Math.min(-16 - loudness(raw), 3);
  ffmpeg(['-i', raw, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false`, '-c:a', 'pcm_s16le', outWav]);
  return outWav;
}
// Runs the first loudnorm pass and returns its measurements (printed as JSON on stderr).
function loudnormStats(args) {
  const r = spawnSync('ffmpeg', args, { windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr.slice(-800));
  const m = r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!m) throw new Error('loudnorm measurement failed');
  return JSON.parse(m[m.length - 1]);
}

// Integrated loudness of a file (LUFS), for the report.
function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const m = r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g);
  return m ? parseFloat(m[m.length - 1].replace(/[^\d.-]/g, '')) : null;
}

function samples() {
  const out = path.join(__dirname, 'samples');
  fs.mkdirSync(out, { recursive: true });
  for (const voice of ['Julie', 'Paul']) {
    const [wav] = synthesize([LINES[0]], voice, path.join(os.tmpdir(), 'pixelqg-voice-sample-' + voice.toLowerCase()));
    const mp3 = path.join(out, `voix-${voice.toLowerCase()}.mp3`);
    ffmpeg(['-i', wav, '-af', 'aresample=44100,adelay=300|300,apad=whole_dur=5,atrim=0:5,loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
    console.log(`${path.relative(path.join(__dirname, '..'), mp3)}  ${wavDuration(wav).toFixed(2)} s spoken`);
  }
}

module.exports = { DEFAULT_VOICE, LINES, buildVoiceTrack, mixAudio, loudness, fullVoiceName };

if (require.main === module) {
  if (process.argv.includes('--samples')) samples();
  else if (process.argv.includes('--list')) execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    "Add-Type -AssemblyName System.Runtime.WindowsRuntime; $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]; [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like 'fr*' } | ForEach-Object { $_.DisplayName }"],
    { stdio: 'inherit', windowsHide: true });
  else console.log('Usage: node video-src/voiceover.js --samples | --list');
}
