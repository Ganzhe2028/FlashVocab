import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoundCardIds,
  createCardIds,
  findNextUnscoredCardIndex,
  getModeProgress,
  recordReview,
  restoreQueue,
} from "./learningAlgorithm.js";

const alwaysLow = () => 0;
const alwaysHigh = () => 0.99;

test("duplicate terms receive independent stable IDs", () => {
  const entries = [
    { term: "Same", pos: "adj.", meaning: "equal" },
    { term: "Same", pos: "adj.", meaning: "equal" },
  ];
  const first = createCardIds(entries);
  const second = createCardIds(entries.map((entry) => ({ ...entry })));

  assert.deepEqual(first, second);
  assert.notEqual(first[0], first[1]);
});

test("two correct reviews hide only the scored mode after the current round", () => {
  let state = {};
  for (let round = 1; round <= 2; round += 1) {
    state = recordReview({
      learningState: state,
      cardId: "a",
      mode: "study",
      round,
      correct: true,
      random: alwaysLow,
    });
  }

  assert.equal(getModeProgress(state, "a", "study").streak, 2);
  assert.equal(getModeProgress(state, "a", "study").hidden, true);
  assert.equal(getModeProgress(state, "a", "study").dueRound, 4);
  assert.equal(getModeProgress(state, "a", "spell").hidden, false);
});

test("a two-round gap returns on current round plus three", () => {
  let state = {};
  for (let round = 1; round <= 2; round += 1) {
    state = recordReview({
      learningState: state,
      cardId: "a",
      mode: "spell",
      round,
      correct: true,
      random: alwaysHigh,
    });
  }

  assert.equal(getModeProgress(state, "a", "spell").dueRound, 5);
});

test("one spelling success links both modes when recognition is hidden", () => {
  const state = recordReview({
    learningState: {
      a: {
        study: {
          streak: 2,
          hidden: true,
          dueRound: 5,
          skipRounds: 2,
        },
      },
    },
    cardId: "a",
    mode: "spell",
    round: 1,
    correct: true,
    random: alwaysLow,
  });

  const spell = getModeProgress(state, "a", "spell");
  assert.equal(spell.streak, 1);
  assert.equal(spell.hidden, true);
  assert.equal(spell.syncedWithStudy, true);
  assert.equal(spell.dueRound, 5);
  assert.equal(spell.skipRounds, 2);
});

test("recognition promotion also links an existing spelling success", () => {
  const state = recordReview({
    learningState: {
      a: {
        study: { streak: 1, lastScoredRound: 1 },
        spell: { streak: 1, lastScoredRound: 1 },
      },
    },
    cardId: "a",
    mode: "study",
    round: 2,
    correct: true,
    random: alwaysLow,
  });

  assert.equal(getModeProgress(state, "a", "study").hidden, true);
  assert.equal(getModeProgress(state, "a", "spell").hidden, true);
  assert.equal(getModeProgress(state, "a", "spell").syncedWithStudy, true);
});

test("linked spelling returns only after recognition actually returned", () => {
  const baseState = {
    a: {
      study: { hidden: true, dueRound: 3, lastReturnedRound: null },
      spell: {
        hidden: true,
        dueRound: 3,
        syncedWithStudy: true,
        lastSyncedStudyRound: null,
      },
    },
  };
  const beforeStudyReturn = buildRoundCardIds({
    cardIds: ["active", "a"],
    learningState: baseState,
    mode: "spell",
    round: 20,
    studyRound: 3,
    shuffleOnLoop: false,
    random: alwaysLow,
  });
  assert.deepEqual(beforeStudyReturn, ["active"]);

  const afterStudyReturn = buildRoundCardIds({
    cardIds: ["active", "a"],
    learningState: {
      ...baseState,
      a: {
        ...baseState.a,
        study: {
          ...baseState.a.study,
          dueRound: 5,
          lastReturnedRound: 3,
        },
      },
    },
    mode: "spell",
    round: 20,
    studyRound: 3,
    shuffleOnLoop: false,
    random: alwaysLow,
  });
  assert.deepEqual(afterStudyReturn, ["active", "a"]);
});

test("a recognition lapse releases a linked spelling card", () => {
  const state = recordReview({
    learningState: {
      a: {
        study: { streak: 2, hidden: true, dueRound: 3 },
        spell: { streak: 1, hidden: true, syncedWithStudy: true },
      },
    },
    cardId: "a",
    mode: "study",
    round: 3,
    correct: false,
  });

  assert.equal(getModeProgress(state, "a", "study").hidden, false);
  assert.equal(getModeProgress(state, "a", "spell").hidden, false);
  assert.equal(getModeProgress(state, "a", "spell").syncedWithStudy, false);
});

test("the same card can only score once per mode and round", () => {
  const once = recordReview({
    learningState: {},
    cardId: "a",
    mode: "study",
    round: 1,
    correct: true,
    random: alwaysLow,
  });
  const twice = recordReview({
    learningState: once,
    cardId: "a",
    mode: "study",
    round: 1,
    correct: true,
    random: alwaysLow,
  });

  assert.deepEqual(twice, once);
  assert.equal(getModeProgress(twice, "a", "study").streak, 1);
});

