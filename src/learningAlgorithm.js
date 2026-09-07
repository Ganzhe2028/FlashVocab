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
  mode,
  round,
  avoidFirstCardId = null,
  random = Math.random,
}) => {
  const removed = new Set(removedCardIds);
  const queue = shuffle(
    cardIds.filter((cardId) => {
      if (removed.has(cardId)) return false;
      const progress = getModeProgress(learningState, cardId, mode);
      return !progress.hidden || progress.dueRound <= round;
    }),
    random,
  );

  if (queue.length > 1 && queue[0] === avoidFirstCardId) {
    const swapIndex = 1 + Math.floor(random() * (queue.length - 1));
    [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
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

const snapshotForUndo = (state) => ({ ...state, undo: null, notice: null });

const createLearningSession = ({
  sourceDeck,
  removedCardIds = [],
  random = Math.random,
  modeWhenEmpty = "empty",
}) => {
  const cardIds = createCardIds(sourceDeck);
  const queue = buildRoundCardIds({
    cardIds,
    removedCardIds,
    mode: "study",
    round: 1,
    random,
  });
  return {
    sourceDeck,
    removedCardIds,
    learningState: {},
    completedRounds: { study: 0, spell: 0 },
    mode: queue.length ? "study" : modeWhenEmpty,
    studyQueueIds: queue,
    studyIndex: 0,
    revealed: false,
    spellQueueIds: [],
    spellIndex: 0,
    spellInput: "",
    spellResult: null,
    pausedSpell: false,
    autoPronounceEnabled: true,
    insightsExpanded: false,
    undo: null,
    notice: null,
  };
};

export const createInitialState = ({ assets = null, random = Math.random } = {}) => {
  if (!assets?.sourceDeck?.length) {
    return createLearningSession({
      sourceDeck: [],
      removedCardIds: [],
      random,
      modeWhenEmpty: "prepare",
    });
  }
  return createLearningSession({
    sourceDeck: assets.sourceDeck,
    removedCardIds: assets.removedCardIds ?? [],
    random,
  });
};

const getActiveCardIds = (state) => {
  const removed = new Set(state.removedCardIds);
  return createCardIds(state.sourceDeck).filter((cardId) => !removed.has(cardId));
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
      spellInput: "",
    };
  }

  let targetMode = completedMode === "study" ? "spell" : "study";
  const cardIds = createCardIds(state.sourceDeck);
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
    const queue = buildRoundCardIds({
      cardIds,
      removedCardIds: state.removedCardIds,
      learningState: state.learningState,
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
        revealed: false,
        spellQueueIds: targetMode === "spell" ? queue : state.spellQueueIds,
        spellIndex: targetMode === "spell" ? 0 : state.spellIndex,
        spellInput: "",
        spellResult: null,
        pausedSpell: false,
        notice: attempts > 0 ? "休息中的词已自动跨过空轮，现在继续练习。" : null,
      };
    }
    completedRounds[targetMode] = round;
    targetMode = targetMode === "study" ? "spell" : "study";
  }

  const recoveryQueue = buildRoundCardIds({
    cardIds: activeCardIds,
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
    revealed: false,
    spellQueueIds: targetMode === "spell" ? recoveryQueue : state.spellQueueIds,
    spellIndex: targetMode === "spell" ? 0 : state.spellIndex,
    spellInput: "",
    spellResult: null,
    pausedSpell: false,
    notice: "休息轮次已整理，现在继续练习。",
  };
};

const replaceWithDeck = (state, sourceDeck, random, label) => {
  const replacement = createLearningSession({ sourceDeck, random });
  return {
    ...replacement,
    undo: { label, snapshot: snapshotForUndo(state) },
    notice: `已换成 ${sourceDeck.length} 个词。`,
  };
};

export const learningReducer = (state, action) => {
  const random = action.random ?? Math.random;
  switch (action.type) {
    case "REVEAL":
      return state.mode === "study" && state.studyQueueIds.length
        ? { ...state, revealed: true, insightsExpanded: false, notice: null }
        : state;
    case "HIDE":
      return state.mode === "study"
        ? { ...state, revealed: false, insightsExpanded: false }
        : state;
    case "TOGGLE_INSIGHTS":
      return { ...state, insightsExpanded: !state.insightsExpanded };
    case "PREVIOUS_STUDY":
      if (state.mode !== "study" || !state.studyQueueIds.length) return state;
      return {
        ...state,
        studyIndex:
          (state.studyIndex - 1 + state.studyQueueIds.length) % state.studyQueueIds.length,
        revealed: false,
        insightsExpanded: false,
      };
    case "ANSWER_STUDY": {
      if (state.mode !== "study" || !state.revealed) return state;
      const cardId = state.studyQueueIds[state.studyIndex];
      const round = state.completedRounds.study + 1;
      const learningState = recordReview({
        learningState: state.learningState,
        cardId,
        mode: "study",
        round,
        correct: action.correct,
      });
      const nextIndex = findNextUnscoredCardIndex({
        queueIds: state.studyQueueIds,
        currentIndex: state.studyIndex,
        learningState,
        mode: "study",
        round,
      });
      const nextState = {
        ...state,
        learningState,
        revealed: false,
        insightsExpanded: false,
        studyIndex: nextIndex < 0 ? state.studyIndex : nextIndex,
        notice: null,
      };
      return nextIndex < 0
        ? moveToNextPlayableRound(nextState, "study", random)
        : nextState;
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
      if (!submitted) return state;
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
          spellResult: isCorrect ? "correct" : "wrong",
        };
      }
      return { ...state, spellResult: isCorrect ? "corrected" : "wrong" };
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
      return moveToNextPlayableRound(state, "spell", random);
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
        cardIds: createCardIds(state.sourceDeck),
        removedCardIds: state.removedCardIds,
        learningState: state.learningState,
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
        revealed: false,
        pausedSpell: true,
        spellInput: "",
      };
    }
    case "REPLACE_DECK":
      return replaceWithDeck(state, action.sourceDeck, random, "撤销替换词表");
    case "USE_SAMPLE":
      return replaceWithDeck(state, action.sourceDeck, random, "撤销恢复示例");
    case "RESET_PROGRESS": {
      const reset = createLearningSession({
        sourceDeck: state.sourceDeck,
        removedCardIds: state.removedCardIds,
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
          : state.studyQueueIds[state.studyIndex];
      if (!cardId) return state;
      const previous = snapshotForUndo(state);
      const removedCardIds = state.removedCardIds.includes(cardId)
        ? state.removedCardIds
        : [...state.removedCardIds, cardId];
      const studyQueueIds = state.studyQueueIds.filter((id) => id !== cardId);
      const spellQueueIds = state.spellQueueIds.filter((id) => id !== cardId);
      const remaining = getActiveCardIds({ ...state, removedCardIds });
      const nextState = {
        ...state,
        removedCardIds,
        studyQueueIds,
        spellQueueIds,
        studyIndex: Math.min(state.studyIndex, Math.max(0, studyQueueIds.length - 1)),
        spellIndex: Math.min(state.spellIndex, Math.max(0, spellQueueIds.length - 1)),
        spellInput: "",
        spellResult: null,
        revealed: false,
        mode: remaining.length
          ? state.mode === "spell" && spellQueueIds.length
            ? "spell"
            : "study"
          : "empty",
        undo: { label: "撤销移出单词", snapshot: previous },
        notice: "已从本词表移出。",
      };
      if (
        remaining.length &&
        ((nextState.mode === "study" && !studyQueueIds.length) ||
          (nextState.mode === "spell" && !spellQueueIds.length))
      ) {
        const advanced = moveToNextPlayableRound(nextState, nextState.mode, random);
        return {
          ...advanced,
          undo: nextState.undo,
          notice: nextState.notice,
        };
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
      if (state.mode === "empty") {
        return {
          ...state,
          removedCardIds,
          learningState,
          mode: "study",
          studyQueueIds: [action.cardId],
          studyIndex: 0,
          revealed: false,
          undo: { label: "撤销找回单词", snapshot: previous },
          notice: "已找回，重新从辨识开始。",
        };
      }
      return {
        ...state,
        removedCardIds,
        learningState,
        undo: { label: "撤销找回单词", snapshot: previous },
        notice: "已找回；下次建立辨识和拼写队列时加入。",
      };
    }
    case "UNDO":
      return state.undo?.snapshot
        ? { ...state.undo.snapshot, notice: "已撤销上一次管理操作。", undo: null }
        : state;
    case "SET_AUTO_PRONOUNCE":
      return { ...state, autoPronounceEnabled: action.value };
    case "CLEAR_NOTICE":
      return { ...state, notice: null };
    default:
      return state;
  }
};
