// 合婚对照面板：从命盘档案中选甲乙两人 → 双盘重算 → 确定性互动清单 + 复制合婚 AI Prompt。
// 选择器用原生 select（轻量且可自动化测试；base-ui Select 有已知自动化限制）。
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, Copy, Sparkles, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateChart, DEFAULT_ENGINE } from '@/lib/engine';
import { listProfiles } from '@/lib/storage';
import { analyzeHehun, buildHehunMarkdown, buildHehunExportData, type HehunResult, type HehunPolarity } from '@/lib/hehun';
import { toToon } from '@/lib/toon';
import type { BaziResult } from '@/lib/bazi';

interface Props {
  /** 档案列表变更信号（ProfileBar 上抛后 App 递增） */
  profilesVersion: number;
}

const POLARITY_STYLE: Record<HehunPolarity, string> = {
  吉: 'bg-green-500/15 text-green-700 dark:text-green-300',
  平: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  忌: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export default function HehunPanel({ profilesVersion }: Props) {
  const profiles = useMemo(() => listProfiles(), [profilesVersion]);
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HehunResult | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [toon, setToon] = useState('');
  const [fileBase, setFileBase] = useState('合婚对照');

  const selectCls =
    'h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

  const run = async () => {
    const pa = profiles.find((p) => p.id === aId);
    const pb = profiles.find((p) => p.id === bId);
    if (!pa || !pb) {
      toast.error('请先选择甲乙双方档案');
      return;
    }
    if (pa.id === pb.id) {
      toast.error('甲乙不能是同一份档案');
      return;
    }
    setBusy(true);
    try {
      const [ca, cb] = await Promise.all([
        calculateChart(pa.input, pa.input.engine ?? DEFAULT_ENGINE),
        calculateChart(pb.input, pb.input.engine ?? DEFAULT_ENGINE),
      ]);
      const partyA = { label: pa.name, input: pa.input, chart: ca as unknown as BaziResult };
      const partyB = { label: pb.name, input: pb.input, chart: cb as unknown as BaziResult };
      const r = analyzeHehun(partyA, partyB);
      setResult(r);
      setMarkdown(buildHehunMarkdown(partyA, partyB, r));
      setToon(toToon(buildHehunExportData(partyA, partyB, r)));
      setFileBase(`合婚_${pa.name}_${pb.name}`);
      toast.success('合婚对照已生成', { icon: '💞' });
    } catch (e: any) {
      console.error(e);
      toast.error(`合婚对照失败：${e?.message || '未知错误'}`);
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('合婚 AI Prompt 已复制，可直接粘贴给 AI', { icon: '📋' });
    } catch {
      toast.error('复制失败，请手动选择文本复制');
    }
  };

  const downloadBlob = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadMd = () => {
    downloadBlob(markdown, 'text/markdown;charset=utf-8', `${fileBase}.md`);
    toast.success('合婚 Markdown 已下载');
  };

  const downloadToon = () => {
    downloadBlob(toon, 'text/plain;charset=utf-8', `${fileBase}.toon`);
    toast.success('合婚 TOON 已下载（紧凑结构化数据，省 token）');
  };

  return (
    <Card className="border-gold/15">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-crimson dark:text-gold">
          <HeartHandshake className="w-4 h-4" />
          合婚对照
          <span className="text-[11px] font-normal text-muted-foreground">
            从档案选两人对照；传统民俗参考，不构成婚姻决策依据
          </span>
        </div>

        {profiles.length < 2 ? (
          <p className="text-xs text-muted-foreground">先在上方保存至少两份命盘档案（如「张三」「李四」），再来合婚对照。</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={aId} onChange={(e) => setAId(e.target.value)} className={selectCls} data-testid="hehun-a">
              <option value="">选择甲方档案…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}（{p.input.year}-{p.input.month}-{p.input.day} {p.input.gender === 1 ? '男' : '女'}）</option>
              ))}
            </select>
            <select value={bId} onChange={(e) => setBId(e.target.value)} className={selectCls} data-testid="hehun-b">
              <option value="">选择乙方档案…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}（{p.input.year}-{p.input.month}-{p.input.day} {p.input.gender === 1 ? '男' : '女'}）</option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={run} disabled={busy} className="h-8 gap-1" data-testid="hehun-run">
              <Sparkles className="w-3.5 h-3.5" /> {busy ? '对照中…' : '生成对照'}
            </Button>
          </div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{result.a.label}（{result.a.pillarText}）× {result.b.label}（{result.b.pillarText}）</span>
              <Badge variant="outline" className="text-[10px]">吉 {result.counts['吉']} · 平 {result.counts['平']} · 忌 {result.counts['忌']}</Badge>
            </div>
            <ul className="space-y-1.5" data-testid="hehun-items">
              {result.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${POLARITY_STYLE[it.polarity]}`}>{it.polarity}</span>
                  <span>
                    <span className="text-muted-foreground">［{it.aspect}］</span>
                    <span className="font-medium">{it.finding}</span>
                    <span className="text-muted-foreground">——{it.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={copyPrompt} className="h-8 gap-1" data-testid="hehun-copy">
                <Copy className="w-3.5 h-3.5" /> 复制合婚 AI Prompt
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={downloadMd} className="h-8 gap-1" data-testid="hehun-md">
                <FileText className="w-3.5 h-3.5" /> 导出 MD
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={downloadToon} className="h-8 gap-1" data-testid="hehun-toon">
                <Download className="w-3.5 h-3.5" /> 导出 TOON
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
