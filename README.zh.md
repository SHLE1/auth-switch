# auth-switch

中文 · [English](./README.md)

一款仅限本地的 macOS/Windows 桌面应用，通过管理 `auth.json` 配置文件和可选的 API 密钥配置文件，实现 OpenAI Codex 账户的快速切换。

---

## 功能特性

- **一键切换账户** — 原子性地替换 `~/.codex/auth.json`。
- **多账户导入** — 可导入任意数量的 Codex `auth.json` 文件。
- **自动识别邮箱** — 自动从 `auth.json` 中解析账户邮箱。
- **自定义显示名称** — 为任意账户设置便于记忆的名称。
- **API 密钥配置文件** — 支持添加 OpenAI 兼容的自定义端点（如 AiHubMix、自建代理等），仅管理 `~/.codex/config.toml` 中的 `openai_base_url` 一行。
- **托盘 / 菜单栏快速切换** — 无需打开主窗口即可切换账户。
- **深色 / 浅色主题** — 跟随系统偏好，也可在标题栏手动切换。
- **中英文界面** — 标题栏语言切换按钮，偏好设置本地保存。
- **完全本地** — 无网络请求，无云同步。所有数据存储于 `~/.auth-switch/auth-switch.db`（SQLite）。
- **Token 刷新安全** — 切换账户前，应用会回读当前的 `auth.json` 并更新数据库，确保 Codex Token 刷新不丢失。

---

## 支持平台

| 平台 | 架构 | 状态 |
|------|------|------|
| macOS | Apple Silicon (arm64) | ✅ 提供 DMG |
| macOS | Intel (x64) | 源码构建 |
| Windows | x64 | 源码构建 |

> **macOS 未签名构建：** 首次启动可能需要右键 → 打开，或在**系统设置 → 隐私与安全性**中允许该应用。

---

## 安装（macOS 预构建 DMG）

1. 从 `release/` 目录下载 `auth-switch-0.1.0-arm64.dmg`。
2. 打开 DMG，将 **auth-switch** 拖入 Applications（应用程序）文件夹。
3. 启动应用；首次运行时会询问是否导入已有的 `~/.codex/auth.json`。

---

## 使用说明

### 首次运行
首次启动时，应用会检测是否存在 `~/.codex/auth.json`。若存在，将提示您是否将其作为第一个账户导入。

### 添加 Codex 账户
在主窗口点击 **添加 auth.json**，或通过**托盘 → 添加 auth.json** 操作。选择一个 Codex `auth.json` 文件即可。

### 切换账户
点击账户列表中任意账户旁的 **切换** 按钮，应用将：
1. 回读当前的 `~/.codex/auth.json` 并更新数据库（防止 Token 丢失）。
2. 将所选账户存储的 `auth.json` 以原子方式写入 `~/.codex/auth.json`。

### 添加 API 密钥配置文件
点击标题栏中的 **添加 API**，填写名称、Base URL 和 API 密钥。应用将：
- 写入 API 密钥格式的 `auth.json`（`{ "auth_mode": "apikey", "OPENAI_API_KEY": "..." }`）。
- 仅在 `~/.codex/config.toml` 中添加或更新 `openai_base_url = "..."` 一行。

切换回普通 auth 账户时，该 `openai_base_url` 行会被注释掉，而不是直接删除。

### 托盘 / 菜单栏
托盘菜单支持切换账户、打开主窗口、添加 auth 文件以及退出应用，无需打开主窗口。

### 重命名 / 删除
使用账户行内的按钮进行重命名或删除操作。

---

## Codex auth 文件路径

```
${CODEX_HOME:-$HOME/.codex}/auth.json
```
通常为：`~/.codex/auth.json`

应用只读写此路径，不修改其他 Codex 配置。

---

## 开发指南

### 环境要求
- Node.js ≥ 20
- pnpm ≥ 9

### 安装依赖
```bash
pnpm install
```

### 开发模式运行
```bash
pnpm dev
```

### 类型检查
```bash
pnpm typecheck
```

### 生产构建
```bash
pnpm build
```

### 打包（DMG / NSIS 安装包）
```bash
pnpm dist
```

DMG 文件将输出至 `release/auth-switch-<version>-arm64.dmg`。

---

## 项目结构

```
src/
  main/          # Electron 主进程（IPC、托盘、窗口、Codex 服务）
    codex/       # auth.json 读写、config.toml 管理
    db/          # SQLite 数据库层
    services/    # 账户切换逻辑
  renderer/      # React UI
    components/  # AccountList、AccountRow、各对话框等
    hooks/       # useAccounts、useTheme
    i18n/        # i18next 配置 + en.json / zh.json 语言文件
  preload/       # contextBridge API 暴露
  shared/        # 共享 TypeScript 类型
plans/           # 代理生成的实现计划
```

---

## 数据存储位置

| 内容 | 路径 |
|------|------|
| 账户数据库 | `~/.auth-switch/auth-switch.db` |
| 当前 Codex auth | `~/.codex/auth.json` |
| Codex 配置（仅 URL） | `~/.codex/config.toml` |

---

## 许可证

MIT
