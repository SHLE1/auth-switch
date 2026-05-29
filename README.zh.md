# auth-switch

中文 · [English](./README.md)

一款仅限本地的 macOS/Windows Tauri 桌面应用，通过管理 Codex 与 Claude Code 的官方本地配置文件，实现 Codex 账户和 Claude Code API 密钥配置文件的快速切换。

---

## 功能特性

- **一键切换账户** — 原子性地替换 `~/.codex/auth.json`。
- **多账户导入** — 可通过选择本地文件或手动粘贴 JSON 内容导入 Codex `auth.json`。
- **自动识别邮箱** — 自动从 `auth.json` 中解析账户邮箱。
- **自定义显示名称** — 为任意账户设置便于记忆的名称。
- **用量与余额展示** — 为 ChatGPT/OAuth `auth.json` 账户显示 Codex 订阅剩余额度，并为支持的 new-api/sub2api API 密钥配置文件显示余额。
- **API 密钥配置文件** — 支持添加 OpenAI 兼容的自定义端点（如 AiHubMix、自建代理等），仅管理 `~/.codex/config.toml` 中的 `openai_base_url` 一行。
- **Claude Code API 配置文件** — 支持添加并切换 Claude Code API 密钥配置文件，写入 `~/.claude/settings.json`。
- **托盘 / 菜单栏快速切换** — 无需打开主窗口即可切换账户。
- **深色 / 浅色主题** — 跟随系统偏好，也可在标题栏手动切换。
- **中英文界面** — 标题栏语言切换按钮，偏好设置本地保存。
- **本地优先的 Tauri 后端** — 无云同步、无应用遥测、无应用内更新检查。所有数据存储于 `~/.auth-switch/auth-switch.db`（SQLite）。唯一的外部请求是用户查看所选配置的用量/余额时访问 OpenAI/ChatGPT、new-api 或 sub2api 端点。
- **Token 刷新安全** — 切换普通 auth 账户前，应用会回读当前的 `auth.json` 并更新数据库，确保 Codex Token 刷新不丢失。

---

## 支持平台

| 平台 | 架构 | 状态 |
|------|------|------|
| macOS | Apple Silicon (arm64) | ✅ 提供 DMG |
| macOS | Intel (x64) | 源码构建 / CI 发布 |
| Windows | x64 | CI 发布 NSIS 安装包 |

> **macOS 未签名构建：** 首次启动可能需要右键 → 打开，或在**系统设置 → 隐私与安全性**中允许该应用。
>
> **Windows 前置要求：** 需要 WebView2 Runtime。多数新版 Windows 已内置；如果应用无法启动，请从 Microsoft 安装。

---

## 安装（macOS 预构建 DMG）

1. 从 `release/` 目录或 GitHub Actions 发布产物下载 `auth-switch-1.0.0-arm64.dmg`。
2. 打开 DMG，将 **auth-switch** 拖入 Applications（应用程序）文件夹。
3. 启动应用；首次运行时会询问是否导入已有的 `~/.codex/auth.json`。

---

## 使用说明

### 首次运行
首次启动时，应用会检测是否存在 `~/.codex/auth.json`。若存在，将提示您是否将其作为第一个账户导入。

### 添加 Codex 账户
在主窗口点击 **添加 auth.json**。选择 **选择本地文件** 可选择 Codex `auth.json` 文件；选择 **粘贴 JSON 内容** 可手动粘贴完整文件内容。

### 切换账户
点击账户列表中任意账户旁的 **切换** 按钮，应用将：
1. 对普通 auth 配置回读当前的 `~/.codex/auth.json` 并更新数据库（防止 Token 丢失）。
2. 将所选账户存储的 `auth.json` 以原子方式写入 `~/.codex/auth.json`。
3. 仅对 API 密钥配置文件，在 `~/.codex/config.toml` 中更新单个受管理的顶层 `openai_base_url` 行。

### 添加 Codex API 密钥配置文件
点击 Codex 标签页中的 **添加 API**，填写名称、Base URL 和 API 密钥。应用将：
- 写入 API 密钥格式的 `auth.json`（`{ "auth_mode": "apikey", "OPENAI_API_KEY": "..." }`）。
- 仅在 `~/.codex/config.toml` 中添加或更新 `openai_base_url = "..."` 一行。

切换回普通 auth 账户时，auth-switch 管理的 `openai_base_url` 行会被注释掉，而不是删除无关配置。

### 查看用量和 API 余额
对于使用 ChatGPT/OAuth 的普通 Codex `auth.json` 账户，当前账户卡片会显示 Codex 限额窗口的剩余额度。对于 Codex API 密钥配置文件，auth-switch 会尝试支持的服务端余额接口：优先 sub2api `/v1/usage`，再尝试 new-api `/dashboard/billing/subscription` 和 `/dashboard/billing/usage`。

