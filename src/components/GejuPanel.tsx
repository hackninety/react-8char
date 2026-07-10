import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { cn, YUN_KIND_CLS as KIND_CLS } from '@/lib/utils';
import { analyzeGeJu } from '@/lib/geju';
import { computeSiLing } from '@/lib/siling';
import { detectPatterns } from '@/lib/patterns';
import { detectYunPatterns } from '@/lib/yunpatterns';
import { buildLifeKline } from '@/lib/lifekline';
import { preloadZiping, isZipingLoaded, getZipingClassic } from '@/lib/zipingzhenquan';
import type { BaziInput, BaziResult } from '@/lib/bazi';

/** 格局 · 古籍语料:取格结论 + 相神忌神 + 子平真诠本格原文 + 组合预检 + 当前运限格局 */
export default function GejuPanel({ input, result }: { input: BaziInput; result: BaziResult }) {
  // 原文库懒加载就绪信号(App 已预载,此处兜底重入并触发重渲染)
  const [zqReady, setZqReady] = useState(isZipingLoaded());
  useEffect(() => {
    void preloadZiping().then(() => setZqReady(true));
  }, []);

  const kline = useMemo(() => buildLifeKline(result), [result]);
  const dayGan = result.pillars?.dayMasterGan || result.pillars?.day?.gan || '';

  const siLing = useMemo(
    () =>
      computeSiLing(
        { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute, utcOffset: input.utcOffset },
        dayGan,
        result.pillars?.month?.zhi,
      ),
    [input, dayGan, result],
  );
  const geJu = useMemo(() => analyzeGeJu(result.pillars, siLing?.gan), [result, siLing]);
  const classic = useMemo(
    () => (zqReady && geJu ? getZipingClassic(geJu.ge) : null),
    [zqReady, geJu],
  );
  const patterns = useMemo(
    () => detectPatterns(result.pillars, { judge: kline?.judge, wuXingPower: result.wuXingPower as Record<string, number> }),
    [result, kline],
  );

  // 当前大运 × 今年流年的运限格局
  const curDy = result.currentYun?.daYun?.ganZhi;
  const curDyGz = Array.isArray(curDy) ? curDy.join('') : curDy || '';
  const curLn = result.currentYun?.liuNian;
  const curLnGz = curLn?.ganZhi ? (Array.isArray(curLn.ganZhi) ? curLn.ganZhi.join('') : curLn.ganZhi) : '';
  const yunHits = useMemo(
    () =>
      curDyGz
        ? detectYunPatterns({ pillars: result.pillars, judge: kline?.judge, gender: result.gender, dayunGz: curDyGz, liunianGz: curLnGz || undefined })
        : [],
    [result, kline, curDyGz, curLnGz],
  );

  if (!geJu) return null;
  const godRow = (label: string, list: typeof geJu.xiangShen) =>
    list.length > 0 && (
      <p className="text-xs">
        <span className="text-muted-foreground">{label}：</span>
        {list.map((g, i) => (
          <span key={i} className={cn('mr-2', g.present ? 'font-medium' : 'text-muted-foreground/70')}>
            {g.shiShen}〔{g.role}〕{g.status}
          </span>
        ))}
      </p>
    );

  const horoRows = [
    { key: '大运', label: `大运 ${curDyGz}`, list: yunHits.filter((h) => h.scope === '大运') },
    ...(curLnGz ? [{ key: '流年', label: `流年 ${curLn?.year ?? ''} ${curLnGz}`, list: yunHits.filter((h) => h.scope === '流年') }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-gold/20 glow-gold" data-testid="geju-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
            <BookOpen className="w-4 h-4" />
            格局 · 古籍语料
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            子平真诠机械取格 + 本格原文引用 · 组合与运限格局为确定性预检，轻重成败留给 AI 细辨
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 取格结论 */}
          <div className="rounded-lg border border-gold/25 bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-bold text-crimson dark:text-gold">{geJu.ge}</span>
              <span className="rounded border border-gold/30 bg-gold/10 px-1.5 py-px text-[10px]">{geJu.type}</span>
            </div>
            <p className="text-xs text-muted-foreground">{geJu.basis}</p>
            {godRow('相神', geJu.xiangShen)}
            {godRow('忌神', geJu.jiShen)}
            <p className="text-xs"><span className="text-muted-foreground">初判：</span>{geJu.verdict}</p>
            {geJu.siLingNote && <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ {geJu.siLingNote}</p>}

            {/* 本格《子平真诠》原文(懒加载就绪后出现) */}
            {classic && (
              <details className="mt-1.5 group">
                <summary className="cursor-pointer text-xs font-medium text-crimson dark:text-gold select-none">
                  《子平真诠·{classic.chapter}》原文（点击展开）
                </summary>
                <div className="mt-1.5 space-y-1.5 border-l-2 border-gold/40 pl-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  {classic.lun.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                  <p className="font-medium text-foreground/80">〔{classic.chapter}取运〕</p>
                  {classic.quYun.split('\n').map((l, i) => <p key={`q-${i}`}>{l}</p>)}
                  <p className="text-[10px] opacity-70">{classic.source}，公有领域；双源抓取交叉验证，未经断句改写</p>
                </div>
              </details>
            )}
          </div>

          {/* 组合预检 */}
          {patterns.length > 0 && (
            <div>
              <h4 className="text-xs font-bold mb-1.5">原局组合预检（{patterns.length}）</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {patterns.map((p, i) => (
                  <div key={i} className="rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
                    <p className="text-xs"><b>{p.name}</b> <span className="text-muted-foreground">{p.hit}</span></p>
                    <p className="text-[11px] text-muted-foreground/90 leading-snug mt-0.5">{p.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 当前运限格局 */}
          {horoRows.length > 0 && curDyGz && (
            <div data-testid="yun-patterns">
              <h4 className="text-xs font-bold mb-1.5">当前运限格局</h4>
              <div className="space-y-1.5">
                {horoRows.map((row) => (
                  <div key={row.key} className="flex gap-2 text-xs items-start">
                    <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">{row.label}</span>
                    {row.list.length ? (
                      <span className="space-y-1">
                        {row.list.map((h, i) => (
                          <span key={i} className="block leading-snug">
                            <i className={cn('not-italic rounded border px-1 py-px text-[10px] mr-1', KIND_CLS[h.kind])}>{h.kind}</i>
                            <b>{h.name}</b>
                            <span className="text-muted-foreground">：{h.basis}——{h.meaning}</span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">未检出显著运限格局</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
