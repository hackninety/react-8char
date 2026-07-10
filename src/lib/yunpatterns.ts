// 岁运格局扫描:大运/流年两个 scope 的经典运限组合确定性检测。
//
// 动机:原局组合(patterns.ts)只看四柱,而「这步运是不是伤官见官」「今年是否岁运并临/冲提纲」
// 这类运限层判断,AI 逐条比对干支容易漏看错位。程序把命中的运限格局连同依据检出来,
// AI 专注论轻重成败;K线(lifekline)的同类因素是「计分」,此处是「命名格局+出处依据」的叙事层,
// 口径与 K线保持一致(伏吟/天克地冲/成局/空亡判定完全同规则)。
//
// 输出仅为线索:同一格局的吉凶轻重须结合原局清浊与救应,由 AI 覆核论断。
import { getShiShen } from './engine/mystilight/ext/shishen';
import { getGanWuXing, ZHI_MAIN_GAN } from './utils';
import { SHENG, KE, CHONG, WU_HE, COMBOS, completesPattern, KU_ZHI, YANG_REN } from './ganzhi';

type GZ = { gan: string; zhi: string; xunKong?: string };
type PillarsLike = { year: GZ; month: GZ; day: GZ; time: GZ };

export interface YunPatternHit {
  scope: '大运' | '流年';
  name: string;
  kind: '吉' | '凶' | '注意';
  /** 命中依据(具体干支与落点) */
  basis: string;
  /** 一句经典义(条件性提示留给 AI 细辨) */
  meaning: string;
}

export interface YunPatternsInput {
  pillars: PillarsLike;
  /** 身强弱(成局喜忌与七杀攻身等条件规则用;缺省时相关规则出「注意」或跳过) */
  judge?: '身强' | '身弱' | '中和' | string;
  /** 性别(配偶星合身判读用,可缺省) */
  gender?: string;
  /** 大运干支,如「戊寅」 */
  dayunGz?: string;
  /** 流年干支(缺省则只扫大运层) */
  liunianGz?: string;
}

/** 原局十神位置索引(天干透 + 地支本气,同 patterns.ts 检测域) */
function natalGodIndex(p: PillarsLike, dayGan: string): Map<string, string[]> {
  const ix = new Map<string, string[]>();
  const put = (ss: string, pos: string) => {
    if (!ss) return;
    ix.set(ss, [...(ix.get(ss) ?? []), pos]);
  };
  (['year', 'month', 'time'] as const).forEach((k) => {
    put(getShiShen(dayGan, p[k].gan), `${k === 'year' ? '年' : k === 'month' ? '月' : '时'}干`);
  });
  (['year', 'month', 'day', 'time'] as const).forEach((k) => {
    const main = ZHI_MAIN_GAN[p[k].zhi];
    if (main) put(getShiShen(dayGan, main), `${k === 'year' ? '年' : k === 'month' ? '月' : k === 'day' ? '日' : '时'}支本气`);
  });
  return ix;
}

/** 扶抑口径的喜五行集合(身弱喜印比之行、身强喜食伤财官之行);judge 未知/中和返回 null。decadeplan/wuxing-energy 共用 */
export function likeElements(dayWx: string, judge?: string): Set<string> | null {
  const yinWx = Object.keys(SHENG).find((e) => SHENG[e] === dayWx)!;
  const guanWx = Object.keys(KE).find((e) => KE[e] === dayWx)!;
  if (judge === '身弱') return new Set([yinWx, dayWx]);
  if (judge === '身强') return new Set([SHENG[dayWx], KE[dayWx], guanWx]);
  return null;
}

