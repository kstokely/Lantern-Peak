// Marlow's Trading Post: the catalogue (design.md "Expansion (v2)"). Pure data, no Phaser.
import type { ToolId } from '../art/keys';

export interface StoreItem {
  id: ToolId;
  name: string;
  price: number;
  /** Camp (1-based) that must be lit before it is sold; 0 = sold from the start. */
  litCamp: number;
  /** One short line for the store card. */
  desc: string;
}

export const STORE_ITEMS: StoreItem[] = [
  { id: 'cocoa', name: 'Cocoa Flask', price: 15, litCamp: 0, desc: 'Free puzzle hint' },
  { id: 'springHooves', name: 'Spring Hooves', price: 40, litCamp: 0, desc: 'Jump extra high' },
  { id: 'chimeBell', name: 'Chime Bell', price: 60, litCamp: 0, desc: 'Befriend Flurries' },
  { id: 'glowLantern', name: 'Glow Lantern', price: 70, litCamp: 2, desc: 'Light up dark caves' },
  { id: 'iceChisel', name: 'Ice Chisel', price: 80, litCamp: 2, desc: 'Break ice walls' },
  { id: 'swiftScarf', name: 'Swift Scarf', price: 90, litCamp: 3, desc: 'Walk faster' },
  { id: 'gemMagnet', name: 'Gem Magnet', price: 100, litCamp: 3, desc: 'Gems fly to you' },
  { id: 'silverBell', name: 'Silver Bell', price: 110, litCamp: 3, desc: 'Bell rings farther' },
  { id: 'trailMap', name: 'Trail Map', price: 120, litCamp: 4, desc: 'Shows secrets' },
  // v4 platforming tools: they only make climbing easier (never needed to light a camp)
  { id: 'gripHooves', name: 'Grip Hooves', price: 90, litCamp: 2, desc: 'No sliding on ice' },
  { id: 'cloudBoots', name: 'Cloud Boots', price: 130, litCamp: 3, desc: 'Jump again in the air' },
  { id: 'featherCape', name: 'Feather Cape', price: 140, litCamp: 4, desc: 'Hold jump to glide' },
];

export interface HatItem {
  index: number;
  name: string;
  price: number;
  litCamp: number;
}

export const HAT_ITEMS: HatItem[] = [
  { index: 0, name: 'Bobble Hat', price: 25, litCamp: 0 },
  { index: 1, name: 'Ear Muffs', price: 30, litCamp: 0 },
  { index: 2, name: 'Explorer Hat', price: 40, litCamp: 2 },
  { index: 3, name: 'Flower Crown', price: 50, litCamp: 3 },
  { index: 4, name: 'Star Band', price: 60, litCamp: 4 },
];

export const storeItem = (id: ToolId) => STORE_ITEMS.find((s) => s.id === id)!;

/** True when a camp requirement is met: litCamp 0 always, else zone litCamp-1 is delivered. */
export function campLit(delivered: boolean[], litCamp: number) {
  return litCamp <= 0 || delivered[litCamp - 1] === true;
}
