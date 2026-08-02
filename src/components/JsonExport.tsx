import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Download, Sparkles, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildExportJSON, generateFileName } from '@/lib/bazi';
import { generateAIPrompt } from '@/lib/prompt-template';
import { buildExportMarkdown, generateMarkdownFileName } from '@/lib/markdown-export';
import { toToon } from '@/lib/toon';
import { preloadQiongTong, isQiongTongLoaded } from '@/lib/tiaohou';
import type { BaziInput, BaziResult } from '@/lib/bazi';

interface JsonExportProps {
  input: BaziInput;
  result: BaziResult;
}

// 预估文件大小（UTF-8 字节数，与下载落盘一致）
function formatSize(text: string): string {
  const kb = new TextEncoder().encode(text).length / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
}

export default function JsonExport({ input, result }: JsonExportProps) {
  // 穷通宝鉴原文库为懒加载 chunk：就绪后重建导出内容（classic 字段补齐）
  const [qtReady, setQtReady] = useState(isQiongTongLoaded());
  // 流日/流时默认不导出，特殊场景独立勾选：流日=当前公历月逐日（出行择日）、流时=今日十三时辰·早晚子时分列（办事择时）
  const [withLiuRi, setWithLiuRi] = useState(false);
  const [withLiuShi, setWithLiuShi] = useState(false);
  useEffect(() => {
    let on = true;
    void preloadQiongTong().then(() => { if (on && !qtReady) setQtReady(true); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // qtReady 是「原文库懒加载就绪」信号：就绪后重建以补齐 classic 字段
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exportData = useMemo(() => buildExportJSON(input, result, { includeLiuRi: withLiuRi, includeLiuShi: withLiuShi }), [input, result, withLiuRi, withLiuShi, qtReady]);
  // 数据载荷用 TOON（JSON 数据模型的紧凑无损等价表示，约省 21% 字符、token 更省）
  const toonText = useMemo(() => toToon(exportData), [exportData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const markdown = useMemo(() => buildExportMarkdown(input, result, { includeLiuRi: withLiuRi, includeLiuShi: withLiuShi }), [input, result, withLiuRi, withLiuShi, qtReady]);
  const toonSize = useMemo(() => formatSize(toonText), [toonText]);
  const mdSize = useMemo(() => formatSize(markdown), [markdown]);

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

  const handleDownload = () => {
    downloadBlob(toonText, 'text/plain;charset=utf-8', generateFileName(input, exportData).replace(/\.json$/, '.toon'));
    toast.success('TOON 文件已下载');
  };

  const handleDownloadMarkdown = () => {
    downloadBlob(markdown, 'text/markdown;charset=utf-8', generateMarkdownFileName(input, exportData));
    toast.success('Markdown 文件已下载');
  };

  const handleCopyPrompt = async () => {
    try {
      const prompt = generateAIPrompt(exportData);
      await navigator.clipboard.writeText(prompt);
      toast.success('AI 分析 Prompt 已复制！粘贴到 ChatGPT / Claude 即可', {
        duration: 4000,
        icon: '🤖',
      });
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('完整 Markdown 已复制！粘贴给 AI，分析更详细', {
        duration: 4000,
        icon: '📝',
      });
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-gold/20 glow-gold">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-crimson dark:text-gold">
            <Bot className="w-4 h-4" />
            数据导出 & AI 分析
          </CardTitle>
          {/* 移动端徽标与说明各占一行，避免徽标被挤成两行；sm 起恢复单行 */}
          <div className="flex flex-col items-start gap-1.5 mt-2 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full whitespace-nowrap shrink-0">
              <Sparkles className="w-3 h-3" />
              已准备好喂 AI
            </div>
            <span className="text-[11px] text-muted-foreground">Markdown 内容最完整；TOON 为 JSON 的紧凑等价表示，更省 token</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 可选：流日/流时独立勾选（默认不导出，防止无关数据稀释 AI 注意力） */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={withLiuRi} onChange={(e) => setWithLiuRi(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gold/30 accent-[var(--color-crimson)]" />
              <span className="text-muted-foreground">附本月流日（出行择日用，默认不导出）</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={withLiuShi} onChange={(e) => setWithLiuShi(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gold/30 accent-[var(--color-crimson)]" />
              <span className="text-muted-foreground">附今日流时（办事择时用，默认不导出）</span>
            </label>
          </div>

          {/* 数据文件（复制走下方 AI Prompt 按钮，不设单独「复制 TOON」以免重复） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="border-gold/30 hover:bg-gold/5 cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              导出 TOON 文件（{toonSize}）
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadMarkdown}
              className="border-gold/30 hover:bg-gold/5 cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              导出 Markdown 文件（{mdSize}）
            </Button>
          </div>

          {/* 一键喂 AI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              onClick={handleCopyPrompt}
              className="crimson-gradient text-white hover:opacity-90 cursor-pointer shadow-md shadow-red-900/20"
            >
              <Bot className="w-4 h-4 mr-2" />
              复制 AI Prompt（TOON）
            </Button>
            <Button
              onClick={handleCopyMarkdown}
              className="crimson-gradient text-white hover:opacity-90 cursor-pointer shadow-md shadow-red-900/20"
            >
              <Bot className="w-4 h-4 mr-2" />
              复制 AI 分析（Markdown）
            </Button>
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 p-3 max-h-40 overflow-y-auto">
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all font-mono leading-relaxed">
              {toonText.slice(0, 2000)}{toonText.length > 2000 ? '...' : ''}
            </pre>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
