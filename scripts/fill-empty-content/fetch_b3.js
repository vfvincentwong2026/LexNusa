// 批量抓取 id.wikisource 转录页，断点续传
// 用法: node fetch_b3.js <from> <to> <outfile> [pdfname]
const fs = require('fs');
const FROM = parseInt(process.argv[2] || '223', 10);
const TO = parseInt(process.argv[3] || '334', 10);
const OUT = process.argv[4] || 'C:/Users/夏夜/AppData/Local/Temp/kuhper_b3_pages.json';
const PDF = process.argv[5] || 'KUHPerdata.pdf';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchBatch(nums) {
  const titles = nums.map(n => `Halaman:${PDF}/${n}`).join('|');
  const url = `https://id.wikisource.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=revisions&rvprop=content&rvslots=main&format=json&maxlag=5`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'LexNusa-ingest/1.0 (legal research; contact: vfvincentwong@gmail.com)' } });
      const text = await res.text();
      if (!text.startsWith('{')) {
        console.error(`non-JSON (rate limit?), waiting 15s: ${text.slice(0, 60)}`);
        await sleep(15000);
        continue;
      }
      const d = JSON.parse(text);
      const result = {};
      for (const k of Object.keys(d.query.pages)) {
        const p = d.query.pages[k];
        const m = p.title.match(/\/(\d+)$/);
        if (!m) continue;
        result[parseInt(m[1], 10)] = (p.revisions && p.revisions[0]) ? p.revisions[0].slots.main['*'] : null;
      }
      return result;
    } catch (e) {
      console.error(`batch attempt ${attempt + 1} failed: ${e.message}`);
      await sleep(8000);
    }
  }
  return null;
}

(async () => {
  let out = {};
  if (fs.existsSync(OUT)) out = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const need = [];
  for (let n = FROM; n <= TO; n++) if (!out[n]) need.push(n);
  console.log(`already have ${Object.keys(out).length}, need ${need.length}`);
  const BATCH = 30;
  for (let i = 0; i < need.length; i += BATCH) {
    const chunk = need.slice(i, i + BATCH);
    const r = await fetchBatch(chunk);
    if (!r) { console.error(`chunk ${chunk[0]}-${chunk[chunk.length - 1]} FAILED permanently`); continue; }
    Object.assign(out, r);
    console.log(`got ${chunk[0]}-${chunk[chunk.length - 1]}, total ${Object.keys(out).length}`);
    fs.writeFileSync(OUT, JSON.stringify(out));
    await sleep(3000);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  const missing = [];
  for (let n = FROM; n <= TO; n++) if (!out[n]) missing.push(n);
  console.log('done. total:', Object.keys(out).length, 'missing:', missing.join(',') || 'none');
})();
