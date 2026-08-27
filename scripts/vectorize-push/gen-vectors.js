#!/usr/bin/env node
/**
 * 批量生成条款向量：本地 bge-m3-lab Worker（wrangler dev --remote --port 8799）
 * 文本构造：《中文法规名》\n<印尼语正文，截断 6000 字符>
 * 输出 vectors.ndjson：{"id","values":[...],"metadata":{"law_id","pasal"}}
 * 断点续跑：已写入 ndjson 的 id 会跳过。
 */
const fs = require("fs");
const path = require("path");

const ENDPOINT = "http://127.0.0.1:8799";
const MODEL = "@cf/baai/bge-m3";
const BATCH = 40;
const MAX_CHARS = 6000;

async function embedBatch(texts) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, texts }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (!Array.isArray(j.data) || j.data.length !== texts.length)
        throw new Error(`bad response shape: data=${j.data && j.data.length}`);
      return j.data;
    } catch (e) {
      console.warn(`  ! 批次失败(第${attempt + 1}次): ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error("批次重试 3 次仍失败");
}

async function main() {
  const dir = __dirname;
  const rows = JSON.parse(fs.readFileSync(path.join(dir, "articles.json"), "utf8"));
  const outPath = path.join(dir, "vectors.ndjson");

  const done = new Set();
  if (fs.existsSync(outPath)) {
    for (const line of fs.readFileSync(outPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { done.add(JSON.parse(line).id); } catch {}
    }
  }
  const todo = rows.filter((r) => !done.has(r.id));
  console.log(`总数 ${rows.length}，已完成 ${done.size}，待处理 ${todo.length}`);
  if (!todo.length) return;

  const out = fs.createWriteStream(outPath, { flags: "a" });
  let processed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map((r) =>
      `${r.zh_title || ""}\n${(r.content || "").slice(0, MAX_CHARS)}`
    );
    const vectors = await embedBatch(texts);
    for (let k = 0; k < batch.length; k++) {
      out.write(
        JSON.stringify({
          id: batch[k].id,
          values: vectors[k],
          metadata: { law_id: batch[k].law_id, pasal: batch[k].pasal || "" },
        }) + "\n"
      );
    }
    processed += batch.length;
    console.log(`[${done.size + processed}/${rows.length}] 批次 ${Math.floor(i / BATCH) + 1} OK`);
  }
  out.end();
  console.log("完成 ->", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
