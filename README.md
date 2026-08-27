# LexNusa：印尼企业服务知识图谱与 Agent 平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%7C%20Workers%20%7C%20D1-orange)](https://cloudflare.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Monorepo](https://img.shields.io/badge/architecture-monorepo-blue)](https://github.com/)

> **为中国出海企业量身打造**：基于 Cloudflare 边缘网络的印尼法律智能中台。通过 **“知识图谱浏览器”+“多专家 Agent 门户”** 双网页，让印尼数万部法规、近百万条款“看得懂、查得准、问得出”。

---

## 📖 项目概览

LexNusa 完全运行于 **Cloudflare 全栈生态**（Pages + Workers + D1 + Vectorize + R2），零服务器运维，全球低延迟。项目包含 **两大独立前端应用**：

| 网页 | 功能定位 | 核心能力 |
| :--- | :--- | :--- |
| **🌐 网页一：知识图谱浏览器** | 结构化法规数据展示与探索 | 关系图谱可视化（D3.js）、矢量语义检索、法规条款关联树、修订脉络追溯 |
| **🤖 网页二：Agent 专家平台** | 基于图谱“生长”出的对话式 AI 专家 | 内置“公司法/税务/劳工”等专家 Agent，每个 Agent 拥有独立人设（Prompt）与技能（Skill），支持 MCP 协议调用底层图谱 |

---

## 🏗️ 技术架构（Cloudflare 原生）

