// 生成 KUHPerdata Buku Ketiga 入库 SQL（法规节点 + 707 条款，长文本 hex 编码）
const fs = require('fs');
const A = JSON.parse(fs.readFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhper_b3_articles.json', 'utf8'));
const OUTDIR = 'scripts/fill-empty-content/out/kuhper';
fs.mkdirSync(OUTDIR, { recursive: true });

const NOW = new Date().toISOString();
const FRBR = '/akn/id/act/stb/1847/23';
const sqlStr = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const sqlText = (v) => v == null ? 'NULL' : `CAST(x'${Buffer.from(v, 'utf8').toString('hex')}' AS TEXT)`;

// 法规节点
const lawMeta = {
  domain: '合同与民法',
  type_name: 'Kitab Undang-Undang (法典)',
  source_url: 'https://id.wikisource.org/wiki/Kitab_Undang-Undang_Hukum_Perdata',
  content_source: 'id.wikisource.org',
  content_note: '印尼维基文库转录文本（公共领域）；当前收录第三编《债法》Buku Ketiga: Perikatan, Pasal 1233–1864',
  scope: 'buku_3_perikatan',
  filled_at: NOW,
};
const zhSummary = '荷兰殖民时期民法典（Staatsblad 1847年第23号），至今仍是印尼合同法与债法的核心。当前收录第三编《债法》（Perikatan，Pasal 1233–1864）：含合同有效四要件（1320）、合同相对性（1340）、合同约束力（1338）、违约责任（1243）、买卖合同（1457起）等。';
const lawSql = `INSERT OR IGNORE INTO nodes (id, name, type, content, description, metadata, frbr_uri, status, number, year, zh_title, zh_summary) VALUES ('kuhperdata', 'Kitab Undang-Undang Hukum Perdata (Burgerlijk Wetboek)', 'KUHPERDATA', NULL, ${sqlStr(zhSummary)}, ${sqlStr(JSON.stringify(lawMeta))}, '${FRBR}', 'berlaku', '23', 1847, '《印尼民法典》（Burgerlijk Wetboek）', ${sqlStr(zhSummary)});`;
fs.writeFileSync(`${OUTDIR}/00_law.sql`, lawSql + '\n');

// 条款节点，分块 120 条/文件
const CHUNK = 120;
let files = 0;
for (let i = 0; i < A.length; i += CHUNK) {
  const chunk = A.slice(i, i + CHUNK);
  const lines = chunk.map((a, j) => {
    const idx = i + j + 1;
    const id = `kuhperdata_pasal_${String(a.pasal).toLowerCase()}`;
    const meta = {
      law_id: 'kuhperdata',
      pasal: String(a.pasal),
      buku: 'Ketiga — Perikatan',
      sort_order: idx,
      content_source: 'id.wikisource.org',
      content_note: '维基文库转录文本（公共领域）',
      filled_at: NOW,
    };
    return `INSERT OR IGNORE INTO nodes (id, name, type, content, description, metadata, frbr_uri, status, number, year, zh_title, zh_summary) VALUES ('${id}', 'Pasal ${a.pasal}', 'ARTICLE', ${sqlText(a.text)}, NULL, ${sqlStr(JSON.stringify(meta))}, '${FRBR}#pasal-${a.pasal}', 'berlaku', NULL, NULL, NULL, NULL);`;
  });
  fs.writeFileSync(`${OUTDIR}/articles_${String(files).padStart(2, '0')}.sql`, lines.join('\n') + '\n');
  files++;
}
console.log('law sql +', files, 'article chunk files;', A.length, 'articles');

// 同时导出条款 id 清单向量化用
fs.writeFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhper_b3_ids.json', JSON.stringify(A.map(a => `kuhperdata_pasal_${String(a.pasal).toLowerCase()}`)));
