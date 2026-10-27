import test from "node:test";
import assert from "node:assert/strict";
import { createWave, LEGACY_WAVE_ID, normalizeWaves } from "./waveModel.js";
import { createCardIds, createInitialState, getActiveCardIds, learningReducer } from "./learningAlgorithm.js";

const oldWord = { term: "alpha", meaning: "first", custom: { retained: true } };
const newWords = [{ term: "alpha", meaning: "first" }, { term: "beta", meaning: "second" }];
const random = () => 0.99;

test("adding a named wave retains old assets and gives duplicate terms independent stable IDs", () => {
  const initial = createInitialState({ assets: { sourceDeck: [oldWord] }, random });
  const [oldId] = createCardIds(initial.sourceDeck);
  const added = learningReducer(initial, { type: "ADD_WAVE", sourceDeck: newWords, name: "W5", now: 1000, random });
  assert.equal(added.sourceDeck.length, 3);
  assert.deepEqual(added.sourceDeck[0].custom, oldWord.custom);
  assert.equal(createCardIds(added.sourceDeck)[0], oldId);
  assert.equal(new Set(createCardIds(added.sourceDeck)).size, 3);
  assert.deepEqual(added.waves.map((wave) => [wave.name, wave.status]), [["W1", "cold"], ["W5", "active"]]);
  assert.equal(getActiveCardIds(added).length, 2);
  const undone = learningReducer(added, { type: "UNDO" });
  assert.deepEqual(undone.sourceDeck, initial.sourceDeck);
  assert.deepEqual(undone.waves, initial.waves);
});

test("cold storage preserves words and semester revival restores graduates while respecting removals", () => {
  let state = createInitialState({ assets: { sourceDeck: [oldWord] }, random });
  state = learningReducer(state, { type: "ADD_WAVE", sourceDeck: newWords, now: 1000, random });
  state = learningReducer(state, { type: "SELECT_WAVE", waveId: LEGACY_WAVE_ID, random });
  assert.deepEqual(getActiveCardIds(state), createCardIds([oldWord]));
  state = learningReducer(state, { type: "COLD_WAVE", waveId: LEGACY_WAVE_ID, random });
  assert.equal(state.mode, "prepare");
  assert.equal(state.sourceDeck.length, 3);
  const ids = createCardIds(state.sourceDeck);
  state = { ...state, mastery: { [ids[0]]: { streak: 3, mistakes: 2, fuzzy: 0, lastSeen: 1000 } }, removedCardIds: [ids[2]] };
  state = learningReducer(state, { type: "REVIVE_ALL_WAVES", random });
  assert.equal(state.mastery[ids[0]].streak, 0);
  assert.equal(state.mastery[ids[0]].mistakes, 2);
  assert.equal(state.studyQueueIds.length, 2);
  assert.equal(state.waves.every((wave) => wave.status === "active"), true);
});

test("recognition and MCQ pools exclude cold waves", () => {
  let state = createInitialState({ assets: { sourceDeck: [{ term: "cold", meaning: "old word" }] }, random });
  state = learningReducer(state, { type: "ADD_WAVE", sourceDeck: newWords, now: 1000, random });
  state = learningReducer(state, { type: "START_QUIZ", random });
  assert.equal(state.quiz.queueIds.length, 2);
  assert.equal(state.quiz.question.options.includes("cold"), false);
});

test("legacy wave dates remain unknown and new waves record their creation time", () => {
  const legacy = normalizeWaves([oldWord]);
  assert.equal(legacy[0].createdAt, null);
  const now = new Date("2026-10-20T12:00:00Z").getTime();
  const wave = createWave([], "W5", now);
  assert.equal(wave.createdAt, now);
  assert.notEqual(createWave([wave], "W6", now).id, wave.id);
});

test("new waves start with recognition even when examples could support a scenario practice", () => {
  const sourceDeck = [
    { term: "alpha", meaning: "first", examples: [{ sentence: "Alpha comes first.", focus: "Alpha" }] },
    { term: "beta", meaning: "second", examples: [{ sentence: "Beta comes second.", focus: "Beta" }] },
  ];
  let state = createInitialState();
  state = learningReducer(state, { type: "ADD_WAVE", sourceDeck, now: Date.now(), random });
  assert.equal(state.mode, "study");
  assert.ok(state.studyQueueIds.length > 0);
  assert.ok(state.undo);
  assert.ok(state.waves[0].createdAt);
});
