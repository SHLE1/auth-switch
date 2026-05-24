# auth-switch Frontend Design Guidelines

> 生成日期：2026-05-23  
> 分支：feat/new-ui  
> 审计模型：frontend-design skill (7-dimension checkpoint)

---

## 设计原则

**Commit to the vision.** 这是一个精密仪器。用户打开它、切换账户、关闭它——全程不超过 5 秒。每一个设计决策必须加速这个流程，否则就该消失。这里的"大胆"意味着将克制推到逻辑极限：没有任何装饰性元素能通过审计。

---

## 七维度设计定义

### Tone · 基调
**精密仪器感** — 像 Raycast 打开的那一秒：边界清晰、层次分明、目的明确。无圆润、无友好引导、无多余卡片阴影。静默而权威。参照：Raycast、1Password Mini。

### Color · 颜色
**浅色主导，冷白底 + 灰色分层**

| 用途 | Light | Dark |
|------|-------|------|
| 背景 body | `#F5F7FA`（冷白，带蓝调） | `#0B0E14`（深蓝黑） |
| 卡片 card | `#FFFFFF` + 细边框 | `#131820` |
| 边框 border | `#E2E8F0` | `#1E2736` |
| 文字主色 | `#0F172A` | `#E2E8F0` |
| 文字次色 | `#64748B` | `#8494AA` |
| Destructive | `#DC2626` | `#991B1B` |

整体无彩色 accent，只有结构色与标准 destructive 红。不用纯白/纯黑，坚持有温度的冷调。

### Typography · 字体
**Geist Sans + JetBrains Mono**

