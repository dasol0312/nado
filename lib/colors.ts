// Names for the room colors in lib/nado/matching.ts (ROOM_COLORS)
const COLOR_NAMES: Record<string, string> = {
  "#FF8A3D": "orange",
  "#3D8BFF": "blue",
  "#2BB673": "green",
  "#A55BFF": "purple",
  "#FF4F8B": "pink",
  "#F5B700": "yellow",
};

export const colorName = (hex: string) => COLOR_NAMES[hex.toUpperCase()] ?? "colored";
