# 八字排盘 (BaZi PaiPan)

基于 React + TypeScript 的现代八字排盘工具，采用渊海子平体系，提供完整的四柱八字排盘、大运流年流月流日流时分析、JSON 导出等功能。

## 在 AI 中使用统一 MCP

支持 MCP 的 AI 客户端可以直接连接 **`https://mcp.0x7c.cc/mcp`**，传输方式选择 **Streamable HTTP**，**无需访问令牌或登录**。统一服务负责排盘和检索 `common-ts-lib` 资料，AI 根据返回的盘面与原文进行分析。

统一服务 `paipan-common` 提供 **31 个工具**：6 个跨术数排盘与 common 检索基础工具、11 个 `bazi_` 八字高级工具、14 个 `taiyi_` 太乙高级工具；另有 7 个提示词和 5 个静态资源。本机 stdio 与远程 HTTP 使用同一套能力，每次传完整参数，不使用旧 `chartId`。

`prepare_reading.searchQueries` 可明确提供 1–3 个检索关键词，原问题保留在 `question`，结果会返回实际关键词。

首次配置时按所用客户端选择一条；本机 stdio 与远程 HTTP 二选一。已存在 `paipan-common` 时先在客户端移除旧同名连接再更换方式，旧 `bazi`、`taiyi`、`paipan-common-remote` 连接可移除，避免重复注册。保存后重连 MCP。

```bash
# Codex
codex mcp add paipan-common --url https://mcp.0x7c.cc/mcp

# Claude Code
claude mcp add --transport http --scope user paipan-common https://mcp.0x7c.cc/mcp
```