- **UI 文字**：[Geist Variable](https://vercel.com/font)（`@fontsource-variable/geist`）— Vercel 的精密工具字体，几何但不冷漠
- **数据字段**：[JetBrains Mono](https://www.jetbrains.com/lp/mono/)（`@fontsource/jetbrains-mono`）— 用于 email、路径、API key、所有机器数据，等宽的工程感完美契合"管理凭据"的语境
- **替换理由**：Inter 是 SaaS 的字体，不是工具的字体

### Motion · 动效
**克制微动效**

- Dialog：保留 Radix 内置 fade + scale
- 账户行：`transition-colors duration-150` hover 状态
- Switch 按钮：签名按压感 `scale(0.97) → 1.0`，120ms ease-out
- 当前账户指示点：`scale-in` keyframe（0.18s）
- 所有 duration ≤ 200ms，没有 scroll-triggered 动画

### Spatial · 空间
**区域分隔 + 等宽内边距**

- 全局水平内边距统一 `px-4`（16px）
- Header / 内容区 / Footer 用 `border-b/t` 隔开，不用背景色差
- 账户行内边距 `px-3 py-2.5`，紧而不压
- 基准栅格：4px
- 圆角：`0.375rem`（6px），比默认 8px 更精密

### Backgrounds · 背景处理
**冷白底 + 灰色分层，无纹理**

- body 与 header/footer 同色（`#F5F7FA`），用 `border` 线隔开区域
- card 用纯白 `#FFFFFF` + `border` 拉开层次
- 绝对不加渐变、噪点、毛玻璃——精密仪器不需要氛围感

### Differentiation · 差异化记忆点
**Switch 按钮签名交互**

这是整个应用最重要的按钮，必须有记忆点：

1. 点击时：`scale(0.97)` 按压感（120ms）
2. 切换中：按钮文字变 `Switching…` + `Loader2` spinner，禁用状态
3. 成功后：行内指示点从空心 `○` 以 `scale-in` 动画填充为实心 `●`，按钮位置出现 `current` badge 替换

全程约 300ms，像机械锁定的感觉。

---

## NEVER Generate（禁止清单）

| 禁止 | 原因 |
|------|------|
| `Inter` 作为主字体 | 已替换为 Geist，不要回滚 |
| `rounded-xl` 卡片 | 太友好；工具用 `rounded-md`（6px） |
| `shadow-md` / `shadow-lg` | 层次靠 border + 背景色差，不靠阴影 |
| 任何蓝色 accent（`text-blue-500` 等） | 应用黑白灰，见到立即删掉 |
| 随机 hover 动效 | 只有 Switch 按钮有签名交互，其余 `transition-colors` |
| 堆叠卡片布局 | 账户行是列表行，不是卡片 |
| `max-w-7xl mx-auto` | 480px 小窗口，无需响应式容器 |
| 可视为可点击但无行为的元素 | badge、指示点不可点，Switch 才是操作入口 |

---

## 改进计划

### Phase 1 · 色彩系统 + 字体（基础，影响全局）

**安装字体**

```bash
pnpm add @fontsource-variable/geist @fontsource/jetbrains-mono
```

**`src/renderer/main.tsx`** 引入：

```ts
import "@fontsource-variable/geist";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
```

**`tailwind.config.ts`** 更新 fontFamily：

```ts
fontFamily: {
  sans: ["GeistVariable", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
  mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
}
```

**`src/renderer/index.css`** CSS 变量重写：

```css
:root {
  --background:    210 17% 97%;   /* #F5F7FA 冷白 */
  --foreground:    222 47% 11%;   /* #0F172A */
  --card:          0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover:       0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary:       222 47% 11%;
  --primary-foreground: 0 0% 98%;
  --secondary:     210 17% 95%;
  --secondary-foreground: 222 47% 11%;
  --muted:         210 17% 95%;
  --muted-foreground: 215 16% 47%; /* #64748B */
  --accent:        210 17% 92%;
  --accent-foreground: 222 47% 11%;
  --destructive:   0 72% 51%;
  --destructive-foreground: 0 0% 98%;
  --border:        214 32% 91%;   /* #E2E8F0 */
  --input:         214 32% 91%;
  --ring:          222 47% 11%;
  --radius:        0.375rem;      /* 6px 更精密 */
  color-scheme:    light;
}

.dark {
  --background:    222 47% 5%;    /* #0B0E14 深蓝黑 */
  --foreground:    213 31% 91%;   /* #E2E8F0 */
  --card:          222 33% 9%;    /* #131820 */
  --card-foreground: 213 31% 91%;
  --popover:       222 47% 5%;
  --popover-foreground: 213 31% 91%;
  --primary:       0 0% 98%;
  --primary-foreground: 222 47% 11%;
  --secondary:     217 33% 14%;
  --secondary-foreground: 213 31% 91%;
  --muted:         217 33% 14%;
  --muted-foreground: 215 20% 55%;
  --accent:        216 34% 17%;
  --accent-foreground: 213 31% 91%;
  --destructive:   0 63% 31%;
  --destructive-foreground: 213 31% 91%;
  --border:        217 33% 17%;   /* #1E2736 */
  --input:         217 33% 17%;
  --ring:          213 31% 91%;
  color-scheme:    dark;
}
```

---

### Phase 2 · 布局精化（结构性改变）

**Header**：去掉图标盒子，纯文字排版

```
left:  auth-switch（text-sm font-semibold）
       LOCAL ONLY（mono-label text-[10px] text-muted-foreground）

right: [EN | 中文] [☀/🌙]
```

- header 高度压缩：`py-2.5`（从 `py-3` 缩减）

**CurrentAccountCard → 嵌入式状态区**

- 不再是浮起的卡片，改为嵌入式状态区：背景与 body 同色，只有下边框分隔
- 去掉 `ShieldCheck` / `Terminal` 图标（视觉噪音）
- 信息层次：`ACTIVE` mono 小帽 → 账户名 `font-semibold` → 邮箱/URL `font-mono text-xs text-muted-foreground` → 类型 badge

**AccountRow 精简**

- 指示点：`size-3.5`（从 `size-5` 缩小），更精密
- Rename / Delete 移至行右侧 `···` DropdownMenu（需 `pnpm dlx shadcn add dropdown-menu`），主视图只保留核心信息
- 行间改用 `Separator` 细线，而非每行独立 border box

**Footer**：压缩为单行

```
Local only · ~/.auth-switch/auth-switch.db
```
`text-[11px] font-mono text-muted-foreground`

---

### Phase 3 · Switch 签名交互（差异化核心）

**`App.tsx`** 添加 switchingId 状态：

```ts
const [switchingId, setSwitchingId] = useState<string | null>(null);
```

**AccountRow** Switch 按钮三态：

| 状态 | 展示 |
|------|------|
| idle | `[Switch]` outline 按钮 |
| switching | `[Switching…]` disabled + Loader2 spinner |
| current | `[current]` badge，不可点击 |

**`tailwind.config.ts`** 添加指示点动画 keyframe：

```ts
keyframes: {
  "dot-fill": {
    from: { transform: "scale(0)", opacity: "0" },
    to:   { transform: "scale(1)", opacity: "1" },
  },
},
animation: {
  "dot-fill": "dot-fill 0.18s ease-out",
},
```

**AccountRow 指示点**：

```tsx
<span
  className={cn(
    "size-3.5 rounded-full border transition-colors duration-150",
    account.is_current
      ? "bg-foreground border-foreground animate-[dot-fill_0.18s_ease-out]"
      : "border-border"
  )}
/>
```

**Switch 按钮按压感**（覆盖 shadcn Button）：

```tsx
className="active:scale-[0.97] transition-transform duration-100"
```

---

### Phase 4 · 细节打磨

| 项目 | 改动 |
|------|------|
| Notice banner | 细边线 + mono 文字，去掉 `bg-muted` 色块，改为 `border-l-2` 左边线风格 |
| Empty state | 加 `FileKey` 图标（Lucide），文字更简洁 |
| Loading state | 骨架屏：3 行 `animate-pulse` 占位行，而非文字 |
| Dialog spacing | gap 从 4 压缩到 3，更紧凑 |
| Badge "auth.json" | `outline` variant，`text-[10px]` |
| DropdownMenu | `pnpm dlx shadcn add dropdown-menu` |
| Tooltip | 给 Sun/Moon 和语言按钮加 Tooltip 提示 |

---

## 文件变更地图

```
src/renderer/
├── index.css              Phase 1 — CSS 变量全替换
├── index.html             无需改动
├── main.tsx               Phase 1 — 引入 fontsource
├── App.tsx                Phase 2+3 — 布局 + switchingId 状态
├── hooks/
│   └── useTheme.ts        无需改动
├── components/
│   ├── CurrentAccountCard.tsx   Phase 2 — 重构为状态区
│   ├── AccountRow.tsx           Phase 2+3+4 — 精简 + 签名交互
│   ├── AccountList.tsx          Phase 2 — Separator 替代 border box
│   ├── ImportButton.tsx         Phase 4 — 小调整
│   ├── RenameDialog.tsx         Phase 4 — spacing tighten
│   ├── ApiProfileDialog.tsx     Phase 4 — spacing tighten
│   └── FirstRunDialog.tsx       Phase 4 — spacing tighten
├── components/ui/
│   └── dropdown-menu.tsx        Phase 3 — 新增（shadcn add）
tailwind.config.ts         Phase 1+3 — fontFamily + dot-fill keyframe
```

---

## 执行建议

按 Phase 顺序执行，每个 Phase 后构建验证：

```bash
pnpm build   # 验证 TypeScript + Vite 无错
pnpm dist    # 每个 Phase 完成后出一个 DMG
```

Phase 1 完成后视觉感知最大，建议先执行后评估再继续。