```mermaid
graph LR
    User[中国企业用户] --> Page1[网页一: 图谱浏览器]
    User --> Page2[网页二: Agent 门户]

    subgraph CF[Cloudflare 边缘网络]
        Pages[Pages 托管双前端]
        Workers[Workers API 网关]
        D1[D1: 关系图谱数据库]
        Vec[Vectorize: 向量索引]
        R2[R2: PDF/附件存储]
    end

    Page1 --> Workers
    Page2 --> Workers
    Workers --> D1
    Workers --> Vec
    Workers --> R2

    subgraph MCP_A2A[协议桥梁]
        MCP[MCP over Streamable HTTP]
        A2A[A2A JSON-RPC]
    end

    Workers -.-> MCP
    Workers -.-> A2A
✨ 核心特性
双网页独立部署：两个前端应用可分别绑定不同域名（如 graph.lexnusa.com 和 agent.lexnusa.com），也可同域路由，灵活适配企业需求。

图谱 + 向量混合检索：D1 存储法规节点/关系（递归 CTE 查询），Vectorize 存储语义向量，一次检索同时返回精确匹配与语义相关结果。

MCP 协议原生支持：Workers 提供标准 MCP 端点（Streamable HTTP），可被 Claude Desktop、Cursor 等第三方 AI 客户端直接接入。

A2A 多 Agent 协作：实现 Google A2A 协议草案，支持多个专家 Agent 协同完成复杂合规报告。

权威数据底座：消费 Pasal.id 开放法律数据平台 API（4 万+ 法规 / 93 万+ 结构化条款，修订链与状态标注齐备），LexNusa 自建中文映射与检索层（详见 docs/P0_DATA_FEASIBILITY.md）。

📂 项目目录结构（GitHub 标准 Monorepo）

lexnusa/
├── .github/                          # GitHub 社区模板
│   ├── ISSUE_TEMPLATE/               # Issue 模板
│   └── workflows/                    # CI/CD 工作流（自动部署）
│
├── apps/                             # 前端应用层（两个独立网页）
│   ├── graph-viewer/                 # 📍 网页一：知识图谱浏览器
│   │   ├── src/                      # React/Vite + D3.js
│   │   ├── public/
│   │   ├── package.json
│   │   └── wrangler.toml             # Pages 部署配置
│   └── agent-portal/                 # 📍 网页二：Agent 专家平台
│       ├── src/                      # React/Vite + 对话界面
│       ├── public/
│       ├── package.json
│       └── wrangler.toml             # Pages 部署配置
│
├── backend/                          # 后端 Worker 层（API + 协议）
│   ├── api/                          # RESTful 图谱查询 Worker
│   │   ├── src/index.ts
│   │   └── wrangler.toml
│   ├── mcp/                          # MCP 协议 Worker（Streamable HTTP 端点）
│   │   ├── src/index.ts
│   │   └── wrangler.toml
│   └── a2a/                          # A2A 多 Agent 协作 Worker
│       ├── src/index.ts
│       └── wrangler.toml
│
├── migrations/                       # D1 数据库 Schema（SQL）
│   ├── 0001_nodes.sql
│   ├── 0002_edges.sql
│   └── 0003_vector_meta.sql
│
├── scripts/                          # 运维 & 数据迁移脚本
│   ├── ingest-pasal-id/              # 从 Pasal.id API 同步法规与修订链
│   └── vectorize-push/               # 生成 Embedding 推送 Vectorize
│
├── docs/                             # 文档
│   └── api-reference.md
│
├── package.json                      # Monorepo 根（pnpm workspace）
├── pnpm-workspace.yaml               # pnpm 工作区配置
├── wrangler.toml                     # 根配置（绑定 D1/Vectorize/R2）
├── .gitignore
├── LICENSE
└── README.md                         # 👈 你现在正在看这个


🚀 快速开始（Cloudflare 部署）
前置条件：Node.js 18+、pnpm、Wrangler CLI，并已登录 Cloudflare 账号。

1. 克隆并安装依赖
bash
git clone https://github.com/your-org/lexnusa.git
cd lexnusa
pnpm install
2. 初始化 D1 数据库并执行迁移
bash
# 创建 D1 实例（选择亚洲区域）
wrangler d1 create lexnusa-db --location=apac

# 应用所有 SQL 迁移
wrangler d1 migrations apply lexnusa-db --remote
3. 导入法规数据（从 Pasal.id API 同步）
bash
# 按核心法规清单拉取条款全文与修订链，三重校验后灌入 D1
pnpm run ingest:regulations
4. 构建向量索引
bash
# 为法规条款生成 Embedding（默认使用 @cf/baai/bge-m3，多语言，覆盖中文/印尼语/英语）
pnpm run vectorize:push
5. 部署后端 Workers（API + MCP + A2A）
bash
# 部署图谱查询 API
cd backend/api && wrangler deploy --env production

# 部署 MCP 协议端点
cd ../mcp && wrangler deploy --env production

# 部署 A2A 协作端点
cd ../a2a && wrangler deploy --env production
6. 部署双前端网页（Cloudflare Pages）
bash
# 部署网页一：知识图谱浏览器
cd apps/graph-viewer
pnpm run build
wrangler pages deploy ./dist --project-name=lexnusa-graph

# 部署网页二：Agent 专家平台
cd ../agent-portal
pnpm run build
wrangler pages deploy ./dist --project-name=lexnusa-agent
💡 提示：两个网页部署完成后，Pages 会分别生成 .pages.dev 域名（如 lexnusa-graph.pages.dev 和 lexnusa-agent.pages.dev），你也可以在 Cloudflare Dashboard 绑定自定义域名。

🧠 数据模型（D1 替代 Neo4j）
利用 D1（SQLite）的 递归 CTE 实现图谱深度遍历，无需额外图数据库：

表名	说明	关键字段
nodes	法规/条款/实体	id, name, type (UU/PP/PERMEN), content
edges	关系（引用/修订/废止）	source_id, target_id, relation_type
vector_meta	向量映射	node_id, chunk_text, vectorize_index
示例查询（查找某法规所有上位法）：

sql
WITH RECURSIVE parent_tree AS (
  SELECT id, name FROM nodes WHERE id = 'UU_2023_6'
  UNION
  SELECT n.id, n.name FROM nodes n
  JOIN edges e ON n.id = e.source_id
  JOIN parent_tree pt ON e.target_id = pt.id
  WHERE e.relation_type = 'AMENDS'
)
SELECT * FROM parent_tree;
🔌 协议集成（MCP / A2A）
协议	Worker 端点	用途
MCP	https://lexnusa-mcp.workers.dev/mcp	将 D1 图谱暴露为标准 MCP 工具（Streamable HTTP），供 Claude Desktop 等客户端调用
A2A	https://lexnusa-a2a.workers.dev/discover	多 Agent 发现与协作，支持“公司法专家”向“税务专家”请求数据
🗺️ 路线图（2026-08-27 按 PM 评估修订，详见 docs/PM_EVALUATION.md 与 docs/P0_DATA_FEASIBILITY.md）
☑ 文档蓝图：架构 / 数据模型 / 产品规格 / MCP 集成（仓库当前为文档阶段，代码未开工）
☑ P0 数据可行性实测：Pasal.id 50 题覆盖度验证 + API 通路打通
□ P0 收尾：bge-m3 三语检索实验
□ P1 MVP 单网页：中文优先法规搜索 + 条款阅读 + 修订状态标注
□ P2 图谱可视化（D3.js）+ 公司法专家 Agent（流式响应）
□ P3 MCP Worker 完整工具链（Streamable HTTP，查询/遍历/读取）
□ 部长级法规（PMK/Permenaker/PER）第二数据源补齐
□ A2A 多 Agent 协同案例（企业合规报告自动生成）
□ GitHub Actions CI/CD 自动部署流水线
🤝 贡献指南
我们欢迎法律专家、全栈开发者和出海企业共同参与：

Fork 本仓库

创建你的特性分支 (git checkout -b feature/amazing-feature)

提交变更 (git commit -m 'Add some amazing feature')

推送到分支 (git push origin feature/amazing-feature)

提交 Pull Request

请确保代码通过 ESLint 和 TypeScript 类型检查。

🙏 致谢与数据源
核心数据：Pasal.id（印尼开放法律数据平台，AGPL-3.0；LexNusa 以 API 消费 + 署名方式使用，不镜像其数据库）

向量模型：Cloudflare Workers AI (@cf/baai/bge-m3，多语言)

📄 许可证
本项目代码采用 MIT License 开源。法规文本依印尼 UU No. 28/2014 第 13 条属公共领域；Pasal.id 结构化数据的使用遵循其 AGPL-3.0 许可与服务条款（禁止整体再分发）。

📧 联系我们
让印尼法律成为企业出海的助推器，而非绊脚石。

项目官网：https://lexnusa.com（示例）

商务合作：lexnusa@example.com

微信社群：扫描下方二维码（示例）

