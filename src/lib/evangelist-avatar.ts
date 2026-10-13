export const EVANGELIST_AVATAR_ATLAS = '/avatars/ivorysql-line-men.png';

export const EVANGELIST_AVATARS = Array.from({ length: 36 }, (_, index) => ({
  index,
  label: `头像 ${String(index + 1).padStart(2, '0')}`,
  url: `${EVANGELIST_AVATAR_ATLAS}#${String(index + 1).padStart(2, '0')}`,
  position: `${(index % 6) * 20}% ${Math.floor(index / 6) * 20}%`,
}));

export interface EvangelistAvatarMember {
  id: number;
  avatar_url?: string | null;
}

export function getEvangelistAvatar(participantId: number, avatarUrl?: string | null) {
  const selected = EVANGELIST_AVATARS.find(avatar => avatar.url === avatarUrl);
  const index = Number.isSafeInteger(participantId) && participantId > 0 ? (participantId - 1) % EVANGELIST_AVATARS.length : 0;
  return selected || EVANGELIST_AVATARS[index];
}

export function getAvailableEvangelistAvatar(members: EvangelistAvatarMember[]): string {
  const used = new Set(members.map(member => getEvangelistAvatar(member.id, member.avatar_url).url));
  return (EVANGELIST_AVATARS.find(avatar => !used.has(avatar.url)) || EVANGELIST_AVATARS[0]).url;
}

export function normalizeEvangelistAvatarUrl(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !EVANGELIST_AVATARS.some(avatar => avatar.url === value)) {
    throw new RangeError('请选择头像库中的头像');
  }
  return value;
}
