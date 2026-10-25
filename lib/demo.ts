// Demo-only data: the sample schedule button, Quick setup, and the demo clock presets.

// A typical first-year schedule. day: 0 = Sunday.
export const DEMO_CLASSES = [
  { label: "CSCI-UA 102 Data Structures", day: 1, start: "09:30", end: "10:45" },
  { label: "CSCI-UA 102 Data Structures", day: 3, start: "09:30", end: "10:45" },
  { label: "MATH-UA 121 Calculus I", day: 2, start: "11:00", end: "12:15" },
  { label: "MATH-UA 121 Calculus I", day: 4, start: "11:00", end: "12:15" },
  { label: "EXPOS-UA 1 Writing as Inquiry", day: 1, start: "14:00", end: "15:15" },
  { label: "EXPOS-UA 1 Writing as Inquiry", day: 3, start: "14:00", end: "15:15" },
  { label: "CORE-UA 400 Texts & Ideas", day: 2, start: "15:30", end: "16:45" },
  { label: "CORE-UA 400 Texts & Ideas", day: 4, start: "15:30", end: "16:45" },
  { label: "CSCI-UA 102 Recitation", day: 5, start: "11:00", end: "12:15" },
];

export const DEMO_EMAIL = "demo@nyu.edu";
export const DEMO_INTERESTS = [
  { activity: "ramen", min: 2 },
  { activity: "boba", min: 3 },
  { activity: "soccer", min: 4 },
];

// The demo clock jumps to a busy weekday moment so plans show up right after a class.
export const CLOCK_PRESETS = [
  { id: "mon1150", label: "Mon 11:50 am · morning classes let out", day: 1, time: "11:50" },
  { id: "tue1205", label: "Tue 12:05 pm · Calc ends in 10 min", day: 2, time: "12:05" },
  { id: "wed1505", label: "Wed 3:05 pm · Writing ends in 10 min", day: 3, time: "15:05" },
  { id: "real", label: "Real time", day: null, time: null },
] as const;
export type ClockPresetId = (typeof CLOCK_PRESETS)[number]["id"];

const ADJ = ["Violet", "Yellow", "Green", "Blue", "Orange", "Pink", "Silver", "Coral", "Mint", "Lavender", "Sky", "Amber"];
const ANI = ["Otter", "Penguin", "Hedgehog", "Raccoon", "Squirrel", "Owl", "Panda", "Fox", "Cat", "Rabbit", "Alpaca", "Koala", "Hamster", "Duck"];
export const randomNickname = () =>
  `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${ANI[Math.floor(Math.random() * ANI.length)]}`;
