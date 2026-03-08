import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Download, Copy, Sparkles, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildExportJSON, generateFileName } from '@/lib/bazi';
import { generateAIPrompt } from '@/lib/prompt-template';
import type { BaziInput, BaziResult } from '@/lib/bazi';

interface JsonExportProps {
  input: BaziInput;
  result: BaziResult;
}

export default function JsonExport({ input, result }: JsonExportProps) {
  const exportData = buildExportJSON(input, result);
  const compactJson = JSON.stringify(exportData);

  const handleDownload = () => {
    const blob = new Blob([compactJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName(input);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('JSON 文件已下载');
  };

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(compactJson);
      toast.success('JSON 已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动复制');
    }
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
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
              <Sparkles className="w-3 h-3" />
              已准备好喂 AI
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="border-gold/30 hover:bg-gold/5 cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              导出 JSON 文件
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyJSON}
              className="border-gold/30 hover:bg-gold/5 cursor-pointer"
            >
              <Copy className="w-4 h-4 mr-2" />
              复制 JSON
            </Button>
            <Button
              onClick={handleCopyPrompt}
              className="crimson-gradient text-white hover:opacity-90 cursor-pointer shadow-md shadow-red-900/20"
            >
              <Bot className="w-4 h-4 mr-2" />
              一键复制 AI Prompt
            </Button>
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 p-3 max-h-40 overflow-y-auto">
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all font-mono leading-relaxed">
              {compactJson.slice(0, 2000)}{compactJson.length > 2000 ? '...' : ''}
            </pre>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
