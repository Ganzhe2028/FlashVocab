import test from "node:test";
import assert from "node:assert/strict";
import { createCardIds } from "../learningAlgorithm.js";
import {
  DECK_STORAGE_KEY,
  DECK_STORAGE_VERSION,
  LEGACY_STORAGE_KEY,
  normalizeDeckAssets,
  readDeckAssets,
  writeDeckAssets,
} from "./learningStorage.js";

const sourceDeck = [
  { term: "One", meaning: "the first number", custom: { kept: true } },
  { term: "Two", meaning: "the second number" },
];

const assets = (overrides = {}) => ({
  version: DECK_STORAGE_VERSION,
  sourceDeck,
  removedCardIds: [],
  ...overrides,
});

test("current assets keep source fields and normalize removed IDs", () => {
  const cardIds = createCardIds(sourceDeck);
  const normalized = normalizeDeckAssets(assets({
    removedCardIds: [cardIds[1], cardIds[1], "unknown"],
  }));
  assert.deepEqual(normalized.removedCardIds, [cardIds[1]]);
  assert.deepEqual(normalized.sourceDeck[0].custom, { kept: true });
});

test("current storage is preferred and does not restore learning queues", () => {
  const storage = {
    getItem(key) {
      if (key === DECK_STORAGE_KEY) return JSON.stringify(assets());
      throw new Error("legacy key should not be read");
    },
  };
  const result = readDeckAssets(storage);
  assert.equal(result.source, "current");
  assert.deepEqual(result.assets.sourceDeck, sourceDeck);
  assert.equal("learningState" in result.assets, false);
});

test("legacy storage contributes only the deck and removed IDs", () => {
  const [removedId] = createCardIds(sourceDeck);
  const legacy = {
    version: 1,
    sourceDeck,
    removedCardIds: [removedId],
    learningState: { secret: "must not migrate" },
    studyQueueIds: ["old queue"],
    mode: "spell",
  };
  const storage = {
    getItem(key) {
      return key === DECK_STORAGE_KEY ? null : JSON.stringify(legacy);
    },
  };
  const result = readDeckAssets(storage);
  assert.equal(result.source, "legacy");
  assert.deepEqual(result.assets, assets({ removedCardIds: [removedId] }));
});

test("damaged current storage reports a warning and does not fall through to legacy", () => {
  const storage = {
    getItem(key) {
      return key === DECK_STORAGE_KEY ? "{broken" : JSON.stringify({ sourceDeck });
    },
  };
  const result = readDeckAssets(storage);
  assert.equal(result.assets, null);
  assert.match(result.warning, /损坏/);
});

test("a rejected write is returned without throwing", () => {
  const quotaError = new Error("Quota exceeded");
  const result = writeDeckAssets(assets(), {
    setItem() { throw quotaError; },
  });
  assert.equal(result.success, false);
  assert.equal(result.error, quotaError);
});

test("valid assets write only the new versioned key", () => {
  const writes = [];
  const result = writeDeckAssets(assets(), {
    setItem(key, value) { writes.push([key, JSON.parse(value)]); },
  });
  assert.deepEqual(result, { success: true });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], DECK_STORAGE_KEY);
  assert.notEqual(writes[0][0], LEGACY_STORAGE_KEY);
  assert.equal(writes[0][1].version, DECK_STORAGE_VERSION);
});

test("missing storage has safe read and write results", () => {
  assert.deepEqual(readDeckAssets(null), { assets: null, source: null, warning: null });
  assert.equal(writeDeckAssets(assets(), null).success, false);
});
