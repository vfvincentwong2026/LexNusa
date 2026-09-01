#!/usr/bin/env node
/**
 * 解析 peraturan.go.id / peraturan.bpk.go.id 官方 PDF → 按 Pasal 切分条款
 * 输出 out/parsed_{law_id}.json：{ "5": "条款正文...", ... }
 *
 * 切分规则：
 *  - 截断 PENJELASAN（官方解释）之后的部分
 *  - 独立行的 "Pasal 5" / "Pasal  5" / "Pasal 5A" 作为条款边界
 *  - 跳过罗马数字 Pasal（I/II 修订章）——不往 API 的修订章节点塞整章文本
 *  - 清理页脚页码行（- 12 -）、BAB 标题行
 */
const fs = require("fs");
const pdf = require("pdf-parse");

const LAW_IDS = process.argv.slice(2);

function cleanAndSplit(raw, lawId) {
  let t = raw.replace(/\r\n/g, "\n");

  // 单法规补丁：UU 27/2022 的 Salinan PDF 字体把独立 "Pasal 1" 渲染成 "Pasal I"
  if (lawId === "uu_2022_27") {
    t = t.replace(/Pasal I\n/g, "Pasal 1\n");
  }

  // 截断 PENJELASAN 部分（必须全大写独立行，避免误伤 "penjelasannya" 等正文词）；正文从 MEMUTUSKAN 之后开始
  const pe = t.search(/^[ \t]*PENJELASAN[ \t]*$/m) > 0
    ? t.search(/^[ \t]*PENJELASAN[ \t]*$/m)
    : t.search(/^[ \t]*PENJELASAN/m);
  if (pe > 0) t = t.slice(0, pe);
  const me = t.search(/MEMUTUSKAN/);
  if (me > 0) t = t.slice(me);

  const lines = t.split("\n");
  const kept = [];
  for (const line of lines) {
    const l = line.trim();
    // 页码行：- 12 - 或 单独数字
    if (/^-[ \t]*\d+[ \t]*-$/.test(l)) continue;
    if (/^\d{1,4}$/.test(l)) continue;
    kept.push(line);
  }
  t = kept.join("\n");

  // 找 Pasal 头候选：独立行 "Pasal 5"/"Pasal 1."，或碎片化 PDF 的 "Pasal\n5"（数字独占一行）
  const re = /^[ \t]*Pasal[ \t]+(\d+[A-Za-z]?)\.?[ \t]*$|^[ \t]*Pasal[ \t]*\n[ \t]*(\d+[A-Za-z]?)\.?[ \t]*$/gm;
  const candidates = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    candidates.push({ num: m[1] || m[2], start: m.index, end: m.index + m[0].length });
  }

  // 序号校验：条款号必须单调递增（过滤跨行折行造成的伪匹配，如 "Pasal\n4 ayat (3)" 引用）。
  // 例外：修订法内嵌完整文本会在罗马数字章（Pasal I/II）后重新从 Pasal 1 开始，允许重启。
  const numVal = (s) => parseInt(s, 10);
  const romanRe = /^[ \t]*Pasal[ \t]+[IVXLCDM]+[ \t]*$/gm;
  const romanPos = [];
  let rm;
  while ((rm = romanRe.exec(t)) !== null) romanPos.push(rm.index);

  const marks = [];
  let lastNum = 0, lastSuffix = "";
  for (const c of candidates) {
    const v = numVal(c.num);
    const suffix = c.num.replace(/^\d+/, "");
    // 候选前有罗马章头且晚于上一个已接受条款 → 允许序号重启
    const hasRomanBefore = romanPos.some((p) => p < c.start && (marks.length === 0 || p > marks[marks.length - 1].start));
    if (v > lastNum || (v === lastNum && suffix > lastSuffix) || (hasRomanBefore && v <= lastNum)) {
      marks.push(c);
      lastNum = v;
      lastSuffix = suffix;
    }
  }

  const pasals = {};
  for (let i = 0; i < marks.length; i++) {
    const { num, end } = marks[i];
    const nextStart = i + 1 < marks.length ? marks[i + 1].start : t.length;
    let body = t.slice(end, nextStart);

    // 去掉段内 BAB 标题块（BAB X 行 + 后续连续全大写标题行）
    const bodyLines = body.split("\n");
    const out = [];
    let skippingCaps = false;
    for (const line of bodyLines) {
      const l = line.trim();
      if (/^BAB[ \t]+[IVXLCDM]+/i.test(l)) { skippingCaps = true; continue; }
      if (skippingCaps) {
        // 标题行：非空且基本全大写（印尼语标题）
        const letters = l.replace(/[^A-Za-z]/g, "");
        if (l && letters.length > 0 && l === l.toUpperCase() && !/^\(\d+\)/.test(l)) continue;
        if (!l) continue; // 标题块内空行也跳过
        skippingCaps = false;
      }
      out.push(line);
    }
    body = out.join("\n");

    // 压缩空行、去首尾空白
    body = body.replace(/\n{3,}/g, "\n\n").trim();
    // 同一 Pasal 号重复出现（页眉伪匹配等）时取较长者
    if (body && (!pasals[num] || body.length > pasals[num].length)) {
      pasals[num] = body;
    }
  }
  return pasals;
}

(async () => {
  const emptyList = JSON.parse(fs.readFileSync("out/empty_articles.json", "utf8"));
  const summary = {};
  for (const id of LAW_IDS) {
    const pdfPath = `pdfs/${id}.pdf`;
    if (!fs.existsSync(pdfPath)) { console.log(id, "无 PDF，跳过"); continue; }
    const data = await pdf(fs.readFileSync(pdfPath));
    fs.writeFileSync(`out/${id}.txt`, data.text);
    const pasals = cleanAndSplit(data.text, id);
    fs.writeFileSync(`out/parsed_${id}.json`, JSON.stringify(pasals, null, 1));

    const needed = emptyList.filter((r) => r.law_id === id).map((r) => String(r.pasal));
    const hit = needed.filter((p) => pasals[p] && pasals[p].length > 30);
    summary[id] = { parsed: Object.keys(pasals).length, needed: needed.length, fillable: hit.length };
    console.log(id, `解析出 ${Object.keys(pasals).length} 条，需补 ${needed.length} 条，可补 ${hit.length} 条`);
  }
  fs.writeFileSync("out/parse_summary.json", JSON.stringify(summary, null, 1));
})();
