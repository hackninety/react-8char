// 用神三法合参：扶抑 / 调候 / 通关 三种取用视角并列，标注共取与相悖。
//
// 动机：数据里已散落三种用神信息（扶抑喜忌由身强弱推导、调候查穷通宝鉴、引擎另给文本），
// AI 需要自己拼且容易漏看「调候与扶抑相悖」这一经典权衡点（如身弱忌水但生于燥月急需壬水）。
// 此处确定性合参：各法结论并列、交集为「多法共取」、调候主用神落在扶抑忌神时明示相悖——
// 取舍论述（寒暖失衡急则调候为先，平则扶抑为主）留给 AI。
import { getGanWuXing } from './utils';
import { SHENG, KE } from './ganzhi';

const WX_ALL = ['木', '火', '土', '金', '水'];

export interface YongShenFa {
  fa: '扶抑' | '调候' | '通关';
  /** 该法所取五行（带角色标注），如 ['土(印)', '金(比劫)']；不取时为空 */
  yongShen: string[];
  note: string;
}

export interface YongShenSanFa {
  fuYi: YongShenFa;
  tiaoHou: YongShenFa;
  tongGuan: YongShenFa;
  /** 合参结论：多法共取 / 相悖点 */
  heCan: string;
}

export interface YongShenInput {
  dayGan: string;
  /** 身强弱判定（缺省视为未知，扶抑不取） */
  judge?: '身强' | '身弱' | '中和' | string;
  wuXingPower?: Record<string, number>;
  /** 调候用神干序列（穷通宝鉴查表结果，主用在前） */
  tiaoHouGods?: string[];
  /** 调候得否结论（透传自 tiaoHou.verdict） */
  tiaoHouVerdict?: string;
}

export function buildYongShenSanFa(input: YongShenInput): YongShenSanFa | null {
  const dayWx = getGanWuXing(input.dayGan);
  if (!dayWx) return null;
  const yinWx = WX_ALL.find((e) => SHENG[e] === dayWx)!;
  const shiShangWx = SHENG[dayWx];
  const caiWx = KE[dayWx];
  const guanShaWx = WX_ALL.find((e) => KE[e] === dayWx)!;

  // ── 扶抑 ──
  let fuYi: YongShenFa;
  let fuYiLike: string[] = [];
  let fuYiDislike: string[] = [];
  if (input.judge === '身弱') {
    fuYiLike = [yinWx, dayWx];
    fuYiDislike = [shiShangWx, caiWx, guanShaWx];
    fuYi = { fa: '扶抑', yongShen: [`${yinWx}(印)`, `${dayWx}(比劫)`], note: '身弱喜印比生扶，忌食伤财官泄耗克' };
  } else if (input.judge === '身强') {
    fuYiLike = [shiShangWx, caiWx, guanShaWx];
    fuYiDislike = [yinWx, dayWx];
    fuYi = { fa: '扶抑', yongShen: [`${shiShangWx}(食伤)`, `${caiWx}(财)`, `${guanShaWx}(官杀)`], note: '身强喜食伤财官泄耗制，忌印比再扶' };
  } else if (input.judge === '中和') {
    fuYi = { fa: '扶抑', yongShen: [], note: '日主中和，扶抑无偏取，以流通与调候为要' };
  } else {
    fuYi = { fa: '扶抑', yongShen: [], note: '身强弱未判，扶抑不取' };
  }

  // ── 调候 ──
  const thGods = input.tiaoHouGods ?? [];
  const thWx = [...new Set(thGods.map((g) => getGanWuXing(g)).filter(Boolean))];
  const tiaoHou: YongShenFa = thGods.length
    ? { fa: '调候', yongShen: thGods.map((g) => `${g}(${getGanWuXing(g)})`), note: input.tiaoHouVerdict ?? '穷通宝鉴查表（主用在前）' }
    : { fa: '调候', yongShen: [], note: '调候数据不可得' };

  // ── 通关（两行相战且皆成气候时，取引化之五行）──
  let tongGuan: YongShenFa = { fa: '通关', yongShen: [], note: '无显著两行相战，通关不取' };
  let tongGuanWx: string | undefined;
  const wx = input.wuXingPower;
  if (wx) {
    const total = WX_ALL.reduce((s, e) => s + (Number(wx[e]) || 0), 0);
    if (total > 0) {
      const pct = (e: string) => ((Number(wx[e]) || 0) / total) * 100;
      const sorted = [...WX_ALL].sort((a, b) => pct(b) - pct(a));
      const [a, b] = [sorted[0], sorted[1]];
      const attacker = KE[a] === b ? a : KE[b] === a ? b : null;
      if (attacker && pct(a) >= 22 && pct(b) >= 22) {
        const victim = attacker === a ? b : a;
        const mediator = SHENG[attacker]; // 攻方所生、又生受方 → 引化
        if (SHENG[mediator] === victim) {
          tongGuanWx = mediator;
          tongGuan = {
            fa: '通关',
            yongShen: [`${mediator}(通关)`],
            note: `${attacker}(${pct(attacker).toFixed(0)}%)克${victim}(${pct(victim).toFixed(0)}%)两行相战，${mediator}通关引化`,
          };
        }
      }
    }
  }

  // ── 合参 ──
  const notes: string[] = [];
  const common = fuYiLike.filter((e) => thWx.includes(e));
  if (common.length) notes.push(`扶抑与调候共取 ${common.join('、')}，为最可靠之用`);
  if (tongGuanWx && (fuYiLike.includes(tongGuanWx) || thWx.includes(tongGuanWx))) {
    notes.push(`通关之${tongGuanWx}与他法相合，用之更力`);
  }
  const primaryThWx = thGods.length ? getGanWuXing(thGods[0]) : '';
  if (primaryThWx && fuYiDislike.includes(primaryThWx)) {
    notes.push(`调候主用${thGods[0]}(${primaryThWx})恰为扶抑之忌——三法相悖之经典权衡点：寒暖失衡急则调候为先、命局平和则扶抑为主，请说明取舍`);
  }
  if (!notes.length) notes.push('三法各有所指且无明显交集，请分别论述适用场景');

  return { fuYi, tiaoHou, tongGuan, heCan: notes.join('；') };
}
