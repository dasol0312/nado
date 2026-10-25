// Built-in interests. supabase/seed.sql is generated from this file
// (npx tsx scripts/generate-seed.ts), so change activities here.
// meet = where the group finds each other (always an NYU building), dest = where the activity happens.

export const CATEGORIES = ["Sports", "Cafe", "Study", "Food", "Culture", "Games", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export type CatalogActivity = {
  name: string;
  label: string;
  category: Category;
  max: number;
  minDefault: number;
  meet: string; // place key
  dest: string; // place key
};

export const CATALOG: CatalogActivity[] = [
  { name: "soccer", label: "Soccer", category: "Sports", max: 10, minDefault: 4, meet: "paulson", dest: "paulson" },
  { name: "basketball", label: "Basketball", category: "Sports", max: 10, minDefault: 4, meet: "paulson", dest: "paulson" },
  { name: "running", label: "Running", category: "Sports", max: 6, minDefault: 2, meet: "silver", dest: "wsp" },
  { name: "climbing", label: "Climbing", category: "Sports", max: 4, minDefault: 2, meet: "paulson", dest: "paulson" },
  { name: "boba", label: "Boba", category: "Cafe", max: 4, minDefault: 2, meet: "kimmel", dest: "surreal" },
  { name: "coffee", label: "Coffee", category: "Cafe", max: 4, minDefault: 2, meet: "silver", dest: "think" },
  { name: "bakery", label: "Bakery run", category: "Cafe", max: 4, minDefault: 2, meet: "silver", dest: "think" },
  { name: "study", label: "Study session", category: "Study", max: 5, minDefault: 2, meet: "bobst", dest: "bobst" },
  { name: "homework", label: "Problem sets", category: "Study", max: 4, minDefault: 2, meet: "bobst", dest: "bobst" },
  { name: "ramen", label: "Ramen", category: "Food", max: 4, minDefault: 2, meet: "kimmel", dest: "karakatta" },
  { name: "pizza", label: "Pizza", category: "Food", max: 6, minDefault: 2, meet: "kimmel", dest: "macdougal" },
  { name: "korean food", label: "Korean food", category: "Food", max: 6, minDefault: 3, meet: "kimmel", dest: "macdougal" },
  { name: "museum", label: "Museum trip", category: "Culture", max: 5, minDefault: 2, meet: "silver", dest: "arch" },
  { name: "movie", label: "Movie night", category: "Culture", max: 5, minDefault: 2, meet: "kimmel", dest: "ifc" },
  { name: "board games", label: "Board games", category: "Games", max: 6, minDefault: 3, meet: "kimmel", dest: "kimmel" },
  { name: "chess", label: "Chess", category: "Games", max: 4, minDefault: 2, meet: "kimmel", dest: "chess" },
];

// Where a custom interest meets if nothing better is known
export const CATEGORY_MEET: Record<Category, string> = {
  Sports: "paulson", Cafe: "kimmel", Study: "bobst", Food: "kimmel", Culture: "silver", Games: "kimmel", Other: "kimmel",
};
export const CATEGORY_DEST: Record<Category, string> = {
  Sports: "paulson", Cafe: "think", Study: "bobst", Food: "macdougal", Culture: "arch", Games: "kimmel", Other: "wsp",
};

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

export const catalogByName = (name: string) => CATALOG.find((a) => a.name === name);
