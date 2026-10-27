import { buildQuestion } from "./questionBuilder.js";
import { compareMastery, getMastery, isGraduated, masteryPriority, recordMastery, summarizeMastery } from "./mastery.js";
import { createWave, getEntryWaveId, LEGACY_WAVE_ID, normalizeWaves } from "./waveModel.js";

const hashText = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const createCardIds = (entries) => {
  const occurrences = new Map();
  return entries.map((entry) => {
    const signature = [entry?.term, entry?.pos, entry?.meaning, entry?.meaningZh]
      .concat(entry?.waveId && entry.waveId !== LEGACY_WAVE_ID ? [entry.waveId] : [])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .join("\u001f");
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    return `card-${hashText(signature)}-${occurrence}`;
  });
};

export const createModeProgress = () => ({
  streak: 0,
  hidden: false,
  dueRound: null,
  lastScoredRound: null,
});

export const getModeProgress = (learningState, cardId, mode) => ({
  ...createModeProgress(),
  ...(learningState?.[cardId]?.[mode] ?? {}),
});

export const recordReview = ({ learningState, cardId, mode, round, correct }) => {
  const previousCard = learningState?.[cardId] ?? {};
  const previous = getModeProgress(learningState, cardId, mode);
  if (previous.lastScoredRound === round) return learningState;

  const shouldRest = previous.hidden || previous.streak + 1 >= 2;
  const next = correct
    ? {
        streak: previous.hidden ? Math.max(previous.streak, 2) : previous.streak + 1,
        hidden: shouldRest,
        dueRound: shouldRest ? round + 2 : null,
        lastScoredRound: round,
      }
    : {
        streak: 0,
        hidden: false,
        dueRound: null,
        lastScoredRound: round,
      };

  return {
    ...learningState,
    [cardId]: { ...previousCard, [mode]: next },
  };
};

const shuffle = (values, random) => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

