import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, GitCompareArrows, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompareReport } from '@/lib/engine';

interface EngineCompareBadgeProps {
  report: CompareReport;
}

/** 双引擎对拍结果徽章：一致=绿色；仅流派差异=金色可展开；硬差异=红色可展开 */
export default function EngineCompareBadge({ report }: EngineCompareBadgeProps) {
  const [open, setOpen] = useState(false);
  const expandable = report.items.length > 0;

  const tone = report.identical
    ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
    : report.consistent
      ? 'border-gold/40 bg-gold/10 text-amber-700 dark:text-gold'
      : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400';

  const Icon = report.identical ? ShieldCheck : report.consistent ? GitCompareArrows : AlertTriangle;

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
          tone,
          expandable ? 'cursor-pointer hover:opacity-90' : 'cursor-default',
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left leading-relaxed">{report.summary}</span>
        {expandable && (
          <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 text-[11px] text-muted-foreground font-medium pb-1 border-b border-border/40">
                <span>差异项</span>
                <span>{report.a.name}</span>
                <span>{report.b.name}</span>
              </div>
              {report.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_1fr] gap-x-3 text-xs items-start">
                  <span
                    className={cn(
                      'font-medium whitespace-nowrap',
                      it.kind === 'hard' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-gold',
                    )}
                  >
                    {it.kind === 'hard' ? '⚠ ' : ''}{it.label}
                  </span>
                  <span className="break-all">{it.a || '—'}</span>
                  <span className="break-all">{it.b || '—'}</span>
                </div>
              ))}
              <p className="pt-1 text-[10px] text-muted-foreground/80 leading-relaxed">
                金色为流派性差异（起运进位/宫位起法等口径不同，属预期）；红色为核心差异（四柱/大运不一致，请谨慎参考）。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
