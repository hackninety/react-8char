import { motion } from 'framer-motion';
import PillarCard from './PillarCard';
import WuXingChart from './WuXingChart';
import DaYunTimeline from './DaYunTimeline';
import { MingPanCard, YuanHaiCard, MingLiCard, GanZhiRelCard, ShenShaCard } from './ShenShaList';
import WuYunLiuQiCard from './WuYunLiuQiCard';
import EngineCompareBadge from './EngineCompareBadge';
import JsonExport from './JsonExport';
import type { BaziInput, BaziResult } from '@/lib/bazi';
import type { CompareReport, EngineMeta } from '@/lib/engine';

interface BaziChartProps {
  input: BaziInput;
  result: BaziResult;
}

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];
const PILLAR_KEYS = ['year', 'month', 'day', 'time'] as const;

export default function BaziChart({ input, result }: BaziChartProps) {
  const { pillars, wuXingPower, gender } = result;
  const engineMeta = (result as any).engine as EngineMeta | undefined;
  const compareReport = (result as any)._compareReport as CompareReport | undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* 概要信息 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-1"
      >
        <h2 className="text-xl font-bold text-crimson dark:text-gold">
          {gender === '男' ? '乾造' : '坤造'}命盘
        </h2>
        <p className="text-sm text-muted-foreground">
          {result.input.year}年{result.input.month}月{result.input.day}日 {result.input.hour}时{result.input.minute}分
          {pillars.dayMasterGan && (
            <span className="ml-2">· 日主 <span className="font-bold text-foreground">{pillars.dayMasterGan}</span></span>
          )}
        </p>
        {engineMeta && (
          <p className="text-[11px] text-muted-foreground/70">排盘引擎：{engineMeta.name}</p>
        )}
      </motion.div>

      {/* 双引擎对拍结果 */}
      {compareReport && <EngineCompareBadge report={compareReport} />}

      {/* 四柱大盘 */}
      <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
        {PILLAR_KEYS.map((key, i) => {
          const pillar = pillars[key];
          if (!pillar) return null;
          return (
            <div key={key} className="min-w-[160px] flex-1 sm:min-w-0">
              <PillarCard
                pillar={pillar}
                label={PILLAR_LABELS[i]}
                isDayMaster={key === 'day'}
                index={i}
              />
            </div>
          );
        })}
      </div>

      {/* Row 1: 五行力量 | 命盘要素（五行力量仅在引擎提供时显示） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {wuXingPower && Object.keys(wuXingPower).length > 0 && <WuXingChart wuXingPower={wuXingPower} />}
        <MingPanCard result={result} />
      </div>

      {/* Row 2: 渊海子平 | 命理分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <YuanHaiCard result={result} />
        <MingLiCard result={result} />
      </div>

      {/* Row 3: 干支关系（全宽） */}
      <GanZhiRelCard result={result} />

      {/* 神煞（全宽，引擎提供时显示） */}
      <ShenShaCard result={result} />

      {/* 五运六气（全宽） */}
      <WuYunLiuQiCard input={input} />

      {/* 大运流年 */}
      <DaYunTimeline result={result} />

      {/* JSON 导出 */}
      <JsonExport input={input} result={result} />
    </motion.div>
  );
}
