'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
      title={theme === 'dark' ? '切换亮色主题' : '切换暗色主题'}
    >
      {theme === 'dark' ? (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
