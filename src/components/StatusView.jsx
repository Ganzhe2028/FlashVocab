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

export function PrepareView({ pasteText, message, onPasteChange, onPasteImport, onFile, onSample, onHelp }) {
  return (
    <section className="prepare-view" aria-labelledby="prepare-title">
      <p className="eyebrow">准备词表</p>
      <h1 id="prepare-title">把这次要考的词放进来。</h1>
      <p className="status-lead">用辨识和拼写快速过一遍临时词表。最简单只要一行一个单词，识别成功后会直接开始。</p>
      <div className="prepare-actions">
        <label className="file-button primary-action">
          <span>Import 文件</span>
          <input type="file" accept=".json,.md,.markdown,.txt,.csv,.docx" onChange={onFile} />
        </label>
        <button type="button" className="secondary-action" onClick={onSample}>用示例词体验 1 分钟</button>
      </div>
      <p className="prepare-note">无需账户。词表保存在当前浏览器；刷新会从新一轮开始。</p>
      <div className="paste-box">
        <label htmlFor="prepare-paste">或者直接粘贴</label>
        <span className="field-help">支持 JSON、Markdown、txt、CSV 与 DOCX 文本内容。</span>
        <textarea id="prepare-paste" value={pasteText} onChange={(event) => onPasteChange(event.target.value)} rows="7" />
        <button type="button" className="secondary-action" onClick={onPasteImport}>使用粘贴内容</button>
      </div>
      {message ? <p className="panel-message" role="status">{message}</p> : null}
      <button type="button" className="text-button sample-link" onClick={onHelp}>先看看怎么用</button>
    </section>
  );
}

export function EmptyView({ canUndo, onUndo, onManage, onSample }) {
  return (
    <section className="status-view" aria-labelledby="empty-title">
      <p className="eyebrow">词表已空</p>
      <h1 id="empty-title">所有词都已移出。</h1>
      <p>可以找回刚才的词、打开词表管理，或换回示例词表。</p>
      <div className="status-actions">
        {canUndo ? <button className="primary-action" type="button" onClick={onUndo}>撤销上次移出</button> : null}
        <button className="secondary-action" type="button" onClick={onManage}>打开管理</button>
        <button className="tertiary-action" type="button" onClick={onSample}>恢复示例词表</button>
      </div>
    </section>
  );
}
