# 贡献指南

> **版本**：v1.0.0 | **最后更新**：2026-08-27

感谢你对 LexNusa 项目的关注！我们欢迎各类贡献——无论是代码、文档、Bug 报告还是功能建议。

---

## 📋 贡献方式

### 1. 提交 Issue

- **Bug 报告**：请使用 `.github/ISSUE_TEMPLATE/bug_report.md` 模板。
- **功能建议**：请使用 `.github/ISSUE_TEMPLATE/feature_request.md` 模板。

### 2. 提交 Pull Request

#### 2.1 准备工作

1. Fork 本仓库。
2. 克隆你 Fork 的仓库到本地：
   ```bash
   git clone https://github.com/your-username/lexnusa.git
   cd lexnusa
安装依赖：

bash
pnpm install
2.2 创建分支
bash
git checkout -b feat/your-feature-name
分支命名规范：

feat/ — 新功能

fix/ — Bug 修复

docs/ — 文档更新

refactor/ — 代码重构

test/ — 测试相关

2.3 开发规范
规范	要求
语言	TypeScript（严格模式）
代码风格	使用 Prettier + ESLint（配置见 .prettierrc 和 .eslintrc）
提交信息	遵循 Conventional Commits
测试	为核心功能编写单元测试（Vitest）
bash
# 运行代码检查
pnpm run lint

# 运行测试
pnpm run test

# 格式化代码
pnpm run format
2.4 提交 Pull Request
推送分支到你的 Fork：

bash
git push origin feat/your-feature-name
在本仓库提交 Pull Request。

填写 PR 模板，描述你的改动内容、原因和测试情况。

等待 Code Review。

🧑‍⚖️ 行为准则
请阅读我们的 行为准则。所有参与者必须遵守此准则，以维护一个友好、尊重和开放的社区环境。

❓ 需要帮助？
查看 文档

在 Issue 中提问（使用 question 标签）

联系项目维护者：lexnusa@example.com

再次感谢你的贡献！ 🎉
