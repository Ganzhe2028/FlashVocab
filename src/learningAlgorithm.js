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
    const signature = [
      entry?.term,
      entry?.pos,
      entry?.meaning,
      entry?.meaningZh,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .join("\u001f");
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    return `card-${hashText(signature)}-${occurrence}`;
  });
};

export const createEmptyModeProgress = () => ({
  streak: 0,
  hidden: false,
  dueRound: null,
  skipRounds: null,
  lastScoredRound: null,
  returnCount: 0,
  lapseCount: 0,
  syncedWithStudy: false,
  lastReturnedRound: null,
  lastSyncedStudyRound: null,
});

export const FAMILIAR_STREAK_TARGET = 2;

export const getModeProgress = (learningState, cardId, mode) => ({
  ...createEmptyModeProgress(),
  ...(learningState?.[cardId]?.[mode] ?? {}),
});

const drawSkipRounds = (random) => (random() < 0.5 ? 1 : 2);

export const recordReview = ({
  learningState,
  cardId,
  mode,
  round,
  correct,
  familiarModeEnabled = true,
  random = Math.random,
}) => {
  const previousCard = learningState?.[cardId] ?? {};
  const previous = getModeProgress(learningState, cardId, mode);
  const previousStudy = getModeProgress(learningState, cardId, "study");
  const previousSpell = getModeProgress(learningState, cardId, "spell");

  if (previous.lastScoredRound === round) return learningState;

  if (!familiarModeEnabled) {
    return {
      ...learningState,
      [cardId]: {
        ...previousCard,
        [mode]: {
          ...previous,
          lastScoredRound: round,
        },
      },
    };
  }

  let nextMode;
  if (!correct) {
    nextMode = {
      ...previous,
      streak: 0,
      hidden: false,
      dueRound: null,
      skipRounds: null,
      lastScoredRound: round,
      lapseCount: previous.lapseCount + 1,
      syncedWithStudy: false,
      lastReturnedRound: previous.hidden ? round : previous.lastReturnedRound,
    };
  } else {
    const nextStreak = previous.streak + 1;
    const shouldSyncWithStudy =
      mode === "spell" && previousStudy.hidden;
    const shouldHide =
      previous.hidden ||
      nextStreak >= FAMILIAR_STREAK_TARGET ||
      shouldSyncWithStudy;
    const skipRounds = shouldHide ? drawSkipRounds(random) : null;
    nextMode = {
      ...previous,
      streak: nextStreak,
      hidden: shouldHide,
      dueRound: shouldSyncWithStudy
        ? previousStudy.dueRound
        : shouldHide
          ? round + skipRounds + 1
          : null,
      skipRounds: shouldSyncWithStudy
        ? previousStudy.skipRounds
        : skipRounds,
      lastScoredRound: round,
      returnCount: previous.returnCount + (previous.hidden ? 1 : 0),
      syncedWithStudy:
        mode === "spell"
          ? previous.syncedWithStudy || shouldSyncWithStudy
          : previous.syncedWithStudy,
      lastReturnedRound: previous.hidden ? round : previous.lastReturnedRound,
      lastSyncedStudyRound:
        mode === "spell" && (previous.syncedWithStudy || shouldSyncWithStudy)
          ? previousStudy.lastReturnedRound
          : previous.lastSyncedStudyRound,
    };
  }

  let nextCard = {
    ...previousCard,
    [mode]: nextMode,
  };

  if (mode === "study") {
    const spellShouldSync =
      nextMode.hidden &&
      (previousSpell.syncedWithStudy || previousSpell.streak >= 1);
    if (spellShouldSync) {
      nextCard = {
        ...nextCard,
        spell: {
          ...previousSpell,
          hidden: nextMode.hidden,
          dueRound: nextMode.dueRound,
          skipRounds: nextMode.skipRounds,
          syncedWithStudy: nextMode.hidden,
        },
      };
    } else if (!nextMode.hidden && previousSpell.syncedWithStudy) {
      nextCard = {
        ...nextCard,
        spell: {
          ...previousSpell,
          hidden: false,
          dueRound: null,
          skipRounds: null,
          syncedWithStudy: false,
        },
      };
    }
  }

  return {
    ...learningState,
    [cardId]: nextCard,
  };
};