export function detectYunPatterns(input: YunPatternsInput): YunPatternHit[] {
  const p = input.pillars;
  const dayGan = p?.day?.gan;
  if (!dayGan) return [];
  const hits: YunPatternHit[] = [];
  const add = (scope: YunPatternHit['scope'], name: string, kind: YunPatternHit['kind'], basis: string, meaning: string) =>
    hits.push({ scope, name, kind, basis, meaning });

  const dayWx = getGanWuXing(dayGan);
  const dayZhi = p.day.zhi;
  const monthZhi = p.month.zhi;
  const dayGZ = dayGan + dayZhi;
  const yearGZ = p.year.gan + p.year.zhi;
  const natalZhis: [string, string][] = [
    [p.year.zhi, '年支'], [monthZhi, '月支'], [dayZhi, '日支'], [p.time.zhi, '时支'],
  ];
  const natalZhiSet = new Set(natalZhis.map(([z]) => z));
  const godIx = natalGodIndex(p, dayGan);
  const at = (ss: string) => (godIx.get(ss) ?? []).map((pos) => `${ss}(${pos})`).join('、');
  const likes = likeElements(dayWx, input.judge);
  const renZhi = YANG_REN[dayGan];
  const spouseStar = input.gender === '女' ? '正官' : input.gender === '男' ? '正财' : '';

  /** 运岁干支引入的十神(干 + 支本气) */
  const bringsOf = (gz: string): { ss: string; via: string }[] => {
    const out: { ss: string; via: string }[] = [];
    const g = getShiShen(dayGan, gz[0]);
    if (g) out.push({ ss: g, via: `干${gz[0]}` });
    const zMain = ZHI_MAIN_GAN[gz[1]];
    const z = zMain ? getShiShen(dayGan, zMain) : '';
    if (z) out.push({ ss: z, via: `支${gz[1]}本气` });
    return out;
  };

  /** 原局×运岁的两神成象三则(伤官见官/枭神夺食/官杀混杂):natal 有其一、运岁引入其二 */
  const clashPairs = (scope: YunPatternHit['scope'], tag: string, gz: string) => {
    const brings = bringsOf(gz);
    const bring = (ss: string) => brings.filter((b) => b.ss === ss).map((b) => `${tag}${b.via}`).join('、');
    const pair = (natalSS: string, yunSS: string): string | null =>
      godIx.has(natalSS) && bring(yunSS) ? `${at(natalSS)} × ${yunSS}(${bring(yunSS)})` : null;

    for (const [a, b] of [['伤官', '正官'], ['正官', '伤官']] as const) {
      const basis = pair(a, b);
      if (basis) { add(scope, `伤官见官(${tag}成象)`, '凶', basis, '为祸百端之组合于此运岁成象——名誉是非、职场冲突、官讼之防;喜印制伤或财通关'); break; }
    }
    for (const [a, b] of [['食神', '偏印'], ['偏印', '食神']] as const) {
      const basis = pair(a, b);
      if (basis) { add(scope, `枭神夺食(${tag}成象)`, '凶', basis, '福寿受制、谋事多阻之象——才华思路被压;喜偏财制枭解救'); break; }
    }
    for (const [a, b] of [['正官', '七杀'], ['七杀', '正官']] as const) {
      const basis = pair(a, b);
      if (basis) { add(scope, `官杀混杂(${tag}凑成)`, '注意', basis, '原局本清,运岁再引则官杀相混——用心不专多头受制,去留取清为要'); break; }
    }
  };

  /** 三合三会成局(base 补齐最后一块) */
  const combosOf = (scope: YunPatternHit['scope'], tag: string, base: Set<string>, added: string) => {
    for (const [pat, el, name] of COMBOS) {
      if (!completesPattern(pat, base, added)) continue;
      const kind: YunPatternHit['kind'] = likes ? (likes.has(el) ? '吉' : '凶') : '注意';
      add(scope, `${tag}会齐${name}`, kind,
        `原局${pat.filter((z) => z !== added).join('、')}得${tag}${added}补齐`,
        `${el}行之力骤增而全局倾动${likes ? `,于日主为${kind === '吉' ? '喜——乘势而进' : '忌——防其党众攻身'}` : ',喜忌视用神而定'}`);
    }
  };

  // ─── 大运层 ───────────────────────────────────────────
  const dy = input.dayunGz;
  if (dy && dy.length >= 2) {
    const dyGan = dy[0];
    const dyZhi = dy[1];

    if (dy === dayGZ) {
      add('大运', '大运伏吟日柱', '注意', `大运${dy}与日柱干支全同`, '伏吟主滞重反复,十年基调沉郁,谋事多迂回;宜守常度势');
    } else if (KE[getGanWuXing(dyGan)] === dayWx && CHONG[dyZhi] === dayZhi) {
      add('大运', '大运天克地冲日柱', '凶', `运干${dyGan}(${getGanWuXing(dyGan)})克日主${dayGan}(${dayWx}),运支${dyZhi}冲日支${dayZhi}`, '干克支冲直撼日主,十年动荡之最——健康、婚姻、根基防连环变动');
    }
    if (CHONG[dyZhi] === monthZhi) {
      add('大运', '大运冲提纲', '注意', `运支${dyZhi}冲月支${monthZhi}(提纲)`, '月令为一盘枢机,冲之则十年根基动摇——迁居、转行、家庭结构变动多发于此运');
    }
    if (CHONG[dyZhi] === dayZhi && !(KE[getGanWuXing(dyGan)] === dayWx)) {
      add('大运', '大运冲婚姻宫', '注意', `运支${dyZhi}冲日支${dayZhi}(婚姻宫)`, '配偶宫十年受冲,婚恋聚散、家宅变动之防;有合则解');
    }
    if (WU_HE[dayGan] === dyGan) {
      const ss = getShiShen(dayGan, dyGan);
      add('大运', '运干合日干', '注意', `运干${dyGan}(${ss})与日主${dayGan}相合`, `日主被合则志向受牵,${ss}之事缠身十年(财合为财所役、官合为职所缚之类)`);
    }
    if (renZhi && natalZhiSet.has(renZhi) && CHONG[dyZhi] === renZhi) {
      add('大运', '阳刃逢冲(运)', '凶', `原局${renZhi}为日主${dayGan}之阳刃,运支${dyZhi}冲之`, '刃者兵凶之器,冲刃易见损伤、破败、横生之祸,大事宜避其锋');
    }
    combosOf('大运', '大运', natalZhiSet, dyZhi);
    clashPairs('大运', '运', dy);
  }

  // ─── 流年层 ───────────────────────────────────────────
  const ln = input.liunianGz;
  if (ln && ln.length >= 2) {
    const lnGan = ln[0];
    const lnZhi = ln[1];
    const dyZhi = dy && dy.length >= 2 ? dy[1] : '';

    if (dy && ln === dy) {
      add('流年', '岁运并临', '注意', `流年与大运干支皆为${ln}`, '同气重叠,该年主题强化、吉凶俱增幅——古诀言之甚重,实指事件强度放大,须看此柱于命为喜为忌');
    }
    if (ln === dayGZ) {
      add('流年', '流年伏吟日柱', '注意', `流年${ln}与日柱干支全同`, '伏吟其年身心多滞,旧事重提、进退反复');
    } else if (ln === yearGZ) {
      add('流年', '流年伏吟年柱', '注意', `流年${ln}与年柱干支全同(本命年)`, '太岁临本命,情绪与身体多起伏,传统以安守为宜');
    }
    if (KE[getGanWuXing(lnGan)] === dayWx && CHONG[lnZhi] === dayZhi) {
      add('流年', '天克地冲日柱(年)', '凶', `流年干${lnGan}(${getGanWuXing(lnGan)})克日主${dayGan}(${dayWx}),支${lnZhi}冲日支${dayZhi}`, '岁君直撼日主,其年动荡剧烈——健康出行婚姻皆宜谨慎,大决策避开为稳');
    } else if (CHONG[lnZhi] === dayZhi) {
      add('流年', '流年冲婚姻宫', '注意', `流年支${lnZhi}冲日支${dayZhi}(婚姻宫)`, '配偶宫受冲之年,感情聚散、家宅变动的敏感期;有合则解');
    }
    if (CHONG[lnZhi] === monthZhi) {
      add('流年', '流年冲提纲', '注意', `流年支${lnZhi}冲月支${monthZhi}(提纲)`, '冲提纲之年多环境变动——职场、居所、家中长辈事须留意');
    }
    if (dyZhi && CHONG[lnZhi] === dyZhi) {
      add('流年', '岁运交战', '注意', `流年支${lnZhi}与大运支${dyZhi}相冲`, '岁运相冲,内外境拉扯,其年多变动反复;冲起之支所主之事应象明显');
    }
    if (WU_HE[dayGan] === lnGan) {
      const ss = getShiShen(dayGan, lnGan);
      if (spouseStar && ss === spouseStar) {
        add('流年', '配偶星合日主', '注意', `流年干${lnGan}(${ss})合日主${dayGan}`, '配偶星贴身相合,姻缘引动的经典应期信号(未婚主缘分,已婚主配偶事)');
      } else {
        add('流年', '流年干合日干', '注意', `流年干${lnGan}(${ss})合日主${dayGan}`, `日主被合其年多牵动,${ss}之事近身`);
      }
    }
    if (renZhi && natalZhiSet.has(renZhi) && CHONG[lnZhi] === renZhi) {
      add('流年', '阳刃逢冲(年)', '凶', `原局${renZhi}为日主${dayGan}之阳刃,流年支${lnZhi}冲之`, '冲刃之年防损伤破败,竞技冒险之事收着做');
    }
    {
      const caiWx = KE[dayWx];
      const ku = KU_ZHI[caiWx];
      if (ku && natalZhiSet.has(ku) && CHONG[lnZhi] === ku) {
        add('流年', '财库冲开', input.judge === '身强' ? '吉' : '注意',
          `原局有财库${ku}(${caiWx}库),流年支${lnZhi}冲之`,
          '墓库逢冲则开,库中财发之应期;身强能任则得财,身弱担财不起反主财动生烦');
      }
    }
    {
      const dayKong = p.day.xunKong || '';
      if (dayKong.includes(lnZhi)) {
        const chongZhi = CHONG[lnZhi];
        if (!natalZhiSet.has(chongZhi) && !(dyZhi && dyZhi === chongZhi)) {
          add('流年', '流年入空亡', '注意', `流年支${lnZhi}落日柱旬空(${dayKong})且无冲`, '入空之年谋事多虚耗蹉跎,宜蓄势少扩张;逢冲则反实不作此论');
        }
      }
    }
    if (input.judge === '身弱') {
      const shaVia = bringsOf(ln).filter((b) => b.ss === '七杀').map((b) => `流年${b.via}`);
      if (shaVia.length) {
        add('流年', '七杀攻身(身弱)', '注意', `${shaVia.join('、')}为七杀,日主弱`, '身弱逢杀年,压力、健康、是非之防;喜印化杀、比劫帮身之救');
      }
    }
    combosOf('流年', '流年', dyZhi ? new Set([...natalZhiSet, dyZhi]) : natalZhiSet, lnZhi);
    clashPairs('流年', '年', ln);
  }

  return hits;
}
