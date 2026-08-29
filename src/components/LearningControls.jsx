import PointerButton from "./PointerButton.jsx";

export default function LearningControls({
  autoPronounceEnabled,
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
  onToggleAutoPronounce,
  onToggleFamiliarMode,
  onToggleShuffle,
  onToggleWordInsights,
  onUndoRemove,
  progress,
  progressLabel,
  pronunciationSupported,
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
        <PointerButton
          className="primary"
          type="button"
          onClick={onToggleReveal}
          disabled={mode !== "study" || !hasDeck}
        >
          {revealed ? "Hide (Space)" : "Reveal (Space)"}
        </PointerButton>
        <PointerButton
          type="button"
          onClick={onPrevCard}
          disabled={mode !== "study" || !hasDeck}
        >
          Prev (Tab / &lt;-)
        </PointerButton>
        <PointerButton
          type="button"
          onClick={revealed ? () => onCompleteAnswer(true) : onToggleReveal}
          disabled={mode !== "study" || !hasDeck}
        >
          {revealed
            ? familiarModeEnabled
              ? "Remembered (Enter)"
              : "Next (Enter)"
            : "Reveal (Enter)"}
        </PointerButton>
        <PointerButton
          type="button"
          onClick={onRemoveCard}
          disabled={mode === "spell" ? !hasSpellDeck : !hasDeck}
        >
          Remove (Delete)
        </PointerButton>
        <PointerButton type="button" onClick={onUndoRemove} disabled={!lastRemoved}>
          Undo Remove
        </PointerButton>
        <PointerButton
          type="button"
          className={shuffleOnLoop ? "primary" : undefined}
          aria-pressed={shuffleOnLoop}
          onClick={onToggleShuffle}
        >
          Shuffle Loop: {shuffleOnLoop ? "On" : "Off"}
        </PointerButton>
        <PointerButton type="button" onClick={onResetDeck}>
          Reset Deck
        </PointerButton>
      </div>
      <div className="feature-switches" aria-label="可选学习功能">
        <label
          className="feature-switch"
          title={
            pronunciationSupported
              ? undefined
              : "当前浏览器不支持语音合成"
          }
        >
          <span>自动美式发音</span>
          <input
            type="checkbox"
            role="switch"
            checked={autoPronounceEnabled}
            tabIndex={-1}
            disabled={!pronunciationSupported}
            onChange={(event) => {
              event.currentTarget.blur();
              onToggleAutoPronounce();
            }}
          />
          <span className="switch-track" aria-hidden="true">
            <span />
          </span>
        </label>
        <label className="feature-switch">
          <span>词源与对应概念</span>
          <input
            type="checkbox"
            role="switch"
            checked={showWordInsights}
            tabIndex={-1}
            onChange={(event) => {
              event.currentTarget.blur();
              onToggleWordInsights();
            }}
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
            tabIndex={-1}
            onChange={(event) => {
              event.currentTarget.blur();
              onToggleFamiliarMode();
            }}
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
