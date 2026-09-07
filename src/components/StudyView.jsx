import { getHighlightedSentence } from "./highlightSentence.js";
import { selectExamples } from "../learningAlgorithm.js";

const Meaning = ({ item }) => (
  <div className="meaning-block">
    <p className="meaning-en">{item?.meaning || "未提供释义"}</p>
    <p className="meaning-zh">{item?.meaningZh || "未提供中文释义"}</p>
  </div>
);

export default function StudyView({
  item,
  revealed,
  insightsExpanded,
  pronunciationSupported,
  copyFeedback,
  onCopy,
  onPronounce,
  onReveal,
  onHide,
  onAnswer,
  onToggleInsights,
}) {
  const examples = selectExamples(item?.examples);
  const hasInsights = Boolean(item?.wordOrigin || item?.relatedWord);

  return (
    <section className="study-view" aria-labelledby="study-term">
      <p className="eyebrow">辨识</p>
      <div className="word-heading-row">
        <h1 id="study-term" className="word-heading">
          <button
            type="button"
            className="word-copy"
            onClick={onCopy}
            aria-describedby="copy-tip"
          >
            {item?.syllables || item?.term}
          </button>
        </h1>
        <button
          type="button"
          className="icon-button speak-button"
          onClick={onPronounce}
          disabled={!pronunciationSupported}
          aria-label={`播放 ${item?.term || "当前单词"} 的美式发音`}
        >
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div id="copy-tip" className="copy-tip" role="tooltip">
        单击复制单词 · Shift＋单击复制深度理解请求
      </div>
      <p className="word-meta">
        {item?.pos || "词性未提供"}
        {item?.respell ? <span>{item.respell}</span> : null}
      </p>
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

          <div className="study-actions" aria-label="辨识结果">
            <button type="button" className="primary-action" onClick={() => onAnswer(true)}>
              <span>认出来了</span><kbd>Enter</kbd>
            </button>
            <button type="button" className="secondary-action coral" onClick={() => onAnswer(false)}>
              <span>没认出来</span><kbd>N</kbd>
            </button>
            <button type="button" className="tertiary-action" onClick={onHide}>
              遮住 <kbd>Space</kbd>
            </button>
          </div>
        </div>
      ) : (
        <div className="study-prompt">
          <p>先在脑中说出它的意思。</p>
          <button type="button" className="primary-action" onClick={onReveal}>
            <span>查看答案</span><kbd>Enter</kbd>
          </button>
        </div>
      )}
    </section>
  );
}
