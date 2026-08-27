# LexNusa 产品经理评估报告

> **文档版本**：v1.0.0 | **评估日期**：2026-08-27 | **评估人**：PM（Kimi）
> **评估范围**：README + docs/ 四篇文档（ARCHITECTURE / DATA_MODEL / PRODUCT_SPEC / MCP_INTEGRATION）
> **核实方式**：GitHub API 核实数据源仓库 + 联网核实 Pasal.id 现状 + SQL/协议规范逐条审查

---

## 0. 结论先行（TL;DR）

**项目方向成立，中文合规层定位是真差异化；但数据策略存在根本性误判，必须重构后再动工。**

| 维度 | 评级 | 一句话结论 |
| :--- | :--- | :--- |
| 市场定位 | ✅ 成立 | "中国出海企业的中文印尼法规合规层"是 Pasal.id（印尼语/英语、面向本地人）没有覆盖的空白 |
| 技术架构 | ⚠️ 基本成立，3 处硬伤 | Cloudflare 全栈合理；但 Embedding 模型、MCP 传输协议、SQL 写法有明确错误 |
| 数据策略 | ❌ 不成立，必须重做 | "Fork 权威数据"这条路实际上不存在（详见 §2.1）；真正的地基是 Pasal.id，但受 AGPL-3.0 约束 |
| MVP 范围 | ❌ 过大 | 双网页 + 数据管线 + Agent，2026-Q4 不现实；建议砍到单网页 |
| 商业/合规 | ❌ 缺失 | 免责声明、PDP 法、AGPL 传染、竞品定位全部空白 |

---

## 1. 成立的部分（不要推翻）

### 1.1 Cloudflare 全栈选型 ✅
- 与 Owner 的 Nusantara 项目群技术栈完全一致（Pages + Workers + D1 + Vectorize + Workers AI），已验证的部署经验、域名策略、避坑清单可全部复用。
- 成本分析（ADR §5，初期月成本 < $5）量级正确，免费额度确实够 MVP。

### 1.2 D1 递归 CTE 替代 Neo4j ✅（有边界）
- 对"上位法追溯 / 下位法遍历 / 2 跳关联"这类**深度有限**的查询，D1 `WITH RECURSIVE` 完全够用，ADR §2.3 的决策理由成立。
- 边界提醒：任意节点间最短路径、全局图算法（PageRank 等）不是 D1 的菜，好在这些不在核心场景里。

### 1.3 双协议方向（MCP + A2A）✅ 前瞻且正确
- Pasal.id 已验证 MCP 模式在印尼法规场景的真实需求（Claude Desktop 直连）。
- LexNusa 若做成"中文口径的印尼法规 MCP"，可复用到 Owner 整个 AI 工具链。

### 1.4 中文服务定位 ✅ 核心护城河
- Pasal.id：印尼语优先 + 英语 UI，服务印尼本地人，免费。
- LexNusa 的机会不在"再造一个法规数据库"，而在**中文合规理解层**：中文检索、中文解读、中国出海场景化问答（PMA 设立、税务、劳工）、企业私有经验沉淀。这个定位与文档 §1.2 的痛点表一致，是对的。

---

## 2. 必须修正的决策（按严重程度排序）

### 2.1 ❌ 致命：数据源策略——"Fork 权威数据"这条路不存在

**README 原文声称**："基于印尼财政部法律局 indonesian-legal-network-analysis 项目重构，保留权威数据模型"。

**核实结果（GitHub API，2026-08-27）**：

| 核实项 | README 暗示 | 实际情况 |
| :--- | :--- | :--- |
| 仓库存在性 | 权威官方项目 | ✅ 存在：`harishartanto/indonesian-legal-network-analysis`，确为财政部秘书处法律局（Biro Hukum Sekretariat Jenderal Kemenkeu）倡议 |
| 维护状态 | 可依赖的数据源 | ❌ **2 stars，最后提交 2024-12-20，已停更约 20 个月** |
| 许可证 | 可 Fork | ❌ **无 LICENSE 文件**——法律上默认"保留所有权利"，直接 Fork 数据/模型有法律风险 |
| 数据可得性 | 可直接迁移 | ❌ 仓库里**没有数据本体**（`data/` 下只有 `output` 空壳）；重建需要自备 OpenAI API + Neo4j + OpenSearch 三套基础设施 |
| 覆盖范围 | 17 万+ 法规 | ❌ 该项目目标是"法规关系映射"，并非全量法规库；**"17 万+"数字来源无法核实**（Pasal.id 全量口径为 100k+） |

