import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollText, Star, BookOpen, Compass, Link, Gem } from 'lucide-react';
import type { BaziResult } from '@/lib/bazi';

function InfoRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function extractScoreJudge(v: any): string {
  if (v == null) return '';
  if (typeof v === 'number') return v.toFixed(2);
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.score != null) {
    const s = typeof v.score === 'number' ? v.score.toFixed(2) : String(v.score);
    return v.judge ? `${s}（${v.judge}）` : s;
  }
  return '';
}

function formatRelation(rel: any): string {
  if (typeof rel === 'string') return rel;
  if (rel && typeof rel === 'object' && rel.desc) return rel.desc;
  return JSON.stringify(rel);
}

const PILLAR_LABEL: Record<string, string> = {
  year: '年', month: '月', ri: '日', day: '日', time: '时',
  daYun: '大运', liuNian: '流年',
};

function formatRelationFrom(from: string): string {
  if (!from) return '';
  const parts = from.split('+').map(p => PILLAR_LABEL[p.trim()] || p.trim());
  return parts.join('+');
}

function formatRelationTo(to: string): string {
  return PILLAR_LABEL[to] || to;
}

// ─── 命盘要素 ──────────────────────────────────────────

export function MingPanCard({ result }: { result: BaziResult }) {
  const { taiYuan, taiYuanNaYin, taiXi, taiXiNaYin, mingGong, mingGongNaYin, shenGong, shenGongNaYin } = result;

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <Compass className="w-4 h-4" />
          命盘要素
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6">
          <InfoRow label="胎元" value={taiYuan ? `${taiYuan}（${taiYuanNaYin}）` : undefined} />
          <InfoRow label="胎息" value={taiXi ? `${taiXi}（${taiXiNaYin}）` : undefined} />
          <InfoRow label="命宫" value={mingGong ? `${mingGong}（${mingGongNaYin}）` : undefined} />
          <InfoRow label="身宫" value={shenGong ? `${shenGong}（${shenGongNaYin}）` : undefined} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 渊海子平 ──────────────────────────────────────────

export function YuanHaiCard({ result }: { result: BaziResult }) {
  const yhzp = result.yuanHaiZiping as any;
  if (!yhzp) return null;

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <BookOpen className="w-4 h-4" />
          渊海子平
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <InfoRow label="身强" value={extractScoreJudge(yhzp.shenQiang)} />
        <InfoRow label="湿度" value={extractScoreJudge(yhzp.shidu)} />
        <InfoRow label="阴阳" value={extractScoreJudge(yhzp.yinyang)} />

        {yhzp.yueLing != null && (
          <div className="space-y-2 pt-1">
            <div className="text-sm font-semibold text-muted-foreground">月令分析</div>
            {yhzp.yueLing.tips && Array.isArray(yhzp.yueLing.tips) && yhzp.yueLing.tips.length > 0 && (
              <div className="space-y-1">
                {yhzp.yueLing.tips.map((tip: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground leading-relaxed pl-2 border-l-2 border-gold/20">
                    {tip}
                  </p>
                ))}
              </div>
            )}
            {yhzp.yueLing.summary && typeof yhzp.yueLing.summary === 'object' && (
              <div className="grid grid-cols-1 gap-1.5">
                {(['year', 'month', 'time'] as const).map(key => {
                  const item = yhzp.yueLing.summary[key];
                  if (!item) return null;
                  const pillarName = key === 'year' ? '年柱' : key === 'month' ? '月柱' : '时柱';
                  const gods = Array.isArray(item.gods) ? item.gods.flat().join(' ') : '';
                  const tags = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(' ') : '';
                  return (
                    <div key={key} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{pillarName}：</span>
                      {gods}{tags ? ` [${tags}]` : ''}
                      {item.note && <span className="ml-1 text-muted-foreground/70">— {item.note}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {yhzp.taiSui && (
          <div className="space-y-1 pt-1">
            <div className="text-sm font-semibold text-muted-foreground">太岁</div>
            <div className="flex flex-wrap gap-1.5">
              {yhzp.taiSui.relation && (
                <Badge variant="outline" className="text-[11px] border-gold/20">{yhzp.taiSui.relation}</Badge>
              )}
              {yhzp.taiSui.riskLevel && (
                <Badge variant="outline" className="text-[11px] border-crimson/20 text-crimson dark:text-crimson-light">
                  风险：{yhzp.taiSui.riskLevel}
                </Badge>
              )}
            </div>
            {yhzp.taiSui.details && Array.isArray(yhzp.taiSui.details) && (
              <div className="space-y-0.5">
                {yhzp.taiSui.details.map((d: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">{d}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 命理分析 ──────────────────────────────────────────

export function MingLiCard({ result }: { result: BaziResult }) {
  const { analysis } = result;

  const hasAnalysis = analysis && (
    analysis.rishi?.length > 0 ||
    analysis.SanMingTongHui?.length > 0 ||
    analysis.XiYongShen?.length > 0
  );

  if (!hasAnalysis) return null;

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <Star className="w-4 h-4" />
          命理分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis.XiYongShen && analysis.XiYongShen.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">喜用神</h4>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {analysis.XiYongShen.map((item: string, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Badge className="bg-crimson/10 text-crimson dark:bg-crimson-light/10 dark:text-crimson-light border-crimson/20">
                    {item}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {analysis.rishi && analysis.rishi.length > 0 && (
          <>
            <Separator className="bg-gold/10" />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">日时分析</h4>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                {analysis.rishi.map((item: string, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                  >
                    <Badge variant="outline" className="text-[11px] border-gold/20">
                      {item}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}

        {analysis.SanMingTongHui && analysis.SanMingTongHui.length > 0 && (
          <>
            <Separator className="bg-gold/10" />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <ScrollText className="w-3.5 h-3.5" />
                三命通会
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {analysis.SanMingTongHui.map((item: string, i: number) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="text-xs text-muted-foreground leading-relaxed"
                  >
                    {item}
                  </motion.p>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 神煞 ──────────────────────────────────────────────

const SHENSHA_POS_LABELS: [string, string][] = [
  ['nian', '年柱'], ['yue', '月柱'], ['ri', '日柱'], ['shi', '时柱'],
];
const SHENSHA_CUR_LABELS: [string, string][] = [
  ['daYun', '当前大运'], ['liuNian', '当前流年'], ['liuYue', '当前流月'], ['liuRi', '当前流日'],
];

// 吉神/凶煞粗分配色（凶煞标红，其余按吉神金色）
const XIONG_SHA = /空亡|亡神|劫煞|灾煞|勾绞|红艳|童子|孤辰|寡宿|羊刃|飞刃|血刃|元辰|丧门|吊客|白虎|天罗|地网|阴差阳错|十恶大败|四废|披麻/;

function ShenShaBadge({ name }: { name: string }) {
  const isXiong = XIONG_SHA.test(name);
  return (
    <Badge
      variant="outline"
      className={
        isXiong
          ? 'text-[11px] border-crimson/25 bg-crimson/5 text-crimson dark:text-crimson-light'
          : 'text-[11px] border-gold/25 bg-gold/5 text-amber-700 dark:text-gold'
      }
    >
      {name}
    </Badge>
  );
}

export function ShenShaCard({ result }: { result: BaziResult }) {
  const sh = (result as any).shensha;
  if (!sh || typeof sh !== 'object') return null;

  const rows = SHENSHA_POS_LABELS
    .map(([key, label]) => ({ label, items: (sh[key] as string[]) || [] }))
    .filter((r) => Array.isArray(r.items) && r.items.length > 0);
  const cur = sh.current && typeof sh.current === 'object'
    ? SHENSHA_CUR_LABELS
        .map(([key, label]) => ({ label, items: (sh.current[key] as string[]) || [] }))
        .filter((r) => Array.isArray(r.items) && r.items.length > 0)
    : [];

  if (rows.length === 0 && cur.length === 0) return null;

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <Gem className="w-4 h-4" />
          神煞
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2">
            <span className="shrink-0 w-16 text-xs text-muted-foreground pt-0.5">{r.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {r.items.map((name, i) => <ShenShaBadge key={`${name}-${i}`} name={name} />)}
            </div>
          </div>
        ))}
        {cur.length > 0 && (
          <>
            <Separator className="bg-gold/10" />
            {cur.map((r) => (
              <div key={r.label} className="flex items-start gap-2">
                <span className="shrink-0 w-16 text-xs text-muted-foreground pt-0.5">{r.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {r.items.map((name, i) => <ShenShaBadge key={`${name}-${i}`} name={name} />)}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 干支关系 ──────────────────────────────────────────

export function GanZhiRelCard({ result }: { result: BaziResult }) {
  const { ganRelations, zhiRelations } = result;

  const hasRelations = (ganRelations && ganRelations.length > 0) || (zhiRelations && zhiRelations.length > 0);
  if (!hasRelations) return null;

  return (
    <Card className="border-gold/20 glow-gold">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
          <Link className="w-4 h-4" />
          干支关系
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ganRelations && ganRelations.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold">天干关系</h4>
            <div className="flex flex-wrap gap-1.5">
              {ganRelations.map((rel: any, i: number) => (
                <Badge key={i} variant="outline" className="text-[11px] border-gold/20 bg-amber-500/5">
                  {rel.from && rel.to && (
                    <span className="text-muted-foreground mr-1">
                      {formatRelationFrom(rel.from)}↔{formatRelationTo(rel.to)}
                    </span>
                  )}
                  {formatRelation(rel)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {zhiRelations && zhiRelations.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold">地支关系</h4>
            <div className="flex flex-wrap gap-1.5">
              {zhiRelations.map((rel: any, i: number) => (
                <Badge key={i} variant="outline" className="text-[11px] border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300">
                  {rel.from && rel.to && (
                    <span className="text-muted-foreground mr-1">
                      {formatRelationFrom(rel.from)}↔{formatRelationTo(rel.to)}
                    </span>
                  )}
                  {formatRelation(rel)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
