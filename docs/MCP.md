# 八字排盘 MCP Server

把排盘引擎暴露为 [MCP](https://modelcontextprotocol.io)（Model Context Protocol）工具，让 Claude 等 AI **按需查询**盘面数据，而不是一次性吞下整份静态导出——AI 分析到哪一年就查哪一年，交互式工具调用对推理质量的提升通常大于更大的静态上下文。

## 构建

```bash
npm install          # 首次
npm run mcp:build    # 产出 dist-mcp/server.mjs（自包含单文件，零运行时依赖）
npm run mcp:check    # 可选：类型检查 mcp/ 与 src/lib
```

## 接入

### Claude Code（本仓库内）

仓库已带项目级 [`.mcp.json`](../.mcp.json)，在本项目目录里打开 Claude Code 即自动可用（需先 `npm run mcp:build`）。

其他项目/全局接入：

```bash
claude mcp add bazi -- node D:/WWW/react-8char/dist-mcp/server.mjs
```

### Claude Desktop

`claude_desktop_config.json` 中加入：

```json
{
  "mcpServers": {
    "bazi": {
      "command": "node",
      "args": ["D:/WWW/react-8char/dist-mcp/server.mjs"]
    }
  }
}
```

## 工具目录

| 工具 | 作用 | 关键入参 |
|---|---|---|
| `paipan` | 排盘，返回紧凑盘面摘要（四柱/五行/调候用神/人元司令/组合预检/神煞释义/引擎断语/大运一览/K线速览）+ `chartId` | 公历生辰、性别；可选 city 或 longitude/latitude/utcOffset、engine、sect |
| `query_year` | 单年详情：所处大运、流年干支藏干十神、流年神煞、K线五维评分逐项归因、全年流月 | chartId + year |
| `query_liuyue` | 某年 12 流月干支十神 | chartId + year |
| `query_liuri` | 某节气月逐日干支十神（择日） | chartId + year + month(1=正月寅) |
| `get_kline` | 五维评分全貌：大运均分表、峰谷 TOP5 及因素、可选逐年序列 | chartId (+series) |
| `query_wuyunliuqi` | 出生年五运六气（中运/司天在泉/主客运气/运气同化/所值运步气步） | chartId |
| `query_tiaohou` | 穷通宝鉴调候用神快查（无需排盘） | dayGan + monthZhi |
| `fanpai` | 四柱干支反查公历出生时间（近 60 年候选） | 四柱干支 |
| `compare_engines` | mystilight × tyme4ts 双引擎对拍校验 | 公历生辰 |
| `hehun` | 合婚双盘对照：宫星互动/互为十神/喜用互补/调候互济，吉平忌清单不打总分 | 双方生辰（a/b 两组） |

## 设计要点

- **stdio 传输**：stdout 只走 JSON-RPC。排盘引擎的耗时 `console.log` 会撕裂协议，入口（[`mcp/server.ts`](../mcp/server.ts)）先把 log/info/debug/warn 改道 stderr，再动态加载业务模块。
- **chartId 缓存**：`paipan` 按输入参数哈希生成确定性 id（同参重排同 id），进程内 LRU 缓存 20 张盘；服务重启后 id 失效，工具会返回明确的「请重新 paipan」提示。
- **反幻觉指引**：server `instructions` 要求 AI 以工具返回为准、禁止凭记忆排盘或引经、结论附论据与置信度——与 web 端导出的分析纪律一致。
- **复用 web 端全部逻辑**：MCP 层只做参数映射与 Markdown 组装（[`mcp/tools.ts`](../mcp/tools.ts) / [`mcp/format.ts`](../mcp/format.ts)），排盘、调候、司令、组合预检、K线全部走 `src/lib/*` 同一套代码，与网页结果严格一致。

## 典型对话流

1. 「帮我看看 1990年6月15日早上8点半北京出生的男命」→ AI 调 `paipan` 得摘要与 chartId
2. 「2026 年财运如何？」→ `query_year(chartId, 2026)`，引用财运分与逐项因素作答
3. 「哪个月适合动土搬家？」→ `query_liuyue` / `query_liuri` 择月择日
4. 「这个盘准不准？」→ `compare_engines` 双引擎对拍
