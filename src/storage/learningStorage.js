import { createCardIds } from "../learningAlgorithm.js";

export const LEARNING_STORAGE_KEY = "vocab2-learning-v1";
export const LEARNING_STORAGE_VERSION = 1;

const VALID_MODES = new Set(["study", "rest", "spell"]);

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeNonNegativeInteger = (value) =>
  Number.isInteger(value) && value >= 0 ? value : 0;

const clampIndex = (value, queueLength) =>
  Math.min(
    normalizeNonNegativeInteger(value),
    Math.max(queueLength - 1, 0),
  );

const normalizeCardIdList = (value, allowedCardIds) => {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value.filter((cardId) => {
    if (
      typeof cardId !== "string" ||
      !allowedCardIds.has(cardId) ||
      seen.has(cardId)
    ) {
      return false;
    }
    seen.add(cardId);
    return true;
  });
};

const getDefaultStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

export const normalizeLearningSnapshot = (snapshot) => {
  if (
    !isRecord(snapshot) ||
    snapshot.version !== LEARNING_STORAGE_VERSION ||
    !Array.isArray(snapshot.sourceDeck) ||
    !snapshot.sourceDeck.every(isRecord)
  ) {
    return null;
  }

  const cardIds = createCardIds(snapshot.sourceDeck);
  const knownCardIds = new Set(cardIds);
  const removedCardIds = normalizeCardIdList(
    snapshot.removedCardIds,
    knownCardIds,
  );
  const activeCardIds = new Set(
    cardIds.filter((cardId) => !removedCardIds.includes(cardId)),
  );
  const studyQueueIds = normalizeCardIdList(
    snapshot.studyQueueIds,
    activeCardIds,
  );
  const spellQueueIds = normalizeCardIdList(
    snapshot.spellQueueIds,
    activeCardIds,
  );

  let mode = VALID_MODES.has(snapshot.mode) ? snapshot.mode : "study";
  if (mode === "spell" && spellQueueIds.length === 0) {
    mode = "study";
  }

  const lastRemoved =
    isRecord(snapshot.lastRemoved) &&
    typeof snapshot.lastRemoved.cardId === "string" &&
    removedCardIds.includes(snapshot.lastRemoved.cardId)
      ? snapshot.lastRemoved
      : null;

  return {
    ...snapshot,
    version: LEARNING_STORAGE_VERSION,
    sourceDeck: snapshot.sourceDeck,
    removedCardIds,
    learningState: isRecord(snapshot.learningState)
      ? snapshot.learningState
      : {},
    completedRounds: {
      study: normalizeNonNegativeInteger(snapshot.completedRounds?.study),
      spell: normalizeNonNegativeInteger(snapshot.completedRounds?.spell),
    },
    shuffleOnLoop:
      typeof snapshot.shuffleOnLoop === "boolean"
        ? snapshot.shuffleOnLoop
        : true,
    showWordInsights:
      typeof snapshot.showWordInsights === "boolean"
        ? snapshot.showWordInsights
        : false,
    familiarModeEnabled:
      typeof snapshot.familiarModeEnabled === "boolean"
        ? snapshot.familiarModeEnabled
        : false,
    mode,
    lastRemoved,
    studyQueueIds,
    spellQueueIds,
    index: clampIndex(snapshot.index, studyQueueIds.length),
    spellIndex: clampIndex(snapshot.spellIndex, spellQueueIds.length),
  };
};

export const readLearningSnapshot = (storage = getDefaultStorage()) => {
  if (!storage || typeof storage.getItem !== "function") return null;

  try {
    const serialized = storage.getItem(LEARNING_STORAGE_KEY);
    if (serialized === null) return null;
    return normalizeLearningSnapshot(JSON.parse(serialized));
  } catch {
    return null;
  }
};

export const writeLearningSnapshot = (
  snapshot,
  storage = getDefaultStorage(),
) => {
  if (!storage || typeof storage.setItem !== "function") {
    return {
      success: false,
      error: new Error("Learning storage is unavailable."),
    };
  }

  const normalized = normalizeLearningSnapshot(snapshot);
  if (!normalized) {
    return {
      success: false,
      error: new Error("Learning snapshot is invalid."),
    };
  }

  try {
    storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(normalized));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error
          : new Error("Learning snapshot could not be stored."),
    };
  }
};
