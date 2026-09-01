const maleAvatarThemes = ['A', 'B', 'C'] as const;

export function getEvangelistAvatarSeed(participantId: number): string {
  return `ivorysql-evangelist-${participantId}`;
}

export function getEvangelistAvatarVariant(participantId: number) {
  // Multiavatar has no gender option, so lock the verified male base design.
  return {
    part: '04' as const,
    theme: maleAvatarThemes[participantId % maleAvatarThemes.length],
  };
}
