import { getHighlightedSentence } from "./highlightSentence.js";
import { FAMILIAR_STREAK_TARGET } from "../learningAlgorithm.js";

export default function StudyCard({
  cardClassName,
  completedByRemoval,
  currentRound,
  hasDeck,
  item,
  noAnim = false,
  onCompleteAnswer,
  onTermClick,
  onTermKeyDown,
  onToggleReveal,
  progress,
  revealed,
  showFamiliarStatus,
  showWordInsights,
}) {
  const term = hasDeck
    ? revealed
      ? item?.syllables || item?.term
      : item?.term
    : completedByRemoval
      ? "Congratulations! 🎉"
      : "No words loaded";
  const posTag = item?.pos || "";
  const meaningText = item
    ? [item.meaning, item.meaningZh].filter(Boolean).join(" / ")
    : "";
  const examples = item?.examples ?? [];
  const respell = item?.respell || "";
  const wordOrigin = item?.wordOrigin || "";
  const relatedWord = item?.relatedWord || "";
  const showDetails = revealed && hasDeck;
  const hint = hasDeck
    ? revealed
      ? showFamiliarStatus
        ? "Enter = remembered · N = not yet · Space hides"
        : "Enter = next · Space hides"
      : "Enter or Space reveals meaning + example sentences"
    : completedByRemoval
      ? "All the work is done! Undo or Reset to continue."
      : "Deck empty. Press Reset to reload.";
  const className = cardClassName ?? `card${noAnim ? " no-anim" : ""}`;

  return (
    <section className={className} aria-live="polite" onClick={onToggleReveal}>
      <div className="hint">{hint}</div>
      {showFamiliarStatus ? (
        <div className="memory-status">
          辨识 {Math.min(progress?.streak ?? 0, FAMILIAR_STREAK_TARGET)}/
          {FAMILIAR_STREAK_TARGET} · 第 {currentRound} 轮
          {progress?.hidden ? " · 返场复习" : ""}
        </div>
      ) : null}
      <div className="term-row">
        <h2
          className="term term-copy"
          role={hasDeck ? "button" : undefined}
          tabIndex={hasDeck ? 0 : undefined}
          title={hasDeck ? `复制 ${item?.term}` : undefined}
          aria-label={hasDeck ? `复制单词 ${item?.term}` : undefined}
          onClick={hasDeck ? onTermClick : undefined}
          onKeyDown={hasDeck ? onTermKeyDown : undefined}
        >
          {term}
        </h2>
        <div className={`pronounce${showDetails ? "" : " is-hidden"}`}>
          <div className="pronounce-value">{respell}</div>
        </div>
      </div>
      <p className={`meaning${showDetails ? "" : " is-hidden"}`}>
        {posTag ? <span className="pos-tag">{posTag}</span> : null}
        <span>{meaningText}</span>
      </p>
      {showDetails && showWordInsights && (wordOrigin || relatedWord) ? (
        <div className="word-insight">
          {wordOrigin ? (
            <p>
              <strong>词根·词缀·词源</strong>
              <span>{wordOrigin}</span>
            </p>
          ) : null}
          {relatedWord ? (
            <p>
              <strong>对应概念</strong>
              <span>{relatedWord}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {examples.length ? (
        <ul
          className={`examples${showDetails ? "" : " is-hidden"}`}
          aria-label="Example sentences"
        >
          {examples.map((example, exampleIndex) => {
            const sentenceHighlight = getHighlightedSentence(
              example?.sentence,
              example?.focus,
              item?.term,
            );

            return (
              <li
                key={`${example?.sentence ?? "example"}-${exampleIndex}`}
                className="example-item"
              >
                {sentenceHighlight ? (
                  <>
                    {sentenceHighlight.before}
                    <strong>{sentenceHighlight.highlight}</strong>
                    {sentenceHighlight.after}
                  </>
                ) : (
                  example?.sentence
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {showDetails && showFamiliarStatus ? (
        <div
          className="study-rating"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="primary"
            type="button"
            onClick={() => onCompleteAnswer(true)}
          >
            想起来了 (Enter)
          </button>
          <button type="button" onClick={() => onCompleteAnswer(false)}>
            没想起来 (N)
          </button>
        </div>
      ) : null}
    </section>
  );
}
