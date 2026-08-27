# LexNusa：印尼企业服务知识图谱与 Agent 平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%7C%20Workers%20%7C%20D1-orange)](https://cloudflare.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Monorepo](https://img.shields.io/badge/architecture-monorepo-blue)](https://github.com/)

> **为中国出海企业量身打造**：基于 Cloudflare 边缘网络的印尼法律智能中台。通过 **“知识图谱浏览器”+“多专家 Agent 门户”** 双网页，让印尼 17 万+ 法规“看得懂、查得准、问得出”。

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
        MCP[MCP over SSE]
        A2A[A2A JSON-RPC]
    end

    Workers -.-> MCP
    Workers -.-> A2A