**同时核实了 Pasal.id（README 列为第二数据源），它是真正的现成地基**：

- `ilhamfp/pasal` + `Aturio/pasal-id-mcp`：**40,143 部法规 / 937,155 条结构化条款（Pasal 级）**，修订链已追踪，新法规 24-48 小时内入库，数据经 Gemini/Claude 视觉对照官方 PDF 验证。
- 已有 REST API + 在线 MCP Server（`https://mcp.pasal.id/mcp`，Streamable HTTP）。
- **但**：许可证 **AGPL-3.0**（商业衍生必须同许可证开源），服务条款**禁止整体再分发其结构化数据库**。LexNusa 目前标注 MIT，两者直接冲突。

**修正方案（三选一，需 Owner 决策）**：

| 方案 | 做法 | 优点 | 代价 |
| :--- | :--- | :--- | :--- |
| **A. API 消费层**（推荐） | 不自建全量库，运行时调 Pasal.id API/MCP，D1 只沉淀"中文标注层 + 企业私有知识 + 高频法规缓存" | 零数据管线成本；不碰 AGPL 数据本体；上线最快 | 依赖上游可用性；需署名；深度图谱关系受限 |
| **B. 自建 ingest** | 直接从 peraturan.go.id 等官方源抓 PDF 自建解析管线 | 数据完全自主，许可干净（法规文本在印尼属公共领域，UU 28/2014 第 13 条） | 重资产：PDF 解析/OCR/条款切分是 Pasal.id 花了大力气才做好的事；等于重造轮子 |
| **C. 混合** | 核心子集（公司/劳工/税务约数百部）自建精标，长尾走 Pasal.id API | 核心数据质量可控，长尾有兜底 | 两套机制并存，复杂度中等 |

> **PM 建议**：MVP 阶段走 **A**，验证产品价值后把高频子集升级为 **C**。绝不选纯 B。

### 2.2 ❌ Embedding 模型选型错误

文档两处（README 快速开始、DATA_MODEL `vector_meta` 默认值）指定 `@cf/baai/bge-base-en-v1.5`——**这是纯英文模型**。

产品要求中文/印尼语/英语三语检索（PRODUCT_SPEC §1.2），用英文模型做印尼语/中文向量，检索质量会显著劣化。Workers AI 上有 **`@cf/baai/bge-m3`（多语言，含印尼语/中文）**，应作为默认。文档需全局替换。

### 2.3 ❌ MCP 传输协议已过时

MCP_INTEGRATION.md 全篇基于 **SSE 传输**。MCP 官方规范自 2025 年起已转向 **Streamable HTTP**，SSE 传输被标记弃用；Pasal.id 的在线 MCP 用的正是 Streamable HTTP。端点设计（§2 端点表、§4 Claude Desktop 配置、§6 调试方法）需整体改写。

### 2.4 ❌ DATA_MODEL.md 的 SQL 有硬伤（开工前必修）

1. **SQLite 不支持在 `CREATE TABLE` 内联写 `INDEX idx_xxx (col)`**——`nodes`、`edges`、`vector_meta` 三个建表语句全部无法执行，索引必须拆成独立 `CREATE INDEX` 语句。
2. **§3.3 最短路径查询中 `json_each(pf.path) != e.target_id` 不是合法 SQL**——`json_each` 是表值函数，不能这样标量比较；防环应写 `NOT EXISTS (SELECT 1 FROM json_each(pf.path) je WHERE je.value = e.target_id)`。
3. 这两处错误说明文档未经真实数据库验证，后续文档涉及的 SQL 都应以"在 D1 实际跑通"为准。

### 2.5 ❌ MVP 范围过大、时间表不现实

PRODUCT_SPEC §5：v0.1（2026-Q4，距今约 1 个月）要做"基础搜索 + 图谱展示 + 1 个 Agent"。叠加数据管线从方案 B 假设出发，实际工作量至少 2 倍。**必须砍**：

