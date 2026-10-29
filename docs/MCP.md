# 八字排盘 MCP 使用说明

有两种 [MCP](https://modelcontextprotocol.io)（Model Context Protocol）入口：统一服务提供跨术数排盘与 common 资料检索；本仓库的专用八字服务提供 `chartId` 驱动的深挖工具。两种服务均返回计算结果或资料，由 AI 组织分析。

## 统一远程 MCP：排八字并查询 common

地址为 **`https://mcp.0x7c.cc/mcp`**，传输方式 **Streamable HTTP**，**无鉴权，无需访问令牌**。

```bash
# Codex
codex mcp add paipan-common-remote --url https://mcp.0x7c.cc/mcp

# Claude Code
claude mcp add --transport http --scope user paipan-common-remote https://mcp.0x7c.cc/mcp
```

命令分别用于对应客户端；配置后重新连接 MCP。已有本机 `paipan-common` 时，本机与远程选一种即可。其他支持远程 MCP 的客户端填写相同地址、Streamable HTTP 与“无鉴权”。依据：[Codex 官方文档](https://learn.chatgpt.com/docs/extend/mcp)、[Claude Code 官方文档](https://code.claude.com/docs/en/mcp)。

统一服务的六个工具为 `system_catalog`、`chart_calculate`、`prepare_reading`、`corpus_list`、`corpus_search`、`corpus_read`。先调用 `system_catalog` 确认 `bazi` 当前支持的参数，再计算并检索命例，最后读取命中的原文。可复制的完整对话示例见 [README](../README.md#在-ai-中使用统一-mcp)。

统一 `bazi` 使用公历出生日期、时分、显式时区和性别；真太阳时另需出生经度，流日/流时另需 `queryTime`。不要用专用服务的 `city`、`latitude`、`utcOffset` 字段替代统一服务的参数结构。统一服务的八字关联 common 资料为命例库；下表中的合婚、反查、双引擎对拍、K线和古籍 resources 属于专用服务，并非统一远端的工具目录。

## 本地专用八字 MCP：构建

```bash
npm ci               # 按锁文件安装依赖
npm run mcp:build    # 产出 dist-mcp/server.mjs（自包含单文件，零运行时依赖）
npm run mcp:check    # 可选：类型检查 mcp/ 与 src/lib
```

## 本地专用八字 MCP：接入

下列示例路径适用于本机 `D:/WWW/react-8char`，其他电脑需改为实际绝对路径，并保证客户端可找到 `node`。服务名为 `bazi`，传输方式为 stdio，计算在本机进行。

### Codex

```bash
codex mcp add bazi -- node D:/WWW/react-8char/dist-mcp/server.mjs
```

### Claude Code（本仓库内）

仓库已带项目级 [`.mcp.json`](../.mcp.json)，先 `npm run mcp:build`，再在本项目目录里打开 Claude Code，确认项目 MCP 配置后即可使用。

其他项目/全局接入：

```bash
claude mcp add --transport stdio --scope user bazi -- node D:/WWW/react-8char/dist-mcp/server.mjs
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

配置后重连 MCP；构建更新或进程重启后，旧 `chartId` 需要重新排盘生成。

## 专用服务工具目录

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
| `query_yingqi` | 应期引动候选：婚恋/事业/财运的候选年份（星透干/星合日主/宫逢合冲/财库冲开等确定性预检，非事件预言） | chartId + topic (+年份范围) |
| `compare_engines` | mystilight × tyme4ts 双引擎对拍校验 | 公历生辰 |
| `hehun` | 合婚双盘对照：宫星互动/互为十神/喜用互补/调候互济，吉平忌清单不打总分 | 双方生辰（a/b 两组） |

另有 **6 个 prompts**（`deep-dive-wealth/career/love/health/children/family`）：六大专项深挖清单的协议原语版，客户端可直接调用（参数 chartId）。`fanpai` 支持 sect 与 fromYear（突破 60 年限制）；`query_wuyunliuqi` 传 year 可查任意年运气年度格局。

**4 个 resources**（静态参考数据，客户端按需挂载）：`bazi://reference/tiaohou`（调候用神全表 120 格）、`bazi://reference/xiangfa`（盲派象法表）、`bazi://reference/shensha`（神煞释义词典）、`bazi://reference/zipingzhenquan`（《子平真诠》八格「论X+论X取运」全文，双源抓取交叉验证；paipan 的 geJu 命中何格即读该章）。

## 设计要点

- **stdio 传输**：stdout 只走 JSON-RPC。排盘引擎的耗时 `console.log` 会撕裂协议，入口（[`mcp/server.ts`](../mcp/server.ts)）先把 log/info/debug/warn 改道 stderr，再动态加载业务模块。
- **chartId 缓存**：`paipan` 按输入参数哈希生成确定性 id（同参重排同 id），进程内 LRU 缓存 20 张盘；服务重启后 id 失效，工具会返回明确的「请重新 paipan」提示。
- **反幻觉指引**：server `instructions` 要求 AI 以工具返回为准、禁止凭记忆排盘或引经、结论附论据与置信度——与 web 端导出的分析纪律一致。
- **复用网页排盘与分析实现**：MCP 层做参数映射与 Markdown 组装（[`mcp/tools.ts`](../mcp/tools.ts) / [`mcp/format.ts`](../mcp/format.ts)），排盘、调候、司令、组合预检、K线走 `src/lib/*` 同一套代码。对比结果时需核对输入参数与时区；当前运限还受各自进程的当前时刻影响。

## 专用服务典型对话流

1. 「公历 1990年6月15日 08:30，男，固定 UTC+8，不做真太阳时校正，请排八字」→ AI 调 `paipan` 得摘要与 chartId；专用服务不传 city/longitude 即不做真太阳时校正
2. 「2026 年财运如何？」→ `query_year(chartId, 2026)`，结合干支、运限与逐项因素作答；K线分值属于该模型的辅助评分，不能直接当作事件结论
3. 「哪个月适合动土搬家？」→ `query_liuyue` / `query_liuri` 择月择日
4. 「这个盘准不准？」→ `compare_engines` 双引擎对拍
