export function MasteredView({ onRestore, onQuiz }) {
  return (
    <section className="status-view" aria-labelledby="mastered-title">
      <p className="eyebrow">已毕业</p>
      <h1 id="mastered-title">这份词表的词都稳了。</h1>
      <p>连续三次独立轮次或题组首答正确的词已移出主队列。需要时可以找回，也可继续做选择题。</p>
      <div className="status-actions">
        <button type="button" className="primary-action" onClick={onRestore}>找回毕业词</button>
        <button type="button" className="secondary-action" onClick={onQuiz}>练习选择题</button>
      </div>
    </section>
  );
}

export function SummaryView({ summary, onContinue, onPrepare, onQuiz }) {
  return (
    <section className="status-view" aria-labelledby="summary-title">
      <p className="eyebrow">轮次结算</p>
      <h1 id="summary-title">这一轮练完了。</h1>
      <dl className="shortcut-list">
        <div><dt>辨识</dt><dd>{summary.study.total} 个词，认识 {summary.study.correct}，模糊 {summary.study.fuzzy}，不认识 {summary.study.unknown}</dd></div>
        {summary.spell.total ? <div><dt>拼写</dt><dd>{summary.spell.total} 个词，首次写对 {summary.spell.correct}，需重拼 {summary.spell.unknown}</dd></div> : null}
        {summary.mastery ? <div><dt>掌握度</dt><dd>待巩固 {summary.mastery.weak}，未见 {summary.mastery.unseen}，渐稳 {summary.mastery.steady}，毕业 {summary.mastery.graduated}</dd></div> : null}
      </dl>
      <div className="status-actions summary-actions" role="group" aria-label="轮次操作">
        <button className="primary-action" type="button" onClick={onContinue}><span>继续下一轮</span><kbd>Enter</kbd></button>
        <button className="secondary-action" type="button" onClick={onPrepare}>回准备页</button>
      </div>
      <section className="summary-practice" aria-labelledby="summary-practice-title">
        <h2 id="summary-practice-title">练一练</h2>
        <div className="summary-practice-grid">
          {[["mcq", "练习选择题", "释义选词"], ["scenario", "练习情景题", "情景选词"], ["bank", "练习词库题", "搭配选词"], ["contrast", "练习对位辨析", "近义辨析"]].map(([kind, label, hint]) => (
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
          <span>先回辨识</span><kbd>Space</kbd>
        </button>
      </div>
    </section>
  );
}

export function PrepareView({ pasteText, message, onPasteChange, onPasteImport, onFile, onSample, onHelp, canContinue, onContinue, waveName, wavePlaceholder, onWaveName, hasWaves, onManage, aiControls, importBusy }) {
  return (
    <section className="prepare-view" aria-labelledby="prepare-title">
      <p className="eyebrow">准备词表</p>
      <h1 id="prepare-title">把这次要考的词放进来。</h1>
      <p className="status-lead">快速过一遍临时词表，拼写练习按需开启。最简单只要一行一个单词，识别成功后会直接开始。</p>
      <label className="field-label" htmlFor="prepare-wave-name">这波叫什么</label>
      <input className="wave-name" id="prepare-wave-name" value={waveName} placeholder={wavePlaceholder} disabled={importBusy} onChange={(event) => onWaveName(event.target.value)} />
      <details className="ai-preparation-details"><summary>用 DeepSeek 补齐资料（可选）</summary>{aiControls}</details>
      <div className="prepare-actions">
        {canContinue ? <button type="button" className="secondary-action" onClick={onContinue}>继续刚才的学习</button> : null}
        {hasWaves ? <button type="button" className="secondary-action" onClick={onManage}>查看已有波次</button> : null}
        <label className="file-button primary-action">
          <span>Import 文件</span>
          <input type="file" accept=".json,.md,.markdown,.txt,.csv,.docx" disabled={importBusy} onChange={onFile} />
        </label>
        <button type="button" className="secondary-action" onClick={onSample}>用示例词体验 1 分钟</button>
      </div>
      <p className="prepare-note">无需账户。词表与掌握度保存在当前浏览器；刷新会从新一轮开始。</p>
      <div className="paste-box">
        <label htmlFor="prepare-paste">或者直接粘贴</label>
        <span className="field-help">支持 JSON、Markdown、txt、CSV 与 DOCX 文本内容。</span>
        <textarea id="prepare-paste" value={pasteText} disabled={importBusy} onChange={(event) => onPasteChange(event.target.value)} rows="7" />
        <button type="button" className="secondary-action" disabled={importBusy} onClick={onPasteImport}>使用粘贴内容</button>
      </div>
      {message ? <p className="panel-message" role="status">{message}</p> : null}
      <button type="button" className="text-button sample-link" onClick={onHelp}>先看看怎么用</button>
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
