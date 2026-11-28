import catalog from '../data/catalog.json';
import type { PublicOffer } from '../types/catalog';

export function useCatalog(): PublicOffer[] {
  return catalog as PublicOffer[];
}
