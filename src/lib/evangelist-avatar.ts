const maleAvatarVariants = [
  { part: '04', theme: 'A' },
  { part: '04', theme: 'B' },
  { part: '04', theme: 'C' },
  { part: '08', theme: 'A' },
  { part: '08', theme: 'B' },
  { part: '08', theme: 'C' },
  { part: '10', theme: 'A' },
  { part: '10', theme: 'B' },
  { part: '10', theme: 'C' },
  { part: '11', theme: 'A' },
  { part: '11', theme: 'B' },
  { part: '11', theme: 'C' },
  { part: '13', theme: 'A' },
  { part: '13', theme: 'B' },
  { part: '13', theme: 'C' },
] as const;

const noBeardAvatarVariant = { part: '08', theme: 'B' } as const;

export function getEvangelistAvatarSeed(participantId: number): string {
  return `ivorysql-evangelist-${participantId}`;
}

export function getEvangelistAvatarVariant(participantId: number, name: string) {
  // Multiavatar has no gender option, so only use visually verified male designs.
  if (name.trim() === '傅超' || name.trim() === '付超') {
    return noBeardAvatarVariant;
  }

  return maleAvatarVariants[participantId % maleAvatarVariants.length];
}
