# 待办 / Backlog

本项目的延后事项。核心排盘、多引擎对拍、多流派 AI 导出、真太阳时（经度差+均时差）已完成。

## 已完成

### ✅ tyme4ts 引擎补命理神煞（2026-07）
新增 [`src/lib/engine/tyme/shensha.ts`](../src/lib/engine/tyme/shensha.ts)，按渊海子平经典查法补齐约 20 种常用神煞
（天乙/文昌/太极/禄神/羊刃/金舆/红艳/将星/华盖/驿马/桃花/劫煞/灾煞/亡神/红鸾/天喜/孤辰/寡宿/天德/月德/空亡），
输出形状与 mystilight 一致（含 (基准柱) 后缀与 current 块）。适配器填充 `chart.shensha`，`registry` 置
`capabilities.shensha=true`。经 3 组命例逐柱与 mystilight 对照：tyme 无任何误报（是 mystilight 的正确子集，
mystilight 另有福星/天厨/德秀/童子煞等本模块未纳入的类别）。

## 计划中

### 1. 人生 K 线可视化
- **目标**：将大运流年的运势起伏绘制成类股票 K 线图（吉凶评分随时间的曲线/柱状），直观展示人生高低点。
- **参考**：[curionox/lifekline](https://github.com/curionox/lifekline)（707★）、[miounet11/life-kline](https://github.com/miounet11/life-kline)（202★）。
- **落点**：新增 `src/components/LifeKlineChart.tsx`，输入为 `dayunArr` + 流年十神/神煞加权评分；需先定义一套「运势评分」算法（喜用神得力度 + 神煞吉凶 + 刑冲合害）。
- **注意**：纯前端可视化，工程量较大，建议独立分支推进。

## 技术债（复查发现，非阻塞）

- **神煞形状归一化下沉**：`src/lib/markdown-export.ts` 的 `SHENSHA_KEY_CN` 与 `src/components/ShenShaList.tsx` 的 `SHENSHA_POS_LABELS` 是同一份引擎数据形状的两处平行映射（现在 mystilight 与 tyme 两引擎都产出此形状，更值得统一）。理想做法是在引擎层定义 shensha 类型与位置标签，消费端只读，避免多处漂移。
- **真太阳时预处理下沉**：`bazi.ts calculateBazi` 与 `engine/tyme/adapter.ts resolveInput` 各有一份真太阳时预处理逻辑。可考虑上提到引擎门面 `engine/index.ts calculateChart` 统一处理，两引擎共用。
- **凶煞名单**：`ShenShaList.tsx` 的 `XIONG_SHA` 正则硬编码约 20 个凶煞名用于红/金配色，遇到名单外的凶煞会按吉神金色显示。可考虑改为数据驱动或由引擎标注吉凶属性。
