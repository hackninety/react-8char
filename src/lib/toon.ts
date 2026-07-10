// TOON（Token-Oriented Object Notation）导出：JSON 数据模型的紧凑无损等价表示，
// 对 LLM 更省 token（实测本项目导出约省 21% 字符，tabular 结构对 tokenizer 更友好）。
// 官方库 https://github.com/toon-format/toon
import { encode } from '@toon-format/toon';

/**
 * 编码为 TOON。先做一次 JSON 规范化（剔除 undefined 等 JSON 不可表示值），
 * 保证 decode(toToon(x)) 与 JSON.parse(JSON.stringify(x)) 完全一致（往返无损）。
 */
export function toToon(data: unknown): string {
  return encode(JSON.parse(JSON.stringify(data)));
}

/** 给 AI 的一行 TOON 语法提示（现代模型多已认识 TOON，此行是廉价保险） */
export const TOON_SYNTAX_HINT =
  'TOON 为 JSON 的紧凑无损等价表示：缩进表层级；`key: value` 为字段；`name[N]{f1,f2}:` 声明表格数组的字段名，其后每行一条逗号分隔的记录；`[N]:` 为行内原始数组。';
