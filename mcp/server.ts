#!/usr/bin/env node
// MCP stdio 入口。stdio 传输下 stdout 只准走 JSON-RPC 帧——
// 而排盘引擎会 console.log 耗时日志（如「排盘 getCurrentEightCharJSON 耗时(ms): 35」），
// 直接输出会撕裂协议。故先把 log/info/debug/warn 全部改道 stderr，
// 再动态 import 业务模块，确保补丁先于一切引擎代码生效。
const toStderr = console.error.bind(console);
console.log = toStderr;
console.info = toStderr;
console.debug = toStderr;
console.warn = toStderr;

const { main } = await import('./tools');
await main();

export {};
