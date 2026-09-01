#!/usr/bin/env node
/**
 * 生成空条款回填 SQL：只 UPDATE content 为空的条款，绝不覆盖已有正文。
 * 正文用 CAST(x'hex' AS TEXT) 单行编码；metadata 用 json_set 打标。
 * 输出 out/fill.sql + out/fill_partNN.sql（每块 600 条）
 */
const fs = require("fs");

const FILLED_AT = new Date().toISOString().slice(0, 10);
const SKIP_LAWS = new Set(["uu_2023_6", "uu_2020_3", "uu_2021_7"]); // 选择性修订法：条文碎片，不填

const emptyList = JSON.parse(fs.readFileSync("out/empty_articles.json", "utf8"));
const sqlEscape = (s) => s.replace(/'/g, "''");
const hexText = (s) => `CAST(x'${Buffer.from(s.replace(/\r\n|\r/g, "\n"), "utf8").toString("hex")}' AS TEXT)`;

const statements = [];
const stats = {};
const filledIds = [];

for (const row of emptyList) {
  const { id, law_id, pasal } = row;
  if (SKIP_LAWS.has(law_id)) continue;
  const parsedPath = `out/parsed_${law_id}.json`;
  if (!fs.existsSync(parsedPath)) continue;
  const parsed = JSON.parse(fs.readFileSync(parsedPath, "utf8"));
  const content = parsed[String(pasal)];
  if (!content || content.length < 30 || content.length > 30000) continue;
  if (/PENJELASAN|MEMUTUSKAN/.test(content.slice(0, 200))) continue; //  sanity：正文不应含结构词

  statements.push(
    `UPDATE nodes SET content = ${hexText(content)}, ` +
      `metadata = json_set(metadata, '$.content_source', 'peraturan.go.id', '$.content_note', '原始条文，本法已被修订', '$.filled_at', '${FILLED_AT}'), ` +
      `updated_at = CURRENT_TIMESTAMP ` +
      `WHERE id = '${sqlEscape(id)}' AND (content IS NULL OR length(trim(content)) = 0);`
  );
  stats[law_id] = (stats[law_id] || 0) + 1;
  filledIds.push(id);
}

fs.writeFileSync("out/fill.sql", statements.join("\n") + "\n");
fs.writeFileSync("out/filled_ids.json", JSON.stringify(filledIds));
const CH = 600;
for (let i = 0, n = 0; i < statements.length; i += CH, n++) {
  fs.writeFileSync(`out/fill_part${String(n).padStart(2, "0")}.sql`, statements.slice(i, i + CH).join("\n") + "\n");
}
console.log("总回填条数:", statements.length);
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(" ", k, v);
