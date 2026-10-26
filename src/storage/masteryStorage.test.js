import test from "node:test";
import assert from "node:assert/strict";
import { MASTERY_STORAGE_KEY, normalizeMastery, readMastery, writeMastery } from "./masteryStorage.js";

test("mastery storage retains only four validated numbers and round-trips independently of queues", () => {
  let saved;
  const storage = { setItem(key, raw) { assert.equal(key, MASTERY_STORAGE_KEY); saved = raw; }, getItem() { return saved; } };
  const mastery = { a: { streak: 2, mistakes: 1, fuzzy: 3, lastSeen: 1234, queue: ["ignored"] } };
  assert.equal(writeMastery(mastery, storage).success, true);
  assert.deepEqual(readMastery(storage).mastery, { a: { streak: 2, mistakes: 1, fuzzy: 3, lastSeen: 1234 } });
  assert.deepEqual(normalizeMastery({ a: { streak: -1, mistakes: Infinity, fuzzy: 1.5, lastSeen: "yesterday" } }).a,
    { streak: 0, mistakes: 0, fuzzy: 0, lastSeen: null });
});

test("damaged or denied mastery storage remains usable and reports persistence failures", () => {
  assert.match(readMastery({ getItem() { return "broken"; } }).warning, /无法读取/);
  assert.equal(writeMastery({}, { setItem() { throw new Error("denied"); } }).success, false);
  assert.deepEqual(readMastery(null), { mastery: {}, warning: null });
});
