import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildLifeKline, KLINE_DIMS, type KlineDim } from '@/lib/lifekline';
import type { BaziResult } from '@/lib/bazi';

// 中式股票配色：红涨绿跌；金色为 5 年均线
const UP = '#dc2626';
const DOWN = '#16a34a';
const GOLD = '#d4af37';

const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 20;
const PAD_B = 24;
const SLOT_W = 7;
const BODY_W = 4.5;
const CHART_H = 170;

interface LifeKlineChartProps {
  result: BaziResult;
}

export default function LifeKlineChart({ result }: LifeKlineChartProps) {
  const data = useMemo(() => buildLifeKline(result), [result]);
  const [dim, setDim] = useState<KlineDim>('total');
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.years.length < 5) return null;
  const { years } = data;

  const svgW = PAD_L + PAD_R + years.length * SLOT_W;
  const svgH = PAD_T + CHART_H + PAD_B;
  const yOf = (v: number) => PAD_T + ((100 - v) / 100) * CHART_H;
  const xOf = (i: number) => PAD_L + i * SLOT_W;

  // 大运分段
  const bands: { start: number; end: number; label: string }[] = [];
  years.forEach((y, i) => {
    const last = bands[bands.length - 1];
    if (!last || last.label !== y.dayun) bands.push({ start: i, end: i, label: y.dayun });
    else last.end = i;
  });

  // 5 年均线（当前维度）
  const maPoints = years
    .map((_, i) => {
      const seg = years.slice(Math.max(0, i - 4), i + 1);
      const avg = seg.reduce((a, y) => a + y.scores[dim], 0) / seg.length;
      return `${xOf(i) + SLOT_W / 2},${yOf(avg).toFixed(1)}`;
    })
    .join(' ');

  // 详情面板默认显示：悬停年 → 当前年 → 最后一年
  const activeIdx = hover ?? (data.currentIndex >= 0 ? data.currentIndex : years.length - 1);
  const active = years[activeIdx];
  const dimLabel = KLINE_DIMS.find((d) => d.key === dim)!.label;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-gold/20 glow-gold">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
              <Activity className="w-4 h-4" />
              人生K线
            </CardTitle>
            {/* 维度切换 */}
            <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5">
              {KLINE_DIMS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDim(d.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                    dim === d.key
                      ? 'bg-background text-crimson dark:text-gold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.judge}（{data.judgeSource}）· {data.preferenceNote} ·
            <span className="ml-1" style={{ color: UP }}>红涨</span>
            <span style={{ color: DOWN }}>绿跌</span>
            <span className="ml-1" style={{ color: GOLD }}>金线=5年均线</span>
          </p>
          {data.dili.hasLocation && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">🧭 {data.dili.note}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-1">
            <svg width={svgW} height={svgH} className="text-foreground select-none block">
              {/* 大运分段 */}
              {bands.map((b, bi) => (
                <g key={`${b.label}-${b.start}`}>
                  {bi % 2 === 1 && (
                    <rect x={xOf(b.start)} y={PAD_T} width={(b.end - b.start + 1) * SLOT_W} height={CHART_H} fill="currentColor" opacity={0.045} />
                  )}
                  {b.label && (
                    <text x={xOf(b.start) + 2} y={PAD_T - 7} fontSize={9} fill="currentColor" opacity={0.65}>{b.label}</text>
                  )}
                  <text x={xOf(b.start) + 2} y={svgH - 8} fontSize={8} fill="currentColor" opacity={0.5}>{years[b.start].year}</text>
                </g>
              ))}

              {/* 网格 */}
              {[20, 50, 80].map((v) => (
                <g key={v}>
                  <line x1={PAD_L} y1={yOf(v)} x2={svgW - PAD_R} y2={yOf(v)} stroke="currentColor" strokeOpacity={v === 50 ? 0.18 : 0.08} strokeDasharray={v === 50 ? '3 3' : '2 4'} />
                  <text x={PAD_L - 4} y={yOf(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" opacity={0.5}>{v}</text>
                </g>
              ))}

              {/* K 线（当前维度） */}
              {years.map((y, i) => {
                const o = y.ohlc[dim];
                const up = o.close >= o.open;
                const color = up ? UP : DOWN;
                const cx = xOf(i) + SLOT_W / 2;
                const bodyTop = yOf(Math.max(o.open, o.close));
                const bodyH = Math.max(1, Math.abs(yOf(o.open) - yOf(o.close)));
                return (
                  <g key={y.year}>
                    <line x1={cx} y1={yOf(o.high)} x2={cx} y2={yOf(o.low)} stroke={color} strokeWidth={1} />
                    <rect x={cx - BODY_W / 2} y={bodyTop} width={BODY_W} height={bodyH} fill={color} stroke={color} strokeWidth={0.5} opacity={hover === null || hover === i ? 1 : 0.5} />
                  </g>
                );
              })}

              {/* 均线 */}
              <polyline points={maPoints} fill="none" stroke={GOLD} strokeWidth={1.4} strokeOpacity={0.85} />

              {/* 选中/当前年竖线 */}
              <line
                x1={xOf(activeIdx) + SLOT_W / 2} y1={PAD_T - 2}
                x2={xOf(activeIdx) + SLOT_W / 2} y2={PAD_T + CHART_H}
                stroke={GOLD} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.8}
              />
              {data.currentIndex >= 0 && (
                <text x={xOf(data.currentIndex) + SLOT_W / 2} y={PAD_T + 8} fontSize={9} textAnchor="middle" fill={GOLD} fontWeight="bold">今</text>
              )}

              {/* 悬停感应区 */}
              {years.map((y, i) => (
                <rect key={`hit-${y.year}`} x={xOf(i)} y={PAD_T} width={SLOT_W} height={CHART_H} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              ))}
            </svg>
          </div>

          {/* 固定详情面板（在图表下方，永不遮挡K线；移动端可点选） */}
          <div className="mt-2 rounded-lg border border-gold/15 bg-muted/30 p-2.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold">
                {active.year} {active.ganZhi}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {active.age}岁{active.dayun ? ` · ${active.dayun}运` : ''}
                  {hover === null && data.currentIndex === activeIdx ? ' · 今年' : ''}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">悬停/点选查看各年</span>
            </div>

            {/* 五维评分一览（当前维高亮） */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {KLINE_DIMS.map((d) => {
                const sc = active.scores[d.key];
                const dl = active.delta[d.key];
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDim(d.key)}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2 py-1 text-xs cursor-pointer border transition-colors',
                      dim === d.key ? 'border-gold/50 bg-gold/10' : 'border-transparent bg-background/60 hover:bg-background',
                    )}
                  >
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-bold tabular-nums" style={{ color: dl >= 0 ? UP : DOWN }}>{sc}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: dl >= 0 ? UP : DOWN }}>
                      {dl >= 0 ? '▲' : '▼'}{Math.abs(dl)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 当前维度因素明细 */}
            <div className="mt-1.5 border-t border-border/40 pt-1.5">
              <div className="text-[10px] text-muted-foreground/80 mb-0.5">{dimLabel}评分因素</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {(active.factors[dim].length ? active.factors[dim] : [`平年（无显著${dimLabel}相关作用）`]).map((f, fi) => (
                  <span key={fi} className="text-[11px] leading-snug text-muted-foreground">· {f}</span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground/70 leading-relaxed">
            五维评分为简化命理模型的确定性量化（喜忌 / 十神类象 / 宫位 / 冲刑合害 / 神煞），仅供参考娱乐；完整解读请交给 AI 分析。
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
