import { FAMILIAR_STREAK_TARGET } from "../learningAlgorithm.js";
import PronounceButton from "./PronounceButton.jsx";

export default function SpellCard({
  currentRound,
  input,
  item,
  onPronounce,
  progress,
  progressLabel,
  result,
  shakeKey,
  showFamiliarStatus,
  pronunciationSupported,
}) {
  const pos = item?.pos || "";
  const meaning = item
    ? [item.meaning, item.meaningZh].filter(Boolean).join(" / ")
    : "";
  const correctDisplay = item?.syllables || item?.term || "";

  return (
    <section className="card spell-card" aria-live="polite">
      <div className="hint">
        {result === "correct"
          ? "enter 下一个"
          : result === "wrong"
            ? "继续键入重拼 / enter 再shake / esc 退出"
            : "键入单词 · enter 提交 · esc 退出"}
      </div>
      {showFamiliarStatus ? (
        <div className="memory-status">
          拼写 {Math.min(progress?.streak ?? 0, FAMILIAR_STREAK_TARGET)}/
          {FAMILIAR_STREAK_TARGET} · 第 {currentRound} 轮
          {progress?.hidden ? " · 返场复习" : ""}
        </div>
      ) : null}

      <p className="meaning">
        {pos ? <span className="pos-tag">{pos}</span> : null}
        <span>{meaning}</span>
      </p>

      <div className="spell-input-row">
        <div
          className={`spell-input-display${
            result === "correct"
              ? " correct"
              : result === "wrong"
                ? " wrong"
                : ""
          }`}
          key={shakeKey}
        >
          {input}
          {result !== "correct" && (
            <span className="spell-cursor" key={input.length} />
          )}
        </div>
      </div>

      {result ? (
        <div className="spell-answer-row">
          <p className="spell-answer">{correctDisplay}</p>
          {result === "correct" ? (
            <PronounceButton
              disabled={!pronunciationSupported}
              onPronounce={onPronounce}
              term={item?.term || "当前单词"}
            />
          ) : null}
        </div>
      ) : null}

      <div className="spell-progress">{progressLabel}</div>
    </section>
  );
}
