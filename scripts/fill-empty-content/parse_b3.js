// 解析 KUHPerdata Buku Ketiga 转录页 -> 条款数组（v2：同时支持 PUU-pasal 模板与 {{c|'''Pasal N'''}} 标题格式）
const fs = require('fs');
const PAGES = JSON.parse(fs.readFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhper_b3_pages.json', 'utf8'));

let all = '';
for (let n = 223; n <= 334; n++) all += (PAGES[n] || '') + '\n';

const beginMark = '<section begin="b3" />';
const endMark = '<section end="b3" />';
const bi = all.indexOf(beginMark);
const ei = all.lastIndexOf(endMark);
let body = all.slice(bi + beginMark.length, ei);

function clean(t) {
  return t
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/^[#*:]+\s*/gm, '')   // 列表标记
    .replace(/\s+/g, ' ')
    .trim();
}

// 顶层模板扫描，带位置
function scanTopLevel(s) {
  const events = []; // {type:'tpl'|'text', start, end, content}
  let i = 0, depth = 0, start = -1, lastTextStart = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (two === '{{') {
      if (depth === 0) {
        if (i > lastTextStart) events.push({ type: 'text', content: s.slice(lastTextStart, i) });
        start = i;
      }
      depth++; i += 2; continue;
    }
    if (two === '}}') {
      depth--;
      if (depth === 0 && start >= 0) { events.push({ type: 'tpl', content: s.slice(start, i + 2) }); start = -1; lastTextStart = i + 2; }
      i += 2; continue;
    }
    i++;
  }
  if (lastTextStart < s.length) events.push({ type: 'text', content: s.slice(lastTextStart) });
  return events;
}

// 拆分模板顶层参数
function splitParams(rest) {
  const parts = [];
  let depth = 0, cur = '', i = 0;
  while (i < rest.length) {
    if (rest[i] === '{' && rest[i + 1] === '{') { depth++; cur += '{{'; i += 2; continue; }
    if (rest[i] === '}' && rest[i + 1] === '}') { depth--; cur += '}}'; i += 2; continue; }
    if (rest[i] === '|' && depth === 0) { parts.push(cur); cur = ''; i++; continue; }
    cur += rest[i]; i++;
  }
  parts.push(cur);
  return parts;
}

const events = scanTopLevel(body);
console.log('events:', events.length);

const articles = {};
const order = [];
let current = null;
let dupes = [];
const emptyPasal = [];

// 转录笔误修正：第三编范围内的孤立 "Pasal 137"（位于 1372 之后）实为 1373
const REMAP = { '137': '1375' };

function startArticle(n) {
  if (REMAP[n]) n = REMAP[n];
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

// 排序键：数字部分 + 字母后缀
function sortKey(p) {
  const m = String(p).match(/^(\d+)\s*([a-z]*)$/i);
  if (!m) { console.error('ODD PASAL KEY:', JSON.stringify(p)); return [99999, String(p)]; }
  return [parseInt(m[1], 10), (m[2] || '').toLowerCase()];
}

for (const ev of events) {
  if (ev.type === 'text') { append(ev.content); continue; }
  const inner = ev.content.slice(2, -2);
  const pipeIdx = inner.indexOf('|');
  const name = (pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner).trim();
  if (name.toLowerCase() === 'puu-pasal') {
    const parts = splitParams(inner.slice(pipeIdx + 1));
    const head = parts[0] || '';
    if (/^\s*pasal\s*=\s*$/.test(head)) {
      append(parts.slice(1).join('|'));  // 空 pasal= 参数 = 续段
    } else if (/^\s*pasal\s*=\s*\d+[a-z]*\s*$/i.test(head)) {
      const p = head.split('=')[1].trim();
      startArticle(p);
      const rest = parts.slice(1).join('|');
      if (clean(rest)) append(rest); else emptyPasal.push(p);
    } else if (/^\s*pasal\s*=\s*\d+[a-z]*$/i.test(head.trim())) {
      const p = head.split('=')[1].trim();
      startArticle(p);
      append(parts.slice(1).join('|'));
    } else {
      append(parts.join('|'));  // 续段
    }
  } else if (name.toLowerCase() === 'c') {
    const txt = clean(inner.slice(pipeIdx + 1));
    const m = txt.match(/^Pasal\s+(\d+[a-z]*)\s*'*$/i);
    if (m) startArticle(m[1]);
  }
}

// 按 sortKey 排序
order.sort((a, b) => {
  const ka = sortKey(a), kb = sortKey(b);
  return ka[0] - kb[0] || (ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0);
});

console.log('articles parsed:', order.length, 'dupes:', dupes.join(',') || 'none');
console.log('empty-template pasal (likely repealed):', emptyPasal.join(',') || 'none');
console.log('first:', order[0], 'last:', order[order.length - 1]);
// 真缺口检查：1233..1864 每个整数，既无整数键也无其字母变体则缺失
const have = new Set(order);
const haveNum = new Set(order.map(p => sortKey(p)[0]));
const gaps = [];
for (let n = 1233; n <= 1864; n++) if (!haveNum.has(n)) gaps.push(n);
console.log('truly missing base numbers:', gaps.join(',') || 'none');

const empty = order.filter(n => !articles[n] || articles[n].length < 10);
console.log('empty/short articles:', empty.join(',') || 'none');

const result = order.map(n => ({ pasal: n, text: articles[n] }));
fs.writeFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhper_b3_articles.json', JSON.stringify(result, null, 1));
for (const n of ['1233', '1320', '1338', '1457', '1603a', '1864']) {
  if (articles[n]) console.log(`\n--- Pasal ${n} ---\n${articles[n].slice(0, 250)}`);
}
