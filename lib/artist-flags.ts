// Mapping des artistes vers leurs drapeaux de pays
export const artistFlags: Record<string, string> = {
  'Vitalii': '🇺🇦', // Ukraine
  'Vladyslav': '🇺🇦', // Ukraine
  'Xuan': '🇨🇳', // China
  'Mychailo': '🇺🇦', // Ukraine
  'Konstantin': '🇩🇰', // Denmark
  'Sarabjot': '🇮🇳', // India
  'Mustafa': '🇹🇷', // Turkey
};

export function getArtistFlag(name: string): string {
  return artistFlags[name] || '🌐';
}



