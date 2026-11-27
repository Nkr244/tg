export function displayTitle(title: string): string {
  return title
    .replace(/\s+Giveaway$/i, '')
    .replace(/\s+\((?:Steam|Epic Games|GOG|PC|Mobile)\)$/i, '')
    .trim();
}
