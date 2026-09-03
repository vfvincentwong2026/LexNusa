#!/usr/bin/env node
/**
 * 为回填条款补生成 bge-m3 向量并输出 ndjson + vector_meta SQL。
 * 输入：out/filled_ids.json + out/parsed_*.json + ../ingest-pasal-id/core-regulations.json
 * 文本构造与现有库一致：《中文法规名》\n<正文截断6000>
 * 需要 bge-m3-lab worker 运行在 127.0.0.1:8799（wrangler dev --remote --port 8799）
 */
const fs = require("fs");

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
  // 用法：node gen-vectors-fill.js [filled_ids.json] [vectors_out.ndjson] [vector_meta_out.sql]
  const IDS_FILE = process.argv[2] || "filled_ids.json";
  const NDJSON_OUT = process.argv[3] || "vectors_fill.ndjson";
  const META_SQL_OUT = process.argv[4] || "vector_meta_fill.sql";
  const filledIds = JSON.parse(fs.readFileSync(`out/${IDS_FILE}`, "utf8"));
  const coreRegs = JSON.parse(
    fs.readFileSync("../ingest-pasal-id/core-regulations.json", "utf8")
  );
  const zhByUri = {};
  for (const r of coreRegs) {
    const parts = r.frbr_uri.replace(/^\//, "").split("/");
    zhByUri[parts.slice(3).join("_")] = r.zh_title;
  }

  // 组装待向量化条款
  const items = [];
  const parsedCache = {};
  for (const id of filledIds) {
    const lawId = id.replace(/_pasal_.*$/, "");
    const pasal = id.split("_pasal_")[1].replace(/_a\d+$/, "");
    if (!parsedCache[lawId]) {
      const p = `out/parsed_${lawId}.json`;
      const raw = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
      // id 中的 pasal 是小写化的（"2A" -> "2a"），建小写键索引
      const lower = {};
      for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase()] = v;
      parsedCache[lawId] = lower;
    }
    const content = parsedCache[lawId][pasal] || parsedCache[lawId][pasal.replace(/_\d+$/, "")];
    if (!content) { console.warn("无正文:", id); continue; }
    items.push({ id, law_id: lawId, pasal, content, zh_title: zhByUri[lawId] || "" });
  }
  console.log("待向量化:", items.length);

  // 断点续跑
  const outPath = "out/" + NDJSON_OUT;
  const done = new Set();
  if (fs.existsSync(outPath)) {
    for (const line of fs.readFileSync(outPath, "utf8").split("\n")) {
      if (line.trim()) { try { done.add(JSON.parse(line).id); } catch {} }
    }
  }
  const todo = items.filter((x) => !done.has(x.id));
  console.log("已完成:", done.size, "待处理:", todo.length);

  const out = fs.createWriteStream(outPath, { flags: "a" });
  const metaSql = fs.createWriteStream("out/" + META_SQL_OUT, { flags: "a" });
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map((r) => `${r.zh_title}\n${r.content.slice(0, MAX_CHARS)}`);
    const vectors = await embedBatch(texts);
    for (let k = 0; k < batch.length; k++) {
      const r = batch[k];
      out.write(JSON.stringify({ id: r.id, values: vectors[k], metadata: { law_id: r.law_id, pasal: r.pasal } }) + "\n");
      const chunk = texts[k].slice(0, 500).replace(/'/g, "''").replace(/\n/g, " ");
      metaSql.write(
        `INSERT OR IGNORE INTO vector_meta (id, node_id, chunk_text, vectorize_index, embedding_model) VALUES ('vm_${r.id}', '${r.id}', '${chunk}', 'lexnusa-vectors', 'bge-m3');\n`
      );
    }
    console.log(`[${done.size + i + batch.length}/${items.length}] OK`);
  }
  out.end(); metaSql.end();
  console.log("完成 ->", outPath);
})().catch((e) => { console.error(e); process.exit(1); });
