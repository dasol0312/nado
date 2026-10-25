// Outfit options for the 30-minute "what are you wearing" check, and stand-in outfits
// for sample students (they never fill the form).
import type { Outfit } from "@/types/database";

export const OUTFIT_COLORS: [string, string][] = [
  ["black", "#1f1f22"], ["white", "#f4f4f2"], ["gray", "#9a9aa0"], ["blue", "#2f6fd6"], ["red", "#d33b36"],
  ["green", "#2f9a5b"], ["yellow", "#f2c230"], ["purple", "#7a3fb8"], ["beige", "#d8c4a0"], ["navy", "#22305e"],
];
export const TOPS = ["hoodie", "T-shirt", "button-up", "sweater", "jacket", "sweatshirt"];
export const SHOES = ["white sneakers", "black sneakers", "boots", "loafers", "high-tops"];
export const HAIR = ["black hair", "brown hair", "blonde hair", "wearing a cap", "wearing glasses"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function sampleOutfit(id: string): Outfit {
  const h = hash(id);
  return {
    color: OUTFIT_COLORS[h % OUTFIT_COLORS.length][0],
    top: TOPS[(h >>> 4) % TOPS.length],
    shoes: SHOES[(h >>> 8) % SHOES.length],
    hair: HAIR[(h >>> 12) % HAIR.length],
  };
}
