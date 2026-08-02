// 生时校正助手（定盘）弹层：同日十三时辰并排 + 特征勾选 + 大事年份反查评分。
// 选定时辰后回填代表时刻并直接起盘（自动关闭真太阳时——时辰不详即无可靠钟表时刻）。
// 参照 react-zwds RectifyPanel，八字版差异列为：四柱/时柱十神/起运/晚子时换日。
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getShiShenColor } from '@/lib/utils';
import type { BaziInput } from '@/lib/bazi';
import {
  TRAITS,
  buildHourCandidates,
  matchEvents,
  scoreCandidate,
  traitHits,
  type LifeEvent,
} from '@/lib/rectify';

interface Props {
  /** 已解析为公历的基础输入（无定位字段） */
  base: Pick<BaziInput, 'year' | 'month' | 'day' | 'gender' | 'sect'>;
  onPick: (hour: number, minute: number) => void;
  onClose: () => void;
}

export default function RectifyPanel({ base, onPick, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<LifeEvent[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const candidates = useMemo(
    () => buildHourCandidates({ ...base, hour: 0, minute: 0 }),
    [base],
  );
  const hitsMap = useMemo(() => candidates.map(traitHits), [candidates]);

  // 大事年份反查仅在填了有效年份时计算（13 盘 K 线较重）
  const validEvents = events.filter((e) => e.year > 1900);
  const eventKey = validEvents.map((e) => `${e.year}${e.kind}`).join('|');
  const eventHitsMap = useMemo(
    () => (validEvents.length ? candidates.map((c) => matchEvents(c.chart, validEvents)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, eventKey],
  );

  const scored = useMemo(
    () =>
      candidates
        .map((c, i) => ({
          c,
          hits: hitsMap[i],
          eventHits: eventHitsMap?.[i] ?? [],
          score: scoreCandidate(hitsMap[i], checked, eventHitsMap?.[i] ?? []),
        }))
        .sort((a, b) => b.score - a.score || a.c.index - b.c.index),
    [candidates, hitsMap, eventHitsMap, checked],
  );
  const maxScore = scored[0]?.score ?? 0;
  const anyCriteria = checked.size > 0 || validEvents.length > 0;

  const toggleTrait = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setEvent = (i: number, patch: Partial<LifeEvent>) =>
    setEvents((list) => {
      const n = [...list];
      n[i] = { ...(n[i] ?? { year: 0, kind: 'turbulent' }), ...patch };
      return n;
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl my-4 rounded-xl border border-gold/30 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gold/20">
          <div className="flex items-center gap-2 text-sm font-bold text-crimson dark:text-gold">
            <Clock3 className="w-4 h-4" />
            生时校正助手（定盘）
            <span className="text-[11px] font-normal text-muted-foreground">
              公历 {base.year}-{base.month}-{base.day} · {base.gender === 1 ? '男' : '女'} · {base.sect === 2 ? '传统派' : '正统派'}
            </span>
          </div>
          <button type="button" onClick={onClose} title="关闭（Esc）"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            时辰不详时定盘：勾选符合命主的<b className="text-foreground">性格特征</b>、填入<b className="text-foreground">已发生的大事年份</b>，
            十三个时辰按匹配度排序（按标准时辰排盘，不作真太阳时校正）。
            <b className="text-crimson dark:text-gold">生于半夜 23:00~01:00（俗称子时）者请重点比对「早子时/晚子时」两盘</b>——
            晚子时跨日，正统派日柱进一日、整盘日主随变，性格与大运起点差异最大（传统派日柱不变、仅时柱入次日子时）。
          </p>

          <div className="flex flex-wrap gap-1.5">
            {TRAITS.map((t) => (
              <button key={t.id} type="button" onClick={() => toggleTrait(t.id)}
                className={cn(
                  'px-2 py-1 rounded-full border text-xs transition-colors cursor-pointer',
                  checked.has(t.id)
                    ? 'border-crimson bg-crimson/10 text-crimson dark:border-gold dark:bg-gold/10 dark:text-gold font-medium'
                    : 'border-border text-muted-foreground hover:border-gold/40',
                )}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">大事年份（可选，最多三条）：</span>
            {[0, 1, 2].map((i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <input type="number" placeholder="公历年" min={1900} max={2100}
                  value={events[i]?.year || ''}
                  onChange={(e) => setEvent(i, { year: Number(e.target.value) || 0 })}
                  className="w-20 h-7 px-1.5 rounded-md border border-gold/20 bg-transparent text-xs focus:border-gold/50 outline-none" />
                <select value={events[i]?.kind ?? 'turbulent'}
                  onChange={(e) => setEvent(i, { kind: e.target.value as LifeEvent['kind'] })}
                  className="h-7 rounded-md border border-gold/20 bg-transparent text-xs cursor-pointer">
                  <option value="turbulent">动荡/破耗/大变动</option>
                  <option value="good">顺遂/有成</option>
                </select>
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gold/15">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">时辰</th>
                  <th className="px-2 py-1.5 text-left font-medium">四柱</th>
                  <th className="px-2 py-1.5 text-left font-medium">时柱十神</th>
                  <th className="px-2 py-1.5 text-left font-medium">起运</th>
                  <th className="px-2 py-1.5 text-left font-medium">特征命中</th>
                  {validEvents.length > 0 && <th className="px-2 py-1.5 text-left font-medium">年份反查</th>}
                  <th className="px-2 py-1.5 text-center font-medium">匹配</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ c, hits, eventHits, score }) => {
                  const matched = TRAITS.filter((t, i) => checked.has(t.id) && hits[i]).map((t) => t.label.split('·')[0]);
                  const best = anyCriteria && score === maxScore && maxScore > 0;
                  const isZi = c.label.includes('子时');
                  return (
                    <tr key={c.index} className={cn('border-t border-border/40', best && 'bg-gold/10 dark:bg-gold/5')}>
                      <td className="px-2 py-1.5">
                        <b className={cn(isZi && 'text-crimson dark:text-gold')}>{c.label}</b>
                        {isZi && <span className="ml-1 text-[9px] px-1 py-px rounded-full border border-crimson/40 text-crimson dark:border-gold/40 dark:text-gold">跨日</span>}
                        <div className="text-[10px] text-muted-foreground">{c.range}</div>
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {c.pillarsText.split(' ').map((gz, i) => (
                          <span key={i} className={cn(
                            'mr-1',
                            i === 3 && 'font-bold',
                            i === 2 && c.dayChanged && 'text-crimson dark:text-gold font-bold underline decoration-dotted underline-offset-2',
                          )}>{gz}</span>
                        ))}
                        {c.dayChanged && <div className="text-[10px] text-crimson dark:text-gold">日柱已进次日（正统派换日）</div>}
                        {!c.dayChanged && c.label === '晚子时' && <div className="text-[10px] text-muted-foreground">日柱不变（传统派），时柱入次日子时</div>}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn('mr-1', getShiShenColor(c.tGanShen))}>{c.tGanShen || '—'}</span>
                        <span className={cn('text-muted-foreground', getShiShenColor(c.tZhiShen))}>/{c.tZhiShen || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.qiYun || '—'}</td>
                      <td className="px-2 py-1.5 max-w-[160px] whitespace-normal">{matched.length ? matched.join('、') : '—'}</td>
                      {validEvents.length > 0 && (
                        <td className="px-2 py-1.5">
                          {validEvents.map((e, k) => (
                            <span key={k} className={cn('mr-1.5', eventHits[k] ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/60')}>
                              {e.year}{eventHits[k] ? '✓' : '✗'}
                            </span>
                          ))}
                        </td>
                      )}
                      <td className="px-2 py-1.5 text-center">
                        <b className={cn(best ? 'text-crimson dark:text-gold' : 'text-muted-foreground')}>{score}</b>
                      </td>
                      <td className="px-2 py-1.5">
                        <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px] border-gold/30 cursor-pointer"
                          onClick={() => onPick(c.hour, c.minute)} data-testid={`rectify-pick-${c.label}`}>
                          用此时辰
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            校时仅供缩小范围：特征按时柱十神/时支作用等通行类象判定、区分度有限，建议多勾几项并配合大事年份交叉验证；
            选定后按该时辰代表时刻回填并关闭真太阳时，若之后能确认大致钟表时刻，可再开启真太阳时精排。
          </p>
        </div>
      </motion.div>
    </div>
  );
}
