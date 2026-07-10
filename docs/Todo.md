# 待办 / Backlog

本项目的延后事项。核心排盘、多引擎对拍、多流派 AI 导出、真太阳时（经度差+均时差）已完成。

## 已完成

### ✅ 格局·古籍语料 + 岁运格局扫描 + 十年规划表 + 五行能量多边形（2026-07，参照 react-zwds 三件套）
① **子平真诠八格原文**：[`scripts/fetch-zipingzhenquan.mjs`](../scripts/fetch-zipingzhenquan.mjs) 双源抓取
（archive.org 公版书带章节标题为主源 × 殆知阁 daizhige 为校源，30 字滑窗覆盖率 ≥75% 方写入，绝不凭记忆默写），
生成 [`src/lib/data/zipingzhenquan.ts`](../src/lib/data/zipingzhenquan.ts)（八格「论X+论X取运」，24KB 独立懒加载 chunk）；
[`zipingzhenquan.ts`](../src/lib/zipingzhenquan.ts) 提供 preload/取格名→章节映射（七杀→偏官、正偏财→财、禄劫变通→建禄月劫），
`geJu.classic` 随 JSON/MD 导出，MCP 增第 4 个资源 `bazi://reference/zipingzhenquan`。
② **岁运格局扫描** [`yunpatterns.ts`](../src/lib/yunpatterns.ts)：大运/流年两 scope 的经典运限组合确定性命名检出
（伏吟/天克地冲/冲提纲/冲婚姻宫/合日干/阳刃逢冲/三合三会成局/岁运并临/岁运交战/空亡入运/财库冲开/七杀攻身
/伤官见官·枭神夺食·官杀混杂之运岁成象），口径与 K线计分层完全一致，输出 name+kind+basis+meaning 叙事层。
③ **十年规划表** [`decadeplan.ts`](../src/lib/decadeplan.ts) + [`DecadePlanTable`](../src/components/DecadePlanTable.tsx)：
一运一行（干支十神全称/十二长生/扶抑喜忌/K线总运均值/高光低谷年/该运格局 chips），行点击展开逐年明细；
随 JSON（紧凑 rows）与 MD（表格）导出。④ **五行能量多边形** [`wuxing-energy.ts`](../src/lib/wuxing-energy.ts) +
[`WuxingRadar`](../src/components/WuxingRadar.tsx)：干支计点法（干100/支藏干 60·30·10，藏干集合与引擎 hideGanAttr
测试对拍锁定）算「原局/+大运/+流年」三层五行结构占比，嵌入人生K线卡片随悬停年联动，轴标五行·十神组、
喜忌红绿着色；与引擎 wuXingPower（旺衰加权）口径互补。⑤ **格局面板** [`GejuPanel`](../src/components/GejuPanel.tsx)：
取格结论+相神忌神+司令异说+本格原文（details 展开）+28 组合预检卡片+当前大运×今年流年运限格局。
同批：干支关系表（冲合刑害/五合/三合三会/墓库/阳刃/生克）下沉 [`ganzhi.ts`](../src/lib/ganzhi.ts) 共享
（lifekline/patterns/yingqi/yongshen 去重）。测试 90 例（新增 [`yun.test.ts`](../tests/yun.test.ts) 13 例，
探针对拍后冻结），e2e 补格局面板/规划表/雷达断言。

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

