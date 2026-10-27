import { getHighlightedSentence } from "./highlightSentence.js";
import { selectExamples } from "../learningAlgorithm.js";

const Meaning = ({ item }) => (
  <div className="meaning-block">
    <p className="meaning-zh">{item?.meaningZh || "未提供中文释义"}</p>
    <p className="meaning-en">{item?.meaning || "未提供释义"}</p>
  </div>
);

const formatStudyHeading = (word) => {
  if (!word || word === word.toLocaleUpperCase()) return word;
  return word.replace(/^([A-Z])/, (initial) => initial.toLocaleLowerCase());
};

export default function StudyView({
  item,
  isPractice,
  revealed,
  studyResult,
  quickKnownEnabled,
  insightsExpanded,
  pronunciationSupported,
  pronunciationSpeaking,
  pronunciationMessage,
  copyFeedback,
  onCopy,
  onPronounce,
  onChoose,
  onAdvance,
  onToggleInsights,
}) {
  const examples = selectExamples(item?.examples);
  const hasInsights = Boolean(item?.wordOrigin || item?.relatedWord);

  return (
    <section className="study-view" aria-labelledby="study-term">
      <p className="eyebrow">{isPractice ? "认词 · 再遇见" : "认词"}</p>
      <div className="word-heading-row">
        <h1 id="study-term" className="word-heading">
          <button
            type="button"
            className="word-copy"
            onClick={onCopy}
            aria-describedby="copy-tip"
          >
            {formatStudyHeading(revealed ? (item?.syllables?.replace(/-/g, "·") || item?.term) : item?.term)}
          </button>
        </h1>
        <button
          type="button"
          className={`icon-button speak-button${pronunciationSpeaking ? " is-speaking" : ""}`}
          onClick={onPronounce}
          disabled={!pronunciationSupported}
          aria-label={`播放 ${item?.term || "当前单词"} 的美式发音`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path className="speak-wave speak-wave-1" d="M15 8a6 6 0 0 1 0 8" />
            <path className="speak-wave speak-wave-2" d="M18 5a10 10 0 0 1 0 14" />
          </svg>
        </button>
        <span className="sr-only" aria-live="polite">
          {pronunciationSpeaking ? "正在播放美式发音。" : ""}
        </span>
      </div>
      <div id="copy-tip" className="copy-tip" role="tooltip">
        单击复制单词 · Shift＋单击复制深度理解请求
      </div>
      {item?.pos || item?.respell ? <p className="word-meta">
        {item?.pos}
        {item?.respell ? <span>{item.respell}</span> : null}
      </p> : null}
      {pronunciationMessage ? <p className="pronunciation-notice" role="status">{pronunciationMessage}</p> : null}
      {copyFeedback ? <p className="copy-feedback" role="status">{copyFeedback}</p> : null}

      {revealed ? (
        <div className="answer" data-testid="study-answer">
          <Meaning item={item} />
          {examples.length ? (
            <ul className="examples" aria-label="例句">
              {examples.map((example, index) => {
                const parts = getHighlightedSentence(
                  example?.sentence,
                  example?.focus,
                  item?.term,
                );
                return (
                  <li key={`${example?.sentence}-${index}`}>
                    {example?.usage ? <span className="usage-tag">{example.usage}</span> : null}
                    {parts ? (
                      <span>{parts.before}<strong>{parts.highlight}</strong>{parts.after}</span>
                    ) : (
                      <span>{example?.sentence}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {hasInsights ? (
            <div className="insights">
              <button
                type="button"
                className="text-button"
                aria-expanded={insightsExpanded}
                onClick={onToggleInsights}
              >
                {insightsExpanded ? "收起词源与对应概念" : "查看词源与对应概念"}
              </button>
              {insightsExpanded ? (
                <div className="insight-content">
                  {item.wordOrigin ? <p><strong>词源</strong>{item.wordOrigin}</p> : null}
                  {item.relatedWord ? <p><strong>对应概念</strong>{item.relatedWord}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="study-actions" aria-label="认词结果">
            <button type="button" className="primary-action" onClick={() => onAdvance()}>
              <span>下一个</span><kbd>N</kbd>
            </button>
            {studyResult === true ? (
              <button type="button" className="secondary-action coral" onClick={() => onAdvance(false)}>
                <span>记错了，下一词</span><kbd>M</kbd>
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="study-prompt">
          <p>{quickKnownEnabled ? "认识按 Q 直接前进；不认识按 E 展开答案。" : "凭记忆判断，然后看答案。"}</p>
          <div className="study-actions study-choice-actions" aria-label="认词选择">
            <button type="button" className="choice-action" onClick={() => onChoose(true)}>
              <span>认识</span><kbd>Q</kbd>
            </button>
            <button type="button" className="choice-action" onClick={() => onChoose(false)}>
              <span>不认识</span><kbd>E</kbd>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
