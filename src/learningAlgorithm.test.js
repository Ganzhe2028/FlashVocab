import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExportDeck,
  buildRoundCardIds,
  createCardIds,
  createInitialState,
  findNextUnscoredCardIndex,
  getModeProgress,
  learningReducer,
  recordReview,
  selectExamples,
} from "./learningAlgorithm.js";

const almostOne = () => 0.999999;
const deck = [
  { term: "Alpha", pos: "n.", meaning: "first", meaningZh: "第一" },
  { term: "Beta", pos: "n.", meaning: "second", meaningZh: "第二" },
];

test("stable IDs distinguish identical duplicate entries", () => {
  const entries = [deck[0], { ...deck[0] }, deck[1]];
  const first = createCardIds(entries);
  const second = createCardIds(entries.map((entry) => ({ ...entry })));
  assert.deepEqual(first, second);
  assert.notEqual(first[0], first[1]);
});

test("two correct results in distinct rounds rest exactly one full round", () => {
  const cardId = "alpha";
  const once = recordReview({
    learningState: {}, cardId, mode: "study", round: 1, correct: true,
  });
  const duplicate = recordReview({
    learningState: once, cardId, mode: "study", round: 1, correct: true,
  });
  assert.equal(getModeProgress(duplicate, cardId, "study").streak, 1);

  const promoted = recordReview({
    learningState: duplicate, cardId, mode: "study", round: 2, correct: true,
  });
  assert.deepEqual(getModeProgress(promoted, cardId, "study"), {
    streak: 2,
    hidden: true,
    dueRound: 4,
    lastScoredRound: 2,
  });
  assert.deepEqual(buildRoundCardIds({
    cardIds: [cardId], learningState: promoted, mode: "study", round: 3, random: almostOne,
  }), []);
  assert.deepEqual(buildRoundCardIds({
    cardIds: [cardId], learningState: promoted, mode: "study", round: 4, random: almostOne,
  }), [cardId]);
});

test("a successful return rests again and a failure releases only that mode", () => {
  const cardId = "alpha";
  const learningState = {
    [cardId]: {
      study: { streak: 2, hidden: true, dueRound: 4, lastScoredRound: 2 },
      spell: { streak: 2, hidden: true, dueRound: 4, lastScoredRound: 2 },
    },
  };
  const returned = recordReview({
    learningState, cardId, mode: "study", round: 4, correct: true,
  });
  assert.equal(getModeProgress(returned, cardId, "study").dueRound, 6);

  const lapsed = recordReview({
    learningState: returned, cardId, mode: "study", round: 6, correct: false,
  });
  assert.equal(getModeProgress(lapsed, cardId, "study").hidden, false);
  assert.equal(getModeProgress(lapsed, cardId, "study").streak, 0);
  assert.equal(getModeProgress(lapsed, cardId, "spell").hidden, true);
  assert.equal(getModeProgress(lapsed, cardId, "spell").dueRound, 4);
});

test("every due card returns without a proportional cap", () => {
  const dueIds = ["a", "b", "c", "d", "e"];
  const learningState = Object.fromEntries(
    dueIds.map((cardId) => [cardId, { spell: { hidden: true, dueRound: 3 } }]),
  );
  assert.deepEqual(
    buildRoundCardIds({
      cardIds: dueIds,
      learningState,
      mode: "spell",
      round: 3,
      random: almostOne,
    }),
    dueIds,
  );
});

test("new queues avoid the last card when an alternative exists", () => {
  const queue = buildRoundCardIds({
    cardIds: ["a", "b", "c"],
    mode: "study",
    round: 1,
    avoidFirstCardId: "a",
    random: almostOne,
  });
  assert.notEqual(queue[0], "a");
  assert.deepEqual([...queue].sort(), ["a", "b", "c"]);
  assert.deepEqual(
    buildRoundCardIds({
      cardIds: ["a"], mode: "study", round: 1, avoidFirstCardId: "a", random: almostOne,
    }),
    ["a"],
  );
});

test("review navigation returns only unscored cards", () => {
  const queueIds = ["a", "b", "c"];
  const learningState = {
    a: { study: { lastScoredRound: 2 } },
    b: { study: { lastScoredRound: 2 } },
  };
  assert.equal(findNextUnscoredCardIndex({
    queueIds, currentIndex: 0, learningState, mode: "study", round: 2,
  }), 2);
});

test("usage examples keep one sentence per supplied usage", () => {
  const examples = [
    { usage: "place", sentence: "one" },
    { usage: "place", sentence: "two" },
    { usage: "job", sentence: "three" },
  ];
  assert.deepEqual(selectExamples(examples), [examples[0], examples[2]]);
  assert.deepEqual(selectExamples([{ sentence: "one" }, { sentence: "two" }]), [{ sentence: "one" }]);
});

test("export keeps source order, unknown fields, resting cards, and every example", () => {
  const sourceDeck = [
    { ...deck[0], extra: "kept", examples: [{ sentence: "1" }, { sentence: "2" }, { sentence: "3" }, { sentence: "4" }] },
    deck[1],
  ];
  const ids = createCardIds(sourceDeck);
  const exported = buildExportDeck(sourceDeck, [ids[1]]);
  assert.equal(exported.length, 1);
  assert.equal(exported[0], sourceDeck[0]);
  assert.equal(exported[0].extra, "kept");
  assert.equal(exported[0].examples.length, 4);
});