### ✅ 书籍数字化二期：穷通宝鉴原文库 + 盲派象法表（2026-07）
**穷通宝鉴原文**：[`scripts/fetch-qiongtongbaojian.mjs`](../scripts/fetch-qiongtongbaojian.mjs) 抓维基文库
公有领域简体本（**原文绝不凭记忆默写**——反幻觉主张的自我要求），解析为 120 格「日主×月支」段落库
[`src/lib/data/qiongtongbaojian.ts`](../src/lib/data/qiongtongbaojian.ts)（100KB；99 本月专段 + 2 合月 +
19 季论回退，原书部分干月本为合并论述，scope 如实标注）。`tiaoHou.classic` 只随盘导出本造那一条
（JSON/Markdown/MCP paipan 与 query_tiaohou 全接入），并叮嘱 AI「引用原文以此为准」。
抽查交叉互证：甲寅原文「得丙癸逢」↔调候表丙癸、辛午「壬己并用」↔壬己癸、己丑「取丙为尊甲木参酌」↔丙甲戊，
已冻结为测试断言。主 bundle +110KB（中文 gzip 友好，本地工具可接受）。
**盲派象法**：[`src/lib/xiangfa.ts`](../src/lib/xiangfa.ts) 十干/十二支本象 + 十神象义各一行
（通行类象简表，非引文），随 JSON/Markdown 导出，支撑盲派视角「十神象×宫位象×干支本象」取象。

### ✅ 多命盘档案 + 合婚对照（2026-07）
**档案**：[`storage.ts`](../src/lib/storage.ts) 档案层（名字+起盘参数+表单快照，上限 50、同名覆盖）+
[`ProfileBar`](../src/components/ProfileBar.tsx)。载入零侵入方案：写回表单快照 → `key` 重挂载回填 →
`handleSubmit` 重算，BaziForm 一行未改。
**合婚**：[`hehun.ts`](../src/lib/hehun.ts) 确定性互动清单——日干互动/互为十神与配偶星应象/婚姻宫与
年支合冲刑害（含半三合、自刑、伏吟同支）/喜用五行互补（双向）/调候寒燥互济/空亡互落/婚恋日柱形态，
吉平忌标注**不打总分**，Markdown 含免责与合婚分析框架；[`HehunPanel`](../src/components/HehunPanel.tsx)
从档案选甲乙（原生 select，可自动化）；MCP 增第 10 个工具 `hehun`（直接传双方生辰）。
preview 全流程验证：存两档案→选甲乙→生成清单→复制 Prompt→载入档案重算，零控制台报错。

