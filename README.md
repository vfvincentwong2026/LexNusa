# LexNusa
基于 Cloudflare 边缘架构的印尼企业服务知识图谱与 Agent 平台
LexNusa：基于 Cloudflare 边缘架构的印尼企业服务知识图谱与 Agent 平台
https://img.shields.io/badge/License-MIT-yellow.svg
https://img.shields.io/badge/Cloudflare-Pages%2520%257C%2520Workers%2520%257C%2520D1-orange
https://img.shields.io/badge/MCP-Protocol-green

为中国出海企业打造的新一代印尼法律与政策智能服务中台。 全栈基于 Cloudflare 边缘网络，零运维成本，全球低延迟。融合印尼官方法规图谱、本地 Obsidian 知识库与多智能体（Agent）协作，让印尼法律合规“轻量化、智能化、私有化”。

📖 项目简介
印尼拥有超过 17 万项法规，频繁修订且语言复杂。LexNusa 彻底摒弃传统重型服务器架构，全部托管于 Cloudflare 边缘网络：

前端展示：部署在 Cloudflare Pages，支持图谱可视化与 Agent 对话门户。

后端逻辑：运行在 Cloudflare Workers，处理图谱查询、向量检索与 Agent 调度。

数据存储：

D1（SQLite 全球分布式）：存储法规节点、关系边与元数据（替代传统 Neo4j，利用递归 CTE 实现图谱遍历）。

Vectorize（向量索引）：存储条款与 Obsidian 笔记的语义向量，实现混合检索。

R2（对象存储）：存储 PDF 原文、政策附件等静态文件。

🏗️ Cloudflare 原生架构图











✨ 核心特性（Cloudflare 专属优势）
特性	具体实现	边缘优势
⚡ 零延迟图谱查询	Workers 直连 D1，利用 WITH RECURSIVE 实现无限层级法规关系遍历。	全球 300+ 数据中心，就近计算。
🔍 矢量+关系混合检索	Worker 同时查询 D1（关键词/关系）与 Vectorize（语义向量），融合排序。	无需自建 ES 或 Milvus，全托管。
📄 静态资源加速	法规原文 PDF 存放 R2，通过 Workers 生成预签名 URL 或直接公网加速。	R2 与 CDN 深度集成，分发成本极低。
🔌 MCP / A2A 协议桥接	Workers 提供 SSE (Server-Sent Events) 或 WebSocket 端点，将 D1 图谱暴露为标准 MCP 工具。	无需公网 IP，Worker 自动负载均衡。
🧩 开源 Fork 数据迁移	Fork indonesian-legal-network-analysis 的 ETL 脚本，将 Neo4j 数据一键迁移至 D1。	保留权威数据模型，但存储成本降低 90%。
🚀 快速开始（Cloudflare 工作流）
前置条件：安装 Node.js、Wrangler CLI，并登录 Cloudflare 账号。

1. 克隆项目并初始化
bash
git clone https://github.com/your-org/lexnusa.git
cd lexnusa
npm install
2. 初始化 D1 全球数据库（创建图谱表）
bash
# 创建 D1 数据库
wrangler d1 create lexnusa-db --location=apac

# 执行 Schema 迁移（包含节点表、边表、向量元数据表）
wrangler d1 migrations apply lexnusa-db --remote
3. 导入印尼官方法规数据（Fork 自官方项目）
我们已将 indonesian-legal-network-analysis 的 ETL 逻辑适配为 D1 导入脚本：