export const buildRoundCardIds = ({
  cardIds,
  removedCardIds = [],
  learningState = {},
  mastery = {},
  mode,
  round,
  avoidFirstCardId = null,
  random = Math.random,
}) => {
  const removed = new Set(removedCardIds);
  const queue = shuffle(
    cardIds.filter((cardId) => {
      if (removed.has(cardId)) return false;
      if (mode === "study" && isGraduated(mastery, cardId)) return false;
      const progress = getModeProgress(learningState, cardId, mode);
      return !progress.hidden || progress.dueRound <= round;
    }),
    random,
  );
  if (mode === "study") queue.sort((first, second) => compareMastery(mastery, first, second));

  if (queue.length > 1 && queue[0] === avoidFirstCardId) {
    const alternatives = queue.flatMap((cardId, index) => index > 0 && (mode !== "study" ||
      masteryPriority(getMastery(mastery, cardId)) === masteryPriority(getMastery(mastery, queue[0]))) ? [index] : []);
    if (alternatives.length) {
      const swapIndex = alternatives[Math.floor(random() * alternatives.length)];
      [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
    }
  }
  return queue;
};

export const findNextUnscoredCardIndex = ({
  queueIds,
  currentIndex,
  learningState,
  mode,
  round,
}) => {
  for (let offset = 1; offset <= queueIds.length; offset += 1) {
    const candidateIndex = (currentIndex + offset) % queueIds.length;
    const progress = getModeProgress(learningState, queueIds[candidateIndex], mode);
    if (progress.lastScoredRound !== round) return candidateIndex;
  }
  return -1;
};

export const selectExamples = (examples = []) => {
  if (!Array.isArray(examples) || !examples.length) return [];
  const tagged = examples.filter((example) => String(example?.usage ?? "").trim());
  if (!tagged.length) return examples.slice(0, 1);

  const seen = new Set();
  return tagged.filter((example) => {
    const usage = String(example.usage).trim();
    if (seen.has(usage)) return false;
    seen.add(usage);
    return true;
  });
};

export const buildExportDeck = (sourceDeck, removedCardIds = []) => {
  const removed = new Set(removedCardIds);
  const cardIds = createCardIds(sourceDeck);
  return sourceDeck.filter((_, index) => !removed.has(cardIds[index]));
};

const snapshotForUndo = (state) => ({
  ...state,
  undo: null,
  notice: null,
  ...(state.mode === "prepare" && state.resumeMode ? { mode: state.resumeMode, resumeMode: null } : {}),
});

export const getCurrentStudyCardId = (state) =>
  state.studyPracticeId ?? state.studyQueueIds[state.studyIndex] ?? null;

export const advanceStudyExposure = (state, result = state.studyResult, now = Date.now()) => {
  const cardId = getCurrentStudyCardId(state);
  const round = state.completedRounds.study + 1;
  const step = (state.studySteps ?? 0) + 1;
  let practices = state.studyPractices ?? [];
  let learningState = state.learningState;
  let mastery = state.mastery;
  let studyRoundResults = state.studyRoundResults ?? {};
  if (state.studyPracticeId) {
    practices = practices.map((practice) => practice.cardId === cardId
      ? { ...practice, remaining: practice.remaining - 1, dueStep: step + 3 }
      : practice).filter((practice) => practice.remaining > 0);
  } else {
    const firstScore = getModeProgress(learningState, cardId, "study").lastScoredRound !== round;
    learningState = recordReview({ learningState, cardId, mode: "study", round, correct: result === true });
    if (firstScore) {
      mastery = recordMastery(mastery, cardId, result, now);
      studyRoundResults = { ...studyRoundResults, [cardId]: result };
    }
    if (firstScore && result === false) {
      practices = [...practices, { cardId, remaining: 2, dueStep: step + 3 }];
    }
  }
  const pendingCurrent = state.studyPracticeId &&
    getModeProgress(learningState, state.studyQueueIds[state.studyIndex], "study").lastScoredRound !== round;
  const nextIndex = pendingCurrent ? state.studyIndex : findNextUnscoredCardIndex({
    queueIds: state.studyQueueIds, currentIndex: state.studyIndex, learningState, mode: "study", round,
  });
  const practice = practices.find((entry) => entry.dueStep <= step) ??
    (nextIndex < 0 ? practices[0] : null);
  return {
    complete: nextIndex < 0 && !practice,
    next: {
      ...state,
      learningState,
      mastery,
      studyRoundResults,
      studyPractices: practices,
      studyPracticeId: practice?.cardId ?? null,
      studySteps: step,
      studyIndex: nextIndex < 0 ? state.studyIndex : nextIndex,
      revealed: false,
      studyResult: null,
      insightsExpanded: false,
      notice: null,
    },
  };
};

const createLearningSession = ({
  sourceDeck,
  removedCardIds = [],
  mastery = {},
  waves: rawWaves,
  random = Math.random,
  modeWhenEmpty = "empty",
}) => {
  const cardIds = createCardIds(sourceDeck);
  const waves = normalizeWaves(sourceDeck, rawWaves);
  const activeWaves = new Set(waves.filter((wave) => wave.status === "active").map((wave) => wave.id));
  const activeIds = cardIds.filter((id, index) => !removedCardIds.includes(id) && activeWaves.has(getEntryWaveId(sourceDeck[index])));
  const queue = buildRoundCardIds({
    cardIds: activeIds,
    removedCardIds,
    mastery,
    mode: "study",
    round: 1,
    random,
  });
  return {
    sourceDeck,
    removedCardIds,
    mastery,
    learningState: {},
    waves,
    completedRounds: { study: 0, spell: 0 },
    mode: queue.length ? "study" : activeIds.length ? "mastered" : sourceDeck.length && !activeWaves.size ? "prepare" : modeWhenEmpty,
    studyQueueIds: queue,
    studyIndex: 0,
    studySteps: 0,
    studyPractices: [],
    studyPracticeId: null,
    studyRoundResults: {},
    revealed: false,
    studyResult: null,
    spellQueueIds: [],
    spellIndex: 0,
    spellInput: "",
    spellResult: null,
    pausedSpell: false,
    autoPronounceEnabled: false,
    spellingMode: "off",
    quickKnownEnabled: false,
    insightsExpanded: false,
    undo: null,
    notice: null,
  };
};

export const createInitialState = ({ assets = null, mastery = {}, random = Math.random } = {}) => {
  if (!assets?.sourceDeck?.length) {
    return createLearningSession({
      sourceDeck: [],
      removedCardIds: [],
      mastery,
      random,
      modeWhenEmpty: "prepare",
    });
  }
  return startWaveSession({
    sourceDeck: assets.sourceDeck,
    removedCardIds: assets.removedCardIds ?? [],
    mastery,
    waves: assets.waves,
    random,
  });
};

const startWaveSession = (options) => createLearningSession(options);

export const getActiveCardIds = (state) => {
  const removed = new Set(state.removedCardIds);
  const activeWaves = new Set(normalizeWaves(state.sourceDeck, state.waves).filter((wave) => wave.status === "active").map((wave) => wave.id));
  return createCardIds(state.sourceDeck).filter((cardId, index) =>
    !removed.has(cardId) && activeWaves.has(getEntryWaveId(state.sourceDeck[index])));
};

const getActiveDeck = (state) => {
  const active = new Set(getActiveCardIds(state));
  const cardIds = createCardIds(state.sourceDeck);
  return state.sourceDeck.filter((entry, index) => active.has(cardIds[index]));
};

const moveToNextPlayableRound = (state, completedMode, random) => {
  const activeCardIds = getActiveCardIds(state);
  if (!activeCardIds.length) {
    return {
      ...state,
      mode: "empty",
      studyQueueIds: [],
      spellQueueIds: [],
      revealed: false,
      studyResult: null,
      spellInput: "",
      spellResult: null,
    };
  }

  const completedRounds = {
    ...state.completedRounds,
    [completedMode]: state.completedRounds[completedMode] + 1,
  };
  if (completedMode === "study" && state.pausedSpell && state.spellQueueIds.length) {
    return {
      ...state,
      completedRounds,
      mode: "spell",
      pausedSpell: false,
      revealed: false,
      studyResult: null,
      spellInput: "",
    };
  }
  if (activeCardIds.every((cardId) => isGraduated(state.mastery, cardId)) &&
    (completedMode === "spell" || state.spellingMode !== "all")) {
    return { ...state, completedRounds, mode: "mastered", revealed: false, studyResult: null };
  }

  const spellingEnabled = state.spellingMode !== "off";
  let targetMode = completedMode === "study" && spellingEnabled ? "spell" : "study";
  const cardIds = activeCardIds;
  const lastCardId =
    completedMode === "study"
      ? state.studyQueueIds[state.studyIndex]
      : state.spellQueueIds[state.spellIndex];

  const largestDueGap = activeCardIds.reduce((largest, cardId) => {
    return ["study", "spell"].reduce((modeLargest, mode) => {
      const progress = getModeProgress(state.learningState, cardId, mode);
      if (!progress.hidden || !Number.isFinite(progress.dueRound)) return modeLargest;
      return Math.max(modeLargest, progress.dueRound - (completedRounds[mode] + 1));
    }, largest);
  }, 0);
  const maxAttempts = Math.max(4, (largestDueGap + 2) * 2);

  for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
    const round = completedRounds[targetMode] + 1;
    const eligibleIds = targetMode === "spell" && state.spellingMode === "mistakes"
      ? cardIds.filter((cardId) => {
          const progress = getModeProgress(state.learningState, cardId, "study");
          return progress.lastScoredRound === completedRounds.study && progress.streak === 0;
        })
      : cardIds;
    const queue = buildRoundCardIds({
      cardIds: eligibleIds,
      removedCardIds: state.removedCardIds,
      learningState: state.learningState,
      mastery: state.mastery,
      mode: targetMode,
      round,
      avoidFirstCardId: lastCardId,
      random,
    });
    if (queue.length) {
      return {
        ...state,
        completedRounds,
        mode: targetMode,
        studyQueueIds: targetMode === "study" ? queue : state.studyQueueIds,
        studyIndex: targetMode === "study" ? 0 : state.studyIndex,
        studySteps: targetMode === "study" ? 0 : state.studySteps,
        studyPractices: [],
        studyPracticeId: null,
        studyRoundResults: targetMode === "study" ? {} : state.studyRoundResults,
        revealed: false,
        studyResult: null,
        spellQueueIds: targetMode === "spell" ? queue : state.spellQueueIds,
        spellIndex: targetMode === "spell" ? 0 : state.spellIndex,
        spellInput: "",
        spellResult: null,
        pausedSpell: false,
        notice: attempts > 0 ? "休息中的词已自动跨过空轮，现在继续练习。" : null,
      };
    }
    completedRounds[targetMode] = round;
    targetMode = targetMode === "study" && spellingEnabled ? "spell" : "study";
  }

  const recoveryQueue = buildRoundCardIds({
    cardIds: activeCardIds,
    mastery: state.mastery,
    mode: targetMode,
    round: completedRounds[targetMode] + 1,
    avoidFirstCardId: lastCardId,
    random,
  });
  return {
    ...state,
    completedRounds,
    mode: targetMode,
    studyQueueIds: targetMode === "study" ? recoveryQueue : state.studyQueueIds,
    studyIndex: targetMode === "study" ? 0 : state.studyIndex,
    studySteps: targetMode === "study" ? 0 : state.studySteps,
    studyPractices: [],
    studyPracticeId: null,
    studyRoundResults: targetMode === "study" ? {} : state.studyRoundResults,
    revealed: false,
    studyResult: null,
    spellQueueIds: targetMode === "spell" ? recoveryQueue : state.spellQueueIds,
    spellIndex: targetMode === "spell" ? 0 : state.spellIndex,
    spellInput: "",
    spellResult: null,
    pausedSpell: false,
    notice: "休息轮次已整理，现在继续练习。",
  };
};

