import { useMemo, useState, Fragment } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarRange, ChevronDown, ChevronRight } from 'lucide-react';
import { cn, YUN_KIND_CLS as KIND_CLS } from '@/lib/utils';
import { buildDecadePlan } from '@/lib/decadeplan';
import type { BaziResult } from '@/lib/bazi';

const UP = '#dc2626';
const DOWN = '#16a34a';

/** 十年规划表:一运一行的人生总览,点行展开逐年明细 */
export default function DecadePlanTable({ result }: { result: BaziResult }) {
  const data = useMemo(() => buildDecadePlan(result), [result]);
  const [open, setOpen] = useState<string | null>(null);

  if (!data) return null;

  const favorCls = (f: string) =>
    f === '喜' ? 'text-red-600 dark:text-red-400' : f === '忌' ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-gold/20 glow-gold" data-testid="decade-plan">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
            <CalendarRange className="w-4 h-4" />
            十年规划表
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            一运一行 · 均值/高光/低谷取K线总运 · 喜忌为扶抑口径（{data.judge || '强弱未判'}）· 点行展开逐年
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="text-muted-foreground border-b border-border/60 [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                  <th></th>
                  <th>大运(虚岁)</th>
                  <th>干支·十神</th>
                  <th>公历</th>
                  <th>长生</th>
                  <th>喜忌</th>
                  <th>均值</th>
                  <th>高光年</th>
                  <th>低谷年</th>
                  <th>运限格局</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const expanded = open === r.ganZhi;
                  return (
                    <Fragment key={r.ganZhi}>
                      <tr
                        data-testid={`dp-row-${r.ganZhi}`}
                        onClick={() => setOpen(expanded ? null : r.ganZhi)}
                        className={cn(
                          'border-b border-border/30 cursor-pointer transition-colors hover:bg-muted/40 [&>td]:px-2 [&>td]:py-1.5',
                          r.current && 'bg-gold/10',
                        )}
                        title={`${r.ganZhi}运 ${r.startYear}~${r.endYear} · 点击${expanded ? '收起' : '展开'}逐年明细`}
                      >
                        <td className="text-muted-foreground">
                          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </td>
                        <td className="font-bold tabular-nums">
                          {r.startAge}~{r.endAge}
                          {r.current && <span className="ml-1 text-[10px] font-normal text-crimson dark:text-gold">当前</span>}
                        </td>
                        <td>
                          <b>{r.ganZhi}</b>
                          <span className="ml-1 text-muted-foreground">{r.ganShen}/{r.zhiShen}</span>
                        </td>
                        <td className="tabular-nums text-muted-foreground">{r.startYear}~{r.endYear}</td>
                        <td>{r.diShi || '—'}</td>
                        <td className={favorCls(r.favor)}>{r.favor}</td>
                        <td className="font-bold tabular-nums">{r.avg ?? '—'}</td>
                        <td className="tabular-nums" style={{ color: UP }}>
                          {r.best ? `${r.best.year}(${r.best.score})` : '—'}
                        </td>
                        <td className="tabular-nums" style={{ color: DOWN }}>
                          {r.worst ? `${r.worst.year}(${r.worst.score})` : '—'}
                        </td>
                        <td>
                          {r.patterns.length ? (
                            <span className="flex flex-wrap gap-1">
                              {r.patterns.map((pt, i) => (
                                <i
                                  key={i}
                                  className={cn('not-italic rounded border px-1 py-px text-[10px]', KIND_CLS[pt.kind])}
                                  title={`${pt.basis}——${pt.meaning}`}
                                >
                                  {pt.name.replace(/\((运|年)?成象\)|\((运|年)?凑成\)|\(运\)|\(年\)/g, '')}
                                </i>
                              ))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-border/30 bg-muted/20">
                          <td colSpan={10} className="px-2 py-2">
                            {r.years.length ? (
                              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                                {r.years.map((y) => (
                                  <span key={y.year} className="text-[11px] leading-snug">
                                    <b className="tabular-nums">{y.year}</b> {y.ganZhi}
                                    <b className="ml-1 tabular-nums" style={{ color: y.delta >= 0 ? UP : DOWN }}>
                                      {y.score}
                                    </b>
                                    <span className="text-[10px] tabular-nums" style={{ color: y.delta >= 0 ? UP : DOWN }}>
                                      {y.delta >= 0 ? '▲' : '▼'}{Math.abs(y.delta)}
                                    </span>
                                    {y.topFactors.length > 0 && (
                                      <span className="ml-1 text-muted-foreground">{y.topFactors.join('、')}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">超出K线量化范围（K线覆盖前100年）</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/70 leading-relaxed">{data.note}；仅供参考娱乐，完整解读请交给 AI 分析。</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
