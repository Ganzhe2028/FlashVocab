import test from "node:test";
import assert from "node:assert/strict";
import { createWave, getSessionKind, LEGACY_WAVE_ID, normalizeWaves } from "./waveModel.js";
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

test("legacy wave dates remain unknown and first-day classification uses recorded creation time", () => {
  const legacy = normalizeWaves([oldWord]);
  assert.equal(legacy[0].createdAt, null);
  const now = new Date("2026-10-20T12:00:00Z").getTime();
  const wave = createWave([], "W5", now);
  assert.equal(getSessionKind([wave], now), "intro");
  assert.equal(getSessionKind([wave], now + 86400000), "review");
  assert.equal(getSessionKind(legacy, now), "review");
  assert.notEqual(createWave([wave], "W6", now).id, wave.id);
});

test("new waves begin with scenario learning when usable examples exist, then review sorts by results", () => {
  const sourceDeck = [
    { term: "alpha", meaning: "first", examples: [{ sentence: "Alpha comes first.", focus: "Alpha" }] },
    { term: "beta", meaning: "second", examples: [{ sentence: "Beta comes second.", focus: "Beta" }] },
  ];
  let state = createInitialState();
  state = learningReducer(state, { type: "ADD_WAVE", sourceDeck, now: Date.now(), random });
  assert.equal(state.mode, "quiz");
  assert.equal(state.quiz.intro, true);
  assert.equal(state.quiz.kind, "scenario");
  const firstId = state.quiz.queueIds[0];
  const wrong = state.quiz.question.options.find((option) => option !== state.quiz.question.answer);
  state = learningReducer(state, { type: "ANSWER_QUIZ", answer: wrong, now: 1000 });
  state = learningReducer(state, { type: "END_QUIZ", random });
  assert.equal(state.mode, "study");
  assert.equal(state.studyQueueIds[0], firstId);
  assert.equal(state.mastery[firstId].mistakes, 1);
  assert.ok(state.undo);
});
