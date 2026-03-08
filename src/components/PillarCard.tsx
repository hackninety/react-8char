import { motion } from 'framer-motion';
import type { Pillar } from 'mystilight-8char-v2';
import { cn, getGanWuXing, getZhiWuXing, WU_XING_COLORS, getShiShenColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PillarCardProps {
  pillar: Pillar;
  label: string;
  isDayMaster?: boolean;
  index: number;
}

function WuXingDot({ element }: { element: string }) {
  const colors = WU_XING_COLORS[element];
  if (!colors) return null;
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full', colors.bg, 'ring-1', colors.ring)} />
  );
}

export default function PillarCard({ pillar, label, isDayMaster, index }: PillarCardProps) {
  const ganWx = getGanWuXing(pillar.gan);
  const zhiWx = getZhiWuXing(pillar.zhi);
  const ganColors = WU_XING_COLORS[ganWx];
  const zhiColors = WU_XING_COLORS[zhiWx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={cn(
        'relative rounded-xl border overflow-hidden h-full',
        isDayMaster
          ? 'border-gold shadow-lg shadow-gold/10 dark:shadow-gold/20'
          : 'border-gold/20',
        'pillar-card-bg glow-gold'
      )}
    >
      {isDayMaster && (
        <div className="absolute top-0 left-0 right-0 h-0.5 gold-gradient" />
      )}

      <div className="p-3 sm:p-4 space-y-3">
        {/* 柱名 + 十神 */}
        <div className="text-center space-y-1">
          <span className="text-xs text-muted-foreground tracking-widest">{label}</span>
          {isDayMaster ? (
            <div className="text-xs font-medium text-gold">日主</div>
          ) : (
            <div className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full inline-block', getShiShenColor(pillar.shiShenGan))}>
              {pillar.shiShenGan}
            </div>
          )}
        </div>

        {/* 天干 */}
        <div className="text-center">
          <div className={cn(
            'text-3xl sm:text-4xl font-bold leading-none',
            ganColors?.text || 'text-foreground'
          )}>
            {pillar.gan}
          </div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <WuXingDot element={ganWx} />
            <span className="text-[10px] text-muted-foreground">{ganWx}</span>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        {/* 地支 */}
        <div className="text-center">
          <div className={cn(
            'text-3xl sm:text-4xl font-bold leading-none',
            zhiColors?.text || 'text-foreground'
          )}>
            {pillar.zhi}
          </div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <WuXingDot element={zhiWx} />
            <span className="text-[10px] text-muted-foreground">{zhiWx}</span>
          </div>
        </div>

        {/* 藏干 */}
        {pillar.hideGanAttr && pillar.hideGanAttr.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[10px] text-center text-muted-foreground tracking-wider">藏干</div>
            <div className="space-y-0.5">
              {pillar.hideGanAttr.map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-muted-foreground">{h.qiLevel}</span>
                  <span className={cn('font-medium', WU_XING_COLORS[h.wuXing]?.text)}>
                    {h.gan}
                  </span>
                  <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-4', getShiShenColor(h.shiShen))}>
                    {h.shiShen}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 纳音 + 地势 */}
        <div className="pt-1 space-y-0.5 text-center">
          <div className="text-[10px] text-muted-foreground">
            纳音：<span className="text-foreground/80">{pillar.naYin}</span>
          </div>
          {pillar.diShi && (
            <div className="text-[10px] text-muted-foreground">
              地势：<span className="text-foreground/80">{pillar.diShi}</span>
            </div>
          )}
          {pillar.xunKong && (
            <div className="text-[10px] text-muted-foreground">
              旬空：<span className="text-foreground/80">{pillar.xunKong}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
