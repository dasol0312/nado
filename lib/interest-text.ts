// Checks a custom interest name before it reaches the catalog (used on screen and in /api/activities).
// English only, no offensive words, no links, no keyboard mashing. Messages stay friendly.

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

// Latin letters (accents allowed, like "café"), digits, spaces and a little punctuation
const ALLOWED = /^[A-Za-z0-9À-ÖØ-öø-ÿ '&.,+\-/#!?()]+$/;
const HAS_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
const LINK = /(https?:\/\/|www\.|\.(com|net|org|io|gg|ly)\b|@)/i;

// Whole words (after undoing l33t spelling). Kept short on purpose: Claude also drops
// conditions about who can join, and anything odd still needs two people to match.
const BLOCKED_WORDS = new Set([
  "ass", "asshole", "bastard", "bitch", "bitches", "boobs", "cock", "cocaine", "crack", "cum", "cunt", "dick", "dildo",
  "drugs", "escort", "fag", "fags", "heroin", "hitler", "hooker", "hookup", "horny", "kkk", "kill", "lsd", "mdma",
  "meth", "molly", "nazi", "nazis", "nude", "nudes", "onlyfans", "orgy", "penis", "porn", "porno", "pussy", "rape",
  "retard", "retarded", "sex", "sexy", "shit", "shrooms", "slut", "stripper", "suicide", "terrorist", "tits",
  "vagina", "weed", "whore",
]);
// Matched anywhere, spaces removed ("f u c k")
const BLOCKED_PARTS = ["fuck", "nigg", "faggot", "shithead", "motherf", "stripclub"];

const unLeet = (s: string) =>
  s.toLowerCase().replace(/0/g, "o").replace(/1|!/g, "i").replace(/3/g, "e").replace(/4|@/g, "a").replace(/5|\$/g, "s").replace(/7/g, "t");

function looksLikeMashing(text: string) {
  const letters = text.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
  if (/(.)\1{3,}/.test(letters)) return true; // "aaaa"
  for (const word of text.toLowerCase().split(/[^a-zà-ÿ]+/)) {
    if (word.length >= 5 && !/[aeiouyà-ÿ]/.test(word)) return true; // "sdfgh"
  }
  if (letters.length >= 8 && (letters.match(/[aeiouyà-ÿ]/g)?.length ?? 0) / letters.length < 0.2) return true;
  return false;
}

export function checkInterestName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, message: "Type an activity or a place." };
  if (name.length > 40) return { ok: false, message: "Keep it under 40 characters." };
  if (LINK.test(name)) return { ok: false, message: "Links can’t be interests. Try the activity or place name." };
  if (ALLOWED.test(name) && !HAS_LETTER.test(name)) return { ok: false, message: "Type an activity or a place." };
  if (!ALLOWED.test(name)) {
    return { ok: false, message: "For now, please type it in English so other students can find it too." };
  }
  const plain = unLeet(name);
  const words = plain.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => BLOCKED_WORDS.has(w)) || BLOCKED_PARTS.some((p) => plain.replace(/[^a-z]/g, "").includes(p))) {
    return { ok: false, message: "Let’s keep interests friendly for everyone. Try a different one." };
  }
  if (looksLikeMashing(name)) return { ok: false, message: "Hmm, we couldn’t read that one. Mind checking the spelling?" };
  return { ok: true, name };
}
