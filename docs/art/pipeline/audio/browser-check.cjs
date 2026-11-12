// Decode every music and sound-effect file in headless Chromium (the game's runtime) and report what the browser gets:
// channels, sample rate, exact length in samples (loops must keep theirs), peak.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../../../public'));
const list = []; for (const d of ['audio/music', 'audio/sfx']) for (const f of fs.readdirSync(path.join(root, d)).sort()) if (f.endsWith('.ogg') || f.endsWith('.mp3')) list.push(`${d}/${f}`);
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.ogg') ? 'audio/ogg' : p.endsWith('.mp3') ? 'audio/mpeg' : 'text/html' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((ok) => srv.listen(0, ok)); const port = srv.address().port;
  const b = await chromium.launch(); const pg = await b.newPage(); await pg.goto(`http://127.0.0.1:${port}/nothing`);
  const res = await pg.evaluate(async (files) => {
    const ac = new OfflineAudioContext(2, 44100, 44100); const out = [];
    for (const k of files) {
      try {
        const buf = await ac.decodeAudioData(await (await fetch('/' + k)).arrayBuffer()); let pk = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) { const x = buf.getChannelData(c); for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i])); }
        out.push({ k, ch: buf.numberOfChannels, sr: buf.sampleRate, n: buf.length, s: +(buf.length / buf.sampleRate).toFixed(3), peak: +(20 * Math.log10(pk)).toFixed(1) });
      } catch (e) { out.push({ k, err: String(e) }); }
    }
    return out;
  }, list);
  for (const r of res) console.log(r.err ? `${r.k} ERROR ${r.err}` : `${r.k} ch${r.ch} ${r.sr} Hz ${r.n} samples ${r.s} s peak ${r.peak}`);
  console.log('decoded', res.filter((r) => !r.err).length, 'of', res.length); await b.close(); srv.close();
})();