bash
# 下载并解析官方 JSON/CSV，灌入 D1（约 5 分钟）
npm run ingest:regulations
4. 构建向量索引（Vectorize）
bash
# 为法规条款和 Obsidian 笔记生成 Embedding，推送至 Vectorize
npm run vectorize:push
5. 部署后端 Workers API
bash
# 部署图谱查询、Agent 调度、MCP 协议等核心 Worker
wrangler deploy --env production
6. 部署前端展示网页（Pages）
bash
# 构建 React/Vue 前端（包含图谱可视化 + Agent 聊天门户）
npm run build:web
wrangler pages deploy ./dist --project-name=lexnusa-portal
📂 Cloudflare 项目目录结构
text
lexnusa/
├── frontend/                          # Cloudflare Pages 前端
│   ├── graph-visualizer/              # 网页一：D3.js/ECharts 法规关系图谱
│   ├── agent-portal/                  # 网页二：Agent 对话交互界面
│   └── wrangler.toml                  # Pages 部署配置
├── backend/                           # Cloudflare Workers 后端
│   ├── api/                           # RESTful API（图谱查询、搜索）
│   ├── mcp-worker/                    # MCP 协议实现（SSE 端点）
│   ├── a2a-worker/                    # A2A 多智能体协作协议
│   └── wrangler.toml                  # Worker 绑定配置（D1, Vectorize, R2）
├── migrations/                        # D1 数据库 Schema（SQL）
│   ├── 0001_create_nodes_table.sql
│   ├── 0002_create_edges_table.sql
│   └── 0003_create_vector_metadata.sql
├── scripts/                           # 数据迁移与 ETL 工具
│   ├── ingest-from-neo4j/             # 从 Fork 项目迁移数据到 D1
│   └── vectorize-obsidian/            # 同步 Obsidian 笔记到 Vectorize
├── obsidian-vault/                    # （可选）本地知识库模板
└── package.json
🧠 数据模型映射（D1 替代 Neo4j）
我们不再依赖 Neo4j，而是利用 Cloudflare D1（SQLite）的 递归公用表表达式（CTE） 实现图谱深度遍历：

D1 表名	对应图谱概念	关键字段
nodes	法规/条款/实体	id, name, type (UU/PP/PERMEN), content
edges	关系（引用/修订/废止）	source_id, target_id, relation_type, metadata
vector_meta	向量索引映射	node_id, vectorize_index_name, chunk_text
示例查询（查询某法规的所有上位法）：

sql
WITH RECURSIVE legal_tree AS (
  SELECT id, name FROM nodes WHERE id = 'UU_2023_6'
  UNION
  SELECT n.id, n.name FROM nodes n
  JOIN edges e ON n.id = e.source_id
  JOIN legal_tree lt ON e.target_id = lt.id
  WHERE e.relation_type = 'AMENDS'
)
SELECT * FROM legal_tree;
🔌 协议与集成
MCP（模型上下文协议）
端点：https://lexnusa-api.workers.dev/mcp/sse

功能：将 D1 图谱、Vectorize 检索、R2 文件读取暴露为标准 MCP 工具（Tools）。

用法：任何支持 MCP 的客户端（如 Claude Desktop）均可直接配置此 SSE 地址。

A2A（智能体间通信）
端点：https://lexnusa-api.workers.dev/a2a/discover

功能：支持“公司法专家”、“税务专家”、“劳工专家”三个 Agent 相互协作。

协议：遵循 Google A2A 草案，基于 JSON-RPC over HTTPS。

🗺️ 路线图 (Roadmap)
☑ Phase 1：完成 D1 Schema 设计与 Fork 数据迁移脚本。
☑ Phase 2：部署基础 Workers API（图谱查询 + 关键词搜索）。
□ Phase 3：集成 Cloudflare Vectorize，实现混合语义检索。
□ Phase 4：构建 MCP Worker，使图谱可被 Claude/GPT 调用。
□ Phase 5：基于 Worker 部署 TrustGraph 轻量版运行时，上线 3 个专家 Agent。
□ Phase 6：前端 Pages 上线，支持双网页无缝切换。
💰 成本与运维优势（Cloudflare 免费额度足够启动）
服务	免费额度	LexNusa 预估用量
Workers	10 万次请求/天	足够支持初期小规模企业内测。
D1	5 GB 存储 / 250 万行读/天	17 万项法规 + 关系约占用 1-2 GB。
Vectorize	100 万向量索引/月	条款向量约 50 万条，完全覆盖。
R2	10 GB 存储 + A 类操作免费	存储全部 PDF 原文。
Pages	无限请求 + 500 次构建/月	完全免费。
🤝 核心数据源致谢
Fork 基础：indonesian-legal-network-analysis（印尼财政部法律局）

开放 API：Pasal.id（结构化法规数据源）

📄 许可证
MIT License。Fork 核心数据模型遵循原项目许可证。

📧 联系我们
让印尼法律成为企业出海的助推器，而非绊脚石。

如有企业定制或商务合作，请发邮件至：lexnusa@example.com
