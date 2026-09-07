export default function SpellView({
  item,
  value,
  result,
  inputRef,
  onChange,
  onSubmit,
  onAdvance,
  onPause,
}) {
  const finished = result === "correct" || result === "corrected";
  const hasError = result === "wrong" || result === "retrying";

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onPause();
      return;
    }
    if (event.key !== "Enter" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (finished) onAdvance();
    else onSubmit();
  };

  return (
    <section className="spell-view" aria-labelledby="spell-heading">
      <p className="eyebrow">拼写</p>
      <h1 id="spell-heading" className="spell-heading">
        {item?.meaning || "未提供释义"}
      </h1>
      <p className="meaning-zh spell-zh">{item?.meaningZh || "未提供中文释义"}</p>
      <p className="word-meta">{item?.pos || "词性未提供"}</p>

      <label className={`spell-field${hasError ? " has-error" : ""}${finished ? " is-correct" : ""}`}>
        <span className="sr-only">输入英文拼写</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          readOnly={finished}
          aria-describedby="spell-feedback"
          autoFocus
        />
      </label>

      <div id="spell-feedback" className="spell-feedback" aria-live="polite">
        {result === "wrong" ? (
          <p className="feedback-error">第一次没拼对：<strong>{item?.term}</strong>。重新正确输入一次。</p>
        ) : null}
        {result === "retrying" ? (
          <p className="feedback-error">按正确拼写再提交一次；首次结果不会被覆盖。</p>
        ) : null}
        {result === "correct" ? (
          <p className="feedback-success">拼对了：<strong>{item?.syllables || item?.term}</strong></p>
        ) : null}
        {result === "corrected" ? (
          <p className="feedback-success">已经改正：<strong>{item?.syllables || item?.term}</strong></p>
        ) : null}
      </div>

      <div className="spell-actions">
        <button
          type="button"
          className="primary-action"
          onClick={finished ? onAdvance : onSubmit}
          disabled={!finished && !value.trim()}
        >
          <span>{finished ? "下一题" : "提交拼写"}</span><kbd>Enter</kbd>
        </button>
        <button type="button" className="tertiary-action" onClick={onPause}>
          暂停 <kbd>Esc</kbd>
        </button>
      </div>
    </section>
  );
}
