'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="app-theme-switch" role="group" aria-label="外观主题">
      <button type="button" title="浅色主题" aria-label="浅色主题" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={17} aria-hidden="true" /></button>
      <button type="button" title="深色主题" aria-label="深色主题" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={17} aria-hidden="true" /></button>
    </div>
  );
}