const replaceWithDeck = (state, sourceDeck, random, label) => {
  const replacement = createLearningSession({ sourceDeck, mastery: state.mastery, random });
  return {
    ...replacement,
    undo: { label, snapshot: snapshotForUndo(state) },
    notice: state.sourceDeck.length ? `已换成 ${sourceDeck.length} 个词。` : `已装入 ${sourceDeck.length} 个示例词。`,
  };
};

const summarizeCycle = (state, next, completedMode) => {
  const summarize = (mode, round) => {
    const results = getActiveCardIds(state)
      .map((id) => getModeProgress(state.learningState, id, mode))
      .filter((progress) => progress.lastScoredRound === round);
    const correct = results.filter((progress) => progress.streak > 0).length;
    return { total: results.length, correct, unknown: results.length - correct };
  };
  const recognitionResults = getActiveCardIds(state).filter((cardId) =>
    Object.hasOwn(state.studyRoundResults ?? {}, cardId)).map((cardId) => state.studyRoundResults[cardId]);
  const study = recognitionResults.length ? {
    total: recognitionResults.length,
    correct: recognitionResults.filter((result) => result === true).length,
    unknown: recognitionResults.filter((result) => result === false).length,
    fuzzy: recognitionResults.filter((result) => result === "fuzzy").length,
  } : { ...summarize("study", state.completedRounds.study + (completedMode === "study" ? 1 : 0)), fuzzy: 0 };
  return {
    ...next,
    mode: "summary",
    roundNextMode: next.mode,
    roundSummary: {
      study,
      spell: completedMode === "spell" ? summarize("spell", state.completedRounds.spell + 1) : { total: 0, correct: 0, unknown: 0 },
      mastery: summarizeMastery(state.mastery, getActiveCardIds(state)),
    },
  };
};

