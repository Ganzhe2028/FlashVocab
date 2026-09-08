import { useEffect, useState } from "react";

export default function ManagePanel({
  open,
  panelRef,
  sourceDeck,
  removedEntries,
  autoPronounceEnabled,
  pronunciationSupported,
  pasteText,
  message,
  initialConfirmAction,
  onClose,
  onFile,
  onPasteChange,
  onPasteImport,
  onExportJson,
  onExportMarkdown,
  onCopyCompletionPrompt,
  onSetAutoPronounce,
  onRestoreRemoved,
  onReset,
  onSample,
  onConfirmConsumed,
}) {
  const [confirmAction, setConfirmAction] = useState(null);
  useEffect(() => {
    if (open && initialConfirmAction) setConfirmAction(initialConfirmAction);
  }, [initialConfirmAction, open]);
  if (!open) return null;

  const confirm = () => {
    if (confirmAction === "reset") onReset();
    if (confirmAction === "sample") onSample();
    setConfirmAction(null);
    onConfirmConsumed();
  };

  return (
    <div className="panel-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside ref={panelRef} className="manage-panel" role="dialog" aria-modal="true" aria-labelledby="manage-title">
        <header className="panel-header">
          <div>
            <p className="eyebrow">工具与设置</p>
            <h2 id="manage-title">管理这份词表</h2>
          </div>
          <button type="button" className="icon-button close-button" onClick={onClose} aria-label="关闭管理面板">×</button>
        </header>

        {confirmAction ? (
          <section className="confirm-box" aria-labelledby="confirm-title">
            <h3 id="confirm-title">{confirmAction === "reset" ? "重置学习进度？" : "恢复示例词表？"}</h3>
            <p>
              {confirmAction === "reset"
                ? "词表和已移出词会保留；两种练习进度、当前队列和偏好回到默认值。"
                : "当前词表和学习现场会被 24 个示例词替换。完成后可以撤销。"}
            </p>
            <div className="inline-actions">
              <button type="button" className="danger-action" onClick={confirm}>确认{confirmAction === "reset" ? "重置" : "恢复"}</button>
              <button type="button" className="tertiary-action" onClick={() => { setConfirmAction(null); onConfirmConsumed(); }}>取消</button>
            </div>
          </section>
        ) : null}

        <section className="panel-section" aria-labelledby="deck-tools-title">
          <h3 id="deck-tools-title">词表</h3>
          <p>{sourceDeck.length} 个原始词，{removedEntries.length} 个已移出。</p>
          <label className="file-button secondary-action">
            <span>Import 新词表</span>
            <input type="file" accept=".json,.md,.markdown,.txt,.csv,.docx" onChange={onFile} />
          </label>
          <label htmlFor="panel-paste" className="field-label">粘贴导入</label>
          <textarea id="panel-paste" rows="5" value={pasteText} onChange={(event) => onPasteChange(event.target.value)} />
          <button type="button" className="secondary-action" onClick={onPasteImport}>使用粘贴内容</button>
          {message ? <p className="panel-message" role="status">{message}</p> : null}
          <div className="button-grid">
            <button type="button" className="tertiary-action" onClick={onExportJson} disabled={!sourceDeck.length}>Export JSON</button>
            <button type="button" className="tertiary-action" onClick={onExportMarkdown} disabled={!sourceDeck.length}>Export Markdown</button>
          </div>
        </section>

        <section className="panel-section" aria-labelledby="help-title">
          <h3 id="help-title">内容补全与快捷键</h3>
          <p>只有单词也能练，缺失释义会明确标出。需要补全时，可复制现有格式提示词到任意 AI。</p>
          <button type="button" className="secondary-action" onClick={onCopyCompletionPrompt}>复制词表补全提示词</button>
          <dl className="shortcut-list">
            <div><dt>辨识</dt><dd>未作答时 Enter 认识、N 不认识；不认识的答案页只用 Enter 下一词，认识的答案页还可用 N 改判并前进；← 回看；Delete 移出</dd></div>
            <div><dt>拼写</dt><dd>输入后 Enter 提交；不会时可空输入直接 Enter 看答案；拼错会清空并要求正确重拼；Esc 暂停</dd></div>
          </dl>
        </section>

        <section className="panel-section" aria-labelledby="settings-title">
          <h3 id="settings-title">学习设置</h3>
          <label className="switch-row">
            <span><strong>自动美式发音</strong><small>{pronunciationSupported ? "进入辨识词、展开答案与拼写提交时播放" : "当前浏览器不可用，练习不受影响"}</small></span>
            <input
              type="checkbox"
              role="switch"
              checked={autoPronounceEnabled}
              disabled={!pronunciationSupported}
              onChange={(event) => onSetAutoPronounce(event.target.checked)}
            />
          </label>
          <p className="setting-note">词源与对应概念默认折叠，需要时在答案下展开。</p>
        </section>

        {removedEntries.length ? (
          <section className="panel-section" aria-labelledby="removed-title">
            <h3 id="removed-title">已移出</h3>
            <ul className="removed-list">
              {removedEntries.map(({ cardId, term }) => (
                <li key={cardId}><span>{term}</span><button type="button" className="text-button" onClick={() => onRestoreRemoved(cardId)}>找回</button></li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="panel-section danger-zone" aria-labelledby="reset-title">
          <h3 id="reset-title">重新开始</h3>
          <button type="button" className="tertiary-action" onClick={() => setConfirmAction("reset")} disabled={!sourceDeck.length}>重置学习进度</button>
          <button type="button" className="tertiary-action" onClick={() => setConfirmAction("sample")}>恢复 24 个示例词</button>
        </section>
      </aside>
    </div>
  );
}
