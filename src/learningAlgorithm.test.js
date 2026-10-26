import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExportDeck,
  buildRoundCardIds,
  createCardIds,
  createInitialState,
  getCurrentStudyCardId,
  findNextUnscoredCardIndex,
  getModeProgress,
  learningReducer,
  recordReview,
  selectExamples,
} from "./learningAlgorithm.js";

const almostOne = () => 0.999999;
const createSpellingState = (options) => ({ ...createInitialState(options), spellingMode: "all" });
const deck = [
  { term: "Alpha", pos: "n.", meaning: "first", meaningZh: "第一" },
  { term: "Beta", pos: "n.", meaning: "second", meaningZh: "第二" },
];

test("quick-known is opt-in and commits once through normal scoring, rest, and summary paths", () => {
  let state = createInitialState({ assets: { sourceDeck: deck }, random: almostOne });
  assert.equal(state.quickKnownEnabled, false);
  state = learningReducer(state, { type: "SET_QUICK_KNOWN", value: true });
  const first = getCurrentStudyCardId(state);
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true, now: 100, random: almostOne });
  assert.equal(state.revealed, false);
  assert.notEqual(getCurrentStudyCardId(state), first);
  assert.equal(state.mastery[first].streak, 1);
  assert.equal(state.learningState[first].study.lastScoredRound, 1);
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: "fuzzy" });
  assert.equal(state.revealed, true);
  state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  assert.equal(state.mode, "summary");
  assert.equal(state.roundSummary.study.correct, 1);
  assert.equal(state.roundSummary.study.fuzzy, 1);
  assert.equal(learningReducer(state, { type: "RESET_PROGRESS", random: almostOne }).quickKnownEnabled, false);
});

test("spelling defaults off and recognition ends at a summary before another study round", () => {
  let state = createInitialState({ assets: { sourceDeck: [deck[0]] }, random: almostOne });
  assert.equal(state.spellingMode, "off");
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
  state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  assert.equal(state.mode, "summary");
  assert.equal(state.roundNextMode, "study");
  assert.equal(state.roundSummary.study.correct, 1);
  assert.equal(state.roundSummary.spell.total, 0);
});

test("mistakes-only spelling includes unknown and fuzzy words while excluding known words", () => {
  const sourceDeck = [...deck, { term: "Gamma" }];
  let state = createInitialState({ assets: { sourceDeck }, random: almostOne });
  state = learningReducer(state, { type: "SET_SPELLING_MODE", value: "mistakes" });
  const ids = createCardIds(sourceDeck);
  const results = new Map([[ids[0], true], [ids[1], "fuzzy"], [ids[2], false]]);
  for (let attempt = 0; attempt < 10 && state.mode === "study"; attempt += 1) {
    const correct = state.studyPracticeId ? true : results.get(getCurrentStudyCardId(state));
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  }
  assert.equal(state.mode, "spell");
  assert.deepEqual(new Set(state.spellQueueIds), new Set(ids.slice(1)));
});

test("preparation navigation retains the spelling queue, input, score, and Undo slot", () => {
  const initial = createSpellingState({ assets: { sourceDeck: deck }, random: almostOne });
  const studying = learningReducer(initial, { type: "REMOVE_CURRENT" });
  const state = { ...studying, mode: "spell", spellInput: "Al", spellResult: "retrying" };
  const prepared = learningReducer(state, { type: "OPEN_PREPARE" });
  assert.equal(prepared.mode, "prepare");
  assert.deepEqual(learningReducer(prepared, { type: "CONTINUE_LEARNING" }), {
    ...state, resumeMode: null,
  });
});

test("live quiz scores one selection per question and returns to the retained learning scene", () => {
  const original = createInitialState({ assets: { sourceDeck: deck }, random: almostOne });
  let state = learningReducer(original, { type: "START_QUIZ", random: almostOne });
  assert.equal(state.mode, "quiz");
  state = learningReducer(state, { type: "ANSWER_QUIZ", answer: "invalid" });
  assert.equal(state.quiz.results.length, 0);
  for (let index = 0; index < deck.length; index += 1) {
    state = learningReducer(state, { type: "ANSWER_QUIZ", answer: state.quiz.question.answer });
    state = learningReducer(state, { type: "ANSWER_QUIZ", answer: state.quiz.question.answer });
    assert.equal(state.quiz.results.length, index + 1);
    state = learningReducer(state, { type: "NEXT_QUIZ", random: almostOne });
  }
  assert.equal(state.quiz.finished, true);
  const returned = learningReducer(state, { type: "END_QUIZ" });
  assert.deepEqual(returned, { ...original, mastery: state.mastery });
  assert.equal(Object.values(returned.mastery).every((progress) => progress.streak === 1), true);
});

