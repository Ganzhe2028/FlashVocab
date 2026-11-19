export function MasteredView({ onRestore, onQuiz }) {
  return (
    <section className="status-view" aria-labelledby="mastered-title">
      <h1 id="mastered-title">都毕业了。</h1>
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
          {[["mcq", "看释义选词"], ["scenario", "看情景选词"], ["bank", "填搭配"], ["contrast", "辨析近义词"]].map(([kind, label]) => (
            <button key={kind} className="secondary-action summary-practice-button" type="button" onClick={() => onQuiz(kind)}>{label}</button>
          ))}
        </div>
      </section>
    </section>
  );
}

export function PauseView({ onResume, onStudy }) {
  return (
    <section className="status-view" aria-labelledby="pause-title">
      <h1 id="pause-title">拼写暂停。</h1>
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
      <h1 id="empty-title">所有词都已移出。</h1>
      <div className="status-actions">
        <button className="secondary-action" type="button" onClick={onManage}>打开管理</button>
        <button className="tertiary-action" type="button" onClick={onSample}>恢复示例词表</button>
      </div>
    </section>
  );
}
