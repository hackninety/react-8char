# 待办 / Backlog

本项目的延后事项。核心排盘、多引擎对拍、多流派 AI 导出、真太阳时（经度差+均时差）已完成。

## 已完成

### ✅ AI 推理数据锚定层 + 提示词协议升级（2026-07）
围绕「AI 引用查表数据而非凭记忆回忆（幻觉源）」新增四个确定性模块并随 JSON/Markdown 导出：
[`tiaohou.ts`](../src/lib/tiaohou.ts)（穷通宝鉴 120 条调候用神查表+原局透藏得否）、
[`siling.ts`](../src/lib/siling.ts)（人元司令分野：分日用事表+精确节气时刻，含北京时换算）、
[`patterns.ts`](../src/lib/patterns.ts)（28 条十神组合/日柱形态/格局线索预检，注意 mystilight 运行时
`shiShenZhi` 实为 string[] 与 d.ts 声明不符）、[`shensha-dict.ts`](../src/lib/shensha-dict.ts)（神煞一行义，
仅注盘中出现者）。提示词新增：反幻觉纪律、盘面事实清单先行、置信度分级、六大专项深挖清单、
滴天髓第四流派视角。同批修复：dili 南半球纬度取绝对值+国外经度中性化、导出流月只展开
当前前后 6 年（JSON 16.9万字符→2.7万）、身强弱 fallback 计入克泄耗并增中和档。
人生K线补大运层作用（大运冲提纲/婚姻宫十年主题、岁运互冲、伏吟、流年干合日干）。

### ✅ 地利方位（喜用神方位适配度 → 五维加成）（2026-07）
新增 [`src/lib/dili.ts`](../src/lib/dili.ts)：由日主强弱+调候定五行喜忌，由出生地**纬度定寒热
（南暖北寒，主轴）、经度定东西**，算出该地助旺的五行是否为喜用，分维（事业看官杀方、财运看财方、
感情看配偶星方、健康/总运看喜用综合方）给出常数加成（±6 封顶），并入人生K线各维曲线。
纬度按**省级气候带**取（[`cities.ts`](../src/lib/cities.ts) `PROVINCE_LATITUDE`，34 省会代表点）——
气候是区域性的，区县级微差对寒热无意义；手动模式可填精确纬度（含国外）。
实测「燥热命南方欠佳/北方有助」符合直觉。
- *可选精化（非必需）*：给主要城市补更精确纬度；但对寒热信号提升有限。

### ✅ tyme4ts 引擎补命理神煞（2026-07）
新增 [`src/lib/engine/tyme/shensha.ts`](../src/lib/engine/tyme/shensha.ts)，按渊海子平经典查法补齐约 20 种常用神煞
（天乙/文昌/太极/禄神/羊刃/金舆/红艳/将星/华盖/驿马/桃花/劫煞/灾煞/亡神/红鸾/天喜/孤辰/寡宿/天德/月德/空亡），
输出形状与 mystilight 一致（含 (基准柱) 后缀与 current 块）。适配器填充 `chart.shensha`，`registry` 置
`capabilities.shensha=true`。经 3 组命例逐柱与 mystilight 对照：tyme 无任何误报（是 mystilight 的正确子集，
mystilight 另有福星/天厨/德秀/童子煞等本模块未纳入的类别）。

### ✅ 人生 K 线可视化（2026-07）
新增 [`src/lib/lifekline.ts`](../src/lib/lifekline.ts)（确定性评分引擎：喜忌定盘 → 大运基调 / 流年十神 /
支冲刑合害 / 神煞吉凶 / 岁运并临 / 天克地冲，逐年 0-100 分 + OHLC）与
[`src/components/LifeKlineChart.tsx`](../src/components/LifeKlineChart.tsx)（手绘 SVG 蜡烛图，零新依赖：
红涨绿跌、5 年均线、大运分段底色、「今」标记、悬停逐年因素明细）。身强判定优先用渊海子平，
tyme 引擎走简化扶抑 fallback（实测两法对同一命例判定一致）。评分数据同步进入
Markdown 导出（大运均分表 + 峰谷 TOP5 含因素）与 JSON 导出（紧凑 lifeKline 字段），供 AI 引用。

### ✅ MCP server 化（2026-07）
排盘引擎暴露为 MCP stdio 工具（[`mcp/`](../mcp)，构建 `npm run mcp:build` → `dist-mcp/server.mjs` 自包含单文件）：
`paipan`（紧凑摘要+chartId，进程内 LRU 缓存）/ `query_year`（单年详情含 K线逐项归因）/ `query_liuyue` /
`query_liuri` / `get_kline` / `query_wuyunliuqi` / `query_tiaohou`（免排盘快查）/ `fanpai` / `compare_engines`。
要点：入口先把 console.log 改道 stderr 再动态加载引擎（stdout 只准走 JSON-RPC，引擎耗时日志会撕协议）；
server instructions 内嵌反幻觉纪律；仓库带项目级 `.mcp.json`。端到端 JSON-RPC 探针 14/14 PASS
（含 fanpai 自洽：北京盘四柱反查命中原出生时间；stdout 纯净性断言）。文档 [docs/MCP.md](MCP.md)。

