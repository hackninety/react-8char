// 十神组合模式检测：~28 条经典组合/日柱形态/格局层次线索的确定性预检。
//
// 动机：伤官见官、枭神夺食、羊刃驾杀这类组合是命理论断的骨架，但 AI 逐柱扫描容易漏看或看错位。
// 程序把「模式是否存在、落在何处」确定性地检出来，AI 专注做高阶推理（轻重、成败、救应）。
// 检测域：天干（年/月/时，日干为日主不计）+ 地支本气十神；日柱形态类查日柱干支本身。
// 输出仅为「线索」：吉凶轻重须结合全局与运岁，由 AI 覆核论断。

import { getGanWuXing } from './utils';
import { SHENG, KE, YANG_REN } from './ganzhi';

// 注意：mystilight 运行时 shiShenZhi 实为 string[]（全部藏干十神，本气在前），
// 与 index.d.ts 声明的 string 不符（类似 shenQiang 的类型漂移），两种形状都兼容。
type GZ = { gan: string; zhi: string; shiShenGan?: string; shiShenZhi?: string | string[] };
type PillarsLike = { year: GZ; month: GZ; day: GZ; time: GZ };

export interface PatternHit {
  name: string;
  /** 命中位置，如「伤官(月干) × 正官(时支本气)」 */
  hit: string;
  /** 一句经典义（含条件性提示） */
  note: string;
}

const KUI_GANG = ['庚辰', '庚戌', '壬辰', '戊戌'];
const YIN_YANG_CHA_CUO = ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'];
const SHI_E_DA_BAI = ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '庚辰', '戊戌', '癸亥', '辛巳', '己丑'];
// 孤鸾煞核心五日（口诀「木火逢蛇…金猪…土猴木虎」；别本增列丙午/戊午/壬子）
const GU_LUAN = ['乙巳', '丁巳', '辛亥', '戊申', '甲寅'];
const SAN_QI = [['乙', '丙', '丁', '地上三奇'], ['甲', '戊', '庚', '天上三奇'], ['壬', '癸', '辛', '人中三奇']] as const;
// 四废日：春庚申辛酉、夏壬子癸亥、秋甲寅乙卯、冬丙午丁巳
const SI_FEI: Record<string, string[]> = { 春: ['庚申', '辛酉'], 夏: ['壬子', '癸亥'], 秋: ['甲寅', '乙卯'], 冬: ['丙午', '丁巳'] };
// 天赦日：春戊寅、夏甲午、秋戊申、冬甲子
const TIAN_SHE: Record<string, string> = { 春: '戊寅', 夏: '甲午', 秋: '戊申', 冬: '甲子' };
const SEASON_OF_ZHI: Record<string, string> = { 寅: '春', 卯: '春', 辰: '春', 巳: '夏', 午: '夏', 未: '夏', 申: '秋', 酉: '秋', 戌: '秋', 亥: '冬', 子: '冬', 丑: '冬' };

interface SSPos { pos: string; ss: string; tou: boolean }

export interface DetectPatternsOpts {
  judge?: '身强' | '身弱' | '中和';
  wuXingPower?: Record<string, number>;
}

