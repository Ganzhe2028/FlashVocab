export default function LearningControls({
  currentSpellRound,
  currentStudyRound,
  familiarSpellCount,
  familiarStudyCount,
  familiarModeEnabled,
  hasDeck,
  hasSpellDeck,
  lastRemoved,
  mode,
  onCompleteAnswer,
  onPrevCard,
  onRemoveCard,
  onResetDeck,
  onToggleReveal,
  onToggleFamiliarMode,
  onToggleShuffle,
  onToggleWordInsights,
  onUndoRemove,
  progress,
  progressLabel,
  revealed,
  showWordInsights,
  shuffleOnLoop,
}) {
  return (
    <section className="meta">
      <div className="progress">
        <div className="progress-bar">
          <span style={{ transform: `scaleX(${progress})` }}></span>
        </div>
        <div className="count">{progressLabel}</div>
      </div>
      <div className="controls">
        <button
          className="primary"
          type="button"
          onClick={onToggleReveal}
          disabled={mode !== "study" || !hasDeck}
        >
          {revealed ? "Hide (Space)" : "Reveal (Space)"}
        </button>
        <button
          type="button"
          onClick={onPrevCard}
          disabled={mode !== "study" || !hasDeck}
        >
          Prev (Tab / &lt;-)
        </button>
        <button
          type="button"
          onClick={revealed ? () => onCompleteAnswer(true) : onToggleReveal}
          disabled={mode !== "study" || !hasDeck}
        >
          {revealed
            ? familiarModeEnabled
              ? "Remembered (Enter)"
              : "Next (Enter)"
            : "Reveal (Enter)"}
        </button>
        <button
          type="button"
          onClick={onRemoveCard}
          disabled={mode === "spell" ? !hasSpellDeck : !hasDeck}
        >
          Remove (Delete)
        </button>
        <button type="button" onClick={onUndoRemove} disabled={!lastRemoved}>
          Undo Remove
        </button>
        <button
          type="button"
          className={shuffleOnLoop ? "primary" : undefined}
          aria-pressed={shuffleOnLoop}
          onClick={onToggleShuffle}
        >
          Shuffle Loop: {shuffleOnLoop ? "On" : "Off"}
        </button>
        <button type="button" onClick={onResetDeck}>
          Reset Deck
        </button>
      </div>
      <div className="feature-switches" aria-label="可选学习功能">
        <label className="feature-switch">
          <span>词源与对应概念</span>
          <input
            type="checkbox"
            role="switch"
            checked={showWordInsights}
            onChange={onToggleWordInsights}
          />
          <span className="switch-track" aria-hidden="true">
            <span />
          </span>
        </label>
        <label className="feature-switch">
          <span>两轮熟悉返场</span>
          <input
            type="checkbox"
            role="switch"
            checked={familiarModeEnabled}
            onChange={onToggleFamiliarMode}
          />
          <span className="switch-track" aria-hidden="true">
            <span />
          </span>
        </label>
      </div>
      {familiarModeEnabled ? (
        <div className="loop">
          辨识第 {currentStudyRound} 轮 · 拼写第 {currentSpellRound} 轮 ·
          暂时熟悉：辨识 {familiarStudyCount} / 拼写 {familiarSpellCount}
        </div>
      ) : null}
    </section>
  );
}
