import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Orbit } from 'lucide-react';
import { cn, WU_XING_COLORS } from '@/lib/utils';
import { getWuYunLiuQiFromResult, type QiStep, type WuYunLiuQiResult } from '@/lib/wuyunliuqi';
import type { BaziResult } from '@/lib/bazi';

interface WuYunLiuQiCardProps {
  result: BaziResult;
}

// 运气同化徽章配色
const TONG_HUA_STYLE: Record<string, string> = {
  太乙天符: 'bg-gold/15 text-gold border-gold/40',
  天符: 'bg-crimson/10 text-crimson dark:text-crimson-light border-crimson/30',
  岁会: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  同天符: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  同岁会: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
};

function HighlightPill({ label, name, element }: { label: string; name: string; element: string }) {
  const colors = WU_XING_COLORS[element];
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-gold/15 bg-muted/30 px-3 py-2 min-w-[88px]">
      <span className="text-[10px] text-muted-foreground tracking-wider">{label}</span>
      <span className={cn('text-sm font-bold whitespace-nowrap', colors?.text || 'text-foreground')}>
        {name}
      </span>
    </div>
  );
}

// 六气步：上「三阴三阳」、下「气+五行」
function QiStepCell({ s, highlight }: { s: QiStep; highlight?: boolean }) {
  const colors = WU_XING_COLORS[s.element];
  const sub = s.qi ? s.qi.slice(2) : '';
  return (
    <div
      className={cn(
        'flex-1 flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 min-w-[56px] shrink-0 sm:min-w-0 sm:shrink transition-colors',
        highlight ? 'border-gold/60 bg-gold/5' : 'border-border/40 bg-background/50',
      )}
    >
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.step}</span>
      <span className={cn('text-xs font-semibold whitespace-nowrap', colors?.text || 'text-foreground')}>
        {s.yinYang}
      </span>
      <span className={cn('text-sm font-bold whitespace-nowrap', colors?.text || 'text-foreground')}>
        {sub}
      </span>
      {s.startDate && (
        <span className="text-[9px] text-muted-foreground/70 whitespace-nowrap hidden sm:block">{s.startDate}</span>
      )}
    </div>
  );
}

// 运步：上「五音」、下「五行」
function YunStepCell({ s }: { s: QiStep }) {
  const colors = WU_XING_COLORS[s.element];
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 rounded-lg border border-border/40 bg-background/50 px-1 py-2 min-w-[56px] shrink-0 sm:min-w-0 sm:shrink">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.step}</span>
      <span className={cn('text-base font-bold whitespace-nowrap', colors?.text || 'text-foreground')}>
        {s.wuYin}
      </span>
      <span className={cn('text-[10px] whitespace-nowrap', colors?.text || 'text-muted-foreground')}>{s.element}</span>
      {s.startDate && (
        <span className="text-[9px] text-muted-foreground/70 whitespace-nowrap hidden sm:block">{s.startDate}</span>
      )}
    </div>
  );
}

function StepRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">{title}</div>
      <div className="flex gap-2 w-full overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">{children}</div>
    </div>
  );
}

export default function WuYunLiuQiCard({ result }: WuYunLiuQiCardProps) {
  const data: WuYunLiuQiResult | null = useMemo(() => getWuYunLiuQiFromResult(result), [result]);
  const [tab, setTab] = useState<'yun' | 'qi'>('yun');

  if (!data) return null;

  const siTianStep = 2; // 客气三之气 = 司天

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <Orbit className="w-4 h-4" />
          五运六气
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {data.ganZhi}年 · 运气年以大寒为界{data.startDate ? `（${data.startDate}起）` : ''}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 概要：中运 / 司天 / 在泉 + 同化 */}
        <div className="flex flex-wrap items-stretch gap-2">
          <HighlightPill label="中运" name={data.zhongYun.label} element={data.zhongYun.element} />
          <HighlightPill label="司天" name={data.siTian.name} element={data.siTian.element} />
          <HighlightPill label="在泉" name={data.zaiQuan.name} element={data.zaiQuan.element} />
          {data.tongHua.length > 0 && (
            <div className="flex flex-col justify-center gap-1.5">
              <span className="text-[10px] text-muted-foreground tracking-wider">运气同化</span>
              <div className="flex flex-wrap gap-1.5">
                {data.tongHua.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className={cn('text-[11px] font-semibold', TONG_HUA_STYLE[t] || 'border-gold/20')}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 五运 / 六气 切换 */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          {([
            ['yun', '五运'],
            ['qi', '六气'],
          ] as const).map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer',
                tab === key
                  ? 'bg-background text-crimson dark:text-gold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* 单一 motion.div 以 tab 为 key：切换时重新挂载淡入，避免 AnimatePresence
            mode="wait" 在 React 19 下退出动画卡住、旧面板残留的问题 */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {tab === 'yun' ? (
            <>
              <StepRow title="主运（每年固定 · 木火土金水）">
                {data.zhuYun.map((s) => (
                  <YunStepCell key={s.step} s={s} />
                ))}
              </StepRow>
              <StepRow title="客运（始于中运 · 相生顺布）">
                {data.keYun.map((s) => (
                  <YunStepCell key={s.step} s={s} />
                ))}
              </StepRow>
            </>
          ) : (
            <>
              <StepRow title="主气（每年固定 · 大寒起）">
                {data.zhuQi.map((s) => (
                  <QiStepCell key={s.step} s={s} />
                ))}
              </StepRow>
              <StepRow title="客气（三之气＝司天 · 终之气＝在泉）">
                {data.keQi.map((s, i) => (
                  <QiStepCell key={s.step} s={s} highlight={i === siTianStep} />
                ))}
              </StepRow>
            </>
          )}
        </motion.div>

        {data.pingQiHint && (
          <>
            <Separator className="bg-gold/10" />
            <p className="text-xs text-muted-foreground leading-relaxed pl-2 border-l-2 border-gold/20">
              {data.pingQiHint}
            </p>
          </>
        )}

        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{data.summary}</p>
      </CardContent>
    </Card>
  );
}