test("stable IDs distinguish identical duplicate entries", () => {
  const entries = [deck[0], { ...deck[0] }, deck[1]];
  const first = createCardIds(entries);
  const second = createCardIds(entries.map((entry) => ({ ...entry })));
  assert.deepEqual(first, second);
  assert.notEqual(first[0], first[1]);
});

test("applying material remaps identity-derived mastery and preserves removed words with Undo", () => {
  const sourceDeck = [{ term: "alpha" }, { term: "beta" }];
  const [alphaId, betaId] = createCardIds(sourceDeck);
  const state = createInitialState({ assets: { sourceDeck, removedCardIds: [betaId] }, mastery: {
    [alphaId]: { streak: 1, mistakes: 2, fuzzy: 0, lastSeen: 1234 },
  } });
  const prepared = learningReducer(state, { type: "APPLY_PREPARATION", entries: [
    { cardId: alphaId, entry: { ...sourceDeck[0], meaning: "first", microScene: "队伍最前面的一张卡。" } },
  ] });
  const [newId] = createCardIds(prepared.sourceDeck);
  assert.notEqual(newId, alphaId);
  assert.deepEqual(prepared.mastery[newId], state.mastery[alphaId]);
  assert.deepEqual(prepared.removedCardIds, [betaId]);
  const undone = learningReducer(prepared, { type: "UNDO" });
  assert.deepEqual(undone.sourceDeck, state.sourceDeck);
  assert.deepEqual(undone.mastery, state.mastery);
});

test("fuzzy judgment reveals compact content and never earns a correct streak", () => {
  let state = createSpellingState({ assets: { sourceDeck: deck }, random: almostOne });
  const cardId = state.studyQueueIds[0];
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: "fuzzy" });
  assert.equal(state.studyResult, "fuzzy");
  assert.equal(state.answerExpanded, true);
  assert.equal(state.insightsExpanded, false);
  state = learningReducer(state, { type: "ADVANCE_STUDY" });
  assert.equal(getModeProgress(state.learningState, cardId, "study").streak, 0);
});

test("unknown cards return twice in the same round without extra scoring or endless scheduling", () => {
  const sourceDeck = Array.from({ length: 6 }, (_, index) => ({ term: `Word${index}` }));
  let state = createSpellingState({ assets: { sourceDeck }, random: almostOne });
  const unknownId = getCurrentStudyCardId(state);
  const exposures = [];
  for (let step = 0; step < 15 && state.mode === "study"; step += 1) {
    exposures.push(getCurrentStudyCardId(state));
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct: step === 0 ? false : true });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  }
  assert.equal(state.mode, "spell");
  assert.equal(exposures.length, 8);
  assert.deepEqual(exposures.flatMap((id, index) => id === unknownId ? [index] : []), [0, 4, 7]);
  assert.equal(getModeProgress(state.learningState, unknownId, "study").streak, 0);
  assert.equal(state.completedRounds.study, 1);
});

test("a one-word unknown deck drains its two practices in bounded steps", () => {
  let state = createSpellingState({ assets: { sourceDeck: [deck[0]] }, random: almostOne });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal(state.mode, "study");
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct: false });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  }
  assert.equal(state.mode, "spell");
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

