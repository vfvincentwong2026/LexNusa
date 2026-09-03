// 生成 KUHDagang 入库 SQL（法规节点 + 955 条款，长文本 hex 编码）
const fs = require('fs');
const A = JSON.parse(fs.readFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhd_articles.json', 'utf8'));
const OUTDIR = 'scripts/fill-empty-content/out/kuhd';
fs.mkdirSync(OUTDIR, { recursive: true });

const NOW = new Date().toISOString();
const FRBR = '/akn/id/act/stb/1847/23-dagang';
const sqlStr = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const sqlText = (v) => v == null ? 'NULL' : `CAST(x'${Buffer.from(v, 'utf8').toString('hex')}' AS TEXT)`;

// 法规节点
const lawMeta = {
  domain: '商事',
  type_name: 'Kitab Undang-Undang (法典)',
  source_url: 'https://id.wikisource.org/wiki/Kitab_Undang-Undang_Hukum_Dagang',
  content_source: 'id.wikisource.org',
  content_note: '印尼维基文库转录文本（公共领域）；Pasal 1-754，缺号 204、569-591（Bab VIII 未转录）、652 为源文本固有缺失',
  scope: 'full',
  missing_pasal: '204, 569-591, 652',
  filled_at: NOW,
};
const zhSummary = '荷兰殖民时期商法典（Staatsblad 1847年第23号，与民法典同日颁布），至今仍是印尼商事组织、票据（汇票/本票/支票）、海商法的核心。Pasal 1-754：第一编商事总论（公司形态、簿记、票据、保险），第二编海商法。与公司法和合同专家互补。';
const lawSql = `INSERT OR IGNORE INTO nodes (id, name, type, content, description, metadata, frbr_uri, status, number, year, zh_title, zh_summary) VALUES ('kuhdagang', 'Kitab Undang-Undang Hukum Dagang (Wetboek van Koophandel)', 'KUHDAGANG', NULL, ${sqlStr(zhSummary)}, ${sqlStr(JSON.stringify(lawMeta))}, '${FRBR}', 'berlaku', '23', 1847, '《印尼商法典》（Wetboek van Koophandel）', ${sqlStr(zhSummary)});`;
fs.writeFileSync(`${OUTDIR}/00_law.sql`, lawSql + '\n');

// 条款节点，分块 120 条/文件
const CHUNK = 120;
let files = 0;
for (let i = 0; i < A.length; i += CHUNK) {
  const chunk = A.slice(i, i + CHUNK);
  const lines = chunk.map((a, j) => {
    const idx = i + j + 1;
    const id = `kuhdagang_pasal_${String(a.pasal).toLowerCase()}`;
    const meta = {
      law_id: 'kuhdagang',
      pasal: String(a.pasal),
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

// 导出条款 id 清单
fs.writeFileSync('C:/Users/夏夜/AppData/Local/Temp/kuhd_ids.json', JSON.stringify(A.map(a => `kuhdagang_pasal_${String(a.pasal).toLowerCase()}`)));
