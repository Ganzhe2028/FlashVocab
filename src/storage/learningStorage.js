import { createCardIds } from "../learningAlgorithm.js";

export const DECK_STORAGE_KEY = "flashvocab-3-assets-v1";
export const DECK_STORAGE_VERSION = 1;
export const LEGACY_STORAGE_KEY = "vocab2-learning-v1";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getDefaultStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

export const normalizeDeckAssets = (value) => {
  if (
    !isRecord(value) ||
    value.version !== DECK_STORAGE_VERSION ||
    !Array.isArray(value.sourceDeck) ||
    !value.sourceDeck.every(isRecord)
  ) {
    return null;
  }

  const allowedIds = new Set(createCardIds(value.sourceDeck));
  const seen = new Set();
  const removedCardIds = (Array.isArray(value.removedCardIds)
    ? value.removedCardIds
    : []
  ).filter((cardId) => {
    if (typeof cardId !== "string" || !allowedIds.has(cardId) || seen.has(cardId)) {
      return false;
    }
    seen.add(cardId);
    return true;
  });

  return {
    version: DECK_STORAGE_VERSION,
    sourceDeck: value.sourceDeck,
    removedCardIds,
  };
};

const parseStoredValue = (serialized) => {
  if (serialized === null) return null;
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
};

export const readDeckAssets = (storage = getDefaultStorage()) => {
  if (!storage || typeof storage.getItem !== "function") {
    return { assets: null, source: null, warning: null };
  }

  try {
    const currentRaw = storage.getItem(DECK_STORAGE_KEY);
    if (currentRaw !== null) {
      const assets = normalizeDeckAssets(parseStoredValue(currentRaw));
      return {
        assets,
        source: assets ? "current" : null,
        warning: assets ? null : "本地词表记录已损坏，请重新导入或使用示例词表。",
      };
    }

    const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw === null) {
      return { assets: null, source: null, warning: null };
    }
    const legacy = parseStoredValue(legacyRaw);
    const assets = normalizeDeckAssets({
      version: DECK_STORAGE_VERSION,
      sourceDeck: legacy?.sourceDeck,
      removedCardIds: legacy?.removedCardIds,
    });
    return {
      assets,
      source: assets ? "legacy" : null,
      warning: assets ? null : "旧版词表记录无法读取，请重新导入。",
    };
  } catch {
    return {
      assets: null,
      source: null,
      warning: "无法读取本地词表，本次仍可继续使用。",
    };
  }
};

export const writeDeckAssets = (assets, storage = getDefaultStorage()) => {
  if (!storage || typeof storage.setItem !== "function") {
    return { success: false, error: new Error("Deck storage is unavailable.") };
  }
  const normalized = normalizeDeckAssets({
    version: DECK_STORAGE_VERSION,
    sourceDeck: assets?.sourceDeck,
    removedCardIds: assets?.removedCardIds,
  });
  if (!normalized) {
    return { success: false, error: new Error("Deck assets are invalid.") };
  }
  try {
    storage.setItem(DECK_STORAGE_KEY, JSON.stringify(normalized));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Deck assets could not be stored."),
    };
  }
};
