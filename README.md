# 八字排盘 (BaZi PaiPan)

基于 React + TypeScript 的现代八字排盘工具，采用渊海子平体系，提供完整的四柱八字排盘、大运流年流月流日流时分析、JSON 导出等功能。

## 技术栈

- **框架**: Vite + React 18 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + lucide-react
- **动画**: framer-motion
- **排盘核心**: [mystilight-8char](https://github.com/mystilight/mystilight-8char)（npm 直接依赖，渊海子平体系）+ 应用内扩展层 `src/lib/engine/mystilight/ext`（十神/流月/流日/流时/真太阳时/农历转换/八字反查）
- **第二引擎**: [tyme4ts](https://github.com/6tail/tyme4ts)（6tail 标准干支历体系，用于双引擎对拍校验）
- **通知**: react-hot-toast

## 功能特性

- **双引擎排盘** - 渊海子平（mystilight）/ 干支历标准（tyme4ts）可切换，插件式架构便于扩展第三家
- **双引擎对拍** - 同一命例双引擎并行校验：四柱/大运一致性硬校验 + 起运/宫位流派性差异分级展示，结果可随 JSON/Markdown 导出喂 AI
- **四柱排盘** - 公历/农历/八字反查三种输入方式
- **真太阳时** - 基于出生城市经度自动校正（80+ 城市，按省分组）
- **五行力量** - 可视化进度条展示五行力量分布
- **命盘要素** - 胎元、胎息、命宫、身宫
- **渊海子平** - 身强、湿度、阴阳、月令、太岁分析
- **命理分析** - 喜用神、日时分析、三命通会
- **调候用神** - 穷通宝鉴 120 条「日主×月支」查表 + 原局透藏得否判定，随导出供 AI 引用而非回忆
- **穷通宝鉴原文库** - 维基文库公有领域全文解析为 120 格原文段，只随盘导出本造那一条（AI 引用原文以此为准）
- **盲派象法表** - 十干/十二支本象 + 十神象义通行类象简表，支撑盲派视角取象直断
- **人元司令** - 按精确节气时刻定出生所值司令之干（月令分日用事表），含司令十神与交界提示
- **格局判定** - 子平真诠机械取格（本气透干/中余气透/禄刃变通），相神忌神候选透藏扫描，成败细辨留给 AI
- **应期预检** - 婚恋/事业/财运候选引动年（星透干/星合日主/宫逢合冲/财库冲开），回答「哪年」类问题的锚定数据
- **十神组合预检** - 伤官见官/杀印相生/官杀混杂/魁罡/从格候选等 28 条经典组合确定性检出并标注落点
- **神煞释义** - 盘中出现的神煞附一行经典义（三命通会/协纪辨方书通说），消除 AI 编义
- **干支关系** - 天干关系、地支关系（合冲刑害）
- **大运流年** - 五级联动：大运 → 流年 → 流月 → 流日 → 流时
- **人生K线** - 运势量化评分（喜忌+十神+宫位冲刑合害+大运冲提纲等十年主题+岁运互冲+伏吟+三合三会成局+调候得济/受伤+空亡冲空+神煞）绘成股票式蜡烛图，红涨绿跌、5年均线、大运分段、悬停逐年因素明细，评分随导出喂 AI
- **流月K线下钻** - 点击年K线展开该年 12 个月子图（月度模型与年线同源，锚定年开盘值表达年内节奏，悬停月因素明细）
- **TOON 导出** - 数据载荷用 [TOON](https://github.com/toon-format/toon)（JSON 数据模型的紧凑无损等价表示，实测省 21% 字符、token 更省；流月仅展开近年附五虎遁口诀），含全部锚定数据，可直接喂 AI 分析
- **Markdown 导出** - 完整命盘（四柱/十神/藏干/五行/调候/司令/组合/大运流月/五运六气）+ AI 分析框架，内容最全，喂 AI 分析更详细
- **AI 分析协议** - 反幻觉纪律（引用查表数据而非凭记忆）、盘面事实清单先行、结论置信度分级、财官婚健子女六亲六大专项深挖清单
- **多流派视角** - 盲派做功/调候穷通宝鉴/旺衰滴天髓/格局子平真诠四派协议内嵌导出，对话中随时切换重读
- **AI Prompt** - 一键生成 AI 分析专用提示词（TOON / Markdown 两种格式）
- **多命盘档案** - 命名保存起盘参数（本机 localStorage），点击档案回填表单并重算
- **合婚对照** - 从档案选两人双盘对照：宫星合冲刑害/互为十神与配偶星应象/喜用互补/调候互济/空亡参照，吉平忌清单不打总分，复制合婚 AI Prompt / 导出 MD / 导出 TOON
- **MCP Server** - 排盘引擎暴露为 MCP 工具（paipan/query_year/应期/流月流日/调候快查/八字反查/双引擎对拍/合婚等 11 个）+ 六大专项深挖 prompts，Claude 等 AI 按需查询盘面而非吞静态导出，见 [docs/MCP.md](docs/MCP.md)
- **响应式** - 移动端适配
- **暗色模式** - 支持明暗主题切换

## MCP Server（AI 按需查询）

```bash
npm run mcp:build   # 产出 dist-mcp/server.mjs（stdio 传输，自包含）
```

仓库自带项目级 `.mcp.json`，本目录内的 Claude Code 直接可用；Claude Desktop 配置与工具目录详见 [docs/MCP.md](docs/MCP.md)。

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 回归测试（golden-case：四柱/起运/双引擎一致/分析模块/MCP）
npm test

# UI e2e（Playwright：排盘/档案/合婚/流月下钻/导出下载）
npm run e2e

# Lint（0 error 0 warning，CI 门槛）
npm run lint

# 预览生产构建
npm run preview
```

## 部署到 Cloudflare Pages

### 方式一：通过 Cloudflare Dashboard（推荐首次部署）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 选择 GitHub 仓库 `react-8char`，点击 **Begin setup**
3. 配置构建参数：

   | 配置项 | 值 |
   |---|---|
   | Framework preset | `Vite` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |
   | Node.js version | `18` 或以上 |

4. 点击 **Save and Deploy** 完成部署，后续推送 main 分支自动触发重新构建。

### 方式二：使用 Wrangler CLI 部署

```bash
# 全局安装 Wrangler（如已安装可跳过）
npm install -g wrangler

# 登录 Cloudflare 账号
wrangler login

# 构建项目
npm run build

# 部署到 Cloudflare Pages（首次会提示创建项目名）
wrangler pages deploy dist --project-name react-8char
```

后续更新只需重新执行最后两条命令即可。

### 环境变量

本项目无需配置服务端环境变量，所有计算均在浏览器端完成。

## 项目结构

```
src/
  main.tsx              # 入口
  App.tsx               # 主组件（主题、状态管理）
  lib/
    bazi.ts             # 排盘逻辑（调用 mystilight-8char-v2）
    cities.ts           # 城市列表（80+ 城市，按省分组）
    utils.ts            # 工具函数（五行颜色、十神颜色等）
    prompt-template.ts  # AI 提示词模板
  components/
    BaziForm.tsx        # 输入表单（公历/农历/八字反查）
    BaziChart.tsx       # 排盘结果总布局
    PillarCard.tsx      # 四柱卡片
    WuXingChart.tsx     # 五行力量图
    ShenShaList.tsx     # 命盘要素/渊海子平/命理分析/干支关系
    DaYunTimeline.tsx   # 大运·流年·流月·流日·流时
    JsonExport.tsx      # JSON 导出/复制/AI Prompt
    ThemeToggle.tsx     # 主题切换
```

## 依赖说明

本项目核心排盘计算依赖 [`mystilight-8char-v2`](https://github.com/hackninety/mystilight-8char-v2)，该库是 [mystilight-8char](https://github.com/mystilight/mystilight-8char) 的 fork 扩展版本，在不修改原版代码的前提下新增了流月/流日/流时/十神计算等扩展 API。依赖通过 GitHub 仓库直接引用（`github:hackninety/mystilight-8char-v2`），`npm install` 时自动拉取，无需额外配置。

## 许可证

MIT