test("study completes its two practices before spelling and correction cannot overwrite first score", () => {
  let state = createSpellingState({ assets: { sourceDeck: [deck[0]], removedCardIds: [] }, random: almostOne });
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
  assert.equal(state.revealed, true);
  assert.equal(state.studyResult, true);
  assert.deepEqual(state.learningState, {});
  state = learningReducer(state, { type: "ADVANCE_STUDY", correct: false, random: almostOne });
  for (let practice = 0; practice < 2; practice += 1) {
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  }
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
  let state = createSpellingState({ assets: { sourceDeck: [deck[0]], removedCardIds: [] }, random: almostOne });
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
    ...createSpellingState({ assets: { sourceDeck: deck, removedCardIds: [] }, random: almostOne }),
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
    const base = createSpellingState({
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
    assert.equal(next.mode, "summary");
    assert.equal(next.roundNextMode, "study");
    assert.equal(next.roundSummary.spell.total, cardIds.length);
    assert.equal(learningReducer(next, { type: "CONTINUE_ROUND" }).mode, "study");
    assert.deepEqual(new Set(next.studyQueueIds), new Set(cardIds));
    assert.equal(next.completedRounds.study, 3);
    assert.equal(next.completedRounds.spell, 3);
  }
});

test("removing and restoring the last card enters and leaves the explicit empty state", () => {
  let state = createSpellingState({ assets: { sourceDeck: [deck[0]], removedCardIds: [] }, random: almostOne });
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
  let state = createSpellingState({ assets: { sourceDeck: deck, removedCardIds: [] }, random: almostOne });
  state = learningReducer(state, { type: "REMOVE_CURRENT", random: almostOne });
  const undo = state.undo;
  state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
  state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  assert.equal(state.undo, undo);
  state = learningReducer(state, { type: "UNDO" });
  assert.equal(state.removedCardIds.length, 0);
});

test("reviewing a scored word preserves the first fuzzy judgment in round statistics", () => {
  let state = createInitialState({ assets: { sourceDeck: deck }, random: almostOne });
  const choose = (correct) => {
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  };
  choose("fuzzy");
  state = learningReducer(state, { type: "PREVIOUS_STUDY" });
  choose(true);
  choose(true);
  assert.equal(state.mode, "summary");
  assert.deepEqual(state.roundSummary.study, { total: 2, correct: 1, fuzzy: 1, unknown: 0 });
});

test("removing the last practice ends the recognition round and Undo restores that practice", () => {
  let state = createInitialState({ assets: { sourceDeck: deck }, random: almostOne });
  const removedId = getCurrentStudyCardId(state);
  for (const correct of [false, true]) {
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
  }
  assert.equal(state.studyPracticeId, removedId);
  state = learningReducer(state, { type: "REMOVE_CURRENT", random: almostOne });
  assert.equal(state.mode, "summary");
  assert.equal(state.roundSummary.study.total, 1);
  const undone = learningReducer(state, { type: "UNDO" });
  assert.equal(undone.mode, "study");
  assert.equal(undone.studyPracticeId, removedId);
});

test("removing another recognition word retains the paused spelling card and first result", () => {
  const sourceDeck = [...deck, { term: "Gamma" }];
  const ids = createCardIds(sourceDeck);
  const state = { ...createSpellingState({ assets: { sourceDeck }, random: almostOne }),
    spellQueueIds: ids, spellIndex: 1, spellResult: "wrong", pausedSpell: true,
  };
  const next = learningReducer(state, { type: "REMOVE_CURRENT", random: almostOne });
  assert.equal(next.spellQueueIds[next.spellIndex], ids[1]);
  assert.equal(next.spellResult, "wrong");
});

test("removing the last pending spelling card settles without asking a scored word again", () => {
  const ids = createCardIds(deck);
  const state = { ...createSpellingState({ assets: { sourceDeck: deck }, random: almostOne }),
    mode: "spell", spellQueueIds: ids, spellIndex: 1,
    learningState: { [ids[0]]: { spell: { streak: 1, lastScoredRound: 1 } } },
  };
  const next = learningReducer(state, { type: "REMOVE_CURRENT", random: almostOne });
  assert.equal(next.mode, "summary");
  assert.equal(next.roundSummary.spell.total, 1);
  assert.equal(next.roundSummary.spell.correct, 1);
});

test("graduation never discards an opted-in or paused spelling queue", () => {
  const sourceDeck = [deck[0]];
  const [cardId] = createCardIds(sourceDeck);
  for (const pausedSpell of [false, true]) {
    let state = { ...createSpellingState({ assets: { sourceDeck }, random: almostOne }),
      mastery: { [cardId]: { streak: 2, mistakes: 0, fuzzy: 0, lastSeen: 1234 } },
      pausedSpell, spellQueueIds: pausedSpell ? [cardId] : [], spellIndex: 0,
    };
    state = learningReducer(state, { type: "CHOOSE_STUDY", correct: true });
    state = learningReducer(state, { type: "ADVANCE_STUDY", random: almostOne });
    assert.equal(state.mode, "spell");
    assert.deepEqual(state.spellQueueIds, [cardId]);
    assert.equal(state.mastery[cardId].streak, 3);
  }
});
