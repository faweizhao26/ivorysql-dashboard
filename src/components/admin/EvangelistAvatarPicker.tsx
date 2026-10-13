'use client';

import { Check } from 'lucide-react';
import EvangelistAvatar from '@/components/EvangelistAvatar';
import { EVANGELIST_AVATARS, getEvangelistAvatar, type EvangelistAvatarMember } from '@/lib/evangelist-avatar';

interface AvatarPickerProps {
  value: string;
  onChange: (value: string) => void;
  members: (EvangelistAvatarMember & { name: string })[];
  participantId?: number;
}

export default function EvangelistAvatarPicker({ value, onChange, members, participantId }: AvatarPickerProps) {
  return <fieldset className="min-w-0 space-y-3 border-t border-slate-700 pt-4">
    <legend className="px-1 text-sm font-medium text-slate-200">头像</legend>
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-9 xl:grid-cols-12">
      {EVANGELIST_AVATARS.map(avatar => {
        const usedBy = members.filter(member => member.id !== participantId && getEvangelistAvatar(member.id, member.avatar_url).url === avatar.url);
        const description = `${avatar.label}${usedBy.length ? `，已用于${usedBy.map(member => member.name).join('、')}` : '，未使用'}`;
        return <label key={avatar.url} title={description} className="relative min-w-0 cursor-pointer">
          <input type="radio" name="evangelist-avatar" value={avatar.url} checked={value === avatar.url} onChange={() => onChange(avatar.url)} aria-label={description} className="peer sr-only" />
          <span className={`flex h-[86px] flex-col items-center justify-center gap-1 rounded-md border py-2 transition-colors hover:border-slate-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300 ${value === avatar.url ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700'}`}>
            <EvangelistAvatar participantId={0} name={avatar.label} avatarUrl={avatar.url} size="picker" />
            <span className="whitespace-nowrap text-xs text-slate-400">{String(avatar.index + 1).padStart(2, '0')}{usedBy.length > 0 && <span className="ml-1 text-slate-500">已用</span>}</span>
          </span>
          {value === avatar.url && <Check size={14} aria-hidden="true" className="absolute right-0.5 top-0.5 rounded-full bg-emerald-400 p-0.5 text-slate-950" />}
        </label>;
      })}
    </div>
  </fieldset>;
}
