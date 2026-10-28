import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { CaseReference } from 'mingli-cases-react';
import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const MingliCaseLibrary = lazy(() => import('mingli-cases-react').then((module) => ({ default: module.MingliCaseLibrary })));
const loadLibrary = () => import('mingli-cases-ts-lib');

class LibraryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('命例库加载失败', error, info.componentStack); }
  render() {
    return this.state.failed
      ? <p role="alert" className="text-sm text-destructive">命例库加载失败，请刷新页面后重试。</p>
      : this.props.children;
  }
}

function LibraryContent({ onReferenceChange }: { onReferenceChange: (reference: CaseReference | null) => void }) {
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  return (
    <LibraryBoundary>
      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">正在加载命例库…</p>}>
        <MingliCaseLibrary
          loadLibrary={loadLibrary}
          preferredChart="bazi"
          title="八字命例库"
          onReferenceChange={(reference) => { if (active.current) onReferenceChange(reference); }}
        />
      </Suspense>
    </LibraryBoundary>
  );
}

interface Props {
  reference: CaseReference | null;
  onReferenceChange: (reference: CaseReference | null) => void;
  onClear: () => void;
}

export default function CaseLibraryEntry({ reference, onReferenceChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-gold/15" data-testid="case-library-entry">
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-crimson dark:text-gold"><BookOpen className="w-4 h-4" />命例库</span>
          <span className="flex-1 text-xs text-muted-foreground">查阅原始资料、练习论断；可选为独立 AI 参考。</span>
          <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? '收起命例库' : '打开命例库'}
          </Button>
        </div>
        {reference && (
          <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="selected-case-reference">
            <span>已选 AI 参考：{reference.title}（非当前命主事实）</span>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}><X className="w-3 h-3" />清除参考</Button>
          </div>
        )}
        {open && <LibraryContent onReferenceChange={onReferenceChange} />}
      </CardContent>
    </Card>
  );
}
