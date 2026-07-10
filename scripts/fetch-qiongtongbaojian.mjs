// 抓取维基文库《穷通宝鉴》并解析为「日主×月支」原文段落库,生成 src/lib/data/qiongtongbaojian.ts。
//
// 源:https://zh.wikisource.org/wiki/穷通宝鉴 (公有领域;简体整理本,结构为 十干 × 三春/三夏/三秋/三冬)。
// 粒度:原书部分干月为合并论述(甲木「正二月」合论、丁火三秋整季一段、己土夏秋冬整季一段等),
// 解析优先级:本月专段 > 合月段(正二/五六) > 整季总论回退,每格标注 scope 以便导出时如实注明。
// 用法:node scripts/fetch-qiongtongbaojian.mjs   (重新抓取并覆写数据文件)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/data/qiongtongbaojian.ts');

const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const SEASONS = [
  ['三春', ['寅', '卯', '辰']],
  ['三夏', ['巳', '午', '未']],
  ['三秋', ['申', '酉', '戌']],
  ['三冬', ['亥', '子', '丑']],
];
// 中文月序 → 月支(正月建寅)
const MONTH_ZHI = { 正: '寅', 二: '卯', 三: '辰', 四: '巳', 五: '午', 六: '未', 七: '申', 八: '酉', 九: '戌', 十: '亥', 十一: '子', 十二: '丑' };
// 合月锚(书中出现过的合并写法)
const COMBO = { 正二: ['寅', '卯'], 五六: ['午', '未'] };

function cleanWiki(s) {
  let t = s;
  t = t.replace(/\{\|[\s\S]*?\|\}/g, ''); // 命例表格
  for (let i = 0; i < 5; i++) t = t.replace(/\{\{[^{}]*\}\}/g, ''); // 模板(处理嵌套迭代几轮)
  t = t.replace(/'''?/g, ''); // 粗斜体标记
  t = t.replace(/<[^>]+>/g, ''); // html 标签
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

async function main() {
  const url = 'https://zh.wikisource.org/w/api.php?action=parse&format=json&prop=wikitext&page=' + encodeURIComponent('穷通宝鉴');
  const res = await fetch(url).then((x) => x.json());
  const wt = res?.parse?.wikitext?.['*'];
  if (!wt) throw new Error('抓取失败:' + JSON.stringify(res).slice(0, 200));

  // 按 === 标题切节
  const parts = wt.split(/^===\s*([^=\n]+?)\s*===$/m); // [pre, h1, body1, h2, body2, ...]
  const sectionOf = {};
  for (let i = 1; i < parts.length; i += 2) sectionOf[parts[i]] = parts[i + 1] ?? '';

  const data = {};
  const stats = [];
  for (const gan of GANS) {
    data[gan] = {};
    for (const [seasonName, zhis] of SEASONS) {
      const raw = sectionOf[`${seasonName}${gan}${GAN_WX[gan]}`];
      if (!raw) { stats.push(`!! 缺节:${seasonName}${gan}`); continue; }
      const text = cleanWiki(raw);

      // 月锚:行首「N月+干+五行」(清洗后粗体已去)。长序数在前避免「十」吞「十一」。
      const anchorRe = new RegExp(`^(正二|五六|十一|十二|正|二|三|四|五|六|七|八|九|十)月${gan}${GAN_WX[gan]}`, 'gm');
      const anchors = [];
      let m;
      while ((m = anchorRe.exec(text)) !== null) anchors.push({ ord: m[1], idx: m.index });
      const preamble = (anchors.length ? text.slice(0, anchors[0].idx) : text).trim();

      const segTextAt = (k) => text.slice(anchors[k].idx, k + 1 < anchors.length ? anchors[k + 1].idx : undefined).trim();
      for (const zhi of zhis) {
        // 1) 本月专段
        let hit = anchors.findIndex((a) => MONTH_ZHI[a.ord] === zhi);
        if (hit >= 0) { data[gan][zhi] = { text: segTextAt(hit), scope: '本月' }; continue; }
        // 2) 合月段
        hit = anchors.findIndex((a) => COMBO[a.ord]?.includes(zhi));
        if (hit >= 0) { data[gan][zhi] = { text: segTextAt(hit), scope: `合论(${anchors[hit].ord}月)` }; continue; }
        // 3) 季论回退(原书本季未分月)
        if (preamble.length >= 40) { data[gan][zhi] = { text: preamble, scope: `季论(${seasonName})` }; continue; }
        // 4) 季无总论且本月无专段:录全季文,scope 如实注明
        data[gan][zhi] = { text, scope: `季论(${seasonName})·原书本月无专段` };
        stats.push(`~~ ${gan}${zhi} 原书本月无专段,录全季文`);
      }
    }
  }

  // 覆盖校验
  let full = 0, combo = 0, season = 0;
  for (const g of GANS) for (const z of Object.keys(data[g])) {
    const s = data[g][z].scope;
    if (s === '本月') full++; else if (s.startsWith('合论')) combo++; else season++;
    if (!data[g][z].text || data[g][z].text.length < 30) stats.push(`!! ${g}${z} 文本过短(${data[g][z].text.length})`);
  }
  const cells = GANS.reduce((n, g) => n + Object.keys(data[g]).length, 0);
  console.log(`覆盖 ${cells}/120 | 本月专段 ${full} · 合月 ${combo} · 季论回退 ${season}`);
  stats.forEach((s) => console.log(s));
  if (cells !== 120) throw new Error('覆盖不足 120 格');

  const banner = `// 《穷通宝鉴》原文段落库(日主×月支)——由 scripts/fetch-qiongtongbaojian.mjs 生成,勿手改。
// 源:维基文库 zh.wikisource.org/wiki/穷通宝鉴(公有领域,简体整理本),抓取于 ${new Date().toISOString().slice(0, 10)}。
// scope 说明:原书部分干月为合并论述——「本月」=该月专段;「合论」=正二月/五六月合并段;
// 「季论」=该季未分月,回退整季总论。导出时只取本造一条,token 成本近零。

export interface QtbjEntry {
  /** 原文(已去命例表格与 wiki 标记) */
  text: string;
  /** 粒度:本月 / 合论(正二月) / 季论(三夏) */
  scope: string;
}

export const QIONG_TONG_TEXT: Record<string, Record<string, QtbjEntry>> = `;
  fs.writeFileSync(OUT, banner + JSON.stringify(data, null, 1).replace(/"([一-鿿])":/g, '$1:') + ';\n', 'utf8');
  console.log('已写入', OUT, '大小', Math.round(fs.statSync(OUT).size / 1024), 'KB');
}

main();
