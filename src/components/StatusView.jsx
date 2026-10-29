export function MasteredView({ onRestore, onQuiz }) {
  return (
    <section className="status-view" aria-labelledby="mastered-title">
      <p className="eyebrow">已毕业</p>
      <h1 id="mastered-title">这份词表的词都稳了。</h1>
      <p>连续三次独立轮次或题组首答正确的词已移出主队列。需要时可以找回，也可继续做选择题。</p>
      <div className="status-actions">
        <button type="button" className="primary-action" onClick={onRestore}>找回毕业词</button>
        <button type="button" className="secondary-action" onClick={onQuiz}>看释义选词</button>
      </div>
    </section>
  );
}

export function SummaryView({ summary, onContinue, onPrepare, onQuiz }) {
  return (
    <section className="status-view" aria-labelledby="summary-title">
      <p className="eyebrow">这一轮完成</p>
      <h1 id="summary-title">这一轮练完了。</h1>
      <dl className="shortcut-list">
        <div><dt>认词</dt><dd>{summary.study.total} 个词，认识 {summary.study.correct}，不认识 {summary.study.unknown}</dd></div>
        {summary.spell.total ? <div><dt>拼写</dt><dd>{summary.spell.total} 个词，首次写对 {summary.spell.correct}，需重拼 {summary.spell.unknown}</dd></div> : null}
        {summary.mastery ? <div><dt>掌握度</dt><dd>待巩固 {summary.mastery.weak}，未见 {summary.mastery.unseen}，渐稳 {summary.mastery.steady}，毕业 {summary.mastery.graduated}</dd></div> : null}
      </dl>
      <div className="status-actions summary-actions" role="group" aria-label="轮次操作">
        <button className="primary-action" type="button" onClick={onContinue}><span>继续下一轮</span><kbd>Enter</kbd></button>
        <button className="secondary-action" type="button" onClick={onPrepare}>换一组词</button>
      </div>
      <section className="summary-practice" aria-labelledby="summary-practice-title">
        <h2 id="summary-practice-title">练一练</h2>
        <div className="summary-practice-grid">
          {[["mcq", "看释义选词", "给定义，选对应词"], ["scenario", "看情景选词", "给句子，选最合适的词"], ["bank", "填搭配", "句中缺一个搭配"], ["contrast", "辨析近义词", "两个近义词二选一"]].map(([kind, label, hint]) => (
            <button key={kind} className="secondary-action summary-practice-button" type="button" aria-labelledby={`summary-${kind}-label`} aria-describedby={`summary-${kind}-hint`} onClick={() => onQuiz(kind)}>
              <strong id={`summary-${kind}-label`}>{label}</strong>
              <span id={`summary-${kind}-hint`}>{hint}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

export function PauseView({ onResume, onStudy }) {
  return (
    <section className="status-view" aria-labelledby="pause-title">
      <p className="eyebrow">拼写已暂停</p>
      <h1 id="pause-title">停一下，答案不会丢。</h1>
      <p>半截输入已清空；当前题、首次结果和整份拼写队列都保留着。</p>
      <div className="status-actions">
        <button className="primary-action" type="button" onClick={onResume}>
          <span>继续拼写</span><kbd>Enter</kbd>
        </button>
        <button className="secondary-action" type="button" onClick={onStudy}>
          <span>先回认词</span><kbd>Space</kbd>
        </button>
      </div>
    </section>
  );
}

export function EmptyView({ onManage, onSample }) {
  return (
    <section className="status-view" aria-labelledby="empty-title">
      <p className="eyebrow">词表已空</p>
      <h1 id="empty-title">所有词都已移出。</h1>
      <p>可以找回刚才的词、打开词表管理，或换回示例词表。</p>
      <div className="status-actions">
        <button className="secondary-action" type="button" onClick={onManage}>打开管理</button>
        <button className="tertiary-action" type="button" onClick={onSample}>恢复示例词表</button>
      </div>
    </section>
  );
}
