import { useMemo } from 'react';
import { buildWuxingEnergy } from '@/lib/wuxing-energy';

const UP = '#dc2626';
const GOLD = '#d4af37';
const DOWN = '#16a34a';

const WX_ORDER = ['木', '火', '土', '金', '水'];
const SIZE = 264;
const CX = SIZE / 2;
const CY = SIZE / 2 + 4;
const R_MAX = 82;

interface WuxingRadarProps {
  pillars: Parameters<typeof buildWuxingEnergy>[0]['pillars'];
  judge?: string;
  /** 选中年的大运/流年干支(缺省只画原局) */
  dayunGz?: string;
  liunianGz?: string;
  /** 标题右侧说明(如「2026 丙午」) */
  caption?: string;
}

/** 五行能量多边形:原局/+大运/+流年 三层结构占比叠加(干支计点法) */
export default function WuxingRadar({ pillars, judge, dayunGz, liunianGz, caption }: WuxingRadarProps) {
  const data = useMemo(
    () => buildWuxingEnergy({ pillars, judge, dayunGz, liunianGz }),
    [pillars, judge, dayunGz, liunianGz],
  );
  if (!data) return null;

  const likes = data.likes ? new Set(data.likes) : null;
  const maxPct = Math.max(...data.layers.flatMap((l) => WX_ORDER.map((w) => l.percent[w] ?? 0)));
  const scaleMax = Math.max(30, Math.ceil(maxPct / 10) * 10);
  const angle = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;
  const pos = (i: number, r: number) => ({ x: CX + Math.cos(angle(i)) * r, y: CY + Math.sin(angle(i)) * r });
  const rOf = (pct: number) => (pct / scaleMax) * R_MAX;
  const polyOf = (percent: Record<string, number>) =>
    WX_ORDER.map((w, i) => {
      const { x, y } = pos(i, rOf(percent[w] ?? 0));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  // 层样式:原局(虚线灰) → +大运(金) → +流年(红);层不足时后者缺省
  const LAYER_STYLE = [
    { stroke: 'currentColor', strokeOpacity: 0.45, fill: 'none', dash: '3 3' },
    { stroke: GOLD, strokeOpacity: 0.9, fill: GOLD, fillOpacity: 0.1, dash: undefined },
    { stroke: UP, strokeOpacity: 0.9, fill: UP, fillOpacity: 0.13, dash: undefined },
  ];
  const finalLayer = data.layers[data.layers.length - 1];

  return (
    <div data-testid="wuxing-radar" className="mt-2 rounded-lg border border-gold/15 bg-muted/20 p-2.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold">
          五行能量多边形
          {caption && <span className="ml-1.5 font-normal text-muted-foreground">{caption}</span>}
        </span>
        <span className="flex gap-2.5 text-[10px] text-muted-foreground">
          {data.layers.map((l, k) => (
            <span key={l.label} className="flex items-center gap-1">
              <i
                className="inline-block w-3 border-t-2 not-italic"
                style={{
                  borderColor: k === 0 ? 'currentColor' : (LAYER_STYLE[k].stroke as string),
                  borderTopStyle: k === 0 ? 'dashed' : 'solid',
                  opacity: k === 0 ? 0.6 : 1,
                }}
              />
              {l.label}
            </span>
          ))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4">
        <svg width={SIZE} height={SIZE - 16} className="text-foreground select-none block shrink-0" aria-hidden="true">
          {/* 环网格(1/3、2/3、满) + 轴线 */}
          {[1 / 3, 2 / 3, 1].map((f) => (
            <polygon
              key={f}
              points={WX_ORDER.map((_, i) => {
                const { x, y } = pos(i, R_MAX * f);
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeOpacity={f === 1 ? 0.22 : 0.1}
              strokeDasharray={f === 1 ? undefined : '2 4'}
            />
          ))}
          {WX_ORDER.map((_, i) => {
            const o = pos(i, R_MAX);
            return <line key={i} x1={CX} y1={CY} x2={o.x} y2={o.y} stroke="currentColor" strokeOpacity={0.08} />;
          })}
          <text x={CX + 3} y={CY - R_MAX / 3 + 3} fontSize={7} fill="currentColor" opacity={0.4}>{Math.round(scaleMax / 3)}%</text>
          <text x={CX + 3} y={CY - R_MAX + 3} fontSize={7} fill="currentColor" opacity={0.4}>{scaleMax}%</text>

          {/* 三层多边形 */}
          {data.layers.map((l, k) => (
            <polygon
              key={l.label}
              points={polyOf(l.percent)}
              fill={LAYER_STYLE[k].fill as string}
              fillOpacity={LAYER_STYLE[k].fillOpacity}
              stroke={LAYER_STYLE[k].stroke as string}
              strokeOpacity={LAYER_STYLE[k].strokeOpacity}
              strokeWidth={1.4}
              strokeDasharray={LAYER_STYLE[k].dash}
            />
          ))}

          {/* 轴标签:五行·十神组 + 终层占比;喜行红、忌行绿(红涨绿跌同 K线口径) */}
          {WX_ORDER.map((w, i) => {
            const lb = pos(i, R_MAX + 20);
            const color = likes ? (likes.has(w) ? UP : DOWN) : 'currentColor';
            const v = pos(i, rOf(finalLayer.percent[w] ?? 0));
            return (
              <g key={w}>
                <circle cx={v.x} cy={v.y} r={2.2} fill={likes && likes.has(w) ? UP : likes ? DOWN : GOLD} />
                <text x={lb.x} y={lb.y - 2} fontSize={11} textAnchor="middle" fill={color} fontWeight="bold">
                  {w}
                  <tspan fontSize={8} fontWeight="normal" opacity={0.75}>·{data.groupOf[w]}</tspan>
                </text>
                <text x={lb.x} y={lb.y + 9} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.65}>
                  {(finalLayer.percent[w] ?? 0).toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* 分层数值表 */}
        <div className="text-[10px] leading-relaxed text-muted-foreground min-w-[150px]">
          <table className="tabular-nums">
            <thead>
              <tr>
                <th className="pr-2 text-left font-medium"></th>
                {WX_ORDER.map((w) => (
                  <th key={w} className="px-1 font-medium" style={likes ? { color: likes.has(w) ? UP : DOWN } : undefined}>{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.layers.map((l) => (
                <tr key={l.label}>
                  <td className="pr-2">{l.label}</td>
                  {WX_ORDER.map((w) => (
                    <td key={w} className="px-1 text-center">{(l.percent[w] ?? 0).toFixed(0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {likes && (
            <p className="mt-1">
              扶抑喜行:<b style={{ color: UP }}>{data.likes!.join('、')}</b>(红)·余为忌(绿)
            </p>
          )}
          <p className="mt-0.5 opacity-80">干支计点占比,岁运各计一柱;与上方五行力量(旺衰加权)口径不同</p>
        </div>
      </div>
    </div>
  );
}
