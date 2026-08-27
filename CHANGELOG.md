# 更新日志

本文档记录 LexNusa 项目的所有重要变更，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范。

---

## [Unreleased]

### Added
- 项目初始化，创建 Monorepo 结构
- D1 数据库 Schema（nodes / edges / vector_meta 表）
- 从 `indonesian-legal-network-analysis` Fork 数据迁移脚本
- Cloudflare Workers 基础 API（搜索、详情查询）
- Cloudflare Pages 双前端脚手架（graph-viewer + agent-portal）

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [v0.1.0] - 2026-09-15 (计划)

### Added
- 网页一：法规关键词搜索（中文/印尼语）
- 网页一：D3.js 关系图谱渲染（力导向图）
- 网页二：Agent 对话界面（公司法专家）
- MCP Worker SSE 端点（3 个工具：搜索、详情、上位法追溯）

### Changed
- N/A

### Fixed
- N/A

---

## 版本号说明

采用 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

- **MAJOR**（主版本号）：不兼容的 API 变更
- **MINOR**（次版本号）：向下兼容的功能新增
- **PATCH**（修订号）：向下兼容的 Bug 修复
text

---

## 📁 最终文件放置位置
lexnusa/
├── docs/
│ ├── PRODUCT_SPEC.md ✅ 已提供
│ ├── ARCHITECTURE.md ✅ 已提供
│ ├── DATA_MODEL.md ✅ 已提供
│ ├── MCP_INTEGRATION.md ✅ 已提供
│ └── DEPLOYMENT.md ⚠️ 你需要的话我可以继续补充
├── .github/
│ └── ISSUE_TEMPLATE/
│ ├── bug_report.md ⚠️ 你需要的话我可以继续补充
│ └── feature_request.md ⚠️ 你需要的话我可以继续补充
├── CONTRIBUTING.md ✅ 已提供
├── CHANGELOG.md ✅ 已提供
└── README.md （已有，保持不变）
