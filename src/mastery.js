export const GRADUATION_STREAK = 3;

export const createMastery = () => ({ streak: 0, mistakes: 0, fuzzy: 0, lastSeen: null });

export const getMastery = (mastery, cardId) => ({ ...createMastery(), ...mastery?.[cardId] });

export const isGraduated = (mastery, cardId) => getMastery(mastery, cardId).streak >= GRADUATION_STREAK;

export const recordMastery = (mastery, cardId, result, now = Date.now()) => {
  const previous = getMastery(mastery, cardId);
  return {
    ...mastery,
    [cardId]: {
      streak: result === true ? previous.streak + 1 : 0,
      mistakes: previous.mistakes + (result === false ? 1 : 0),
      fuzzy: previous.fuzzy + (result === "fuzzy" ? 1 : 0),
      lastSeen: now,
    },
  };
};

export const masteryPriority = (progress) => progress.lastSeen === null ? 1 : progress.streak === 0 ? 0 : 2;

export const compareMastery = (mastery, firstId, secondId) => {
  const first = getMastery(mastery, firstId);
  const second = getMastery(mastery, secondId);
  return masteryPriority(first) - masteryPriority(second) ||
    first.streak - second.streak ||
    (second.mistakes + second.fuzzy) - (first.mistakes + first.fuzzy) ||
    (first.lastSeen ?? 0) - (second.lastSeen ?? 0);
};

export const summarizeMastery = (mastery, cardIds) => cardIds.reduce((summary, cardId) => {
  const progress = getMastery(mastery, cardId);
  const group = isGraduated(mastery, cardId) ? "graduated" : progress.lastSeen === null ? "unseen" : progress.streak === 0 ? "weak" : "steady";
  summary[group] += 1;
  return summary;
}, { weak: 0, unseen: 0, steady: 0, graduated: 0 });
