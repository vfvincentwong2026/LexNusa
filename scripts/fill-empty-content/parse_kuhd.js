// KUHDagang 解析器 v2：修复 Bagian/Sub 数字行误匹配 + 转录页跨页拼接
const fs = require('fs');
const SUB = JSON.parse(fs.readFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhd_subpages.json', 'utf8'));
const TRANS = JSON.parse(fs.readFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhd_pages_1_3.json', 'utf8'));

function clean(t) {
  return t
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const articles = {};
const order = [];
let current = null;
let dupes = [];

function startArticle(n) {
  n = String(n);
  current = n;
  if (articles[n] !== undefined) { dupes.push(n); return; }
  articles[n] = '';
  order.push(n);
}
function append(text) {
  if (current == null) return;
  const t = clean(text);
  if (!t) return;
  articles[current] = articles[current] ? articles[current] + ' ' + t : t;
}

// ---------- 1. 转录页：front(Pasal 1) + b1b1(Pasal 2-5) + b1b2跨页(Pasal 6-13) ----------
// 拼接三页全文
const allTrans = [TRANS['1'], TRANS['2'], TRANS['3']].join('\n');

// front section: Pasal 1
{
  const b = allTrans.indexOf('<section begin="front" />');
  const e = allTrans.indexOf('<section end="front" />');
  if (b >= 0 && e > b) parseTranscriptionSection(allTrans.slice(b, e));
}

// b1b1: Pasal 2-5
{
  const b = allTrans.indexOf('<section begin="b1b1" />');
  const e = allTrans.indexOf('<section end="b1b1" />');
  if (b >= 0 && e > b) parseTranscriptionSection(allTrans.slice(b, e));
}

// b1b2: 跨页 = page1[begin→页尾] + page2[全部] + page3[begin→end]
{
  let b1b2 = '';
  // page 1: b1b2 begin → 页尾
  const p1b = TRANS['1'].indexOf('<section begin="b1b2" />');
  if (p1b >= 0) b1b2 += TRANS['1'].slice(p1b);
  // page 2: 整页（无 section 标记）
  b1b2 += '\n' + TRANS['2'];
  // page 3: b1b2 begin → end
  const p3b = TRANS['3'].indexOf('<section begin="b1b2" />');
  const p3e = TRANS['3'].indexOf('<section end="b1b2" />');
  if (p3b >= 0 && p3e > p3b) b1b2 += '\n' + TRANS['3'].slice(p3b, p3e + '<section end="b1b2" />'.length);
  parseTranscriptionSection(b1b2);
}

function parseTranscriptionSection(text) {
  const tplRe = /\{\{(?:c|center)\|(.+?)\}\}/gs;
  let lastIdx = 0;
  let m;
  while ((m = tplRe.exec(text))) {
    if (m.index > lastIdx) append(text.slice(lastIdx, m.index));
    const inner = clean(m[1]);
    const pm = inner.match(/^Pasal\s+(\d+[a-z]*)\s*'*$/i);
    if (pm) startArticle(pm[1]);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) append(text.slice(lastIdx));
}

console.log('from transcription:', order.length, 'articles, first:', order[0], 'last:', order[order.length - 1]);

// ---------- 2. inline wiki 页面 ----------
const INLINE_PAGES = [
  'Buku Kesatu/Bab III',
  'Buku Kesatu/Bab IV',
  'Buku Kesatu/Bab V',
  'Buku Kesatu/Bab VI',
  'Buku Kesatu/Bab VII',
  'Buku Kesatu/Bab VIII',
  'Buku Kesatu/Bab IX',
  'Buku Kesatu/Bab X',
  'Buku Kedua/Ketentuan Umum',
  'Buku Kedua/Bab I',
  'Buku Kedua/Bab II',
  'Buku Kedua/Bab III',
  'Buku Kedua/Bab IV',
  'Buku Kedua/Bab V',
  'Buku Kedua/Bab V-A',
  'Buku Kedua/Bab V-B',
  'Buku Kedua/Bab VI',
  'Buku Kedua/Bab VII',
  'Buku Kedua/Bab IX',
  'Buku Kedua/Bab X',
  'Buku Kedua/Bab XI',
  'Buku Kedua/Bab XII',
  'Buku Kedua/Bab XIII',
];

for (const suffix of INLINE_PAGES) {
  const title = 'Kitab Undang-Undang Hukum Dagang/' + suffix;
  const wt = SUB[title];
  if (!wt) { console.error('MISSING:', suffix); continue; }
  current = null;  // 页面边界重置，防止跨页标题混入上一条款

  let body = wt;
  const headerEnd = body.indexOf('}}', body.indexOf('{{header'));
  if (headerEnd >= 0) body = body.slice(headerEnd + 2);

  body = body
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  const lines = body.split('\n');
  let pageCount = 0;
  let prevLine = '';

  for (let li = 0; li < lines.length; li++) {
    const t = lines[li].trim();
    if (!t) { prevLine = ''; continue; }

    // "Pasal\nN" 跨行：当前行是纯 "Pasal"
    if (/^Pasal\s*$/i.test(t)) { prevLine = 'Pasal'; continue; }

    // "Pasal N" 同行
    const pm2 = t.match(/^Pasal\s+(\d+[a-z]?)\s*$/i);
    if (pm2) { startArticle(pm2[1]); pageCount++; prevLine = ''; continue; }

    // 纯数字行：只有前一行是 "Pasal" 才视为条款编号
    if (/^(\d+[a-z]?)\s*$/.test(t) && prevLine === 'Pasal') {
      startArticle(t); pageCount++; prevLine = ''; continue;
    }

    // Bagian/Bab/Sub 标题行不追加
    if (/^(Bagian|BAB|BUKU|Bab|Buku|Sub)\s/i.test(t)) { prevLine = t; continue; }
    // 纯数字行（非 Pasal 后跟）跳过
    if (/^(\d+[a-z]?)\s*$/.test(t)) { prevLine = t; continue; }
    // 全大写标题行跳过
    if (/^[A-Z\s\-,'()\.:;]+$/.test(t) && t.length > 5 && t.length < 200) { prevLine = t; continue; }

    append(t);
    prevLine = t;
  }
  if (pageCount) console.log(`${suffix}: +${pageCount}`);
}

console.log('\ntotal articles:', order.length, 'dupes:', dupes.join(',') || 'none');

// 排序
function sortKey(p) {
  const m = String(p).match(/^(\d+)([a-z]?)$/i);
  if (!m) { console.error('ODD KEY:', JSON.stringify(p)); return [99999, p]; }
  return [parseInt(m[1], 10), (m[2] || '').toLowerCase()];
}
order.sort((a, b) => {
  const ka = sortKey(a), kb = sortKey(b);
  return ka[0] - kb[0] || (ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0);
});

console.log('first:', order[0], 'last:', order[order.length - 1]);

// 缺号检查
const have = new Set(order.map(p => sortKey(p)[0]));
const gaps = [];
for (let n = 1; n <= 754; n++) if (!have.has(n)) gaps.push(n);
console.log('missing base numbers:', gaps.join(',') || 'none');

// 空条款
const empty = order.filter(n => !articles[n] || articles[n].length < 10);
console.log('empty/short articles:', empty.join(',') || 'none');

// 尾部清理：Pasal 754 的 "TAHUN 1847 NOMOR 23"
if (articles['754']) {
  articles['754'] = articles['754'].replace(/\s*TAHUN 1847 NOMOR 23\s*$/, '');
}

// 写出
const result = order.map(n => ({ pasal: n, text: articles[n] }));
fs.writeFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhd_articles.json', JSON.stringify(result, null, 1));

// 抽查
for (const n of ['1', '6', '12', '17', '100', '309', '466', '754']) {
  if (articles[n]) console.log(`\n--- Pasal ${n} ---\n${articles[n].slice(0, 200)}`);
}
