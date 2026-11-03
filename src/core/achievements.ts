import type { Save } from "./economy";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  test: (s: Save) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "seed100", name: "First handful", desc: "Gather 100 seeds in total.", test: (s) => s.allTime >= 100 },
  { id: "seed1k", name: "Seed collector", desc: "Gather 1,000 seeds in total.", test: (s) => s.allTime >= 1000 },
  { id: "seed10k", name: "Pantry full", desc: "Gather 10,000 seeds in total.", test: (s) => s.allTime >= 10_000 },
  { id: "seed100k", name: "Seed baron", desc: "Gather 100,000 seeds in total.", test: (s) => s.allTime >= 100_000 },
  { id: "seed1m", name: "Seed tycoon", desc: "Gather 1,000,000 seeds in total.", test: (s) => s.allTime >= 1_000_000 },
  { id: "pouch10", name: "Chubby cheeks", desc: "Own 10 cheek pouches.", test: (s) => s.owned.pouch >= 10 },
  { id: "farm", name: "Green paws", desc: "Dig the seed farm.", test: (s) => s.owned.farm > 0 },
  { id: "tunnels", name: "Underground", desc: "Dig the tunnel network.", test: (s) => s.owned.tunnels > 0 },
  { id: "spa", name: "Pampered", desc: "Open the hamster spa.", test: (s) => s.owned.spa > 0 },
  { id: "moon", name: "Night shift", desc: "Open the moon observatory.", test: (s) => s.owned.observatory > 0 },
  { id: "fever", name: "Fever rider", desc: "Catch a Squeek fever.", test: (s) => s.fevers >= 1 },
  { id: "golden", name: "Lucky find", desc: "Catch a golden seed.", test: (s) => s.golden >= 1 },
  { id: "hibernate", name: "Deep sleeper", desc: "Hibernate once.", test: (s) => s.hibernations >= 1 },
];

export function pendingAchievements(s: Save): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !s.ach.includes(a.id) && a.test(s));
}
