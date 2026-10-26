import { createMastery } from "../mastery.js";

export const MASTERY_STORAGE_KEY = "flashvocab-mastery-v1";
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const counter = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export const normalizeMastery = (value) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, progress]) => isRecord(progress)).map(([id, progress]) => [id, {
    ...createMastery(),
    streak: counter(progress.streak),
    mistakes: counter(progress.mistakes),
    fuzzy: counter(progress.fuzzy),
    lastSeen: Number.isSafeInteger(progress.lastSeen) && progress.lastSeen >= 0 ? progress.lastSeen : null,
  }]));
};

const defaultStorage = () => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

export const readMastery = (storage = defaultStorage()) => {
  try {
    const raw = storage?.getItem(MASTERY_STORAGE_KEY);
    if (raw == null) return { mastery: {}, warning: null };
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !isRecord(parsed.mastery)) throw new Error("Invalid mastery data");
    return { mastery: normalizeMastery(parsed.mastery), warning: null };
  } catch {
    return { mastery: {}, warning: "掌握度记录无法读取，词表仍可正常使用。" };
  }
};

export const writeMastery = (mastery, storage = defaultStorage()) => {
  try {
    if (!storage) return { success: false };
    storage.setItem(MASTERY_STORAGE_KEY, JSON.stringify({ version: 1, mastery: normalizeMastery(mastery) }));
    return { success: true };
  } catch { return { success: false }; }
};
