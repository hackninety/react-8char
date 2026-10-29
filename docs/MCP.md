# 八字排盘：统一 MCP 使用说明

八字原有 11 项专用工具、6 个专项提示词和 4 个经典资源已迁入 [react-mcp](https://github.com/hackninety/react-mcp)。统一连接名为 **`paipan-common`**，本机 stdio 与公网 HTTP 使用同一套 **31 个工具、7 个提示词、5 个静态资源**。本仓库不再维护独立 MCP 服务。

## 接入：本机与远程二选一

远程地址 **`https://mcp.0x7c.cc/mcp`**，传输方式 **Streamable HTTP**，**无鉴权**。首次配置时选择对应客户端命令：

```bash
# Codex
codex mcp add paipan-common --url https://mcp.0x7c.cc/mcp
# Claude Code
claude mcp add --transport http --scope user paipan-common https://mcp.0x7c.cc/mcp
```

本机使用者在有权限访问的 `react-mcp` 仓库中执行 `npm ci`、`npm run build`，然后选对应命令；以下绝对路径需替换为实际位置：

```bash
# Codex
codex mcp add paipan-common -- node D:/WWW/react-mcp/dist/stdio.mjs
# Claude Code
claude mcp add --transport stdio --scope user paipan-common -- node D:/WWW/react-mcp/dist/stdio.mjs
```

已存在 `paipan-common` 时先在客户端移除旧同名连接再更换方式；删除旧 `bazi`、`taiyi` 或 `paipan-common-remote` 连接，重连后用 `system_catalog` 确认工具目录。客户端设置依据：[Codex 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp)、[Claude Code 官方 MCP 文档](https://code.claude.com/docs/en/mcp)。

支持 stdio JSON 配置的客户端可使用：

```json
{
  "mcpServers": {
    "paipan-common": {
      "command": "node",
      "args": ["D:/WWW/react-mcp/dist/stdio.mjs"]
    }
  }
}
```

## 基础工作流与统一参数

六个基础工具为 `system_catalog`、`chart_calculate`、`prepare_reading`、`corpus_list`、`corpus_search`、`corpus_read`。先确认系统需要的参数，再计算、检索并读取原文，最后由 AI 分析。八字关联 common 公开命例库，答案默认不读取；`prepare_reading.searchQueries` 可明确给 1–3 个检索关键词，保留原问题并返回实际关键词。

工具每次接收完整参数，不返回或依赖旧 `chartId`。出生日期、时分、时区、性别放在 `birth`；观测时刻放在 `queryTime`；引擎和流派放在 `options`。日期用公历，时区必须明确，真太阳时须出生经度；不能用旧 `city/utcOffset/sect` 平铺参数代替。

例如 `bazi_query_year`：

```json
{
  "birth": { "date": "1990-06-15", "time": "08:30", "timezone": "+08:00", "gender": "male", "trueSolarTime": false },
  "queryTime": { "date": "2026-10-29", "time": "12:00", "timezone": "+08:00" },
  "options": { "engine": "mystilight", "school": "zhengtong" },
  "year": 2026
}
```

年份和区间查询必须明确 `year` 或 `fromYear/toYear`，不默认服务器今年。IANA 时区按日期解析夏令时，固定 `+08:00` 与 `Asia/Shanghai` 不能随意互换。流日、流时基础查询须提供 `queryTime`；缺少出生时辰应询问，不能猜中午 12 点。

## 八字高级工具

| 工具 | 作用与额外参数 |
|---|---|
| `bazi_paipan` | 摘要及字段目录；`options.fields` 选择字段，再按 `cursor/maxChars` 分页 |
| `bazi_query_year` / `bazi_query_liuyue` | 指定 `year` 查询年度详情或十二流月 |
| `bazi_query_liuri` | 指定 `year/month`（1=寅月），逐日数据按 `cursor/limit` 分页 |
| `bazi_get_kline` | 模型评分；`options.series` 选择逐年序列并分页，不等同事实预言 |
| `bazi_query_wuyunliuqi` | 指定 `year` 查询该年，省略仅使用出生瞬间 |
| `bazi_query_tiaohou` | `dayGan/monthZhi` 快查；`options.includeText` 后分页读取原文 |
| `bazi_query_yingqi` | `topic` 为婚恋/事业/财运，明确 `fromYear/toYear` 查询候选线索 |
| `bazi_fanpai` | 四柱 `yearGZ/monthGZ/dayGZ/timeGZ` 加明确年份区间反查 |
| `bazi_compare_engines` | 完整生辰，mystilight 与 tyme 双引擎对拍 |
| `bazi_hehun` | 双方完整 `birthA/birthB`，可分别给 `optionsA/optionsB` |

原六个专项提示词仍叫 `deep-dive-wealth/career/love/health/children/family`；协议提示词参数为 `birth` JSON 字符串，可附 `queryTime/options` JSON 字符串，替代旧命盘编号。

四个静态参考资源为 `bazi://reference/tiaohou`、`bazi://reference/xiangfa`、`bazi://reference/shensha`、`bazi://reference/zipingzhenquan`。《子平真诠》先返回章节目录，按目录给出的 URI 分页读取原文；统一服务另有 `reading_workflow` 提示词和 `paipan://workflow` 资源。

## 迁移与口径

旧项目 `.mcp.json`、独立启动脚本、命盘 LRU 缓存及重复协议测试已移除。网页继续使用自身算法与导出；统一服务保存有来源提交、哈希及许可证的移植快照，协议与部署测试在 `react-mcp` 执行。网页当前运限使用浏览器观测时刻，MCP 指定查询使用 `queryTime`，比较时须先对齐时间口径。

共用资料和计算结果由工具返回，引用前读取原文；区分盘面事实、案例参考和 AI 推断，候选年份与 K线评分不能直接当作已发生事件。