### ✅ 流月K线下钻 + TOON 导出（2026-07）
**流月下钻**：[`buildMonthKline`](../src/lib/lifekline.ts)（月度模型与年线同源、幅度约 60%：流月十神/
月支与本命冲刑合害/月冲流年(岁破之月)/神煞/调候/空亡；分数锚定该年开盘值表达年内节奏，OHLC 年内串联；
从 ext 直接导流月避免与 bazi.ts 循环依赖）；LifeKlineChart 点击年蜡烛展开 12 月子图、悬停月因素明细。
**TOON**：接官方 `@toon-format/toon`（[`toon.ts`](../src/lib/toon.ts) 编码前 JSON 规范化保证往返无损，
实测导出省 21% 字符）。JsonExport 面板 JSON 全面换 TOON（.toon 文件/复制/AI Prompt ```toon 围栏+一行语法提示）；
合婚面板新增 导出 MD / 导出 TOON（[`buildHehunExportData`](../src/lib/hehun.ts) 结构化数据）。

### ✅ AI 推理二期：格局判定 + 应期预检 + 运岁长生 + MCP prompts（2026-07）
**格局**：[`geju.ts`](../src/lib/geju.ts) 子平真诠机械取格（本气透干 > 中余气透 > 本气直取；
比劫当令走禄刃另论/变通取用），吉凶顺逆标注 + 相神/忌神候选的原局透藏扫描 + 一句话初判
（成败细辨留给 AI）+ 人元司令分野取格异说注。
**应期**：[`yingqi.ts`](../src/lib/yingqi.ts) 婚恋/事业/财运的候选引动年预检（星透干/星合日主/
星临太岁/宫逢合冲/财库冲开/星运放大，强度=线索计数≥2 入选），MCP 工具 `query_yingqi` 任意范围，
导出带近 16 年窗口——直接回答「哪年结婚/发财/升职」类问题的锚定数据，明示「候选提示非事件预言」。
**长生**：utils `getDiShi`（阳顺阴逆），大运/流年导出补 diShi 字段（与 mystilight 本命地势
交叉验证全等）。**MCP**：六大专项深挖清单映射为 prompts 原语（deep-dive-*，与静态导出共用
同一份清单）；query_wuyunliuqi 支持任意年年度格局。
**修复**：fanpai 反查原隐用上游 sect=2（传统派）与应用默认正统派不一致——sect 现随表单/参数
透传；fromYear 透传上游 baseYear 突破「最近 60 年」硬限。**CI**：新增 `mcp:e2e` stdio 纯净性
端到端（spawn 真实 bundle，断言 stdout 全为 JSON-RPC——InMemory 测试测不到顶层 console.log
污染协议的风险）。测试 62→75 例。

### ✅ 用神三法合参 + MCP resources + 穷通宝鉴懒加载（2026-07）
**合参**：[`yongshen.ts`](../src/lib/yongshen.ts) 扶抑（judge 推导喜忌五行）/调候（穷通干转五行）/
通关（两行相战≥22%时取引化五行）三法并列，交集标「多法共取」，调候主用神落在扶抑忌神时明示
「相悖之经典权衡点」（北京测例即典型：身弱忌水但午月急需壬）。
**Resources**：MCP 增 3 个静态参考资源（bazi://reference/tiaohou|xiangfa|shensha），协议原语，
客户端按需挂载而非塞进每次工具输出。
**懒加载**：穷通宝鉴 100KB 拆出首屏主包为独立 chunk（gzip 30KB）——tiaohou 改缓存式懒加载
（preloadQiongTong 幂等），App 挂载即后台预载、JsonExport qtReady 就绪后重建导出、MCP main
启动 await；stdio e2e 加「原文段预载」断言防回归。测试 75→77 例。

### ✅ lint 清零入 CI + Playwright UI e2e（2026-07）
**lint**：历史红（累计 104 error）清零——组件与核心 lib 全部真类型化（`BaziResultExtras` 集中声明
私挂字段、unknown 收窄、zod/引擎类型推断替代注解），tests/ 与 shadcn ui/ 经配置显式豁免（注明理由），
markdown-export 与 mcp 格式层维持文件级 seam 豁免（上游 d.ts 自身含 any）；`npm run lint --max-warnings 0`
级别全绿并纳入 CI 门槛。顺带修出一处真问题：DaYunTimeline 删 any 后 tsc 暴露的可空访问。
**UI e2e**：[`e2e/app.spec.ts`](../e2e/app.spec.ts)（Playwright/chromium）两条全流程——
①排盘（golden 干支断言）→K线流月下钻→TOON 下载内容校验+零页面错误；②档案存/载→合婚清单→合婚 MD 下载。
本地复用 dev server，CI 自启并装浏览器。UI 层从「手工 preview 冒烟」升级为回归保护。

## 计划中

### 0.5 小型增强（择机）
（本节已清空——原列项目全部完成）

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

## 技术债（已清账 2026-07）

- ✅ **神煞形状归一化下沉**：位置键→中文的唯一权威映射 `SHENSHA_POS_CN`（含柱序/运岁序常量）落在
  [`shensha-dict.ts`](../src/lib/shensha-dict.ts)，markdown-export / ShenShaList / mcp/format 三处消费端全部切换，
  平行硬编码删除。
- ✅ **真太阳时预处理下沉**：抽出共享模块 [`engine/solar.ts`](../src/lib/engine/solar.ts)
  `resolveTrueSolarInput`，bazi.ts 与 tyme/adapter 两份逐行相同的实现删除；golden 测试
  （四例真太阳时命例 + 跨日边界 + 双引擎对拍）确认零回归。
- ✅ **凶煞名单数据驱动**：`isXiongSha()` 落在 shensha-dict（兼容「阴差阳错/阴阳差错」两种写法），
  ShenShaList 的 `XIONG_SHA` 硬编码正则删除；名单外未知神煞仍按吉神显示（宁缺勿错标）。
