import test from "node:test";
import assert from "node:assert/strict";
import { recordMastery } from "./mastery.js";
import { buildRoundCardIds, createCardIds, createInitialState, learningReducer } from "./learningAlgorithm.js";

test("mastery tracks first-answer streak, failures, fuzzy judgments, and measured time independently", () => {
  let mastery = recordMastery({}, "a", true, 1000);
  mastery = recordMastery(mastery, "a", "fuzzy", 2000);
  mastery = recordMastery(mastery, "a", false, 3000);
  assert.deepEqual(mastery.a, { streak: 0, mistakes: 1, fuzzy: 1, lastSeen: 3000 });
});

test("study sorts weak, unseen, and steady words without overriding one-round rest", () => {
  const mastery = {
    weak: { streak: 0, mistakes: 2, fuzzy: 0, lastSeen: 2000 },
    steady: { streak: 1, mistakes: 0, fuzzy: 0, lastSeen: 1000 },
    graduate: { streak: 3, mistakes: 0, fuzzy: 0, lastSeen: 1000 },
  };
  const queue = buildRoundCardIds({ cardIds: ["steady", "new", "weak", "graduate", "resting"], mastery,
    learningState: { resting: { study: { hidden: true, dueRound: 4 } } }, mode: "study", round: 3,
    avoidFirstCardId: "weak", random: () => 0.9 });
  assert.deepEqual(queue, ["weak", "new", "steady"]);
});

test("three independent recognition rounds graduate a word and restoration can be undone", () => {
  const sourceDeck = [{ term: "alpha" }];
  const [cardId] = createCardIds(sourceDeck);
  let state = createInitialState({ assets: { sourceDeck }, random: () => 0.9 });
  for (let round = 0; round < 3; round += 1) {
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
    state = learningReducer(state, { type: "ADVANCE_STUDY", now: 1000 + round, random: () => 0.9 });
    assert.equal(state.mode, "summary");
    assert.equal(state.roundSummary.study.correct, 1);
    assert.equal(state.roundSummary.mastery.graduated, round === 2 ? 1 : 0);
    state = learningReducer(state, { type: "CONTINUE_ROUND" });
  }
  assert.equal(state.mode, "mastered");
  assert.equal(state.mastery[cardId].streak, 3);
  const restored = learningReducer(state, { type: "RESTORE_GRADUATED" });
  assert.equal(restored.mode, "study");
  assert.equal(restored.mastery[cardId].streak, 0);
  const undone = learningReducer(restored, { type: "UNDO" });
  assert.equal(undone.mode, "mastered");
  assert.equal(undone.mastery[cardId].streak, 3);
});