export const learningReducer = (state, action) => {
  const random = action.random ?? Math.random;
  switch (action.type) {
    case "START_QUIZ": {
      const kind = action.kind ?? "mcq";
      const sourceDeck = getActiveDeck(state);
      const itemById = new Map(createCardIds(state.sourceDeck).map((id, index) => [id, state.sourceDeck[index]]));
      const queueIds = shuffle(getActiveCardIds(state).filter((cardId) =>
        buildQuestion({ kind, entry: itemById.get(cardId), sourceDeck, random: () => 0.5 })), random);
      if (!queueIds.length) return { ...state, notice: kind === "scenario" ? "情景题需至少两个不同词，并有包含目标词原形的例句。" : kind === "bank" ? "填搭配需要包含 target 搭配的例句，搭配必须原样出现在句中。" : kind === "contrast" ? "辨析近义词需要分界线情景。可在「词表」里用 DeepSeek 补全，或导入带这类资料的词表。" : "至少需要两个不同的词，且目标词需有释义，才能组选择题。" };
      return {
        ...state,
        mode: "quiz",
        quiz: {
          queueIds, index: 0, selected: null, results: [], finished: false,
          kind,
          returnState: state.mode === "quiz" ? state.quiz.returnState : state,
          question: buildQuestion({ kind, entry: itemById.get(queueIds[0]), sourceDeck,
            extraDeck: buildExportDeck(state.sourceDeck, state.removedCardIds), random }),
        },
        notice: null,
          };
    }
    case "ANSWER_QUIZ": {
      if (state.mode !== "quiz" || state.quiz.finished || state.quiz.selected !== null || !state.quiz.question.options.includes(action.answer)) return state;
      const quiz = state.quiz;
      const mastery = recordMastery(state.mastery, quiz.queueIds[quiz.index], action.answer === quiz.question.answer, action.now ?? Date.now());
      return { ...state, mastery, quiz: {
        ...quiz, selected: action.answer,
        results: [...quiz.results, { cardId: quiz.queueIds[quiz.index], correct: action.answer === quiz.question.answer }],
      } };
    }
    case "NEXT_QUIZ": {
      if (state.mode !== "quiz" || state.quiz.finished || state.quiz.selected === null) return state;
      const index = state.quiz.index + 1;
      if (index >= state.quiz.queueIds.length) return { ...state, quiz: { ...state.quiz, finished: true } };
      const cardId = state.quiz.queueIds[index];
      const entry = state.sourceDeck[createCardIds(state.sourceDeck).indexOf(cardId)];
      return { ...state, quiz: { ...state.quiz, index, selected: null,
        question: buildQuestion({ kind: state.quiz.kind, entry, sourceDeck: getActiveDeck(state),
          extraDeck: buildExportDeck(state.sourceDeck, state.removedCardIds), random }),
      } };
    }
    case "END_QUIZ": {
      if (state.mode !== "quiz") return state;
      const returned = { ...state.quiz.returnState, mastery: state.mastery, undo: state.undo, quickKnownEnabled: state.quickKnownEnabled };
      return returned;
    }
    case "RESTORE_GRADUATED": {
      const graduated = getActiveCardIds(state).filter((cardId) => isGraduated(state.mastery, cardId));
      if (!graduated.length) return state;
      const mastery = { ...state.mastery };
      const learningState = { ...state.learningState };
      for (const cardId of graduated) {
        mastery[cardId] = { ...getMastery(mastery, cardId), streak: 0 };
        learningState[cardId] = { ...learningState[cardId], study: createModeProgress() };
      }
      const queue = buildRoundCardIds({ cardIds: getActiveCardIds(state), removedCardIds: state.removedCardIds,
        learningState, mastery, mode: "study", round: state.completedRounds.study + 1, random });
      return { ...state, mastery, learningState, mode: "study", studyQueueIds: queue, studyIndex: 0,
        studySteps: 0, studyPractices: [], studyPracticeId: null, studyRoundResults: state.mode === "study" ? state.studyRoundResults : {}, revealed: false, studyResult: null,
        undo: { label: "撤销找回毕业词", snapshot: snapshotForUndo(state) }, notice: `已找回 ${graduated.length} 个毕业词。`,
      };
    }
    case "CONTINUE_ROUND":
      return state.mode === "summary"
        ? { ...state, mode: state.roundNextMode, roundSummary: null, roundNextMode: null }
        : state;
    case "OPEN_PREPARE":
      return state.mode === "prepare"
        ? state
        : { ...state, resumeMode: state.mode, mode: "prepare" };
    case "CONTINUE_LEARNING":
      return state.mode === "prepare" && state.resumeMode
        ? { ...state, mode: state.resumeMode, resumeMode: null }
        : state;
    case "CHOOSE_STUDY": {
      if (state.mode !== "study" || state.revealed || !state.studyQueueIds.length || typeof action.correct !== "boolean") return state;
      const chosen = {
            ...state,
            revealed: true,
            studyResult: action.correct,
                    insightsExpanded: false,
            notice: null,
          };
      return state.quickKnownEnabled && action.correct === true
        ? learningReducer(chosen, { type: "ADVANCE_STUDY", random, now: action.now })
        : chosen;
    }
    case "TOGGLE_INSIGHTS":
      return { ...state, insightsExpanded: !state.insightsExpanded };
    case "PREVIOUS_STUDY":
      if (state.mode !== "study" || !state.studyQueueIds.length) return state;
      return {
        ...state,
        studyIndex:
          (state.studyIndex - 1 + state.studyQueueIds.length) % state.studyQueueIds.length,
        studyPracticeId: null,
        revealed: false,
        studyResult: null,
        insightsExpanded: false,
      };
    case "ADVANCE_STUDY": {
      if (state.mode !== "study" || !state.revealed || state.studyResult === null) return state;
      const correct = typeof action.correct === "boolean" ? action.correct : state.studyResult;
      const { complete, next } = advanceStudyExposure(state, correct, action.now ?? Date.now());
      if (!complete) return next;
      const scheduled = moveToNextPlayableRound(next, "study", random);
      return scheduled.mode === "spell" ? scheduled : summarizeCycle(next, scheduled, "study");
    }
    case "SET_SPELL_INPUT":
      return state.mode === "spell"
        ? {
            ...state,
            spellInput: action.value,
            spellResult: state.spellResult === "wrong" ? "retrying" : state.spellResult,
          }
        : state;
    case "SUBMIT_SPELL": {
      if (state.mode !== "spell") return state;
      const cardId = state.spellQueueIds[state.spellIndex];
      const entryIndex = createCardIds(state.sourceDeck).indexOf(cardId);
      const answer = state.sourceDeck[entryIndex]?.term?.trim().toLocaleLowerCase();
      const submitted = state.spellInput.trim().toLocaleLowerCase();
      if (!submitted && state.spellResult !== null) return state;
      const isCorrect = submitted === answer;
      const round = state.completedRounds.spell + 1;

      if (state.spellResult === null) {
        return {
          ...state,
          learningState: recordReview({
            learningState: state.learningState,
            cardId,
            mode: "spell",
            round,
            correct: isCorrect,
          }),
          spellInput: isCorrect ? state.spellInput : "",
          spellResult: isCorrect ? "correct" : "wrong",
        };
      }
      return {
        ...state,
        spellInput: isCorrect ? state.spellInput : "",
        spellResult: isCorrect ? "corrected" : "wrong",
      };
    }
    case "ADVANCE_SPELL":
      if (!["correct", "corrected"].includes(state.spellResult)) return state;
      if (state.spellIndex < state.spellQueueIds.length - 1) {
        return {
          ...state,
          spellIndex: state.spellIndex + 1,
          spellInput: "",
          spellResult: null,
          notice: null,
        };
      }
      return summarizeCycle(state, moveToNextPlayableRound(state, "spell", random), "spell");
    case "PAUSE_SPELL":
      return state.mode === "spell"
        ? { ...state, mode: "pause", spellInput: "", pausedSpell: true }
        : state;
    case "RESUME_SPELL":
      return state.mode === "pause"
        ? { ...state, mode: "spell", pausedSpell: false }
        : state;
    case "PAUSE_TO_STUDY": {
      if (state.mode !== "pause") return state;
      const round = state.completedRounds.study + 1;
      const queue = buildRoundCardIds({
        cardIds: getActiveCardIds(state),
        removedCardIds: state.removedCardIds,
        learningState: state.learningState,
        mastery: state.mastery,
        mode: "study",
        round,
        avoidFirstCardId: state.spellQueueIds[state.spellIndex],
        random,
      });
      if (!queue.length) return { ...state, mode: "spell", pausedSpell: false };
      return {
        ...state,
        mode: "study",
        studyQueueIds: queue,
        studyIndex: 0,
        studySteps: 0,
        studyPractices: [],
        studyPracticeId: null,
        studyRoundResults: {},
        revealed: false,
        studyResult: null,
        pausedSpell: true,
        spellInput: "",
      };
    }
    case "ADD_WAVE": {
      const wave = createWave(state.waves, action.name, action.now ?? Date.now());
      const sourceDeck = [...state.sourceDeck, ...action.sourceDeck.map((entry) => ({ ...entry, waveId: wave.id }))];
      const waves = [...state.waves.map((previous) => ({ ...previous, status: "cold" })), wave];
      return {
        ...startWaveSession({ sourceDeck, waves, removedCardIds: state.removedCardIds, mastery: state.mastery, random }, action.now ?? Date.now()),
        undo: { label: "撤销新增词表", snapshot: snapshotForUndo(state) },
        notice: state.waves.length
          ? `已新增 ${wave.name}，${action.sourceDeck.length} 个词；之前的词表已收起，可随时切回。`
          : `已新增 ${wave.name}，${action.sourceDeck.length} 个词。`,
      };
    }
    case "APPLY_PREPARATION": {
      const oldIds = createCardIds(state.sourceDeck);
      const active = new Set(getActiveCardIds(state));
      const updates = new Map((action.entries ?? []).filter(({ cardId }) => active.has(cardId)).map(({ cardId, entry }) => [cardId, entry]));
      if (!updates.size) return state;
      const sourceDeck = state.sourceDeck.map((entry, index) => updates.has(oldIds[index])
        ? { ...entry, ...updates.get(oldIds[index]), term: entry.term, waveId: entry.waveId } : entry);
      const newIds = createCardIds(sourceDeck);
      const idMap = new Map(oldIds.map((cardId, index) => [cardId, newIds[index]]));
      const mastery = Object.fromEntries(Object.entries(state.mastery).map(([cardId, progress]) => [idMap.get(cardId) ?? cardId, progress]));
      const removedCardIds = state.removedCardIds.map((cardId) => idMap.get(cardId) ?? cardId);
      return {
        ...createLearningSession({ sourceDeck, waves: state.waves, removedCardIds, mastery, random }),
        autoPronounceEnabled: state.autoPronounceEnabled, spellingMode: state.spellingMode, quickKnownEnabled: state.quickKnownEnabled,
        undo: { label: "撤销补全", snapshot: snapshotForUndo(state) }, notice: `已补齐 ${updates.size} 词资料，从新一轮认词继续。`,
      };
    }
    case "RENAME_WAVE": {
      const name = String(action.name ?? "").trim().slice(0, 40);
      if (!name || !state.waves.some((wave) => wave.id === action.waveId) ||
        state.waves.find((wave) => wave.id === action.waveId).name === name) return state;
      return {
        ...state,
        waves: state.waves.map((wave) => wave.id === action.waveId ? { ...wave, name } : wave),
        undo: { label: "撤销改名", snapshot: snapshotForUndo(state) },
        notice: "词表已改名。",
      };
    }
    case "SELECT_WAVE":
    case "COLD_WAVE":
    case "REVIVE_ALL_WAVES": {
      if (action.type !== "REVIVE_ALL_WAVES" && !state.waves.some((wave) => wave.id === action.waveId)) return state;
      const waves = state.waves.map((wave) => ({ ...wave, status: action.type === "REVIVE_ALL_WAVES" ? "active" :
        action.type === "SELECT_WAVE" ? wave.id === action.waveId ? "active" : "cold" : wave.id === action.waveId ? "cold" : wave.status }));
      const mastery = { ...state.mastery };
      if (action.type === "REVIVE_ALL_WAVES") {
        for (const cardId of createCardIds(state.sourceDeck)) {
          if (isGraduated(mastery, cardId)) mastery[cardId] = { ...getMastery(mastery, cardId), streak: 0 };
        }
      }
      return {
        ...createLearningSession({ sourceDeck: state.sourceDeck, waves, removedCardIds: state.removedCardIds, mastery, random }),
        undo: { label: "撤销切换词表", snapshot: snapshotForUndo(state) },
        notice: action.type === "REVIVE_ALL_WAVES" ? "全部词表已恢复，开始总复习。" : "词表已更新，掌握度保留。",
      };
    }
    case "USE_SAMPLE":
      return replaceWithDeck(state, action.sourceDeck, random, "撤销恢复示例");
    case "RESET_PROGRESS": {
      const reset = createLearningSession({
        sourceDeck: state.sourceDeck,
        removedCardIds: state.removedCardIds,
        mastery: {},
        waves: state.waves,
        random,
      });
      return {
        ...reset,
        undo: { label: "撤销重置进度", snapshot: snapshotForUndo(state) },
        notice: "学习进度已重置，词表和已移出词保持不变。",
      };
    }
    case "REMOVE_CURRENT": {
      const cardId =
        state.mode === "spell"
          ? state.spellQueueIds[state.spellIndex]
          : getCurrentStudyCardId(state);
      if (!cardId) return state;
      const previous = snapshotForUndo(state);
      const removedCardIds = state.removedCardIds.includes(cardId)
        ? state.removedCardIds
        : [...state.removedCardIds, cardId];
      const studyQueueIds = state.studyQueueIds.filter((id) => id !== cardId);
      const spellQueueIds = state.spellQueueIds.filter((id) => id !== cardId);
      const previousStudyId = state.studyQueueIds[state.studyIndex];
      const previousSpellId = state.spellQueueIds[state.spellIndex];
      const studyIndex = studyQueueIds.includes(previousStudyId) ? studyQueueIds.indexOf(previousStudyId) : Math.min(state.studyIndex, Math.max(0, studyQueueIds.length - 1));
      const spellIndex = spellQueueIds.includes(previousSpellId) ? spellQueueIds.indexOf(previousSpellId) : Math.min(state.spellIndex, Math.max(0, spellQueueIds.length - 1));
      const spellCurrentRemoved = previousSpellId === cardId;
      const replacementSpellProgress = getModeProgress(state.learningState, spellQueueIds[spellIndex], "spell");
      const replacementAlreadyCompleted = spellCurrentRemoved && replacementSpellProgress.lastScoredRound === state.completedRounds.spell + 1;
      const remaining = getActiveCardIds({ ...state, removedCardIds });
      const nextState = {
        ...state,
        removedCardIds,
        studyQueueIds,
        studyPractices: (state.studyPractices ?? []).filter((practice) => practice.cardId !== cardId),
        studyPracticeId: state.studyPracticeId === cardId ? null : state.studyPracticeId,
        spellQueueIds,
        studyIndex,
        spellIndex,
        spellInput: spellCurrentRemoved ? "" : state.spellInput,
        spellResult: spellCurrentRemoved ? replacementAlreadyCompleted ? replacementSpellProgress.streak > 0 ? "correct" : "corrected" : null : state.spellResult,
        revealed: false,
        studyResult: null,
        mode: remaining.length
          ? state.mode === "spell" && spellQueueIds.length
            ? "spell"
            : "study"
          : "empty",
        undo: { label: "撤销移出单词", snapshot: previous },
        notice: "已从本词表移出。",
      };
      const finishRemovedRound = (completedMode) => {
        const scheduled = moveToNextPlayableRound(nextState, completedMode, random);
        const advanced = completedMode === "spell" || scheduled.mode !== "spell" ? summarizeCycle(nextState, scheduled, completedMode) : scheduled;
        return {
          ...advanced,
          undo: nextState.undo,
          notice: nextState.notice,
        };
      };
      if (remaining.length && state.mode === "spell" && !spellQueueIds.some((id) =>
        getModeProgress(state.learningState, id, "spell").lastScoredRound !== state.completedRounds.spell + 1)) {
        return finishRemovedRound("spell");
      }
      if (remaining.length && nextState.mode === "study") {
        const round = state.completedRounds.study + 1;
        const pending = studyQueueIds[studyIndex] && getModeProgress(state.learningState, studyQueueIds[studyIndex], "study").lastScoredRound !== round
          ? studyIndex : findNextUnscoredCardIndex({ queueIds: studyQueueIds, currentIndex: studyIndex, learningState: state.learningState, mode: "study", round });
        if (pending >= 0) nextState.studyIndex = pending;
        else if (nextState.studyPractices.length) nextState.studyPracticeId = nextState.studyPractices[0].cardId;
        else return finishRemovedRound("study");
      }
      return nextState;
    }
    case "RESTORE_REMOVED": {
      if (!state.removedCardIds.includes(action.cardId)) return state;
      const previous = snapshotForUndo(state);
      const removedCardIds = state.removedCardIds.filter((id) => id !== action.cardId);
      const learningState = {
        ...state.learningState,
        [action.cardId]: { study: createModeProgress(), spell: createModeProgress() },
      };
      const mastery = { ...state.mastery, [action.cardId]: { ...getMastery(state.mastery, action.cardId), streak: 0 } };
      if (state.mode === "empty") {
        return {
          ...state,
          removedCardIds,
          learningState,
          mastery,
          mode: "study",
          studyQueueIds: [action.cardId],
          studyIndex: 0,
          revealed: false,
          studyResult: null,
          undo: { label: "撤销找回单词", snapshot: previous },
          notice: "已找回，重新从认词开始。",
        };
      }
      return {
        ...state,
        removedCardIds,
        learningState,
        mastery,
        undo: { label: "撤销找回单词", snapshot: previous },
        notice: "已找回；下一轮会加入。",
      };
    }
    case "UNDO":
      return state.undo?.snapshot
        ? { ...state.undo.snapshot, notice: "已撤销上一次管理操作。", undo: null }
        : state;
    case "SET_AUTO_PRONOUNCE":
      return { ...state, autoPronounceEnabled: action.value };
    case "SET_SPELLING_MODE":
      return ["off", "mistakes", "all"].includes(action.value)
        ? { ...state, spellingMode: action.value }
        : state;
    case "SET_QUICK_KNOWN":
      return { ...state, quickKnownEnabled: Boolean(action.value) };
    case "CLEAR_NOTICE":
      return { ...state, notice: null };
    default:
      return state;
  }
};