test("study completion goes directly to spelling and wrong correction cannot overwrite first score", () => {
  let state = createInitialState({ assets: { sourceDeck: [deck[0]], removedCardIds: [] }, random: almostOne });
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
  assert.equal(state.revealed, true);
  assert.equal(state.studyResult, true);
  assert.deepEqual(state.learningState, {});
  state = learningReducer(state, { type: "ADVANCE_STUDY", correct: false, random: almostOne });
  assert.equal(state.mode, "spell");
  assert.equal(getModeProgress(state.learningState, state.studyQueueIds[0], "study").streak, 0);

  state = learningReducer(state, { type: "SET_SPELL_INPUT", value: "wrong" });
  state = learningReducer(state, { type: "SUBMIT_SPELL" });
  assert.equal(state.spellResult, "wrong");
  assert.equal(state.spellInput, "");
  assert.equal(getModeProgress(state.learningState, state.spellQueueIds[0], "spell").streak, 0);

  state = learningReducer(state, { type: "SET_SPELL_INPUT", value: "Alpha" });
  state = learningReducer(state, { type: "SUBMIT_SPELL" });
  assert.equal(state.spellResult, "corrected");
  assert.equal(getModeProgress(state.learningState, state.spellQueueIds[0], "spell").streak, 0);
});

test("empty first spelling submission records a failure and reveals the retry state", () => {
  let state = createInitialState({ assets: { sourceDeck: [deck[0]], removedCardIds: [] }, random: almostOne });
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
  state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  state = learningReducer(state, { type: "SUBMIT_SPELL" });
  assert.equal(state.spellResult, "wrong");
  assert.equal(state.spellInput, "");
  assert.equal(getModeProgress(state.learningState, state.spellQueueIds[0], "spell").streak, 0);
});

test("pause preserves one spell queue, clears half input, and can resume after recognition", () => {
  const ids = createCardIds(deck);
  let state = {
    ...createInitialState({ assets: { sourceDeck: deck, removedCardIds: [] }, random: almostOne }),
    mode: "spell",
    spellQueueIds: ids,
    spellIndex: 1,
    spellInput: "Be",
    spellResult: null,
  };
  state = learningReducer(state, { type: "PAUSE_SPELL" });
  assert.equal(state.mode, "pause");
  assert.equal(state.spellInput, "");
  assert.deepEqual(state.spellQueueIds, ids);

  const resumed = learningReducer(state, { type: "RESUME_SPELL" });
  assert.equal(resumed.mode, "spell");
  assert.equal(resumed.spellIndex, 1);

  const studying = learningReducer(state, { type: "PAUSE_TO_STUDY", random: almostOne });
  assert.equal(studying.mode, "study");
  assert.equal(studying.pausedSpell, true);
  const afterFirst = learningReducer(learningReducer(studying, { type: "CHOOSE_STUDY", correct: true }), {
    type: "ADVANCE_STUDY", random: almostOne,
  });
  const afterSecond = learningReducer(learningReducer(afterFirst, { type: "CHOOSE_STUDY", correct: true }), {
    type: "ADVANCE_STUDY", random: almostOne,
  });
  assert.equal(afterSecond.mode, "spell");
  assert.deepEqual(afterSecond.spellQueueIds, ids);
  assert.equal(afterSecond.spellIndex, 1);
});

test("one-card and two-card all-resting states advance empty rounds with a bounded transition", () => {
  for (const size of [1, 2]) {
    const selectedDeck = deck.slice(0, size);
    const cardIds = createCardIds(selectedDeck);
    const lastIndex = cardIds.length - 1;
    const base = createInitialState({
      assets: { sourceDeck: selectedDeck, removedCardIds: [] },
      random: almostOne,
    });
    const state = {
      ...base,
      mode: "spell",
      completedRounds: { study: 2, spell: 1 },
      spellQueueIds: cardIds,
      spellIndex: lastIndex,
      learningState: Object.fromEntries(cardIds.map((cardId, index) => [
        cardId,
        {
          study: { streak: 2, hidden: true, dueRound: 4, lastScoredRound: 2 },
          spell: index === lastIndex
            ? { streak: 1, hidden: false, dueRound: null, lastScoredRound: 1 }
            : { streak: 2, hidden: true, dueRound: 4, lastScoredRound: 2 },
        },
      ])),
      spellInput: selectedDeck[lastIndex].term,
      spellResult: null,
    };
    const submitted = learningReducer(state, { type: "SUBMIT_SPELL" });
    const next = learningReducer(submitted, { type: "ADVANCE_SPELL", random: almostOne });
    assert.equal(next.mode, "study");
    assert.deepEqual(new Set(next.studyQueueIds), new Set(cardIds));
    assert.equal(next.completedRounds.study, 3);
    assert.equal(next.completedRounds.spell, 3);
  }
});

test("removing and restoring the last card enters and leaves the explicit empty state", () => {
  let state = createInitialState({ assets: { sourceDeck: [deck[0]], removedCardIds: [] }, random: almostOne });
  const cardId = state.studyQueueIds[0];
  state = learningReducer(state, { type: "REMOVE_CURRENT", random: almostOne });
  assert.equal(state.mode, "empty");
  state = learningReducer(state, { type: "RESTORE_REMOVED", cardId, random: almostOne });
  assert.equal(state.mode, "study");
  assert.deepEqual(state.studyQueueIds, [cardId]);
  assert.deepEqual(getModeProgress(state.learningState, cardId, "study"), {
    streak: 0, hidden: false, dueRound: null, lastScoredRound: null,
  });
});

test("ordinary answers do not overwrite the one management undo slot", () => {
  let state = createInitialState({ assets: { sourceDeck: deck, removedCardIds: [] }, random: almostOne });
  state = learningReducer(state, { type: "REMOVE_CURRENT", random: almostOne });
  const undo = state.undo;
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
  state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  assert.equal(state.undo, undo);
  state = learningReducer(state, { type: "UNDO" });
  assert.equal(state.removedCardIds.length, 0);
});
