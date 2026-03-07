import type { UserInfo } from "@/types";

const ADJECTIVES = [
  "Brave",
  "Calm",
  "Clever",
  "Cosmic",
  "Curious",
  "Daring",
  "Eager",
  "Fierce",
  "Gentle",
  "Golden",
  "Happy",
  "Keen",
  "Lively",
  "Lucky",
  "Mighty",
  "Noble",
  "Pixel",
  "Quick",
  "Rapid",
  "Sharp",
  "Silent",
  "Smart",
  "Solar",
  "Steel",
  "Swift",
  "Vivid",
  "Warm",
  "Wild",
  "Wise",
  "Zen",
];

const ANIMALS = [
  "Bear",
  "Cat",
  "Cobra",
  "Crane",
  "Deer",
  "Dolphin",
  "Eagle",
  "Falcon",
  "Fox",
  "Hawk",
  "Horse",
  "Jaguar",
  "Koala",
  "Leo",
  "Lynx",
  "Otter",
  "Owl",
  "Panda",
  "Phoenix",
  "Raven",
  "Robin",
  "Shark",
  "Tiger",
  "Viper",
  "Wolf",
  "Whale",
  "Wren",
  "Yak",
  "Zebra",
  "Zephyr",
];

// Curated palette of visually distinct, accessible colours
const COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#84CC16",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STORAGE_KEY = "kang-user";

export function getOrCreateUser(): UserInfo {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      return JSON.parse(stored) as UserInfo;
    } catch {
      // Corrupted storage — regenerate
    }
  }

  const user: UserInfo = {
    userId: crypto.randomUUID(),
    displayName: `${randomFrom(ADJECTIVES)} ${randomFrom(ANIMALS)}`,
    color: randomFrom(COLORS),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}
