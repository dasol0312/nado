// Categories and the icebreaker question bank. The 16 preset activities themselves live in
// lib/activities.ts (ACTIVITY_CATALOG, the source of truth shared with scripts/generate-students.ts).
// Places aren't preset: Claude picks them per activity when a plan opens (lib/nado/plan.ts).
import { ACTIVITY_CATALOG, type ActivityCategory } from "./activities";

export const CATEGORIES = ["Sports", "Cafe", "Study", "Food", "Culture", "Games", "Place", "Other"] as const satisfies readonly ActivityCategory[];
export type Category = ActivityCategory;

export const isPreset = (name: string) => ACTIVITY_CATALOG.some((a) => a.name === name);

// Activity-specific icebreakers, used when Claude isn't available
const QUESTIONS: Record<string, string[]> = {
  soccer: ["Which position do you secretly think you'd be great at?", "Messi or Ronaldo, and you have to defend it for 30 seconds.", "Worst sports injury you've ever gotten from a casual game?"],
  basketball: ["If you had one signature move, what would it be called?", "Who on this team is taking the last shot, and why is it you?", "What's your free-throw ritual?"],
  running: ["What's the longest you've ever run without stopping?", "What's on your running playlist right now?", "Best route in the city that isn't the Hudson River path?"],
  climbing: ["Which hold type do you hate the most?", "What scared you more: your first lead climb or your first NYC subway ride?", "Most ridiculous fall you've taken?"],
  boba: ["What's your go-to order, sugar and ice level included?", "Tapioca pearls or a topping hot take?", "Best boba you've ever had, and where?"],
  coffee: ["How do you take your coffee, and how many a day is too many?", "What's the best café in the city to study in?", "Have you ever had a coffee so bad you still remember it?"],
  bakery: ["Croissant, bagel, or something else for the perfect breakfast?", "Which NYC bakery line is actually worth the wait?", "Sweet or savory pastry person?"],
  study: ["What class are you avoiding studying for right now?", "Floor of Bobst you'd defend to the end?", "Pomodoro, all-nighter, or chaos?"],
  homework: ["Which problem set this week made you question everything?", "Do you start homework the day it's assigned or the day it's due?", "Who's the best TA you've had so far?"],
  ramen: ["Tonkotsu, shoyu, miso, or shio?", "Do you drink the broth at the end, and is that a personality trait?", "How many toppings is too many?"],
  pizza: ["Fold it or eat it flat, and why?", "Dollar slice or fancy pie for the rest of your life?", "Pineapple on pizza: yes, no, or it depends?"],
  "korean food": ["Tteokbokki spice level: mild, medium, or crying?", "What's your perfect Korean barbecue order?", "Ramyeon at 2am: which brand?"],
  museum: ["If you could steal one painting in the city, which one?", "Which museum is the most underrated in New York?", "Do you read every placard or just vibe?"],
  movie: ["Which movie can you quote start to finish?", "Best movie you've seen in a theater this year?", "What movie should everyone here watch before graduating?"],
  "board games": ["Which board game has ended a friendship for you?", "Are you a rules-reader or a learn-as-we-go player?", "Strategy or chaos games?"],
  chess: ["What opening do you always play, and why?", "Have you ever played the chess hustlers in the park?", "Speed chess or a long game?"],
  "cat:Sports": ["What sport did you play as a kid that you've given up?", "Pregame snack of choice?"],
  "cat:Cafe": ["Sweet tooth or bitter coffee person?", "Best place to sit for hours without buying a second drink?"],
  "cat:Study": ["What's your study soundtrack?", "Which class surprised you the most this semester?"],
  "cat:Food": ["What dish from home do you miss most?", "Best cheap eat near campus?"],
  "cat:Culture": ["What show or exhibit should we all see next?", "Last thing that genuinely surprised you on a stage or screen?"],
  "cat:Place": ["What spot in the city do you go to when you need a break?", "Best hidden corner near campus that nobody knows about?"],
  "cat:Games": ["Most competitive game you've ever played?", "Do you play to win or play to have fun?"],
};
// When there's no question for the activity or its category
const GENERAL = [
  "What surprised you most when you got to NYU?",
  "What's the weirdest thing you've seen in Washington Square Park?",
  "What's your favorite class this semester?",
  "Boba sweetness: 0, 50, or 100 percent?",
  "Is there a food from home you still can't find in NYC?",
  "Where do you go in Manhattan on weekends?",
  "What's your strangest subway moment so far?",
];

export function questionsFor(activity: string, category?: string): string[] {
  return QUESTIONS[activity] ?? (category ? QUESTIONS[`cat:${category}`] : undefined) ?? GENERAL;
}

