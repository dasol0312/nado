// Meeting spots around Washington Square. `key` matches places.key in the DB.
// x/y are positions on the sketch map in components/room/CampusMap.tsx (viewBox 360x262).
export type PlaceInfo = {
  key: string;
  name: string;
  tag: string; // short map label
  address: string;
  campus: boolean; // NYU building: groups always meet at one of these first
  x: number;
  y: number;
  side: "l" | "r"; // which side of the dot the label goes
};

export const PLACES: PlaceInfo[] = [
  { key: "kimmel", name: "Kimmel Center lobby", tag: "Kimmel Center", address: "60 Washington Sq S", campus: true, x: 184, y: 205, side: "l" },
  { key: "bobst", name: "Bobst Library entrance", tag: "Bobst Library", address: "70 Washington Sq S", campus: true, x: 222, y: 205, side: "r" },
  { key: "silver", name: "Silver Center lobby", tag: "Silver Center", address: "100 Washington Sq E", campus: true, x: 252, y: 112, side: "r" },
  { key: "paulson", name: "Paulson Center lobby", tag: "Paulson Center", address: "181 Mercer St", campus: true, x: 300, y: 234, side: "l" },
  { key: "arch", name: "Washington Square Arch", tag: "Washington Sq Arch", address: "Washington Square Park", campus: false, x: 168, y: 70, side: "r" },
  { key: "wsp", name: "Washington Square Park loop", tag: "Park loop", address: "Washington Square Park", campus: false, x: 168, y: 126, side: "r" },
  { key: "chess", name: "Park chess tables (SW corner)", tag: "Chess tables", address: "Washington Square Park", campus: false, x: 118, y: 170, side: "r" },
  { key: "surreal", name: "Surreal Creamery (boba)", tag: "Surreal Creamery", address: "126 MacDougal St", campus: false, x: 102, y: 246, side: "r" },
  { key: "think", name: "Think Coffee", tag: "Think Coffee", address: "248 Mercer St", campus: false, x: 300, y: 206, side: "r" },
  { key: "karakatta", name: "Karakatta (ramen)", tag: "Karakatta", address: "230 Thompson St", campus: false, x: 160, y: 232, side: "r" },
  { key: "ifc", name: "IFC Center (movies)", tag: "IFC Center", address: "323 6th Ave", campus: false, x: 40, y: 230, side: "r" },
  { key: "macdougal", name: "MacDougal St food strip", tag: "MacDougal St eats", address: "MacDougal St, south of the park", campus: false, x: 90, y: 206, side: "l" },
];

export const placeByKey = (key: string | null | undefined) => PLACES.find((p) => p.key === key);

// Rough walking minutes between two spots on the sketch map (30 px ≈ 1 minute)
export const walkMinutes = (a: PlaceInfo, b: PlaceInfo) => Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / 30));

// Streets on the sketch map. A place Claude suggests is pinned near the crossing of its
// nearest north-south and east-west street; a far one sits on the map edge with an arrow.
export const NS_X: Record<string, number> = {
  "6th Ave": 30, "MacDougal St": 96, "Thompson St": 156, "5th Ave": 168,
  "University Pl / LaGuardia Pl": 240, "Mercer St": 296, "Broadway": 336,
};
export const EW_Y: Record<string, number> = { "W 8th St": 24, "Waverly Pl": 60, "W 4th St": 190, "W 3rd St": 222, "Bleecker St": 252 };
const ARROW = { N: "↑", S: "↓", E: "→", W: "←" } as const;

export type PlaceRowLike = {
  key: string;
  name: string;
  address: string | null;
  ns_street?: string | null;
  ew_street?: string | null;
  far?: string | null;
  confident?: boolean | null;
};
export type MapPlace = PlaceInfo & { suggested: boolean; sure: boolean; far: "" | "N" | "S" | "E" | "W" };

// A DB place → something the map can draw. Built-in spots use the fixed table above.
export function mapPlace(row: PlaceRowLike | null | undefined): MapPlace | undefined {
  if (!row) return undefined;
  const known = placeByKey(row.key);
  if (known) return { ...known, suggested: false, sure: true, far: "" };
  const far = (["N", "S", "E", "W"].includes(row.far ?? "") ? row.far : "") as MapPlace["far"];
  let x = (NS_X[row.ns_street ?? ""] ?? 168) + 6;
  let y = (EW_Y[row.ew_street ?? ""] ?? 222) + 8;
  if (far === "N") y = 10;
  if (far === "S") y = 252;
  if (far === "E") x = 344;
  if (far === "W") x = 12;
  x = Math.max(10, Math.min(346, x));
  y = Math.max(10, Math.min(252, y));
  const tag = row.name.length > 18 ? `${row.name.slice(0, 17)}…` : row.name;
  return {
    key: row.key, name: row.name, address: row.address ?? "near Washington Square", campus: false,
    tag: far ? `${tag} ${ARROW[far]}` : tag, x, y, side: x < 250 ? "r" : "l",
    suggested: true, sure: row.confident !== false, far,
  };
}
