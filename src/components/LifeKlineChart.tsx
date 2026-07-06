import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { buildLifeKline } from '@/lib/lifekline';
import type { BaziResult } from '@/lib/bazi';

// 中式股票配色：红涨绿跌；金色为 5 年均线
const UP = '#dc2626';
const DOWN = '#16a34a';
const GOLD = '#d4af37';

const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 20;
const PAD_B = 24;
const SLOT_W = 7; // 每年占位宽
const BODY_W = 4.5; // K 线实体宽
const CHART_H = 170;

interface LifeKlineChartProps {
  result: BaziResult;
}

export default function LifeKlineChart({ result }: LifeKlineChartProps) {
  const data = useMemo(() => buildLifeKline(result), [result]);
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.years.length < 5) return null;
  const { years } = data;

  const svgW = PAD_L + PAD_R + years.length * SLOT_W;
  const svgH = PAD_T + CHART_H + PAD_B;
  const yOf = (v: number) => PAD_T + ((100 - v) / 100) * CHART_H;
  const xOf = (i: number) => PAD_L + i * SLOT_W;

  // 大运分段（连续同大运的年份为一段；起运前占位段无标签）
  const bands: { start: number; end: number; label: string }[] = [];
  years.forEach((y, i) => {
    const last = bands[bands.length - 1];
    if (!last || last.label !== y.dayun) bands.push({ start: i, end: i, label: y.dayun });
    else last.end = i;
  });

  // 5 年均线
  const maPoints = years
    .map((_, i) => {
      const seg = years.slice(Math.max(0, i - 4), i + 1);
      const avg = seg.reduce((a, y) => a + y.close, 0) / seg.length;
      return `${xOf(i) + SLOT_W / 2},${yOf(avg).toFixed(1)}`;
    })
    .join(' ');

  const h = hover !== null ? years[hover] : null;
  const TIP_W = 224; // w-56
  const cx = hover !== null ? xOf(hover) + SLOT_W / 2 : 0;
  // 浮层放在光标一侧；右侧放不下就翻到左侧，始终不遮住正在看的那根K线（尤其末尾年份）
  const flipLeft = cx + 14 + TIP_W > svgW;
  const tipLeft = hover === null ? 0 : flipLeft ? Math.max(4, cx - 14 - TIP_W) : cx + 14;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-gold/20 glow-gold">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
            <Activity className="w-4 h-4" />
            人生K线
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {data.judge}（{data.judgeSource}）· {data.preferenceNote} ·
            <span className="ml-1" style={{ color: UP }}>红涨</span>
            <span style={{ color: DOWN }}>绿跌</span>
            <span className="ml-1" style={{ color: GOLD }}>金线=5年均线</span>
            · 悬停查看逐年明细
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-1">
            <div className="relative" style={{ width: svgW }}>
              <svg width={svgW} height={svgH} className="text-foreground select-none block">
                {/* 大运分段底色与标签 */}
                {bands.map((b, bi) => (
                  <g key={`${b.label}-${b.start}`}>
                    {bi % 2 === 1 && (
                      <rect
                        x={xOf(b.start)} y={PAD_T}
                        width={(b.end - b.start + 1) * SLOT_W} height={CHART_H}
                        fill="currentColor" opacity={0.045}
                      />
                    )}
                    {b.label && (
                      <text x={xOf(b.start) + 2} y={PAD_T - 7} fontSize={9} fill="currentColor" opacity={0.65}>
                        {b.label}
                      </text>
                    )}
                    <text x={xOf(b.start) + 2} y={svgH - 8} fontSize={8} fill="currentColor" opacity={0.5}>
                      {years[b.start].year}
                    </text>
                  </g>
                ))}

                {/* 水平网格 + 刻度 */}
                {[20, 50, 80].map((v) => (
                  <g key={v}>
                    <line x1={PAD_L} y1={yOf(v)} x2={svgW - PAD_R} y2={yOf(v)}
                      stroke="currentColor" strokeOpacity={v === 50 ? 0.18 : 0.08}
                      strokeDasharray={v === 50 ? '3 3' : '2 4'} />
                    <text x={PAD_L - 4} y={yOf(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" opacity={0.5}>
                      {v}
                    </text>
                  </g>
                ))}

                {/* K 线 */}
                {years.map((y, i) => {
                  const up = y.close >= y.open;
                  const color = up ? UP : DOWN;
                  const cx = xOf(i) + SLOT_W / 2;
                  const bodyTop = yOf(Math.max(y.open, y.close));
                  const bodyH = Math.max(1, Math.abs(yOf(y.open) - yOf(y.close)));
                  return (
                    <g key={y.year}>
                      <line x1={cx} y1={yOf(y.high)} x2={cx} y2={yOf(y.low)} stroke={color} strokeWidth={1} />
                      <rect
                        x={cx - BODY_W / 2} y={bodyTop} width={BODY_W} height={bodyH}
                        fill={up ? color : color} stroke={color} strokeWidth={0.5}
                        opacity={hover === null || hover === i ? 1 : 0.55}
                      />
                    </g>
                  );
                })}

                {/* 5 年均线 */}
                <polyline points={maPoints} fill="none" stroke={GOLD} strokeWidth={1.4} strokeOpacity={0.85} />

                {/* 当前年标记 */}
                {data.currentIndex >= 0 && (
                  <g>
                    <line
                      x1={xOf(data.currentIndex) + SLOT_W / 2} y1={PAD_T - 2}
                      x2={xOf(data.currentIndex) + SLOT_W / 2} y2={PAD_T + CHART_H}
                      stroke={GOLD} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.9}
                    />
                    <text x={xOf(data.currentIndex) + SLOT_W / 2} y={PAD_T + 8} fontSize={9}
                      textAnchor="middle" fill={GOLD} fontWeight="bold">今</text>
                  </g>
                )}

                {/* 悬停感应区 */}
                {years.map((y, i) => (
                  <rect
                    key={`hit-${y.year}`}
                    x={xOf(i)} y={PAD_T} width={SLOT_W} height={CHART_H}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </svg>

              {/* 悬浮明细 */}
              {h && (
                <div
                  className="absolute top-2 z-10 w-56 rounded-lg border border-gold/25 bg-background/95 backdrop-blur-sm shadow-lg p-2.5 pointer-events-none"
                  style={{ left: tipLeft }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold">
                      {h.year} {h.ganZhi}
                      <span className="ml-1 font-normal text-muted-foreground">{h.age}岁{h.dayun ? ` · ${h.dayun}运` : ''}</span>
                    </span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: h.delta >= 0 ? UP : DOWN }}>
                      {h.score}分 {h.delta >= 0 ? '▲' : '▼'}{Math.abs(h.delta)}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {(h.factors.length ? h.factors.slice(0, 6) : ['平年（无显著作用关系）']).map((f, fi) => (
                      <p key={fi} className="text-[10px] leading-snug text-muted-foreground">· {f}</p>
                    ))}
                    {h.factors.length > 6 && (
                      <p className="text-[10px] text-muted-foreground/60">… 共 {h.factors.length} 项</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground/70 leading-relaxed">
            评分为简化扶抑模型的确定性量化（大运基调 / 流年十神 / 支冲刑合害 / 神煞 / 岁运并临等），仅供参考娱乐，完整解读请交给 AI 分析。
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
