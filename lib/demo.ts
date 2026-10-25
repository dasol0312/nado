// Shared clock Easter egg presets and automatic student nicknames.

// The demo clock jumps to a busy weekday moment so plans show up right after a class.
export const CLOCK_PRESETS = [
  { id: "mon1150", label: "Mon 11:50 am · morning classes let out", day: 1, time: "11:50" },
  { id: "tue1205", label: "Tue 12:05 pm · Calc ends in 10 min", day: 2, time: "12:05" },
  { id: "wed1505", label: "Wed 3:05 pm · Writing ends in 10 min", day: 3, time: "15:05" },
  { id: "real", label: "Real time", day: null, time: null },
] as const;

const ADJ = ["Violet", "Yellow", "Green", "Blue", "Orange", "Pink", "Silver", "Coral", "Mint", "Lavender", "Sky", "Amber"];
const ANI = ["Otter", "Penguin", "Hedgehog", "Raccoon", "Squirrel", "Owl", "Panda", "Fox", "Cat", "Rabbit", "Alpaca", "Koala", "Hamster", "Duck"];
export const randomNickname = () =>
  `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${ANI[Math.floor(Math.random() * ANI.length)]}`;
