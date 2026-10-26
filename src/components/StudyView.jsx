import MemoryPicture from "./MemoryPicture.jsx";

const Meaning = ({ item }) => (
  <div className="meaning-block">
    <p className="meaning-en">{item?.meaning || "未提供释义"}</p>
    <p className="meaning-zh">{item?.meaningZh || "未提供中文释义"}</p>
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
  answerExpanded,
  studyResult,
  quickKnownEnabled,
  insightsExpanded,
  pronunciationSupported,
  pronunciationMessage,
  copyFeedback,
  onCopy,
  onPronounce,
  onChoose,
  onAdvance,
  onToggleInsights,
  onShowAnswer,
  guideActive,
  onDismissGuide,
}) {
  return (
    <section className="study-view" aria-labelledby="study-term">
      <p className="eyebrow">{isPractice ? "辨识 · 本轮再遇见" : "辨识"}</p>
      <div className="word-heading-row">
        <h1 id="study-term" className="word-heading">
          <button
            type="button"
            className="word-copy"
            onClick={onCopy}
            aria-describedby="copy-tip"
          >
            {formatStudyHeading(revealed ? (item?.syllables || item?.term) : item?.term)}
          </button>
        </h1>
        <button
          type="button"
          className="icon-button speak-button"
          onClick={onPronounce}
          disabled={!pronunciationSupported}
          aria-label={`播放 ${item?.term || "当前单词"} 的美式发音`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg>
        </button>
      </div>
      <div id="copy-tip" className="copy-tip" role="tooltip">
        单击复制单词 · Shift＋单击复制深度理解请求
      </div>
      {item?.pos || item?.respell ? <p className="word-meta">
        {item?.pos}
        {item?.respell ? <span>{item.respell}</span> : null}
      </p> : null}
      {copyFeedback ? <p className="copy-feedback" role="status">{copyFeedback}</p> : null}
      {pronunciationMessage ? <p className="page-notice" role="status">{pronunciationMessage}</p> : null}

      {guideActive ? (
        <aside className="learning-guide" aria-label="首次辨识提示">
          <div>
            <strong>{revealed ? "答案页只做一件事" : "第一次先凭记忆判断"}</strong>
            <p>{revealed
              ? studyResult === true
                ? "按 N 确认并去下一词；如果刚才其实没认出，按 M 改判后继续。"
                : studyResult === "fuzzy"
                  ? "看完释义和对应概念，按 N 确认模糊并去下一词。"
                  : "看完答案，按 N 确认不认识并去下一词。"
              : quickKnownEnabled ? "认识按 Q 直接前进；模糊按 W、不认识按 E，看完答案再按 N。" : "认识按 Q，模糊按 W，不认识按 E。选择后按 N 前进；认识的词无需展开答案。"}</p>
          </div>
          <button type="button" className="text-button" onClick={onDismissGuide}>不再提示</button>
        </aside>
      ) : null}

      {revealed ? (
        <div className="answer" data-testid="study-answer">
          {answerExpanded ? <>
          <Meaning item={item} />
          {item.usageTags?.length ? <p className="usage-tags">{item.usageTags.join(" · ")}</p> : null}
          {studyResult === false ? <div className="micro-scene"><strong>记忆画面</strong><MemoryPicture item={item} /></div> : null}
          {item.relatedWord ? <p className="insight-content"><strong>对应概念</strong>{item.relatedWord}</p> : null}

          {item.wordOrigin ? (
            <div className="insights">
              <button
                type="button"
                className="text-button"
                aria-expanded={insightsExpanded}
                onClick={onToggleInsights}
              >
                {insightsExpanded ? "收起词源" : "查看词源"}
              </button>
              {insightsExpanded ? (
                <div className="insight-content">
                  {item.wordOrigin ? <p><strong>词源</strong>{item.wordOrigin}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          </> : <p>认识，直接继续。<button type="button" className="text-button" onClick={onShowAnswer}>查看答案</button></p>}

          <div className="study-actions" aria-label="辨识结果">
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
          <p>{quickKnownEnabled ? "认识按 Q 直接前进；模糊或不认识仍会展开答案。" : "先判断自己是否认识，再查看答案。"}</p>
          <div className="study-actions study-choice-actions" aria-label="辨识选择">
            <button type="button" className="choice-action" onClick={() => onChoose(true)}>
              <span>认识</span><kbd>Q</kbd>
            </button>
            <button type="button" className="choice-action" onClick={() => onChoose("fuzzy")}>
              <span>模糊</span><kbd>W</kbd>
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
