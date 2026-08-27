import test from "node:test";
import assert from "node:assert/strict";
import { createCardIds } from "../learningAlgorithm.js";
import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORAGE_VERSION,
  normalizeLearningSnapshot,
  readLearningSnapshot,
  writeLearningSnapshot,
} from "./learningStorage.js";

const createSnapshot = (overrides = {}) => {
  const sourceDeck = [{ term: "One", meaning: "the first number" }];
  const [cardId] = createCardIds(sourceDeck);
  return {
    version: LEARNING_STORAGE_VERSION,
    sourceDeck,
    removedCardIds: [],
    learningState: {},
    completedRounds: { study: 0, spell: 0 },
    shuffleOnLoop: true,
    showWordInsights: true,
    familiarModeEnabled: true,
    mode: "study",
    lastRemoved: null,
    studyQueueIds: [cardId],
    spellQueueIds: [],
    index: 0,
    spellIndex: 0,
    ...overrides,
  };
};

const createReadableStorage = (value) => ({
  getItem(key) {
    assert.equal(key, LEARNING_STORAGE_KEY);
    return value;
  },
});

test("damaged JSON is ignored without throwing", () => {
  assert.equal(readLearningSnapshot(createReadableStorage("{broken")), null);
});

test("a snapshot from another storage version is ignored", () => {
  const serialized = JSON.stringify(createSnapshot({ version: 999 }));
  assert.equal(readLearningSnapshot(createReadableStorage(serialized)), null);
});

test("a quota write failure is returned instead of thrown", () => {
  const quotaError = new Error("Quota exceeded");
  quotaError.name = "QuotaExceededError";
  const storage = {
    setItem() {
      throw quotaError;
    },
  };

  const result = writeLearningSnapshot(createSnapshot(), storage);

  assert.equal(result.success, false);
  assert.equal(result.error, quotaError);
});

test("missing window storage has explicit safe read and write results", () => {
  assert.equal(readLearningSnapshot(), null);

  const result = writeLearningSnapshot(createSnapshot());
  assert.equal(result.success, false);
  assert.match(result.error.message, /unavailable/i);
});

test("spell mode with an empty queue degrades to a consistent study state", () => {
  const sourceDeck = [
    { term: "One", meaning: "the first number" },
    { term: "Two", meaning: "the second number" },
  ];
  const cardIds = createCardIds(sourceDeck);
  const normalized = normalizeLearningSnapshot(
    createSnapshot({
      sourceDeck,
      mode: "spell",
      studyQueueIds: cardIds,
      spellQueueIds: [],
      index: 99,
      spellIndex: 99,
    }),
  );

  assert.equal(normalized.mode, "study");
  assert.equal(normalized.index, 1);
  assert.equal(normalized.spellIndex, 0);
});

test("optional complex features default off for older snapshots", () => {
  const snapshot = createSnapshot();
  delete snapshot.showWordInsights;
  delete snapshot.familiarModeEnabled;

  const normalized = normalizeLearningSnapshot(snapshot);

  assert.equal(normalized.showWordInsights, false);
  assert.equal(normalized.familiarModeEnabled, false);
});

test("queues discard removed, unknown, and duplicate IDs", () => {
  const sourceDeck = [
    { term: "One", meaning: "the first number" },
    { term: "Two", meaning: "the second number" },
  ];
  const cardIds = createCardIds(sourceDeck);
  const normalized = normalizeLearningSnapshot(
    createSnapshot({
      sourceDeck,
      removedCardIds: [cardIds[1], "unknown"],
      studyQueueIds: [cardIds[0], cardIds[0], cardIds[1], "unknown"],
      spellQueueIds: [cardIds[1]],
    }),
  );

  assert.deepEqual(normalized.removedCardIds, [cardIds[1]]);
  assert.deepEqual(normalized.studyQueueIds, [cardIds[0]]);
  assert.deepEqual(normalized.spellQueueIds, []);
});

test("a valid snapshot is stored under the versioned key", () => {
  let storedKey;
  let storedValue;
  const storage = {
    setItem(key, value) {
      storedKey = key;
      storedValue = value;
    },
  };

  const result = writeLearningSnapshot(createSnapshot(), storage);

  assert.deepEqual(result, { success: true });
  assert.equal(storedKey, LEARNING_STORAGE_KEY);
  assert.equal(JSON.parse(storedValue).version, LEARNING_STORAGE_VERSION);
  assert.equal(JSON.parse(storedValue).showWordInsights, true);
  assert.equal(JSON.parse(storedValue).familiarModeEnabled, true);
});
