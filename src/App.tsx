import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Compass } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import BaziForm from '@/components/BaziForm';
import BaziChart from '@/components/BaziChart';
import ThemeToggle from '@/components/ThemeToggle';
import { calculateChart, compareEngines, DEFAULT_ENGINE } from '@/lib/engine';
import { saveChart, loadChart } from '@/lib/storage';
import type { BaziInput, BaziResult } from '@/lib/bazi';

export default function App() {
  const getSystemDark = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const [dark, setDark] = useState(getSystemDark);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BaziResult | null>(null);
  const [input, setInput] = useState<BaziInput | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 刷新后恢复上次命盘
  useEffect(() => {
    const saved = loadChart();
    if (saved) {
      setInput(saved.input);
      setResult(saved.result);
    }
  }, []);

  // 命盘变化即持久化（含对拍结果）
  useEffect(() => {
    if (input && result) saveChart(input, result);
  }, [input, result]);

  const handleSubmit = useCallback((formInput: BaziInput) => {
    setLoading(true);
    setResult(null);
    setInput(formInput);

    setTimeout(() => {
      void (async () => {
        try {
          // 经引擎门面排盘（引擎代码懒加载）
          const res = await calculateChart(formInput, formInput.engine ?? DEFAULT_ENGINE);
          setResult(res as unknown as BaziResult);
          toast.success('排盘成功！数据已准备好', { icon: '✨' });
          // 对拍校验异步补挂，不阻塞主盘展示
          if (formInput.compare) {
            try {
              const rep = await compareEngines(formInput);
              setResult((prev) =>
                prev ? ({ ...(prev as any), _compareReport: rep } as BaziResult) : prev,
              );
            } catch (cmpErr) {
              console.error('双引擎对拍失败', cmpErr);
            }
          }
        } catch (err: any) {
          console.error(err);
          toast.error(`排盘失败：${err?.message || '未知错误'}`);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Toaster
          position="top-center"
          toastOptions={{
            className: 'text-sm',
            style: {
              background: dark ? '#1a1a2e' : '#fff',
              color: dark ? '#f0d78c' : '#1a1a2e',
              border: '1px solid rgba(212,175,55,0.2)',
            },
          }}
        />

        {/* 顶部导航 */}
        <header className="sticky top-0 z-50 border-b border-gold/10 bg-background/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-6 h-6 text-crimson dark:text-gold" />
              <h1 className="text-lg font-bold tracking-wide text-crimson dark:text-gold">
                八字排盘
              </h1>
              <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">
                Powered by mystilight-8char
              </span>
            </div>
            <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} />
          </div>
        </header>

        {/* 主体内容 */}
        <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
          <div className="space-y-8">
            <BaziForm onSubmit={handleSubmit} loading={loading} />

            {/* 不用 AnimatePresence mode="wait"：React 19 下退出动画会卡死、
                结果面板永远等不到挂载（同 WuYunLiuQiCard 的已知问题），
                改为条件渲染 + key 重挂载淡入 */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 space-y-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 rounded-full border-2 border-gold/20 border-t-gold"
                />
                <p className="text-sm text-muted-foreground">正在排盘，请稍候...</p>
              </motion.div>
            )}

            {!loading && result && input && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <BaziChart input={input} result={result} />
              </motion.div>
            )}
          </div>
        </main>

        {/* 页脚 */}
        <footer className="border-t border-gold/10 py-6 mt-10">
          <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground space-y-1">
            <p>八字排盘 · 命理分析结果仅供学术研究参考</p>
            <p>核心计算引擎：mystilight-8char · 基于渊海子平原理</p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
