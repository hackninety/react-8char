// tyme4ts 流派映射（与 mystilight 口径实证对齐，见 P2 校准记录）
//
// 早晚子时（4 样例含立春边界全等）：
//   sect=1 正统派 → DefaultEightCharProvider     （晚子时日柱算第二天）
//   sect=2 传统派 → LunarSect2EightCharProvider  （晚子时日柱算当天）
// 起运（8 样例含顺逆排全等，含日期与时刻）：
//   mystilight 起运口径 = LunarSect1ChildLimitProvider
import {
  LunarHour,
  ChildLimit,
  DefaultEightCharProvider,
  LunarSect2EightCharProvider,
  LunarSect1ChildLimitProvider,
} from 'tyme4ts';

/** 计算前设置 tyme4ts 全局流派（其 provider 为静态配置；浏览器单线程下安全） */
export function applySect(sect: 1 | 2): void {
  LunarHour.provider = sect === 2 ? new LunarSect2EightCharProvider() : new DefaultEightCharProvider();
  ChildLimit.provider = new LunarSect1ChildLimitProvider();
}
