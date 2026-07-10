// 抓取《子平真诠》八格「论X + 论X取运」原文,生成 src/lib/data/zipingzhenquan.ts。
//
// 双源交叉验证(原文绝不凭记忆默写):
//   主源(带章节标题):archive.org 公版书文本 fanqienovel-7332316490827353150(沈孝瞻原著,简体整理本)
//   校源(无中后段标题但内容完整):殆知阁 daizhigev20 易藏/术数/子平真诠评注.txt
// 主源按标题切章,每章正文再以 30 字滑窗对殆知阁全文做覆盖率校验(≥75% 方通过),
// 双源近乎逐字一致(各有零星异文/错字,如宣参国命例「木局/水局」),以主源为准原样保留。
// 用法:node scripts/fetch-zipingzhenquan.mjs   (重新抓取并覆写数据文件)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/data/zipingzhenquan.ts');

const SRC_MAIN = 'https://archive.org/download/fanqienovel-7332316490827353150/' + encodeURIComponent('子平真诠-2025081023.txt');
const SRC_CHECK = 'https://raw.githubusercontent.com/garychowcmu/daizhigev20/master/' + encodeURI('易藏/术数/子平真诠评注.txt');

// 目标章:格局章节键 → [论X标题, 论X取运标题](标题匹配忽略序号与空白)
const CHAPTERS = [
  ['正官', '论正官', '论正官取运'],
  ['财', '论财', '论财取运'],
  ['印绶', '论印绶', '论印绶取运'],
  ['食神', '论食神', '论食神取运'],
  ['偏官', '论偏官', '论偏官取运'],
  ['伤官', '论伤官', '论伤官取运'],
  ['阳刃', '论阳刃', '论阳刃取运'],
  ['建禄月劫', '论建禄月劫', '论建禄月劫取运'],
];

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'react-8char-fetch' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

/** 主源切章:标题行形如「三十一、论正官」(章名重复出现两次,首行后紧跟重复标题,一并吸收) */
function splitChapters(main) {
  const lines = main.split(/\r?\n/);
  const heads = []; // { title, line }
  const headRe = /^[一二三四五六七八九十]+(?:\s*[（(]?附[)）]?)?[、．.]\s*(论\S.*?)\s*$/;
  lines.forEach((ln, i) => {
    const m = ln.trim().match(headRe);
    if (m) heads.push({ title: m[1].replace(/\s+/g, ''), line: i });
  });
  const sections = {};
  for (let k = 0; k < heads.length; k++) {
    const { title, line } = heads[k];
    if (sections[title] !== undefined) continue; // 重复标题(章名连出两次)只取首个起点
    // 该标题的正文 = 从此行之后到下一个"不同标题"行为止,期间跳过重复标题行
    let end = lines.length;
    for (let j = k + 1; j < heads.length; j++) {
      if (heads[j].title !== title) { end = heads[j].line; break; }
    }
    const body = lines.slice(line + 1, end)
      .filter((ln) => !headRe.test(ln.trim()))
      .map((ln) => ln.trim())
      .filter(Boolean)
      .join('\n');
    sections[title] = body;
  }
  return sections;
}

/** 30 字滑窗覆盖率:sec 的字符窗在 whole(已归一)中的命中比例 */
function coverage(sec, whole) {
  const norm = (s) => s.replace(/[\s，。、；：？！""''「」『』（）,.;:?!()]/g, '');
  const a = norm(sec);
  const b = norm(whole);
  if (a.length < 30) return a.length > 0 && b.includes(a) ? 1 : 0;
  const step = 15;
  let hit = 0, total = 0;
  for (let i = 0; i + 30 <= a.length; i += step) {
    total++;
    if (b.includes(a.slice(i, i + 30))) hit++;
  }
  return total ? hit / total : 0;
}

async function main() {
  const [mainTxt, checkTxt] = await Promise.all([fetchText(SRC_MAIN), fetchText(SRC_CHECK)]);
  console.log(`主源 ${Math.round(mainTxt.length / 1024)}KB · 校源 ${Math.round(checkTxt.length / 1024)}KB`);

  const sections = splitChapters(mainTxt);
  const data = {};
  const report = [];
  for (const [key, lunTitle, quYunTitle] of CHAPTERS) {
    const lun = sections[lunTitle];
    const quYun = sections[quYunTitle];
    if (!lun || !quYun) throw new Error(`缺章:${lunTitle}=${!!lun} ${quYunTitle}=${!!quYun}(主源标题解析失败)`);
    const covL = coverage(lun, checkTxt);
    const covQ = coverage(quYun, checkTxt);
    report.push(`${key.padEnd(4, '　')} 论${String(lun.length).padStart(5)}字(校验${(covL * 100).toFixed(0)}%) 取运${String(quYun.length).padStart(5)}字(校验${(covQ * 100).toFixed(0)}%)`);
    if (covL < 0.75 || covQ < 0.75) throw new Error(`${key} 双源覆盖率过低(论${covL.toFixed(2)}/取运${covQ.toFixed(2)}),疑似脏数据,拒绝写入`);
    data[key] = { lun, quYun };
  }
  report.forEach((r) => console.log(r));

  const banner = `// 《子平真诠》八格原文库(论X + 论X取运)——由 scripts/fetch-zipingzhenquan.mjs 生成,勿手改。
// 著:沈孝瞻(清乾隆),公有领域。抓取于 ${new Date().toISOString().slice(0, 10)},双源交叉验证:
//   主源 archive.org/details/fanqienovel-7332316490827353150(公版书简体整理本,带章节标题)
//   校源 github.com/garychowcmu/daizhigev20 易藏/术数/子平真诠评注.txt(30字滑窗覆盖率≥75%)
// 章节键与取格的映射见 src/lib/zipingzhenquan.ts(七杀格→偏官、正/偏财→财、正/偏印→印绶、禄劫变通→建禄月劫)。

export interface ZpzqChapter {
  /** 论X 章原文 */
  lun: string;
  /** 论X取运 章原文 */
  quYun: string;
}

export const ZIPING_ZHENQUAN: Record<string, ZpzqChapter> = `;
  fs.writeFileSync(OUT, banner + JSON.stringify(data, null, 1).replace(/"([一-鿿]+)":/g, '$1:') + ';\n', 'utf8');
  console.log('已写入', OUT, '大小', Math.round(fs.statSync(OUT).size / 1024), 'KB');
}

main();
