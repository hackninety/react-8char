# 待办 / Backlog

本项目的延后事项。核心排盘、多引擎对拍、多流派 AI 导出、真太阳时（经度差+均时差）已完成。

## 计划中

### 1. tyme4ts 引擎补命理神煞
- **现状**：mystilight 引擎自带完整神煞系统（结果页神煞卡片已接入）；tyme4ts 引擎只输出四柱/大运等标准盘面，无命理神煞。
- **目标**：在 `src/lib/engine/tyme/` 下新增神煞模块，让 tyme 引擎也能输出常见神煞（天乙贵人、桃花、驿马、空亡、羊刃、将星等），使其能力对齐 mystilight，双引擎对拍可覆盖神煞维度。
- **参考**：[cantian-ai/bazi-mcp](https://github.com/cantian-ai/bazi-mcp)（400★，在 tyme4ts 之上补神煞的先例，可借鉴其神煞判定规则）。
- **落点**：新增 `tyme/shensha.ts`，适配器填充 `chart.shensha`，`registry.ts` 里把 tyme 的 `capabilities.shensha` 置为 true。

### 2. 人生 K 线可视化
- **目标**：将大运流年的运势起伏绘制成类股票 K 线图（吉凶评分随时间的曲线/柱状），直观展示人生高低点。
- **参考**：[curionox/lifekline](https://github.com/curionox/lifekline)（707★）、[miounet11/life-kline](https://github.com/miounet11/life-kline)（202★）。
- **落点**：新增 `src/components/LifeKlineChart.tsx`，输入为 `dayunArr` + 流年十神/神煞加权评分；需先定义一套「运势评分」算法（喜用神得力度 + 神煞吉凶 + 刑冲合害）。
- **注意**：纯前端可视化，工程量较大，建议独立分支推进。

## 技术债（复查发现，非阻塞）

- **神煞形状归一化下沉**：`src/lib/markdown-export.ts` 的 `SHENSHA_KEY_CN` 与 `src/components/ShenShaList.tsx` 的 `SHENSHA_POS_LABELS` 是同一份引擎数据形状的两处平行映射。理想做法是在引擎层（`engine/mystilight/`）把 shensha 归一化为统一结构，消费端只读，避免两处漂移。
- **真太阳时预处理下沉**：`bazi.ts calculateBazi` 与 `engine/tyme/adapter.ts resolveInput` 各有一份真太阳时预处理逻辑。可考虑上提到引擎门面 `engine/index.ts calculateChart` 统一处理，两引擎共用。
- **凶煞名单**：`ShenShaList.tsx` 的 `XIONG_SHA` 正则硬编码约 20 个凶煞名用于红/金配色，遇到名单外的凶煞会按吉神金色显示。可考虑改为数据驱动或由引擎标注吉凶属性。
