# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 协作约定（用户要求，最高优先）

- **始终用中文**与用户对话（回复、提问、总结都用中文）。
- **commit 信息用中文**，沿用仓库现有 `feat:/fix:/test:/docs:` 前缀风格。
- **每处理完一项任务立即 commit 并 push**（类似存档），不要攒多项改动合并成一个大提交。
- 用户 GitHub 账号（hackninety）名下另有 **`*-ts-lib` 系列库**（shj-ts-lib、tbss-ts-lib、nhx-ts-lib、qmdj-ts-lib、lrdq-ts-lib、zslj-ts-lib），其项目群的部分功能引用这些库；若任务需要改动它们，可同步修改对应仓库并推送。

## 常用命令

```bash
npm run dev          # Vite 开发服务器（端口 5173）
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm test             # vitest 全量单测
npx vitest run tests/golden.test.ts   # 跑单个测试文件
npx vitest run -t '闰月'               # 按用例名过滤
npm run mcp:check    # MCP 层 tsc 类型检查（tsconfig.mcp.json）
npm run mcp:build    # esbuild 打包 MCP server → dist-mcp/server.mjs
npm run mcp:e2e      # stdio 协议检查（stdout 必须全为 JSON-RPC）
npm run e2e          # Playwright UI e2e（webServer 自启）
```

CI（`.github/workflows/test.yml`）按 lint → build → mcp:check → mcp:build → mcp:e2e → test → e2e 全跑，`TZ=Asia/Shanghai`（排盘比较基准为北京时，本地时区不同会引起个别用例差异）。

## 架构总览

React 19 + Vite + Tailwind 4 的八字排盘应用。核心设计哲学：**确定性查表/规则预检数据随导出喂 AI，让 AI「引用而非回忆」**（反幻觉）；量化评分类数据（人生K线）仅页面展示、不随导出（分数易被 AI 锚定致误报）。

### 排盘引擎层 `src/lib/engine/`
- `registry.ts` 按 id 惰性加载双引擎：`mystilight`（默认，渊海子平体系）与 `tyme`（tyme4ts，起运流派多，主要用于对拍校验）；`compare.ts` 生成对拍报告，区分「硬差异」（必须一致）与「流派性差异」（预期口径不同）。
- `mystilight/upstream.ts` 是 npm 包 `mystilight-8char` 的**唯一接入点**（该包 main 字段指向不存在的文件，此处直连 `index.js`，勿绕过）；`mystilight/ext/` 为应用内扩展层：流月/流日/流时、农历↔公历转换、闰月查询（`getLunarLeapMonth`）、真太阳时、八字反查。
- `solar.ts` 真太阳时预处理（经度差+均时差），两引擎共用同一实现。

### 数据流（单向）
`BaziForm` → `calculateBazi`（`src/lib/bazi.ts`）→ 引擎 `EightCharJSON` + 应用私挂字段（`BaziResultX`）→ 组件渲染；导出走 `buildExportJSON` → TOON（`toon.ts`）或 `buildExportMarkdown`（`markdown-export.ts`）。`buildExportJSON` 是 TOON/Prompt/MCP 三处共用的唯一数据组装点。

### AI 锚定数据层 `src/lib/`（确定性模块，均随导出）
`tiaohou`（穷通宝鉴 120 条调候查表+原局得否）、`siling`（人元司令分野）、`geju`（子平真诠机械取格）+ `zipingzhenquan`（八格原文，懒加载 chunk，导出前需 preload）、`patterns`（28 条十神组合预检）、`yunpatterns`（岁运格局扫描）、`yongshen`（用神三法合参）、`yingqi`（应期引动预检）、`xiangfa`（盲派象法表）、`shensha-dict`（神煞释义）、`wuxing-energy`（宫位轴能量计点）、`decadeplan`（十年规划表）、`wuyunliuqi`（五运六气）。干支冲合刑害基础表统一下沉在 `ganzhi.ts`。

### 人生K线 `lifekline.ts` —— 仅页面展示
运势量化模型；其身强弱判定 `judge` 被 patterns/decadeplan/yongshen/wuxing-energy 复用（内部输入）。**lifeKline 分数与十年规划表的均值/高光/低谷列均不进 TOON/MD 导出**；MCP 的 `get_kline` 工具仍可按需查询。

### 提示词协议 `prompt-template.ts`
AI 角色 + 分析框架 + 反幻觉纪律 + 六大专项深挖 + 四流派视角切换协议，Markdown 导出与 AI Prompt 共用；改导出字段时须同步这里的字段说明文字。

### MCP Server `mcp/`
`paipan` 返回紧凑摘要 + chartId（进程内 LRU 缓存 20 张盘），后续 `query_year/query_yingqi/query_liuyue/...` 凭 chartId 按需深挖——按需查询哲学，优于一次吞完整导出。stdout 必须全为 JSON-RPC，顶层 `console.log` 会污染协议（`mcp:e2e` 专门拦这个）。

### 测试基线
- `tests/golden.test.ts`：四柱/起运/双引擎硬一致 + 农历闰月查表，**期望值经手工核对后冻结**，用于防 dependabot 每周升级引擎依赖（mystilight-8char/tyme4ts/lunar-javascript）引入排盘回归。
- 改导出结构时须同步 `tests/yun.test.ts`（导出集成断言）、`tests/toon.test.ts`（TOON 往返/Prompt）、`tests/analysis.test.ts`（锚定字段）。
- 已知技术债（如 mystilight 运行时 `shiShenZhi` 实为 `string[]` 与 d.ts 声明不符）记录在 `docs/Todo.md`，改动引擎 seam 层前先读它。
