// 多命盘档案栏：保存当前盘为命名档案、点击档案载入（回填表单+重算）、删除。
// 档案数据只存起盘参数+表单快照（storage.ts），载入走 App 的 handleSubmit 重算。
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { listProfiles, saveProfile, deleteProfile, loadForm, type ChartProfile } from '@/lib/storage';
import type { BaziInput } from '@/lib/bazi';

interface Props {
  /** 当前已排盘的参数（无则禁用保存） */
  currentInput: BaziInput | null;
  /** 载入档案：回填表单并重算 */
  onLoad: (profile: ChartProfile) => void;
  /** 档案列表变化时上抛（合婚面板同步） */
  onChanged?: () => void;
}

function summaryOf(p: ChartProfile): string {
  const i = p.input;
  return `${i.year}-${String(i.month).padStart(2, '0')}-${String(i.day).padStart(2, '0')} ${i.gender === 1 ? '男' : '女'}`;
}

export default function ProfileBar({ currentInput, onLoad, onChanged }: Props) {
  const [name, setName] = useState('');
  const [profiles, setProfiles] = useState<ChartProfile[]>(listProfiles);

  const refresh = () => {
    setProfiles(listProfiles());
    onChanged?.();
  };

  const handleSave = () => {
    if (!currentInput) return;
    // 未另填档案名时沿用表单姓名（同 react-zwds 按姓名索引档案的口径）
    const trimmed = name.trim() || (currentInput.name ?? '').trim();
    if (!trimmed) {
      toast.error('请先给档案起个名字（如人名）');
      return;
    }
    saveProfile(trimmed, currentInput, loadForm());
    setName('');
    refresh();
    toast.success(`档案「${trimmed}」已保存`, { icon: '📁' });
  };

  const handleDelete = (p: ChartProfile) => {
    deleteProfile(p.id);
    refresh();
    toast(`已删除档案「${p.name}」`, { icon: '🗑️' });
  };

  return (
    <Card className="border-gold/15">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-crimson dark:text-gold">
          <Users className="w-4 h-4" />
          命盘档案
          <span className="text-[11px] font-normal text-muted-foreground">
            存本机浏览器；先排盘再命名保存，点击档案即载入重算
          </span>
        </div>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              !currentInput ? '请先排盘，再保存档案'
              : currentInput.name ? `留空则用姓名「${currentInput.name}」`
              : '档案名，如：张三'
            }
            disabled={!currentInput}
            className="h-8 text-sm flex-1"
            data-testid="profile-name"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={!currentInput}
            className="h-8 gap-1"
            data-testid="profile-save"
          >
            <Save className="w-3.5 h-3.5" /> 保存档案
          </Button>
        </div>

        {profiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/5 pl-3 pr-1.5 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onLoad(p)}
                  className="hover:text-crimson dark:hover:text-gold transition-colors"
                  title={`载入并重算：${summaryOf(p)}`}
                  data-testid={`profile-load-${p.name}`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground ml-1.5">{summaryOf(p)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                  title="删除档案"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
