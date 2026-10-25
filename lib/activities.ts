// The 16 preset activities (the `activities` catalog in Supabase).
// scripts/generate-students.ts writes these rows, so this file is the source of truth.
// Where to meet and where to go is not preset: Claude picks places per activity when a plan opens.
// Claude also maps custom names onto these ("bubble tea" → "boba").

export type ActivityCategory = "Sports" | "Cafe" | "Study" | "Food" | "Culture" | "Games" | "Other";

export type PresetActivity = {
  name: string;        // lowercase key used by matching
  label: string;
  category: ActivityCategory;
  maxSize: number;     // largest group that still works for strangers
  minDefault: number;  // suggested minimum; each student can change theirs
};

export const ACTIVITY_CATALOG: PresetActivity[] = [
  { name: "soccer", label: "Soccer", category: "Sports", maxSize: 10, minDefault: 4 },
  { name: "basketball", label: "Basketball", category: "Sports", maxSize: 10, minDefault: 4 },
  { name: "running", label: "Running", category: "Sports", maxSize: 6, minDefault: 2 },
  { name: "climbing", label: "Climbing", category: "Sports", maxSize: 4, minDefault: 2 },
  { name: "boba", label: "Boba", category: "Cafe", maxSize: 4, minDefault: 2 },
  { name: "coffee", label: "Coffee", category: "Cafe", maxSize: 4, minDefault: 2 },
  { name: "bakery", label: "Bakery run", category: "Cafe", maxSize: 4, minDefault: 2 },
  { name: "study", label: "Study session", category: "Study", maxSize: 5, minDefault: 2 },
  { name: "homework", label: "Problem sets", category: "Study", maxSize: 4, minDefault: 2 },
  { name: "ramen", label: "Ramen", category: "Food", maxSize: 4, minDefault: 2 },
  { name: "pizza", label: "Pizza", category: "Food", maxSize: 6, minDefault: 2 },
  { name: "korean food", label: "Korean food", category: "Food", maxSize: 6, minDefault: 3 },
  { name: "museum", label: "Museum trip", category: "Culture", maxSize: 5, minDefault: 2 },
  { name: "movie", label: "Movie night", category: "Culture", maxSize: 5, minDefault: 2 },
  { name: "board games", label: "Board games", category: "Games", maxSize: 6, minDefault: 3 },
  { name: "chess", label: "Chess", category: "Games", maxSize: 4, minDefault: 2 },
];

export const PRESET_ACTIVITIES = ACTIVITY_CATALOG.map((a) => a.name);
