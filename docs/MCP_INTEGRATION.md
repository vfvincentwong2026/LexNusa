# MCP 协议集成指南

> **文档版本**：v1.1.0 | **最后更新**：2026-08-27
> **v1.1.0 变更**：传输协议由 SSE 改为 **Streamable HTTP**（MCP 官方现行规范，SSE 传输已弃用；Pasal.id 等生产级实现均采用 Streamable HTTP）。

---

## 1. 什么是 MCP？

MCP（Model Context Protocol，模型上下文协议）是一个开放标准，允许 AI 应用程序（如 Claude Desktop、Cursor、Codex）通过标准化接口访问外部数据源和工具。

**LexNusa 的 MCP 能力**：将 D1 图谱、Vectorize 索引、R2 文件存储暴露为 MCP 工具，使任何支持 MCP 的 AI 客户端能够查询印尼法规。

---

## 2. LexNusa MCP 端点

| 环境 | 端点 URL | 传输协议 |
| :--- | :--- | :--- |
| **生产** | `https://mcp.lexnusa.workers.dev/mcp` | Streamable HTTP |
| **预览** | `https://mcp-staging.lexnusa.workers.dev/mcp` | Streamable HTTP |

> 说明：端点统一使用 `/mcp` 路径（与 Pasal.id `https://mcp.pasal.id/mcp` 等行业实践一致）。客户端请求头须携带 `Accept: application/json, text/event-stream`，服务端按需在单次响应内升级为 SSE 流。

---

## 3. MCP 工具列表

LexNusa MCP Worker 提供以下 Tools：

| 工具名称 | 功能 | 参数 |
| :--- | :--- | :--- |
| `search_regulations` | 关键词搜索法规 | `q`（查询词）, `limit`（返回数量） |
| `get_regulation` | 获取法规详情 | `id`（法规 ID） |
| `get_ancestors` | 获取上位法（递归追溯） | `id`, `max_depth` |
| `get_descendants` | 获取下位法（向下遍历） | `id`, `max_depth` |
| `semantic_search` | 向量语义检索 | `text`（自然语言描述）, `top_k` |
| `get_edges` | 获取某节点的所有关系 | `id` |
| `find_path` | 查找两个法规间的最短路径 | `from_id`, `to_id` |
| `download_pdf` | 获取法规 PDF 下载链接 | `id` |

---

## 4. 集成到 Claude Desktop

### 4.1 命令行添加（推荐）

```bash
claude mcp add --transport http lexnusa https://mcp.lexnusa.workers.dev/mcp
```

### 4.2 手动编辑配置文件

编辑 Claude Desktop 配置文件（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`，Windows：`%APPDATA%\Claude\claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "lexnusa": {
      "type": "http",
      "url": "https://mcp.lexnusa.workers.dev/mcp"
    }
  }
}
```

### 4.3 使用示例

配置完成后，在 Claude Desktop 中输入：

```text
请帮我查询印尼关于 PMA（外商投资）设立的最新法规
```

Claude 将自动调用 `search_regulations` 和 `get_ancestors` 工具，返回结构化的法规信息。

---

## 5. 集成 Obsidian 本地知识库

### 5.1 安装 Obsidian MCP 插件

方案一：使用 obsidian-mcp 社区插件

1. 在 Obsidian 中搜索并安装 Obsidian MCP 插件。
2. 在插件设置中，配置 MCP 服务器端口（默认 2710）。
3. 启动插件后，Obsidian 会自动暴露为 MCP 服务器。

### 5.2 配置 LexNusa Worker 连接 Obsidian

在 `wrangler.toml` 中添加环境变量：

```toml
[vars]
OBSIDIAN_MCP_URL = "http://localhost:2710"
```

> ⚠️ 注意：`localhost` 只在本地 `wrangler dev` 调试时可达；生产 Worker 运行在 Cloudflare 边缘，**无法访问用户本机的 Obsidian**。生产环境的私有知识库集成需要改为"用户侧代理上传索引"或 Cloudflare Tunnel 方案，设计前需另行评审。

### 5.3 融合查询（官方图谱 + 私有笔记）

```typescript
// Worker 端混合查询逻辑
async function hybridSearch(query: string) {
  // 1. 查询 D1 图谱
  const official = await searchRegulations(query);

  // 2. 查询 Obsidian 本地笔记（仅本地调试环境可用）
  let private: unknown[] = [];
  if (OBSIDIAN_MCP_URL) {
    private = await searchObsidianNotes(query);
  }

  // 3. 融合结果（官方法规优先，本地笔记作为补充）
  return { official, private };
}
```

---

## 6. MCP 协议调试

### 6.1 使用 MCP Inspector

MCP 官方提供的调试工具：

```bash
npx @modelcontextprotocol/inspector
```

在 Inspector 界面中选择 **Streamable HTTP** 传输，填入端点 URL 即可连接调试。

### 6.2 本地测试

```bash
# 本地启动 MCP Worker
cd backend/mcp
wrangler dev

# 在另一个终端测试（Streamable HTTP：POST + 双 Accept 头）
curl -N -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}'
```

---

## 7. 安全注意事项

| 风险 | 缓解措施 |
| :--- | :--- |
| 未授权访问 | 使用 Cloudflare Access 或 API Key（Bearer Token）保护 MCP 端点 |
| 数据泄露 | 所有传输强制 HTTPS，敏感数据（如 PDF）使用预签名 URL |
| 速率滥用 | 在 Worker 层面实施速率限制（Rate Limiting） |
| Obsidian 本地暴露 | 仅限 localhost 访问，不暴露公网 |