Claude Code API 配置文件在所配置的 Base URL 支持 sub2api `/v1/usage` 端点时，也会显示服务端余额。主窗口打开时会统一刷新一次，单行手动刷新仍保留。

### 添加 Claude Code API 配置文件
切换到 **Claude Code** 标签页并点击 **添加 Claude API**。填写名称、Auth Token，以及可选的 Base URL、Haiku / Sonnet / Opus 模型映射。切换到该配置文件时，应用会将它写入 `~/.claude/settings.json`。

Claude Code 切换与 Codex 切换互不影响：可以同时存在一个当前 Codex 账户和一个当前 Claude Code 配置文件。

### 切换账户或配置文件
点击当前标签页中任意账户 / 配置文件旁的 **切换**。Codex 会更新 `~/.codex/auth.json`，API 密钥配置文件还会更新受管理的 `openai_base_url` 行。Claude Code 会先回读当前实时 `~/.claude/settings.json`，再将所选配置文件原子写入该文件。

### 托盘 / 菜单栏
托盘菜单支持切换 Codex 账户和 Claude Code 配置文件、打开主窗口以及退出应用，无需打开主窗口。它使用单色系统托盘 / 菜单栏图标，并显示本地化文字，以及 **打开窗口**（macOS 为 `Command+,`，Windows 为 `Ctrl+W`）和 **退出**（macOS 为 `Command+Q`，Windows 为 `Ctrl+Q`）快捷键。关闭主窗口后 auth-switch 会继续留在托盘 / 菜单栏中；请使用 **退出** 来结束应用。

### 重命名 / 删除 / 编辑
点击账户行右侧的 **⋯** 按钮。菜单始终包含 **重命名** 和 **删除**；对于 API 密钥配置文件（Codex API 或 Claude Code），还会显示 **编辑**，可修改名称、URL、密钥或模型映射。

---

## Codex auth 文件路径

```
${CODEX_HOME:-$HOME/.codex}/auth.json
```
通常为：`~/.codex/auth.json`

应用只读写这个 Codex 官方路径。不支持自定义 Codex 路径，也不会重写 provider 表、MCP、profiles、sandbox 或其他 Codex 配置段。

## Claude Code settings 文件路径

```
~/.claude/settings.json
```

Claude Code API 配置文件以 `env` settings 形式保存，包含 `ANTHROPIC_AUTH_TOKEN`，以及可选的 `ANTHROPIC_BASE_URL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL` 和 `ANTHROPIC_DEFAULT_OPUS_MODEL`。auth-switch 只写入这个 Claude Code 官方 settings 文件。

---

## 开发指南

### 环境要求
- Node.js ≥ 20
- pnpm ≥ 9
- Rust stable（推荐使用 `rustup`）
- Tauri v2 平台前置依赖
- macOS：Xcode Command Line Tools
- Windows：Microsoft C++ Build Tools 和 WebView2 Runtime

### 安装依赖
```bash
pnpm install
```

### 开发模式运行
```bash
pnpm dev
```
该命令会启动 Vite 并打开 Tauri v2 应用。

### 类型检查
```bash
pnpm typecheck
```

### Rust 检查
```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

### 生产构建（不生成安装包）
```bash
pnpm build
```

### 打包
```bash
pnpm dist        # 所有已配置安装包
pnpm dist:mac    # macOS DMG
pnpm dist:win    # Windows NSIS 安装包
```

Tauri 打包产物位于 `src-tauri/target/release/bundle/`。macOS 脚本还会把最新 DMG 复制到 `release/auth-switch-<version>-<arch>.dmg`，以兼容发布和 Homebrew 流程，并输出文件大小和 SHA256。

GitHub Release 应通过 GitHub Actions 发布，优先使用 `.github/workflows/manual-release.yml`。

---

## 项目结构

```
src-tauri/       # Tauri v2 Rust 后端
  src/           # commands、托盘、对话框、通知、SQLite、Codex 服务
  capabilities/  # Tauri v2 权限
  icons/         # Tauri 打包图标
src/
  renderer/      # React UI
    api/         # 类型化 Tauri invoke/listen 适配器
    components/  # AccountList、AccountRow、各对话框等
    hooks/       # useAccounts、useTheme
    i18n/        # i18next 配置 + en.json / zh.json 语言文件
  shared/        # 共享 TypeScript 类型
plans/           # 代理生成的实现计划
```

---

## 数据存储位置

| 内容 | 路径 |
|------|------|
| 账户数据库 | `~/.auth-switch/auth-switch.db` |
| 当前 Codex auth | `~/.codex/auth.json` |
| 当前 Claude Code settings | `~/.claude/settings.json` |
| Codex 配置（仅 URL 行） | `~/.codex/config.toml` |

---

## 许可证

MIT