test("simple mode completes rounds without changing familiarity progress", () => {
  const previous = {
    a: {
      study: {
        streak: 3,
        hidden: true,
        dueRound: 8,
        lapseCount: 1,
      },
    },
  };
  const next = recordReview({
    learningState: previous,
    cardId: "a",
    mode: "study",
    round: 4,
    correct: false,
    familiarModeEnabled: false,
  });

  assert.equal(next.a.study.streak, 3);
  assert.equal(next.a.study.hidden, true);
  assert.equal(next.a.study.dueRound, 8);
  assert.equal(next.a.study.lapseCount, 1);
  assert.equal(next.a.study.lastScoredRound, 4);
});

test("round completion waits for cards skipped by previous navigation", () => {
  const queueIds = ["a", "b", "c", "d"];
  const learningState = {
    d: { study: { lastScoredRound: 1 } },
  };

  assert.equal(
    findNextUnscoredCardIndex({
      queueIds,
      currentIndex: 3,
      learningState,
      mode: "study",
      round: 1,
    }),
    0,
  );
  assert.equal(
    findNextUnscoredCardIndex({
      queueIds,
      currentIndex: 2,
      learningState: {
        a: { study: { lastScoredRound: 1 } },
        b: { study: { lastScoredRound: 1 } },
        d: { study: { lastScoredRound: 1 } },
      },
      mode: "study",
      round: 1,
    }),
    -1,
  );
});

test("a lapse resets only the failed mode", () => {
  let state = {
    a: {
      study: { streak: 3 },
      spell: { streak: 4, hidden: true, dueRound: 8 },
    },
  };
  state = recordReview({
    learningState: state,
    cardId: "a",
    mode: "study",
    round: 4,
    correct: false,
  });

  assert.equal(getModeProgress(state, "a", "study").streak, 0);
  assert.equal(getModeProgress(state, "a", "study").hidden, false);
  assert.equal(getModeProgress(state, "a", "spell").hidden, true);
});

test("returning cards are capped at one quarter of the final normal queue", () => {
  const active = Array.from({ length: 12 }, (_, index) => `active-${index}`);
  const due = Array.from({ length: 7 }, (_, index) => `due-${index}`);
  const learningState = Object.fromEntries(
    due.map((cardId) => [
      cardId,
      { study: { hidden: true, dueRound: 2 } },
    ]),
  );

  const queue = buildRoundCardIds({
    cardIds: [...active, ...due],
    learningState,
    mode: "study",
    round: 2,
    shuffleOnLoop: false,
    random: alwaysLow,
  });

  const returned = queue.filter((cardId) => cardId.startsWith("due-"));
  assert.equal(returned.length, 4);
  assert.equal(queue.length, 16);
});

test("overdue cards remain eligible and older due rounds take priority", () => {
  const queue = buildRoundCardIds({
    cardIds: ["active-1", "active-2", "active-3", "old", "new"],
    learningState: {
      old: { study: { hidden: true, dueRound: 2 } },
      new: { study: { hidden: true, dueRound: 4 } },
    },
    mode: "study",
    round: 5,
    shuffleOnLoop: false,
    random: alwaysHigh,
  });

  assert.ok(queue.includes("old"));
  assert.ok(!queue.includes("new"));
});

test("small active queues still return one card to avoid starvation", () => {
  const queue = buildRoundCardIds({
    cardIds: ["active-1", "active-2", "due"],
    learningState: {
      due: { study: { hidden: true, dueRound: 2 } },
    },
    mode: "study",
    round: 2,
    shuffleOnLoop: false,
    random: alwaysLow,
  });

  assert.deepEqual(queue, ["active-1", "active-2", "due"]);
});

test("a due-only round returns a quarter of the pool with a minimum of one", () => {
  const due = ["a", "b", "c", "d", "e"];
  const learningState = Object.fromEntries(
    due.map((cardId) => [
      cardId,
      { spell: { hidden: true, dueRound: 3 } },
    ]),
  );
  const queue = buildRoundCardIds({
    cardIds: due,
    learningState,
    mode: "spell",
    round: 3,
    random: alwaysLow,
  });

  assert.equal(queue.length, 1);
});

test("simple mode includes hidden cards without applying return caps", () => {
  const queue = buildRoundCardIds({
    cardIds: ["active", "hidden-1", "hidden-2"],
    learningState: {
      "hidden-1": { study: { hidden: true, dueRound: 99 } },
      "hidden-2": { study: { hidden: true, dueRound: 2 } },
    },
    mode: "study",
    round: 2,
    familiarModeEnabled: false,
    shuffleOnLoop: false,
  });

  assert.deepEqual(queue, ["active", "hidden-1", "hidden-2"]);
});

test("a new round avoids the last presented card when alternatives exist", () => {
  const queue = buildRoundCardIds({
    cardIds: ["a", "b", "c"],
    learningState: {},
    mode: "study",
    round: 2,
    shuffleOnLoop: false,
    avoidFirstCardId: "a",
    random: alwaysLow,
  });

  assert.deepEqual(queue, ["b", "a", "c"]);
});

test("restoreQueue drops missing IDs and preserves the requested order", () => {
  const sourceDeck = [{ term: "A" }, { term: "B" }, { term: "C" }];

  assert.deepEqual(
    restoreQueue(sourceDeck, ["a", "b", "c"], ["c", "missing", "a"]),
    [sourceDeck[2], sourceDeck[0]],
  );
  assert.deepEqual(restoreQueue(sourceDeck, ["a", "b", "c"], null), []);
});
