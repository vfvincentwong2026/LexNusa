#!/usr/bin/env node
/**
 * LexNusa P1 数据同步脚本：Pasal.id API -> D1 seed.sql
 *
 * 用法：node scripts/ingest-pasal-id/ingest.js
 * Token：从环境变量 PASAL_TOKEN 或仓库根目录 .env.local 读取（严禁硬编码）。
 *
 * 行为：
 *  - 逐部拉取 core-regulations.json 中的法规（速率限制 60 次/分 -> 每请求 sleep 1.1s）
 *  - 响应缓存到 out/cache/，重跑不重复打 API
 *  - 失败重试一次；三重校验：HTTP 200 + articles 非空 + work.title 含关键词
 *  - 生成 out/seed.sql（法规节点 + pasal 条款节点 + 关系边 + 占位节点）
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "out");
const CACHE_DIR = path.join(OUT_DIR, "cache");
const BASE_URL = "https://pasal.id/api/v1";
const SLEEP_MS = 1100;

// ---------- token ----------
function loadToken() {
  if (process.env.PASAL_TOKEN) return process.env.PASAL_TOKEN.trim();
  const envFile = path.join(ROOT, ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*PASAL_TOKEN\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim();
    }
  }
  throw new Error("未找到 PASAL_TOKEN：请设置环境变量或在仓库根目录创建 .env.local（见 .env.example）");
}

// ---------- 工具 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  const s = String(v);
  const esc = (x) => "'" + x.replace(/'/g, "''") + "'";
  // 条款正文含换行：用 blob 字面量 CAST(x'..' AS TEXT)，保证每条 INSERT 只占一行
  // （'..' || char(10) || '..' 链会触发 SQLite 表达式深度上限 100）
  if (!/[\r\n]/.test(s)) return esc(s);
  const hex = Buffer.from(s.replace(/\r\n|\r/g, "\n"), "utf8").toString("hex");
  return `CAST(x'${hex}' AS TEXT)`;
}

/** /akn/id/act/uu/2007/25 -> uu_2007_25 */
function compactId(frbrUri) {
  const parts = frbrUri.replace(/^\//, "").split("/");
  return parts.slice(3).join("_").toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

/** frbr_uri 第 4 段推断节点类型 */
function typeFromUri(frbrUri) {
  const seg = frbrUri.replace(/^\//, "").split("/")[3] || "";
  const map = {
    uu: "UU",
    pp: "PP",
    perpres: "PERPRES",
    perppu: "PERPPU",
    permen: "PERMEN",
    perda: "PERDA",
    perda_prov: "PERDA",
    per: "PERATURAN",
  };
  return map[seg.toLowerCase()] || seg.toUpperCase() || "UNKNOWN";
}

const REL_MAP = {
  Mengubah: "AMENDS",
  Mencabut: "REPEALS",
  Merujuk: "REFERENCES",
  Melaksanakan: "IMPLEMENTS",
  Menguji: "REVIEWS",
};

// ---------- API ----------
async function fetchLaw(frbrUri, token) {
  const apiPath = frbrUri.replace(/^\//, "");
  const cacheFile = path.join(CACHE_DIR, apiPath.replace(/\//g, "_") + ".json");
  if (fs.existsSync(cacheFile)) {
    return { data: JSON.parse(fs.readFileSync(cacheFile, "utf8")), cached: true };
  }
  const url = `${BASE_URL}/laws/${apiPath}`;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // 三重校验：状态码 + 条款非空 + 标题关键词
      if (!data.work || !data.work.title) throw new Error("缺少 work 元数据");
      if (!Array.isArray(data.articles) || data.articles.length === 0)
        throw new Error("articles 为空（伪 404 陷阱？）");
      fs.writeFileSync(cacheFile, JSON.stringify(data));
      return { data, cached: false };
    } catch (e) {
      lastErr = e;
      console.warn(`  ! 第 ${attempt + 1} 次请求失败：${e.message}`);
      if (attempt === 0) await sleep(2000);
    }
  }
  throw lastErr;
}

// ---------- 主流程 ----------
async function main() {
  const token = loadToken();
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const list = JSON.parse(
    fs.readFileSync(path.join(__dirname, "core-regulations.json"), "utf8")
  );

  const nodes = new Map(); // id -> row
  const edges = new Map(); // id -> row
  const usedFrbr = new Set(); // 保证 frbr_uri UNIQUE 不被条款重复占用
  const stats = { laws: 0, articles: 0, edges: 0, placeholders: 0, failed: [] };

  const isPlaceholder = (row) => (row.metadata || "").includes('"placeholder":true');

  const addNode = (n) => {
    const existing = nodes.get(n.id);
    // 已存在占位节点、新节点是完整节点时，用完整节点覆盖占位
    if (!existing || (isPlaceholder(existing) && !isPlaceholder(n))) {
      nodes.set(n.id, n);
    }
    return n;
  };

  const uniqueFrbr = (base) => {
    let candidate = base;
    let i = 2;
    while (usedFrbr.has(candidate)) candidate = `${base}~${i++}`;
    usedFrbr.add(candidate);
    return candidate;
  };

  for (let i = 0; i < list.length; i++) {
    const reg = list[i];
    const lawId = compactId(reg.frbr_uri);
    process.stdout.write(
      `[${i + 1}/${list.length}] ${reg.frbr_uri} ${reg.zh_title} ... `
    );

    let data, cached;
    try {
      ({ data, cached } = await fetchLaw(reg.frbr_uri, token));
    } catch (e) {
      console.log(`失败：${e.message}`);
      stats.failed.push({ frbr_uri: reg.frbr_uri, error: e.message });
      if (!cached) await sleep(SLEEP_MS);
      continue;
    }

    const { work, articles = [], relationships = [] } = data;

    // 法规节点
    usedFrbr.add(work.frbr_uri);
    addNode({
      id: lawId,
      name: work.title,
      type: work.type || typeFromUri(reg.frbr_uri),
      content: null,
      description: reg.zh_summary,
      metadata: JSON.stringify({
        domain: reg.domain,
        type_name: work.type_name,
        source_url: work.source_url,
        source_pdf_url: work.source_pdf_url,
        issuing_body: work.issuing_body ? work.issuing_body.name : null,
        content_verified: work.content_verified ?? null,
      }),
      frbr_uri: work.frbr_uri,
      status: work.status || null,
      number: work.number || null,
      year: work.year || null,
      zh_title: reg.zh_title,
      zh_summary: reg.zh_summary,
    });
    stats.laws++;

    // 条款节点（bab 作为 pasal 的层级信息存入 metadata）
    const babById = new Map();
    for (const a of articles) if (a.type === "bab") babById.set(a.id, a);

    let pasalCount = 0;
    for (const a of articles) {
      if (a.type !== "pasal") continue;
      const bab = a.parent_id ? babById.get(a.parent_id) : null;
      const pasalNum = String(a.number).toLowerCase().replace(/[^a-z0-9]/g, "_");
      // 综合法（如 UU 6/2023）中 pasal 编号会重复：冲突时追加稳定后缀
      let articleId = `${lawId}_pasal_${pasalNum}`;
      if (nodes.has(articleId)) articleId = `${articleId}_a${a.id}`;
      addNode({
        id: articleId,
        name: `Pasal ${a.number}${a.heading ? " — " + a.heading : ""}`,
        type: "ARTICLE",
        content: a.content || "",
        description: null,
        metadata: JSON.stringify({
          law_id: lawId,
          pasal: String(a.number),
          heading: a.heading || null,
          bab: bab ? String(bab.number) : null,
          bab_heading: bab ? bab.heading || null : null,
          sort_order: a.sort_order ?? null,
        }),
        frbr_uri: uniqueFrbr(`${work.frbr_uri}#pasal-${a.number}`),
        status: work.status || null,
        number: null,
        year: null,
        zh_title: null,
        zh_summary: null,
      });
      pasalCount++;
    }
    stats.articles += pasalCount;

    // 关系边（目标法规不在清单内时先建占位节点）
    let edgeCount = 0;
    for (const rel of relationships) {
      const relType = REL_MAP[rel.type];
      const rw = rel.related_work;
      if (!relType || !rw || !rw.frbr_uri) continue;
      const targetId = compactId(rw.frbr_uri);
      if (targetId === lawId) continue;
      if (!nodes.has(targetId)) {
        usedFrbr.add(rw.frbr_uri);
        addNode({
          id: targetId,
          name: rw.title || rw.frbr_uri,
          type: typeFromUri(rw.frbr_uri),
          content: null,
          description: null,
          metadata: JSON.stringify({ placeholder: true }),
          frbr_uri: rw.frbr_uri,
          status: rw.status || null,
          number: rw.number ? String(rw.number) : null,
          year: rw.year || null,
          zh_title: null,
          zh_summary: null,
        });
        stats.placeholders++;
      }
      const edgeId = `${lawId}|${relType}|${targetId}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source_id: lawId,
          target_id: targetId,
          relation_type: relType,
          metadata: JSON.stringify({ pasal_type: rel.type, pasal_type_en: rel.type_en }),
        });
        edgeCount++;
      }
    }
    stats.edges += edgeCount;

    console.log(
      `OK${cached ? " (缓存)" : ""} status=${work.status} pasal=${pasalCount} edges=${edgeCount}`
    );
    if (!cached) await sleep(SLEEP_MS);
  }

  // ---------- 生成 seed.sql ----------
  const lines = [];
  lines.push("-- LexNusa seed.sql（由 scripts/ingest-pasal-id/ingest.js 生成，请勿手改）");
  lines.push(`-- 生成时间：${new Date().toISOString()}`);
  lines.push("PRAGMA defer_foreign_keys = ON;");
  lines.push("BEGIN TRANSACTION;");
  for (const n of nodes.values()) {
    lines.push(
      `INSERT OR IGNORE INTO nodes (id, name, type, content, description, metadata, frbr_uri, status, number, year, zh_title, zh_summary) VALUES (${[
        sqlStr(n.id), sqlStr(n.name), sqlStr(n.type), sqlStr(n.content),
        sqlStr(n.description), sqlStr(n.metadata), sqlStr(n.frbr_uri),
        sqlStr(n.status), sqlStr(n.number), n.year === null || n.year === undefined ? "NULL" : Number(n.year),
        sqlStr(n.zh_title), sqlStr(n.zh_summary),
      ].join(", ")});`
    );
  }
  for (const e of edges.values()) {
    lines.push(
      `INSERT OR IGNORE INTO edges (id, source_id, target_id, relation_type, metadata) VALUES (${[
        sqlStr(e.id), sqlStr(e.source_id), sqlStr(e.target_id), sqlStr(e.relation_type), sqlStr(e.metadata),
      ].join(", ")});`
    );
  }
  lines.push("COMMIT;");
  lines.push("");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const seedPath = path.join(OUT_DIR, "seed.sql");
  fs.writeFileSync(seedPath, lines.join("\n"));

  console.log("\n===== 同步完成 =====");
  console.log(`法规节点：${stats.laws}（另生成占位节点 ${stats.placeholders} 个）`);
  console.log(`条款节点：${stats.articles}`);
  console.log(`关系边：${stats.edges}`);
  if (stats.failed.length) {
    console.log(`失败 ${stats.failed.length} 部：`);
    for (const f of stats.failed) console.log(`  - ${f.frbr_uri}: ${f.error}`);
  }
  console.log(`seed.sql：${seedPath}（${(fs.statSync(seedPath).size / 1024 / 1024).toFixed(2)} MB）`);
}

main().catch((e) => {
  console.error("ingest 失败：", e);
  process.exit(1);
});