- 双网页 → **单网页**（先做法规搜索 + 条款阅读 + 修订状态，这是所有用户故事的共同地基）；
- 图谱可视化、Agent 平台顺延到 v0.2；
- 时间锚点重排（见 §4）。

### 2.6 ⚠️ 商业与合规章节整体缺失

| 缺失项 | 风险 |
| :--- | :--- |
| 免责声明（"非法律意见"） | 法律科技产品红线，Pasal.id / LexHarmoni 都有醒目声明，我们必须有 |
| 数据许可合规（AGPL / ToS） | 见 §2.1，未决策前不能写一行 ingest 代码 |
| 印尼 PDP 个人数据保护法 | 若做企业账号/收藏/对话记录即落入监管范围 |
| 竞品定位 | Hukumonline（商业库）、peraturan.go.id（官方）、Pasal.id（免费开源）均未分析 |

### 2.7 ⚠️ 已知环境约束（Owner 侧）

- **R2 未开通**（Cloudflare 账号需绑支付方式）：PDF 原文存储功能前置依赖 Owner 操作。
- Workers AI 模型会弃用（Llama 3.1 已于 2026-05-30 弃用）：动工前 `wrangler ai models` 核实 bge-m3 仍在目录。

---

## 3. 一句话战略重构

> **LexNusa 的价值不在"数据"（Pasal.id 已免费做完），而在"中文合规理解层"。**
> 数据策略：站在 Pasal.id 肩膀上（API 消费 + 署名），把全部工程量投到中文解读、场景化专家 Agent、企业私有知识沉淀上。

---

## 4. 修订版路线图

| 阶段 | 内容 | 出口标准 | 建议时间 |
| :--- | :--- | :--- | :--- |
| **P0 验证冲刺**（不写产品代码） | ① 直连 Pasal.id MCP，用 50 个中国出海真实问题实测数据覆盖度；② 与 Pasal.id 确认商用署名口径（或落地方案 C 自建范围）；③ bge-m3 三语检索小实验；④ 修正文档硬伤（§2.2–2.4） | 数据可行性报告 + 许可路径书面确认 | 2 周 |
| **P1 MVP 单网页** | 中文优先的法规搜索 + 条款阅读器 + 修订状态标注 + 法条引用出处；D1 仅存中文标注层与高频缓存 | 3 个种子用户（法务/合规角色）能用中文查到带出处条款 | 4–6 周 |
| **P2 图谱 + 首个 Agent** | 核心法规子集（公司/劳工/税务）图谱可视化（D3.js）+ 公司法专家 Agent（流式回答 + 引用） | US-AGENT-01 场景闭环 | +6 周 |
| **P3 协议层** | MCP Server（Streamable HTTP）对外开放 + Obsidian 私有库混合查询 | Claude Desktop 可直连中文口径印尼法规 | 按需 |

原路线图的 v0.3 A2A 多 Agent、v1.0 企业版（SSO）方向保留，时间整体后移，不在本次承诺范围。

---

## 5. 给 Owner 的待决策清单

1. **数据许可路径**：方案 A / B / C 选哪个？（PM 推荐 A→C）
2. **开源许可证**：LexNusa 维持 MIT 则与 AGPL 数据源隔离必须做干净；若接受 AGPL 则商业化模式需另议。
3. **R2 开通**：是否现在去 Cloudflare Dashboard 绑支付方式？
4. **"17 万+ 法规"口径**：README 数字建议改为可核实口径（如"Pasal.id 覆盖 4 万+ 法规 / 93 万+ 条款"）或删除。

---

## 附：核实记录（2026-08-27）

- `harishartanto/indonesian-legal-network-analysis`：GitHub API 核实，2 stars / 无 LICENSE / pushed_at 2024-12-20 / data 目录无数据本体。
- `Aturio/pasal-id-mcp`、`ilhamfp/pasal`：GitHub API + 官网核实，40,143 法规 / 937,155 条款 / AGPL-3.0 / MCP 在线（Streamable HTTP）。
- MCP 传输演进：官方规范 Streamable HTTP 取代 SSE（Pasal.id 实际实现佐证）。
- 印尼法规文本公共领域依据：UU No. 28/2014 第 13 条（Pasal.id 服务条款引用）。
