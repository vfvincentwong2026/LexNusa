#!/usr/bin/env node
/** 第二轮回填：PP 36/2021 + PP 34/2021（peraturan.go.id bt 版 PDF，带文本层）
 *  content_note 按法规实际状态：diubah -> 原始条文，本法已被修订；berlaku -> 官方原文
 */
const fs = require("fs");

const FILLED_AT = new Date().toISOString().slice(0, 10);
const NOTE_BY_LAW = {
  pp_2021_36: "原始条文，本法已被修订", // PP 36/2021 已被 PP 51/2023 修订
  pp_2021_34: "官方原文（peraturan.go.id）", // PP 34/2021 现行有效
};

const emptyList = JSON.parse(fs.readFileSync("out/empty_articles.json", "utf8"));
const hexText = (s) => `CAST(x'${Buffer.from(s.replace(/\r\n|\r/g, "\n"), "utf8").toString("hex")}' AS TEXT)`;

const statements = [];
const filledIds = [];
for (const row of emptyList) {
  const { id, law_id, pasal } = row;
  if (!NOTE_BY_LAW[law_id]) continue;
  const parsed = JSON.parse(fs.readFileSync(`out/parsed_${law_id}.json`, "utf8"));
  const content = parsed[String(pasal)];
  if (!content || content.length < 30 || content.length > 30000) continue;
  statements.push(
    `UPDATE nodes SET content = ${hexText(content)}, ` +
      `metadata = json_set(metadata, '$.content_source', 'peraturan.go.id', '$.content_note', '${NOTE_BY_LAW[law_id]}', '$.filled_at', '${FILLED_AT}'), ` +
      `updated_at = CURRENT_TIMESTAMP ` +
      `WHERE id = '${id.replace(/'/g, "''")}' AND (content IS NULL OR length(trim(content)) = 0);`
  );
  filledIds.push(id);
}
fs.writeFileSync("out/fill2.sql", statements.join("\n") + "\n");
fs.writeFileSync("out/filled2_ids.json", JSON.stringify(filledIds));
console.log("回填条数:", statements.length, "| pp36:", filledIds.filter((x) => x.startsWith("pp_2021_36")).length, "| pp34:", filledIds.filter((x) => x.startsWith("pp_2021_34")).length);
