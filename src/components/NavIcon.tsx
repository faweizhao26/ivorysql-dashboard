import { Award, CalendarDays, Download, Files, GitBranch, House, Monitor, Settings2 } from 'lucide-react';

const icons = { home: House, github: GitBranch, social: Monitor, content: Files, download: Download, evangelist: Award, events: CalendarDays, admin: Settings2 };

export function NavIcon({ name, className = '' }: { name: string; className?: string }) {
  const Icon = icons[name as keyof typeof icons];
  return Icon ? <Icon size={18} className={className} aria-hidden="true" /> : null;
}