export function detectPatterns(pillars: PillarsLike | undefined, opts: DetectPatternsOpts = {}): PatternHit[] {
  if (!pillars?.day?.gan) return [];
  const p = pillars;
  const hits: PatternHit[] = [];
  const push = (name: string, hit: string, note: string) => hits.push({ name, hit, note });

  // ── 十神位置索引（天干透 + 地支本气）──
  const entries: SSPos[] = [];
  (
    [['year', '年'], ['month', '月'], ['time', '时']] as const
  ).forEach(([k, cn]) => {
    const ss = p[k].shiShenGan;
    if (ss) entries.push({ pos: `${cn}干`, ss, tou: true });
  });
  (
    [['year', '年'], ['month', '月'], ['day', '日'], ['time', '时']] as const
  ).forEach(([k, cn]) => {
    const raw = p[k].shiShenZhi;
    const ss = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : '';
    if (ss) entries.push({ pos: `${cn}支本气`, ss, tou: false });
  });
  const find = (name: string) => entries.filter((e) => e.ss === name);
  const has = (name: string) => find(name).length > 0;
  const hasTou = (name: string) => find(name).some((e) => e.tou);
  const posText = (name: string) => find(name).map((e) => `${name}(${e.pos})`).join('、');
  const pair = (a: string, b: string) => `${posText(a)} × ${posText(b)}`;
  const anyOf = (...names: string[]) => names.find((n) => has(n));

  // ── 两神组合 ──
  if (has('伤官') && has('正官')) {
    push('伤官见官', pair('伤官', '正官'), '为祸百端之凶组合——名誉是非、官讼职场冲突之象；喜印制伤或财通关，紧贴者重、远隔者轻');
  }
  if (has('偏印') && has('食神')) {
    push('枭神夺食', pair('偏印', '食神'), '福寿受损、谋事多阻之象——才华思路被压制；喜偏财制枭解救');
  }
  if (has('食神') && has('七杀') && !has('伤官')) {
    push('食神制杀', pair('食神', '七杀'), '化凶为权的贵组合——才略胆识、以技驭权；忌枭夺食、忌财党杀');
  }
  if (has('伤官') && has('七杀') && !has('食神')) {
    push('伤官驾杀', pair('伤官', '七杀'), '才气驭权、偏业成名之象；身弱须印滋扶方能胜任');
  }
  const yinAny = anyOf('正印', '偏印');
  if (has('七杀') && yinAny) {
    push('杀印相生', pair('七杀', yinAny), '化杀为权——压力转化为地位实权之贵组合；印须有根方真');
  }
  if (has('正官') && has('正印')) {
    push('官印相生', pair('正官', '正印'), '仕途正路、名誉学业两全的贵组合；喜官印紧贴流通');
  }
  if (has('正官') && has('七杀')) {
    const both = hasTou('正官') && hasTou('七杀') ? '并透' : '并见';
    push('官杀混杂', `${pair('正官', '七杀')}（${both}）`, '用心不专、多头受制之象——去留为要：合杀留官或制杀存官则清');
  }
  const caiAny = anyOf('正财', '偏财');
  const biJieCount = find('比肩').length + find('劫财').length;
  if (biJieCount >= 2 && caiAny) {
    push('比劫争财', `比劫共${biJieCount}处 × ${posText(caiAny)}`, '破财分产、合伙纠纷之象（男命兼扰婚姻）；喜官杀制比劫');
  }
  const shiShangAny = anyOf('食神', '伤官');
  if (shiShangAny && caiAny) {
    push('食伤生财', pair(shiShangAny, caiAny), '才华生财、经营取利之正路；身弱则泄耗过重，须先扶身');
  }
  if (has('伤官') && has('正印')) {
    push('伤官配印', pair('伤官', '正印'), '才华得制化而成文贵；须印有根且财不坏印');
  }
  if (hasTou('正财') && hasTou('正官')) {
    push('财官双美', pair('正财', '正官'), '富贵正路组合——财生官旺；身能任之方享，身弱反为所累');
  }

  // ── 身强弱相关组合（judge 缺省时跳过）──
  const judge = opts.judge;
  if (judge === '身弱') {
    if (caiAny && has('七杀')) {
      push('财滋七杀攻身', pair(caiAny, '七杀'), '身弱财党杀——因财惹祸、压力伤身之险象；喜印化杀、比劫帮身');
    }
    if (yinAny && caiAny) {
      push('贪财坏印', pair(caiAny, yinAny), '身弱用印而财来坏印——因利损誉、学业事业受财所误；喜比劫解围');
    }
  }

  // ── 羊刃 ──
  const renZhi = YANG_REN[p.day.gan];
  if (renZhi) {
    const renPos = (
      [['year', '年'], ['month', '月'], ['day', '日'], ['time', '时']] as const
    ).filter(([k]) => p[k].zhi === renZhi).map(([, cn]) => `${cn}支`);
    if (renPos.length) {
      if (has('七杀')) {
        push('羊刃驾杀', `羊刃${renZhi}(${renPos.join('、')}) × ${posText('七杀')}`, '大权大贵之象——胆略过人、宜武职/开创/竞争行业；刃杀两停为美');
      } else if (renPos.length >= 2) {
        push('羊刃重重', `羊刃${renZhi}(${renPos.join('、')})`, '气刚性烈，无官杀驾驭则易伤身破财；喜官杀制刃');
      }
    }
  }

  // ── 日柱形态 ──
  const dayGZ = p.day.gan + p.day.zhi;
  if (KUI_GANG.includes(dayGZ)) {
    push('魁罡日', `日柱${dayGZ}`, '性刚果决、聪明敏锐；忌财官刑冲，叠见者贵；女命婚姻宜相敬');
  }
  if (YIN_YANG_CHA_CUO.includes(dayGZ)) {
    push('阴阳差错日', `日柱${dayGZ}`, '古论婚姻易生外缘纠葛、与亲家寡合；现代宜作婚恋沟通课题看待');
  }
  if (SHI_E_DA_BAI.includes(dayGZ)) {
    push('十恶大败日', `日柱${dayGZ}`, '古法禄入空亡主财帛易耗散；今作理财谨慎之提示即可，不宜迷信');
  }
  if (GU_LUAN.includes(dayGZ)) {
    push('孤鸾煞', `日柱${dayGZ}`, '古论婚缘偏晚、聚少离多之象（别本另列丙午/戊午/壬子）；重在配偶宫受克与否，现代宜宽解');
  }
  const season = SEASON_OF_ZHI[p.month.zhi];
  if (season && TIAN_SHE[season] === dayGZ) {
    push('天赦日', `${season}月生逢${dayGZ}`, '逢凶化吉、贵人解难之吉日');
  }
  if (season && SI_FEI[season]?.includes(dayGZ)) {
    push('四废日', `${season}月生逢${dayGZ}`, '日主临休囚绝地，做事易有始无终；喜印比生扶、忌再逢克泄');
  }

  // ── 天干整体形态 ──
  const gans = [p.year.gan, p.month.gan, p.day.gan, p.time.gan];
  const zhis = [p.year.zhi, p.month.zhi, p.day.zhi, p.time.zhi];
  if (new Set(gans).size === 1) push('天元一气', `四干皆${gans[0]}`, '气势纯粹专一，成败皆大；喜地支承载有情');
  if (new Set(zhis).size === 1) push('地支一气', `四支皆${zhis[0]}`, '地气纯一，格局气象特殊，须专论');
  for (const [a, b, c, label] of SAN_QI) {
    const ordered = (gans[0] === a && gans[1] === b && gans[2] === c) || (gans[1] === a && gans[2] === b && gans[3] === c);
    const all = [a, b, c].every((g) => gans.includes(g));
    if (ordered) push('三奇贵人', `${label}${a}${b}${c}顺布`, '才智超群、逢凶化吉之贵；顺布为真');
    else if (all) push('三奇贵人(散)', `${label}${a}${b}${c}俱全不顺布`, '三奇散见力减，以顺布为真');
  }

  // ── 格局层次线索（需五行力量）──
  const wx = opts.wuXingPower;
  const dayWx = getGanWuXing(p.day.gan);
  if (wx && dayWx) {
    const total = Object.values(wx).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total > 0) {
      const pct = (e: string) => ((Number(wx[e]) || 0) / total) * 100;
      const yinWx = Object.keys(SHENG).find((e) => SHENG[e] === dayWx) || '';
      const selfSide = pct(dayWx) + pct(yinWx);
      const guanShaWx = Object.keys(KE).find((e) => KE[e] === dayWx) || '';
      const caiWx = KE[dayWx];
      if (selfSide < 15) {
        push('从格候选', `日主${dayWx}+印${yinWx}合计仅占 ${selfSide.toFixed(1)}%`, '日主孤弱无依，或弃命从势（从财/从杀/从儿依最旺者）——喜忌与扶抑法相反，请以从格法覆核');
      } else if (selfSide > 65) {
        push('专旺候选', `日主${dayWx}+印${yinWx}合计占 ${selfSide.toFixed(1)}%`, '一行得气成势，或从强/专旺（曲直/炎上类）——顺其气势为吉，逆之为凶，请覆核');
      }
      if (judge === '身弱' && pct(caiWx) >= 30) {
        push('财多身弱', `财星${caiWx}占 ${pct(caiWx).toFixed(1)}%`, '富屋贫人之象——见财担不动；喜比劫帮身分担，忌再行财地');
      }
      if (judge === '身弱' && pct(guanShaWx) >= 30) {
        push('杀重身轻', `官杀${guanShaWx}占 ${pct(guanShaWx).toFixed(1)}%`, '压力伤身、易受制于人；喜印化杀通关为救');
      }
      if (dayWx === '木' && ['寅', '卯'].includes(p.month.zhi) && ['丙', '丁'].some((g) => [p.year.gan, p.month.gan, p.time.gan].includes(g))) {
        push('木火通明', `木日主生${p.month.zhi}月、火透干`, '秀气流行——文采声名之象，利文教创意之业');
      }
      if (dayWx === '金' && ['申', '酉'].includes(p.month.zhi) && ['壬', '癸'].some((g) => [p.year.gan, p.month.gan, p.time.gan].includes(g))) {
        push('金白水清', `金日主生${p.month.zhi}月、水透干`, '才思清奇——聪慧善辩之象，利技艺文职');
      }
    }
  }

  return hits;
}
