export const findTextRange = (source, query) => {
  const text = typeof source === "string" ? source : "";
  const needle = typeof query === "string" ? query.trim() : "";
  if (!text || !needle) return null;

  const start = text.toLowerCase().indexOf(needle.toLowerCase());
  if (start === -1) return null;

  return {
    start,
    end: start + needle.length,
  };
};

export const getHighlightedSentence = (sentence, sentenceFocus, term) => {
  const match =
    findTextRange(sentence, sentenceFocus) ?? findTextRange(sentence, term);
  if (!match) return null;

  return {
    before: sentence.slice(0, match.start),
    highlight: sentence.slice(match.start, match.end),
    after: sentence.slice(match.end),
  };
};
