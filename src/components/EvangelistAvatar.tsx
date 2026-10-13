'use client';

import { EVANGELIST_AVATAR_ATLAS, getEvangelistAvatar } from '@/lib/evangelist-avatar';

interface EvangelistAvatarProps {
  participantId: number;
  name: string;
  avatarUrl?: string | null;
  size: 'small' | 'large' | 'picker';
}

const sizeClasses = {
  small: 'h-8 w-8',
  large: 'h-16 w-16',
  picker: 'h-12 w-12',
};

export default function EvangelistAvatar({ participantId, name, avatarUrl, size }: EvangelistAvatarProps) {
  const avatar = getEvangelistAvatar(participantId, avatarUrl);
  return (
    <span
      role="img"
      aria-label={`${name}头像`}
      data-avatar-url={avatar.url}
      className={`${sizeClasses[size]} inline-block shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-400/60`}
      style={{ backgroundImage: `url("${EVANGELIST_AVATAR_ATLAS}")`, backgroundSize: '600% 600%', backgroundPosition: avatar.position, backgroundRepeat: 'no-repeat' }}
    />
  );
}
