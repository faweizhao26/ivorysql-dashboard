const maleShortHeadVariants = [
  'flatTop',
  'grayShort',
  'mohawk',
  'noHair1',
  'noHair2',
  'noHair3',
  'pomp',
  'shaved1',
  'shaved2',
  'short1',
  'short2',
  'short3',
  'short4',
  'short5',
] as const;

const expressionVariants = [
  'blank',
  'calm',
  'concerned',
  'contempt',
  'driven',
  'explaining',
  'serious',
  'smile',
  'smileBig',
  'solemn',
  'suspicious',
] as const;

const facialHairVariants = [
  'chin',
  'full2',
  'goatee1',
  'goatee2',
  'moustache2',
  'moustache6',
] as const;

export function getEvangelistAvatarOptions(participantId: number, name: string) {
  const normalizedId = Math.abs(participantId);
  const hasNoBeard = name.trim() === '傅超' || name.trim() === '付超';

  return {
    seed: `ivorysql-evangelist-${participantId}`,
    headVariant: maleShortHeadVariants[normalizedId % maleShortHeadVariants.length],
    expressionVariant: expressionVariants[normalizedId % expressionVariants.length],
    facialHairVariant: facialHairVariants[normalizedId % facialHairVariants.length],
    facialHairProbability: hasNoBeard ? 0 : normalizedId % 5 === 0 ? 100 : 0,
    accessoriesProbability: 0,
    maskProbability: 0,
    skinColor: 'ffffff',
    clothingColor: 'ffffff',
    headContrastColor: '000000',
    inkColor: '000000',
    backgroundColor: 'ffffff',
    backgroundColorFill: 'solid' as const,
  };
}
