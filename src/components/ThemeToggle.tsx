import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ThemeToggleProps {
  dark: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ dark, onToggle }: ThemeToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="rounded-full cursor-pointer"
      aria-label="切换暗黑模式"
    >
      {dark ? <Sun className="w-5 h-5 text-gold" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
}
