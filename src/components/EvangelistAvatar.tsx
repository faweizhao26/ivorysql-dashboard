'use client';

import { useMemo } from 'react';
import multiavatar from '@multiavatar/multiavatar/esm';
import {
  getEvangelistAvatarSeed,
  getEvangelistAvatarVariant,
} from '@/lib/evangelist-avatar';

interface EvangelistAvatarProps {
  participantId: number;
  name: string;
  size: 'small' | 'large';
}

const sizeClasses = {
  small: 'h-8 w-8',
  large: 'h-16 w-16',
};

export default function EvangelistAvatar({ participantId, name, size }: EvangelistAvatarProps) {
  const avatarSvg = useMemo(
    () =>
      multiavatar(
        getEvangelistAvatarSeed(participantId),
        false,
        getEvangelistAvatarVariant(participantId),
      ),
    [participantId],
  );

  return (
    <span
      aria-label={`${name} 默认头像`}
      className={`${sizeClasses[size]} inline-flex shrink-0 overflow-hidden rounded-full bg-slate-900 ring-2 ring-slate-700/80`}
    >
      <span
        aria-hidden="true"
        className="block h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: avatarSvg }}
      />
    </span>
  );
}
