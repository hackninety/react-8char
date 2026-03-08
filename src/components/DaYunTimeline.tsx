import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, getShiShenColor } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';
import { getLiuYueForYear, getLiuRiForMonth, getLiuShiForDay, getShiShen } from '@/lib/bazi';
import type { BaziResult, LiuRiItem, LiuShiItem } from '@/lib/bazi';

interface DaYunTimelineProps {
  result: BaziResult;
}

export default function DaYunTimeline({ result }: DaYunTimelineProps) {
  const { dayunArr, currentYun, yun } = result;
  const dayMasterGan = result.pillars?.dayMasterGan || result.pillars?.day?.gan || '';

  const currentDaYunGanZhi = currentYun?.daYun
    ? (Array.isArray(currentYun.daYun.ganZhi) ? currentYun.daYun.ganZhi.join('') : currentYun.daYun.ganZhi)
    : null;
  const currentLiuNianYear = currentYun?.liuNian?.year;

  const initialDyIdx = dayunArr?.findIndex((dy: any) => dy.ganZhi === currentDaYunGanZhi) ?? -1;
  const [selectedDaYun, setSelectedDaYun] = useState<number | null>(initialDyIdx >= 0 ? initialDyIdx : null);
  const [selectedLiuNian, setSelectedLiuNian] = useState<number | null>(null);
  const [selectedLiuYue, setSelectedLiuYue] = useState<number | null>(null);
  const [selectedLiuRi, setSelectedLiuRi] = useState<number | null>(null);

  const activeDaYun = selectedDaYun !== null ? dayunArr?.[selectedDaYun] : null;
  const activeLiuNian = selectedLiuNian !== null && activeDaYun?.liunianArr
    ? (activeDaYun.liunianArr as any[])[selectedLiuNian]
    : null;

  const activeLnGan = activeLiuNian && typeof activeLiuNian.ganZhi === 'string'
    ? activeLiuNian.ganZhi[0] : '';

  const liuYueArr = useMemo(() => {
    if (!activeLnGan || !dayMasterGan) return [];
    return getLiuYueForYear(activeLnGan, dayMasterGan);
  }, [activeLnGan, dayMasterGan]);

  const activeLiuYueItem = selectedLiuYue !== null ? liuYueArr[selectedLiuYue] : null;

  const liuRiArr: LiuRiItem[] = useMemo(() => {
    if (!activeLiuYueItem || !activeLiuNian) return [];
    return getLiuRiForMonth(activeLiuNian.year, activeLiuYueItem.monthIndex, dayMasterGan);
  }, [activeLiuNian, activeLiuYueItem, dayMasterGan]);

  const activeLiuRiItem = selectedLiuRi !== null ? liuRiArr[selectedLiuRi] : null;

  const liuShiArr: LiuShiItem[] = useMemo(() => {
    if (!activeLiuRiItem) return [];
    return getLiuShiForDay(activeLiuRiItem.solarYear, activeLiuRiItem.solarMonth, activeLiuRiItem.solarDay, dayMasterGan);
  }, [activeLiuRiItem, dayMasterGan]);

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <TrendingUp className="w-4 h-4" />
          大运 · 流年 · 流月 · 流日 · 流时
        </CardTitle>
        {yun && (
          <p className="text-xs text-muted-foreground">
            {yun.forward ? '顺排' : '逆排'} · 起运：{yun.startSolar}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 第一行：大运 */}
        <div>
          <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">大运</div>
          <div className="flex gap-2 w-full">
            {dayunArr?.map((dy: any, dyIdx: number) => {
              const isCurrent = dy.ganZhi === currentDaYunGanZhi;
              const isSelected = selectedDaYun === dyIdx;
              if (!dy.ganZhi) return null;
              return (
                <button key={dyIdx} type="button"
                  onClick={() => {
                    setSelectedDaYun(isSelected ? null : dyIdx);
                    setSelectedLiuNian(null);
                    setSelectedLiuYue(null);
                    setSelectedLiuRi(null);
                  }}
                  className={cn(
                    'flex-1 flex flex-col items-center px-1 py-2 rounded-lg border transition-all cursor-pointer min-w-0',
                    isSelected
                      ? 'border-gold bg-gold/15 shadow-sm shadow-gold/20'
                      : isCurrent
                        ? 'border-gold/50 bg-gold/5'
                        : 'border-border/50 hover:border-gold/30 hover:bg-muted/30',
                  )}
                >
                  <span className={cn('text-sm sm:text-base font-bold whitespace-nowrap', isSelected || isCurrent ? 'text-gold' : '')}>
                    {dy.ganZhi}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">{dy.startYear}年</span>
                  {dy.ganshen && (
                    <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-3.5 mt-0.5 whitespace-nowrap', getShiShenColor(dy.ganshen))}>
                      {dy.ganshen}
                    </Badge>
                  )}
                  {isCurrent && <Badge className="text-[8px] bg-gold text-black mt-0.5 px-1 py-0 h-3.5 whitespace-nowrap hidden md:inline-flex">当前</Badge>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 第二行：流年 */}
        <AnimatePresence mode="wait">
          {activeDaYun && activeDaYun.liunianArr && (
            <motion.div key={`ln-${selectedDaYun}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                流年（{activeDaYun.ganZhi}运）
              </div>
              <div className="flex gap-2 w-full">
                {(activeDaYun.liunianArr as any[]).map((ln: any, lnIdx: number) => {
                  const isLnCurrent = String(ln.year) === String(currentLiuNianYear);
                  const isLnSelected = selectedLiuNian === lnIdx;
                  const lnGan = typeof ln.ganZhi === 'string' ? ln.ganZhi[0] : '';
                  const lnShiShen = lnGan && dayMasterGan ? getShiShen(dayMasterGan, lnGan) : ln.ganshen || '';

                  return (
                    <button key={lnIdx} type="button"
                      onClick={() => {
                        setSelectedLiuNian(isLnSelected ? null : lnIdx);
                        setSelectedLiuYue(null);
                        setSelectedLiuRi(null);
                      }}
                      className={cn(
                        'flex-1 flex flex-col items-center px-1 py-2 rounded-lg border transition-all cursor-pointer min-w-0',
                        isLnSelected
                          ? 'border-crimson bg-crimson/10 shadow-sm'
                          : isLnCurrent
                            ? 'border-crimson/50 bg-crimson/5'
                            : 'border-border/50 hover:border-crimson/30 hover:bg-muted/30',
                      )}
                    >
                      <span className={cn('text-sm sm:text-base font-bold whitespace-nowrap', isLnSelected || isLnCurrent ? 'text-crimson dark:text-crimson-light' : '')}>
                        {ln.ganZhi}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">{ln.year}年</span>
                      {lnShiShen && (
                        <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-3.5 mt-0.5 whitespace-nowrap', getShiShenColor(lnShiShen))}>
                          {lnShiShen}
                        </Badge>
                      )}
                      {isLnCurrent && <Badge className="text-[8px] bg-crimson text-white mt-0.5 px-1 py-0 h-3.5 whitespace-nowrap hidden md:inline-flex">今年</Badge>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第三行：流月 */}
        <AnimatePresence mode="wait">
          {activeLnGan && liuYueArr.length > 0 && (
            <motion.div key={`ly-${selectedDaYun}-${selectedLiuNian}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                流月（{activeLiuNian.ganZhi} · {activeLiuNian.year}年）
              </div>
              <div className="flex gap-2 w-full">
                {liuYueArr.map((ly: any, lyIdx: number) => {
                  const isLySelected = selectedLiuYue === lyIdx;
                  return (
                    <button key={ly.monthIndex} type="button"
                      onClick={() => {
                        setSelectedLiuYue(isLySelected ? null : lyIdx);
                        setSelectedLiuRi(null);
                      }}
                      className={cn(
                        'flex-1 flex flex-col items-center px-1 py-2 rounded-lg border transition-all cursor-pointer min-w-0',
                        isLySelected
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                          : 'border-border/40 bg-background/50 hover:border-emerald-500/30 hover:bg-muted/30',
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">{ly.monthName}</span>
                      <span className={cn('text-sm sm:text-base font-bold whitespace-nowrap', isLySelected ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                        {ly.ganZhi}
                      </span>
                      {ly.shiShen && (
                        <Badge variant="outline" className={cn('text-[8px] px-0.5 py-0 h-3.5 mt-0.5 whitespace-nowrap', getShiShenColor(ly.shiShen))}>
                          {ly.shiShen}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第四行：流日（横向滚动） */}
        <AnimatePresence mode="wait">
          {activeLiuYueItem && liuRiArr.length > 0 && (
            <motion.div key={`lr-${selectedDaYun}-${selectedLiuNian}-${selectedLiuYue}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                流日（{activeLiuYueItem.monthName} · {activeLiuYueItem.ganZhi}）
              </div>
              <div className="flex gap-1.5 w-full overflow-x-auto pb-1">
                {liuRiArr.map((lr, lrIdx) => {
                  const isLrSelected = selectedLiuRi === lrIdx;
                  return (
                    <button key={lr.solarDay} type="button"
                      onClick={() => setSelectedLiuRi(isLrSelected ? null : lrIdx)}
                      className={cn(
                        'flex flex-col items-center px-1.5 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0',
                        'min-w-[52px]',
                        isLrSelected
                          ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                          : 'border-border/40 bg-background/50 hover:border-purple-500/30 hover:bg-muted/30',
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{lr.lunarDay}</span>
                      <span className={cn('text-sm font-bold whitespace-nowrap', isLrSelected ? 'text-purple-600 dark:text-purple-400' : '')}>
                        {lr.ganZhi}
                      </span>
                      {lr.shiShen && (
                        <Badge variant="outline" className={cn('text-[7px] px-0.5 py-0 h-3 mt-0.5 whitespace-nowrap', getShiShenColor(lr.shiShen))}>
                          {lr.shiShen}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第五行：流时 */}
        <AnimatePresence mode="wait">
          {activeLiuRiItem && liuShiArr.length > 0 && (
            <motion.div key={`ls-${selectedDaYun}-${selectedLiuNian}-${selectedLiuYue}-${selectedLiuRi}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                流时（{activeLiuRiItem.lunarDay} · {activeLiuRiItem.ganZhi}）
              </div>
              <div className="flex gap-2 w-full">
                {liuShiArr.map((ls) => (
                  <div key={ls.shiChenName}
                    className="flex-1 flex flex-col items-center px-1 py-2 rounded-lg border border-border/40 bg-background/50 min-w-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">{ls.shiChenName}</span>
                    <span className="text-sm sm:text-base font-bold whitespace-nowrap">{ls.ganZhi}</span>
                    {ls.shiShen && (
                      <Badge variant="outline" className={cn('text-[8px] px-0.5 py-0 h-3.5 mt-0.5 whitespace-nowrap', getShiShenColor(ls.shiShen))}>
                        {ls.shiShen}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
