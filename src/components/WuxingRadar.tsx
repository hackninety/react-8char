import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { buildWuxingEnergy } from '@/lib/wuxing-energy';

/** 范围档位:0=总局(仅原局) 1=大限(+大运) 2=流年(+流年);可用档位随传入干支而定 */
const SCOPE_LABELS = ['总局', '大限', '流年'] as const;

const UP = '#dc2626';
const GOLD = '#d4af37';
const DOWN = '#16a34a';

const SIZE = 272;
const CX = SIZE / 2;
const CY = SIZE / 2 + 4;
const R_MAX = 80;

interface WuxingRadarProps {
  pillars: Parameters<typeof buildWuxingEnergy>[0]['pillars'];
  judge?: string;
  /** 性别(婚姻轴并入配偶星用) */
  gender?: string;
  /** 选中年的大运/流年干支(缺省只画原局) */
  dayunGz?: string;
  liunianGz?: string;
  /** 标题右侧说明(如「2026 丙午」) */
  caption?: string;
}

/** 能量多边形:宫位轴(事业/财帛/子女/兄弟/父母,婚姻随性别并入)× 总局/大限/流年 范围切换的层叠占比 */
export default function WuxingRadar({ pillars, judge, gender, dayunGz, liunianGz, caption }: WuxingRadarProps) {
  const data = useMemo(
    () => buildWuxingEnergy({ pillars, judge, gender, dayunGz, liunianGz }),
    [pillars, judge, gender, dayunGz, liunianGz],
  );
  // 范围档位(默认最深可用档;传入干支变化时自动收窄)
  const [scopePick, setScopePick] = useState(2);
  if (!data) return null;

  const maxScope = data.layers.length - 1;
  const scope = Math.min(scopePick, maxScope);
  const layers = data.layers.slice(0, scope + 1); // 总局=仅原局层

  const axes = data.palaces; // 宫位轴序固定,星与五行随日主变
  const n = axes.length;
  const likes = data.likes ? new Set(data.likes) : null;
  const maxPct = Math.max(...layers.flatMap((l) => axes.map((a) => l.percent[a.wx] ?? 0)));
  const scaleMax = Math.max(30, Math.ceil(maxPct / 10) * 10);
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pos = (i: number, r: number) => ({ x: CX + Math.cos(angle(i)) * r, y: CY + Math.sin(angle(i)) * r });
  const rOf = (pct: number) => (pct / scaleMax) * R_MAX;
  const polyOf = (percent: Record<string, number>) =>
    axes.map((a, i) => {
      const { x, y } = pos(i, rOf(percent[a.wx] ?? 0));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  // 层样式:原局(虚线灰) → +大运(金) → +流年(红);层不足时后者缺省
  const LAYER_STYLE = [
    { stroke: 'currentColor', strokeOpacity: 0.45, fill: 'none', dash: '3 3' },
    { stroke: GOLD, strokeOpacity: 0.9, fill: GOLD, fillOpacity: 0.1, dash: undefined },
    { stroke: UP, strokeOpacity: 0.9, fill: UP, fillOpacity: 0.13, dash: undefined },
  ];
  const finalLayer = layers[layers.length - 1];

  return (
    <div data-testid="wuxing-radar" className="mt-2 rounded-lg border border-gold/15 bg-muted/20 p-2.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold flex items-center gap-2">
          能量多边形
          {/* 范围切换:总局(仅原局)/大限(+大运)/流年(+流年),档位随传入干支可用 */}
          <span className="flex gap-0.5 rounded-md bg-muted/60 p-0.5" data-testid="radar-scope">
            {SCOPE_LABELS.slice(0, maxScope + 1).map((lb, i) => (
              <button
                key={lb}
                type="button"
                onClick={() => setScopePick(i)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer',
                  scope === i ? 'bg-background text-crimson dark:text-gold shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {lb}
              </button>
            ))}
          </span>
          {caption && scope > 0 && <span className="font-normal text-muted-foreground">{caption}</span>}
          {scope === 0 && <span className="font-normal text-muted-foreground">总命局(原局八字)</span>}
        </span>
        <span className="flex gap-2.5 text-[10px] text-muted-foreground">
          {layers.map((l, k) => (
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
        <svg width={SIZE} height={SIZE - 12} className="text-foreground select-none block shrink-0" aria-hidden="true">
          {/* 环网格(1/3、2/3、满) + 轴线 */}
          {[1 / 3, 2 / 3, 1].map((f) => (
            <polygon
              key={f}
              points={axes.map((_, i) => {
                const { x, y } = pos(i, R_MAX * f);
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeOpacity={f === 1 ? 0.22 : 0.1}
              strokeDasharray={f === 1 ? undefined : '2 4'}
            />
          ))}
          {axes.map((_, i) => {
            const o = pos(i, R_MAX);
            return <line key={i} x1={CX} y1={CY} x2={o.x} y2={o.y} stroke="currentColor" strokeOpacity={0.08} />;
          })}
          <text x={CX + 3} y={CY - R_MAX / 3 + 3} fontSize={7} fill="currentColor" opacity={0.4}>{Math.round(scaleMax / 3)}%</text>
          <text x={CX + 3} y={CY - R_MAX + 3} fontSize={7} fill="currentColor" opacity={0.4}>{scaleMax}%</text>

          {/* 层多边形(按范围档切片) */}
          {layers.map((l, k) => (
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

          {/* 轴标签:宫位 + 星组·五行 + 终层占比;喜行红、忌行绿(红涨绿跌同 K线口径) */}
          {axes.map((a, i) => {
            const lb = pos(i, R_MAX + 24);
            const color = likes ? (likes.has(a.wx) ? UP : DOWN) : 'currentColor';
            const v = pos(i, rOf(finalLayer.percent[a.wx] ?? 0));
            return (
              <g key={a.label}>
                <circle cx={v.x} cy={v.y} r={2.2} fill={likes ? (likes.has(a.wx) ? UP : DOWN) : GOLD} />
                <text x={lb.x} y={lb.y - 6} fontSize={10.5} textAnchor="middle" fill={color} fontWeight="bold">
                  {a.label}
                </text>
                <text x={lb.x} y={lb.y + 5} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.7}>
                  {a.group}·{a.wx} {(finalLayer.percent[a.wx] ?? 0).toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* 分层数值表(宫位列序与轴一致) */}
        <div className="text-[10px] leading-relaxed text-muted-foreground min-w-[170px]">
          <table className="tabular-nums">
            <thead>
              <tr>
                <th className="pr-2 text-left font-medium"></th>
                {axes.map((a) => (
                  <th key={a.label} className="px-1 font-medium" style={likes ? { color: likes.has(a.wx) ? UP : DOWN } : undefined}>
                    {a.label.slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layers.map((l) => (
                <tr key={l.label}>
                  <td className="pr-2">{l.label}</td>
                  {axes.map((a) => (
                    <td key={a.label} className="px-1 text-center">{(l.percent[a.wx] ?? 0).toFixed(0)}</td>
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
          <p className="mt-0.5 opacity-80">{data.palaceNote}</p>
          <p className="mt-0.5 opacity-80">干支计点占比,岁运各计一柱;与上方五行力量(旺衰加权)口径不同</p>
        </div>
      </div>
    </div>
  );
}