### ✅ golden-case 回归测试 + CI（2026-07）
vitest（[`tests/`](../tests)，`npm test`，40 例秒级）三层固化：
① [`golden.test.ts`](../tests/golden.test.ts) 命例四柱/起运 + **双引擎硬一致断言**（防引擎升级回归的核心屏障）
+ 边界例（立春前后年月柱换界、早晚子时 sect 语义锁定、真太阳时跨日 sect1 四柱不变仅起运变/sect2 日柱退一日）；
② [`analysis.test.ts`](../tests/analysis.test.ts) 调候/司令（含交界提示与 UTC 换算）/组合预检/词典/地利（南半球/西经/国内）/K线（伏吟、干合、fallback 中和）/流月五虎遁/导出结构（流月窗口相对断言防跨年失效）；
③ [`mcp.test.ts`](../tests/mcp.test.ts) SDK InMemoryTransport 免 spawn 全链路。
期望值取自当前代码 + 双引擎对拍 + 手工复核（立春 2000-02-04 20:40 对天文数据、五虎遁/五鼠遁逐项核）后冻结。
CI：[`.github/workflows/test.yml`](../.github/workflows/test.yml)（push/PR，TZ 钉 Asia/Shanghai），
dependabot 每周引擎升级 PR 自动过测试。**测试中订正**：sect 语义实为 sect1 正统派=晚子时日柱算次日、
sect2 传统派=算当天（MCP 工具描述原先写反，已修）。

### ✅ K线成局/调候/空亡（2026-07）
[`lifekline.ts`](../src/lib/lifekline.ts) 流年层再补三类因素：
① **三合/三会成局**——运岁支补齐命局拼图的最后一块才算事件（本命自带全套属原局特征不计），
大运凑齐为十年主题、流年凑齐为年度事件，按成局五行对日主的十神喜忌加权（会方 9 > 合局 8），
波及维度官杀/印局→事业、财/食伤/比劫局→财运；
② **调候维度**——复用 dili `WARMTH_NEED` 月令暖需，大运+流年干支火/水算暖度，寒命遇火=暖济、
燥命遇火=助燥（干 0.6/支 1、运 0.7/年 1 权重），入总运与健康；
③ **空亡入运**——流年支落日柱旬空显式计分（从神煞综合拆出防双计），被本命/大运支冲则
「冲空反实」不罚（实测重庆盘丑落空被本命未冲全部自动解、子落空唯行午运之年解，逻辑自洽）。
新增 5 例回归断言（成局+调候同年并发、冲空反实两种来源、会方喜例）。

## 计划中

### 0.5 小型增强（择机）
- **书籍数字化二期**：穷通宝鉴分「日主×月支」原文段落库（只导出本造那一条，token 近零）、盲派干支象法/十神象义表。
- **产品向**：多命盘档案管理（现 localStorage 单盘）、合婚双盘对照导出、流月 K 线下钻。

### 1. 紫微斗数引擎（13 宫 K 线）
- **背景**：人生K线现按八字原生的五维（总/事业/财运/感情/健康，十神类象+宫位加权）划分。
  更细的「按 12/13 宫分别出 K 线」属**紫微斗数**范畴——八字没有 12 宫飞星结构，
  「三方四正」是紫微的盘面几何（本宫+对宫+两三合宫），无法移植到八字盘。
- **正确做法**：接入紫微引擎（[iztro](https://github.com/SylarLong/iztro)，2714★）排真紫微盘，
  逐年取流年宫轮转，按各宫**三方四正 + 四化（禄权科忌）**评分 → 12/13 条宫位 K 线。
  技术要点：三方四正**已含对宫**（命宫三方四正即命-财-官-迁），故无需再单独「命身迁结合」，
  按每宫自身的三方四正打分即可；身宫作为加权修正。
- **落点**：作为第三引擎接入现有多引擎架构（`src/lib/engine/ziwei/`），
  K 线组件增加「紫微宫位」数据源。工程量大（新重依赖 + 四化评分模型），独立推进。

## 技术债（复查发现，非阻塞）

- **神煞形状归一化下沉**：`src/lib/markdown-export.ts` 的 `SHENSHA_KEY_CN` 与 `src/components/ShenShaList.tsx` 的 `SHENSHA_POS_LABELS` 是同一份引擎数据形状的两处平行映射（现在 mystilight 与 tyme 两引擎都产出此形状，更值得统一）。理想做法是在引擎层定义 shensha 类型与位置标签，消费端只读，避免多处漂移。
- **真太阳时预处理下沉**：`bazi.ts calculateBazi` 与 `engine/tyme/adapter.ts resolveInput` 各有一份真太阳时预处理逻辑。可考虑上提到引擎门面 `engine/index.ts calculateChart` 统一处理，两引擎共用。
- **凶煞名单**：`ShenShaList.tsx` 的 `XIONG_SHA` 正则硬编码约 20 个凶煞名用于红/金配色，遇到名单外的凶煞会按吉神金色显示。可考虑改为数据驱动或由引擎标注吉凶属性。
