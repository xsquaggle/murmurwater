// Decode every voice file in headless Chromium (the game's runtime) and report what the browser hears.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../../../public'));
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.json') ? 'application/json' : p.endsWith('.mp3') ? 'audio/mpeg' : 'text/html' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((ok) => srv.listen(0, ok)); const port = srv.address().port;
  const b = await chromium.launch(); const pg = await b.newPage(); await pg.goto(`http://127.0.0.1:${port}/audio/voice/voiced.json`);
  const res = await pg.evaluate(async () => {
    const v = await (await fetch('/audio/voice/voiced.json')).json(); const ac = new OfflineAudioContext(1, 44100, 44100); const out = [];
    for (const k of Object.keys(v)) {
      const r = await fetch(`/audio/voice/${k}.mp3`); if (!r.ok) { out.push({ k, err: r.status }); continue; }
      try {
        const buf = await ac.decodeAudioData(await r.arrayBuffer()); const x = buf.getChannelData(0); const thr = Math.pow(10, -45 / 20); let a = 0, z = x.length - 1, pk = 0;
        while (a < x.length && Math.abs(x[a]) < thr) a++; while (z > 0 && Math.abs(x[z]) < thr) z--; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
        out.push({ k, ch: buf.numberOfChannels, sr: buf.sampleRate, dur: +buf.duration.toFixed(2), lead: +(a / buf.sampleRate).toFixed(3), tail: +((x.length - 1 - z) / buf.sampleRate).toFixed(3), peak: +(20 * Math.log10(pk)).toFixed(1) });
      } catch (e) { out.push({ k, err: String(e) }); }
    }
    return out;
  });
  const bad = res.filter((r) => r.err || r.lead >= 0.15 || r.tail >= 0.15 || r.ch !== 1);
  console.log('decoded', res.filter((r) => !r.err).length, 'of', res.length, '| lead max', Math.max(...res.map((r) => r.lead || 0)), '| tail max', Math.max(...res.map((r) => r.tail || 0)), '| peak max', Math.max(...res.map((r) => r.peak ?? -99)), '| total s', res.reduce((s, r) => s + (r.dur || 0), 0).toFixed(1));
  console.log('problems', JSON.stringify(bad)); await b.close(); srv.close();
})();