命令分别用于对应客户端，配置后重新连接 MCP；已有本机 `paipan-common` 配置时，本机与远程选一种即可。其他支持远程 MCP 的客户端填写上述地址、传输方式和“无鉴权”。配置方法见 [Codex 官方文档](https://learn.chatgpt.com/docs/extend/mcp)与 [Claude Code 官方文档](https://code.claude.com/docs/en/mcp)。

可直接向 AI 发送以下示例：

```text
先调用 system_catalog 核对 bazi 的参数，再用 prepare_reading 只排八字。
出生资料：公历 1990-05-17 10:30，男，时区固定 +08:00，不启用真太阳时。
查询时刻：2026-10-29 12:00，时区固定 +08:00。
请检索 common 中相关命例，用 corpus_read 阅读原文后再分析，并区分盘面事实、案例参考和你的推断；先不读取原题答案。
```

八字输入须明确公历日期、时分、时区及性别；真太阳时还须提供出生地经度。流日、流时查询必须提供 `queryTime`。不知道时辰时先说明缺项，不用中午 12 点代填。IANA 时区（如 `Asia/Shanghai`）按日期处理夏令时，固定 `+08:00` 始终表示东八区，两者不可随意替换。

六个基础工具为 `system_catalog`、`chart_calculate`、`prepare_reading`、`corpus_list`、`corpus_search`、`corpus_read`。八字关联 common 命例库，高级合婚、反查、对拍、应期、K线与经典资源也已迁入同一服务，详见 [MCP 使用说明](docs/MCP.md)。

## 技术栈

- **框架**: Vite 7 + React 19 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + lucide-react
- **动画**: framer-motion
- **排盘核心**: [mystilight-8char](https://github.com/mystilight/mystilight-8char)（npm 直接依赖，渊海子平体系）+ 应用内扩展层 `src/lib/engine/mystilight/ext`（十神/流月/流日/流时/真太阳时/农历转换/八字反查）
- **第二引擎**: [tyme4ts](https://github.com/6tail/tyme4ts)（6tail 标准干支历体系，用于双引擎对拍校验）
- **通知**: react-hot-toast

## 功能特性

- **双引擎排盘** - 渊海子平（mystilight）/ 干支历标准（tyme4ts）可切换，插件式架构便于扩展第三家
- **双引擎对拍** - 同一命例双引擎并行校验：四柱/大运一致性硬校验 + 起运/宫位流派性差异分级展示，结果可随 JSON/Markdown 导出喂 AI
- **四柱排盘** - 公历/农历/八字反查三种输入方式
- **校对时辰（定盘）** - 时辰不详时同日十三时辰（早子~晚子）并排起盘：四柱/时柱十神/起运逐格对比，按「性格特征勾选 ×1 + 已发生大事年份 K线反查 ×2」打匹配分排序；晚子时跨日重点标注（正统派日柱进次日、整盘日主随变），选定后回填代表时刻直接起盘（自动关真太阳时）
- **真太阳时** - 基于出生城市经度自动校正（80+ 城市，按省分组）
- **五行力量** - 可视化进度条展示五行力量分布
- **命盘要素** - 胎元、胎息、命宫、身宫
- **渊海子平** - 身强、湿度、阴阳、月令、太岁分析
- **命理分析** - 喜用神、日时分析、三命通会（仅页面展示，不随导出——日时机械查表的成品断语易被 AI 直接引为结论）
- **调候用神** - 穷通宝鉴 120 条「日主×月支」查表 + 原局透藏得否判定，随导出供 AI 引用而非回忆
- **穷通宝鉴原文库** - 维基文库公有领域全文解析为 120 格原文段，只随盘导出本造那一条（AI 引用原文以此为准）
- **盲派象法表** - 十干/十二支本象 + 十神象义通行类象简表，支撑盲派视角取象直断
- **人元司令** - 按精确节气时刻定出生所值司令之干（月令分日用事表），含司令十神与交界提示
- **格局判定** - 子平真诠机械取格（本气透干/中余气透/禄刃变通），相神忌神候选透藏扫描，成败细辨留给 AI
- **格局·古籍语料** - 《子平真诠》八格「论X+论X取运」原文双源抓取（archive.org 公版书 × 殆知阁滑窗交叉验证，绝不默写），取格命中即附本格原文：面板可展开、随 JSON/MD 导出、MCP 资源全文，AI 论成败救应从背书变引用
- **当前运限格局** - 岁运格局扫描（大运/流年两 scope）：伏吟/天克地冲/冲提纲/岁运并临/岁运交战/阳刃逢冲/空亡入运/财库冲开/运岁凑成伤官见官·枭神夺食·官杀混杂等经典组合确定性命名检出，附依据与经典义
- **十年规划表** - 一运一行人生总览：干支十神/十二长生/扶抑喜忌/K线总运均值/高光低谷年/该运格局 chips，点行展开逐年明细；随导出喂 AI（导出版不含扶抑喜忌列与 K线均值/高光低谷等结论型量化列，防 AI 照抄锚定误报）
- **能量多边形** - 宫位轴（事业官禄/财帛/子女才华/兄弟同侪/父母学业，婚姻随性别并入配偶星轴——八字对应紫微宫分类的六亲星映射）×「原局 → +大运 → +流年」层叠结构占比雷达（干支计点法），**总局/大限/流年三档范围切换**（总局=总命局原局能量），嵌在人生K线内随悬停联动，喜忌红绿着色（与引擎旺衰加权的五行力量互补两个口径）；仅页面展示、不随导出（双套五行数值易被 AI 混用致旺衰误判）
- **应期预检** - 婚恋/事业/财运候选引动年（星透干/星合日主/宫逢合冲/财库冲开）；不随静态导出（候选年+强度分易被 AI 当预言输出致误报），经统一 MCP `bazi_query_yingqi` 按需查询
- **十神组合预检** - 伤官见官/杀印相生/官杀混杂/魁罡/从格候选等 28 条经典组合确定性检出并标注落点
- **神煞释义** - 盘中出现的神煞附一行经典义（三命通会/协纪辨方书通说），消除 AI 编义
- **干支关系** - 天干关系、地支关系（合冲刑害）
- **大运流年** - 五级联动：大运 → 流年 → 流月 → 流日 → 流时
- **人生K线** - 运势量化评分（喜忌+十神+宫位冲刑合害+大运冲提纲等十年主题+岁运互冲+伏吟+三合三会成局+调候得济/受伤+空亡冲空+神煞）绘成股票式蜡烛图，红涨绿跌、5年均线、大运分段、悬停逐年因素明细，仅页面展示、不随 TOON/MD 导出（简化模型分数易被 AI 锚定致误报）；**流年/大限双视图**——大限视图一运一根蜡烛（该运首年开、末年收、区间极值，同日K合成周K），详情面板显示该运十神/长生/喜忌/五维均值/高光低谷/运限格局
- **流月K线下钻** - 点击年K线展开该年 12 个月子图（月度模型与年线同源，锚定年开盘值表达年内节奏，悬停月因素明细）
- **TOON 导出** - 数据载荷用 [TOON](https://github.com/toon-format/toon)（JSON 数据模型的紧凑无损等价表示，实测省 21% 字符、token 更省；流月仅展开近年附五虎遁口诀），含全部锚定数据，可直接喂 AI 分析
- **Markdown 导出** - 完整命盘（四柱/十神/藏干/五行/调候/司令/组合/大运流月/五运六气，渊海子平身强/湿度/阴阳附量化明细）+ AI 分析框架，内容最全，喂 AI 分析更详细
- **流日流时可选导出** - 两个独立勾选：本月流日（公历当月逐日干支/十神/长生，出行择日用）、今日流时（十三时辰干支/十神，早/晚子时分列同 react-zwds，办事择时用）；note 附六十甲子顺推与五鼠遁口诀，AI 可推算表外任意日期的流日流时；默认均不导出
- **AI 分析协议** - 反幻觉纪律（引用查表数据而非凭记忆）、盘面事实清单先行、结论置信度分级、财官婚健子女六亲六大专项深挖清单
- **多流派视角** - 盲派做功/调候穷通宝鉴/旺衰滴天髓/格局子平真诠四派协议内嵌导出，对话中随时切换重读
- **AI Prompt** - 一键生成 AI 分析专用提示词（TOON / Markdown 两种格式）
- **多命盘档案** - 命名保存起盘参数（本机 localStorage），点击档案回填表单并重算
- **公开命例库** - 在表单下方点击「打开命例库」才加载资料；按来源、资料集、年份、原题术数与题材筛选，保留来源版本、原出生资料、时间精度标记和上游预排盘。答案默认隐藏，可直接选择「用于 AI 参考（不含答案）」；先揭晓答案后，才可明确选择「用于 AI 参考（含已揭晓答案）」。点击「隐藏答案」会撤回含答案的参考。所选内容在 TOON / Markdown / AI Prompt 中作为独立参考区，案例不会回填出生表单或保存到个人档案，清除参考、重新排盘或载入档案会移除旧引用。数据和界面来自 [common-ts-lib](https://github.com/hackninety/common-ts-lib) 中独立发布的 `mingli-cases-ts-lib` / `mingli-cases-react` **0.1.1 固定 Release 包**；标为未经核实的时刻或区间中点不得当作确定生时。
- **合婚对照** - 从档案选两人双盘对照：宫星合冲刑害/互为十神与配偶星应象/喜用互补/调候互济/空亡参照，吉平忌清单不打总分，复制合婚 AI Prompt / 导出 MD / 导出 TOON
- **统一八字 MCP** - 11 项八字高级能力已迁入 `react-mcp`，工具名前缀为 `bazi_`，本机和公网均可调用；本仓库保留网页算法与导出，不再单独启动 MCP，见 [docs/MCP.md](docs/MCP.md)
- **响应式** - 移动端适配
- **暗色模式** - 支持明暗主题切换

## 节气时间口径（按出生瞬间）

两引擎（mystilight-8char 内联的 lunar-javascript、tyme4ts）的节气表都是北京时（UTC+8），而排盘输入是出生地钟表或真太阳时。排盘时按输入尺度把节气表平移 `utcOffset×60 + 真太阳时偏移 − 480` 分钟（`src/lib/engine/jieqi-scale.ts`），于是：

- **年柱、月柱、起运**按「出生瞬间 vs 交节瞬间」比较——国外出生、1986–1991 中国夏令时（填 UTC+9）、开启真太阳时都不再错位；
- **日柱、时柱**仍按所填当地钟表（开启时按真太阳时）读取。

例：纽约 2024-02-04 10:00（UTC−5，即北京时 23:00，已过立春 16:27）排 **甲辰 丙寅 戊戌 丁巳**。本项目未提供 `utcOffset` 时默认 UTC+8；同时未启用真太阳时才是零平移。统一 MCP 则要求显式提供时区。

**当前流月单独采用观测时刻的时分和 UTC 偏移**：网页使用浏览器当前时刻，统一 MCP 使用 `queryTime`，均不继承出生地时区或出生真太阳时校正。流月按交节瞬间切换，晚子流派只控制日界；当前流年仍沿用上游的公历年份索引，不应视为精确到立春瞬间的切换。

mystilight 一侧通过 `scripts/mystilight-jieqi-patch.mjs` 在 dev 预构建 / vite build / Vitest 中执行三处受保护的替换，分别处理出生节气尺度、观测时刻尺度与精确流月；每处目标必须恰好匹配一次，上游变化会使构建报错。独立对照与随机用例见 `tests/solar-term-scale.test.ts`。

## 本机使用统一 MCP

在有权限访问的 [react-mcp 仓库](https://github.com/hackninety/react-mcp) 中执行 `npm ci`、`npm run build`，将客户端 `paipan-common` 的 stdio 命令指向 `node D:/WWW/react-mcp/dist/stdio.mjs`（换成自己的绝对路径）。无需构建本仓库的旧专用服务。完整命令和工具目录见 [docs/MCP.md](docs/MCP.md)。

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 回归测试（golden-case：四柱/起运/双引擎一致/分析模块）
npm test

# UI e2e（Playwright：排盘/档案/合婚/流月下钻/导出下载）
npm run e2e

# Lint（0 error 0 warning，CI 门槛）
npm run lint

# 预览生产构建
npm run preview
```

## 静态站点部署

当前线上使用 Cloudflare Workers 静态资源与 Git 集成：安装依赖后运行 `npm run build`，发布目录为 `dist`。构建使用 Node.js **22.12 或以上的 22.x**。下面的 Pages 流程适用于另建 Pages 站点；已有 Worker 应继续使用其现有部署配置。

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
   | Node.js version | `22.12` 或以上的 `22.x` |

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

网页排盘在浏览器端完成，无需服务端环境变量。统一 MCP 的本机 stdio 连接在运行它的电脑中计算；使用统一远程 MCP 时，输入会发送到上述 MCP 服务进行计算与检索。

## 项目结构

```
src/
  main.tsx              # 入口
  App.tsx               # 主组件（主题、状态管理）
  lib/
    bazi.ts             # 排盘逻辑（统一引擎入口）
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

排盘核心直接依赖 npm 包 [`mystilight-8char`](https://github.com/mystilight/mystilight-8char)，通过 `src/lib/engine/mystilight/upstream.ts` 接入，流月/流日/流时/十神等扩展保存在本项目 `src/lib/engine/mystilight/ext/`；第二引擎为 npm 包 `tyme4ts`。旧的 `mystilight-8char-v2` Git fork 已不作为当前依赖。

命例数据与组件由 `common-ts-lib` 单仓库多包管理，各包保留独立包名、接口和 Release 版本；`package.json` 固定各自 `.tgz` 地址，`package-lock.json` 锁定安装内容。部署使用 `npm ci`，无需旧的独立资料库仓库或相邻本地目录。

## 许可证

MIT
