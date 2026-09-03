// 抓取 KUHDagang 全部子页面的 wikitext（只含 pages 标签，用于确定页范围与 section）
const fs = require('fs');
const OUT = 'C:/Users/夏夜/AppData/Local/Temp/kuhd_subpages.json';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TITLES = JSON.parse(fs.readFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhd_pages.json', 'utf8'))
  .query.allpages.map(p => p.title).filter(t => t !== 'Kitab Undang-Undang Hukum Dagang');

async function fetchBatch(titles) {
  const url = `https://id.wikisource.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=revisions&rvprop=content&rvslots=main&format=json&maxlag=5`;
  for (let a = 0; a < 5; a++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'LexNusa-ingest/1.0 (legal research)' } });
      const text = await res.text();
      if (!text.startsWith('{')) { await sleep(15000); continue; }
      const d = JSON.parse(text);
      const out = {};
      for (const k of Object.keys(d.query.pages)) {
        const p = d.query.pages[k];
        out[p.title] = (p.revisions && p.revisions[0]) ? p.revisions[0].slots.main['*'] : null;
      }
      return out;
    } catch (e) { console.error('retry:', e.message); await sleep(8000); }
  }
  return null;
}

(async () => {
  let out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const need = TITLES.filter(t => !out[t]);
  console.log('have', Object.keys(out).length, 'need', need.length);
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20);
    const r = await fetchBatch(chunk);
    if (r) Object.assign(out, r);
    fs.writeFileSync(OUT, JSON.stringify(out));
    console.log('got', chunk.length, 'total', Object.keys(out).length);
    await sleep(2000);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('done');
})();