export const findNextUnscoredCardIndex = ({
  queueIds,
  currentIndex,
  learningState,
  mode,
  round,
}) => {
  for (let offset = 1; offset < queueIds.length; offset += 1) {
    const candidateIndex = (currentIndex + offset) % queueIds.length;
    const progress = getModeProgress(
      learningState,
      queueIds[candidateIndex],
      mode,
    );
    if (progress.lastScoredRound !== round) return candidateIndex;
  }
  return -1;
};

const shuffle = (values, random) => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const interleaveReturningCards = (activeIds, returningIds) => {
  if (!activeIds.length) return returningIds;
  const result = [];
  let returnIndex = 0;

  activeIds.forEach((cardId, index) => {
    result.push(cardId);
    if ((index + 1) % 3 === 0 && returnIndex < returningIds.length) {
      result.push(returningIds[returnIndex]);
      returnIndex += 1;
    }
  });

  return result.concat(returningIds.slice(returnIndex));
};

export const buildRoundCardIds = ({
  cardIds,
  removedCardIds = [],
  learningState,
  mode,
  round,
  studyRound = null,
  familiarModeEnabled = true,
  shuffleOnLoop = true,
  avoidFirstCardId = null,
  random = Math.random,
}) => {
  const removed = new Set(removedCardIds);
  const activeIds = [];
  const eligibleIds = [];

  cardIds.forEach((cardId) => {
    if (removed.has(cardId)) return;
    const progress = getModeProgress(learningState, cardId, mode);
    const studyProgress = getModeProgress(learningState, cardId, "study");
    if (!familiarModeEnabled || !progress.hidden) {
      activeIds.push(cardId);
    } else if (
      mode === "spell" &&
      progress.syncedWithStudy
        ? studyRound !== null &&
          studyProgress.lastReturnedRound !== null &&
          studyProgress.lastReturnedRound <= studyRound &&
          progress.lastSyncedStudyRound !== studyProgress.lastReturnedRound
        : progress.dueRound !== null && progress.dueRound <= round
    ) {
      eligibleIds.push(cardId);
    }
  });

  const returningLimit = activeIds.length
    ? Math.max(1, Math.floor(activeIds.length / 3))
    : eligibleIds.length
      ? Math.max(1, Math.floor(eligibleIds.length * 0.25))
      : 0;

  const randomizedEligible = eligibleIds
    .map((cardId) => ({
      cardId,
      syncPriority:
        mode === "spell" &&
        getModeProgress(learningState, cardId, mode).syncedWithStudy
          ? 0
          : 1,
      dueRound:
        mode === "spell" &&
        getModeProgress(learningState, cardId, mode).syncedWithStudy
          ? getModeProgress(learningState, cardId, "study").dueRound
          : getModeProgress(learningState, cardId, mode).dueRound,
      tieBreaker: random(),
    }))
    .sort(
      (left, right) =>
        left.syncPriority - right.syncPriority ||
        left.dueRound - right.dueRound ||
        left.tieBreaker - right.tieBreaker,
    )
    .map(({ cardId }) => cardId);

  const returningIds = randomizedEligible.slice(0, returningLimit);
  const orderedActiveIds = shuffleOnLoop
    ? shuffle(activeIds, random)
    : activeIds;
  const orderedReturningIds = shuffle(returningIds, random);
  const queue = interleaveReturningCards(
    orderedActiveIds,
    orderedReturningIds,
  );

  if (
    queue.length > 1 &&
    avoidFirstCardId &&
    queue[0] === avoidFirstCardId
  ) {
    const swapIndex = 1 + Math.floor(random() * (queue.length - 1));
    [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
  }

  return queue;
};

export const restoreQueue = (sourceDeck, cardIds, queueIds) => {
  const entriesById = new Map(
    cardIds.map((cardId, index) => [cardId, sourceDeck[index]]),
  );
  return (Array.isArray(queueIds) ? queueIds : [])
    .map((cardId) => entriesById.get(cardId))
    .filter(Boolean);
};
