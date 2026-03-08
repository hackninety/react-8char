import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WU_XING_BAR_COLORS } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface WuXingChartProps {
  wuXingPower: Record<string, number>;
}

const WU_XING_ICONS: Record<string, string> = {
  '木': '🌳',
  '火': '🔥',
  '土': '⛰️',
  '金': '⚔️',
  '水': '💧',
};

const WU_XING_ORDER = ['木', '火', '土', '金', '水'];

export default function WuXingChart({ wuXingPower }: WuXingChartProps) {
  const total = Object.values(wuXingPower).reduce((a, b) => a + b, 0);
  const maxVal = Math.max(...Object.values(wuXingPower));

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <Flame className="w-4 h-4" />
          五行力量
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {WU_XING_ORDER.map((wx, i) => {
          const value = wuXingPower[wx] ?? 0;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          const barWidth = maxVal > 0 ? (value / maxVal) * 100 : 0;
          const color = WU_XING_BAR_COLORS[wx];

          return (
            <motion.div
              key={wx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium min-w-[60px]">
                  <span>{WU_XING_ICONS[wx]}</span>
                  <span>{wx}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {value.toFixed(1)} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </motion.div>
          );
        })}

        <div className="pt-2 text-[11px] text-muted-foreground text-center">
          五行总值：{total.toFixed(1)}
        </div>
      </CardContent>
    </Card>
  );
}
