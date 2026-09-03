#!/usr/bin/env node
// 为 KUHDagang 955 条款生成 bge-m3 向量（断点续跑）
const fs = require("fs");

const ENDPOINT = "http://127.0.0.1:8799";
const MODEL = "@cf/baai/bge-m3";
const BATCH = 40;
const MAX_CHARS = 6000;
const ZH = "《印尼商法典》（Wetboek van Koophandel）";

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
        throw new Error("bad response shape");
      return j.data;
    } catch (e) {
      console.warn(`  ! 批次失败(第${attempt + 1}次): ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error("批次重试 3 次仍失败");
}

(async () => {
  const arts = JSON.parse(fs.readFileSync("C:/Users/夏夜/AppData/Local/Temp/kuhd_articles.json", "utf8"));
  const items = arts.map(a => ({
    id: `kuhdagang_pasal_${String(a.pasal).toLowerCase()}`,
    pasal: String(a.pasal),
    content: a.text,
  }));
  console.log("待向量化:", items.length);

  const outPath = "out/vectors_kuhd.ndjson";
  const done = new Set();
  if (fs.existsSync(outPath)) {
    for (const line of fs.readFileSync(outPath, "utf8").split("\n")) {
      if (line.trim()) { try { done.add(JSON.parse(line).id); } catch {} }
    }
  }
  const todo = items.filter(x => !done.has(x.id));
  console.log("已完成:", done.size, "待处理:", todo.length);

  const out = fs.createWriteStream(outPath, { flags: "a" });
  const metaSql = fs.createWriteStream("out/vector_meta_kuhd.sql", { flags: "a" });
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map(r => `${ZH}\n${r.content.slice(0, MAX_CHARS)}`);
    const vectors = await embedBatch(texts);
    for (let k = 0; k < batch.length; k++) {
      const r = batch[k];
      out.write(JSON.stringify({ id: r.id, values: vectors[k], metadata: { law_id: "kuhdagang", pasal: r.pasal } }) + "\n");
      const chunk = texts[k].slice(0, 500).replace(/'/g, "''").replace(/\n/g, " ");
      metaSql.write(`INSERT OR IGNORE INTO vector_meta (id, node_id, chunk_text, vectorize_index, embedding_model) VALUES ('vm_${r.id}', '${r.id}', '${chunk}', 'lexnusa-vectors', 'bge-m3');\n`);
    }
    console.log(`[${done.size + i + batch.length}/${items.length}] OK`);
  }
  out.end(); metaSql.end();
  console.log("完成 ->", outPath);
})().catch(e => { console.error(e); process.exit(1); });
