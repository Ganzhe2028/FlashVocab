import { useEffect, useState } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const PANEL_TITLES = {
  deck: ["词表", "更换或保存词表"],
  help: ["使用帮助", "1 分钟上手"],
  settings: ["偏好", "让学习更顺手"],
};

const currentModeHelp = (mode) => {
  if (mode === "spell") return "当前是拼写：输入后按 Enter。不会时可空按 Enter 看答案，Esc 暂停。";
  if (mode === "pause") return "当前拼写已暂停：Enter 继续原队列，Space 先回辨识。";
  if (mode === "prepare") return "先导入自己的词表，或用示例词体验。最简单的格式是一行一个单词。";
  if (mode === "empty") return "当前词表已经空了：可以撤销、找回已移出词，或换一份词表。";
  return "当前是辨识：先按 Q 认识或 E 不认识；答案页按 N 下一词，必要时按 M 改判。";
};

export default function ManagePanel({
  open,
  panelRef,
  section,
  mode,
  sourceDeck,
  removedEntries,
  autoPronounceEnabled,
  themePreference,
  pronunciationSupported,
  pasteText,
  message,
  initialConfirmAction,
  onClose,
  onSectionChange,
  onFile,
  onPasteChange,
  onPasteImport,
  onExportJson,
  onExportMarkdown,
  onCopyCompletionPrompt,
  onSetAutoPronounce,
  onSetThemePreference,
  onRestoreRemoved,
  onReset,
  onSample,
  onRestartGuide,
  onConfirmConsumed,
}) {
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (open && initialConfirmAction) setConfirmAction(initialConfirmAction);
  }, [initialConfirmAction, open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return undefined;

    const containFocus = (event) => {
      if (event.key !== "Tab") return;
      const focusable = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener("keydown", containFocus);
    return () => panel.removeEventListener("keydown", containFocus);
  }, [open, panelRef, section]);

  if (!open) return null;

  const confirm = () => {
    if (confirmAction === "reset") onReset();
    if (confirmAction === "sample") onSample();
    setConfirmAction(null);
    onConfirmConsumed();
  };
  const [eyebrow, title] = PANEL_TITLES[section];

  return (
    <div className="panel-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside ref={panelRef} className="manage-panel" role="dialog" aria-modal="true" aria-labelledby="manage-title">
        <header className="panel-header">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2 id="manage-title">{title}</h2>
            </div>
            <button type="button" className="icon-button close-button" onClick={onClose} aria-label="关闭管理面板">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav className="panel-nav" aria-label="面板分类">
            {[
              ["help", "怎么用"],
              ["settings", "设置"],
              ["deck", "词表"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={section === value ? "is-active" : ""}
                aria-current={section === value ? "page" : undefined}
                onClick={() => onSectionChange(value)}
              >
                {label}
              </button>
            ))}
          </nav>
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

        {section === "help" ? (
          <div className="panel-content">
            <section className="panel-section panel-section-first" aria-labelledby="current-help-title">
              <h3 id="current-help-title">当前屏怎么操作</h3>
              <p className="current-mode-help">{currentModeHelp(mode)}</p>
            </section>

            <section className="panel-section" aria-labelledby="quickstart-title">
              <h3 id="quickstart-title">完整学习循环</h3>
              <ol className="quickstart-list">
                <li><span className="quickstart-number" aria-hidden="true">1</span><strong>准备词表</strong><span>文件、粘贴或一行一个单词都可以。</span></li>
                <li><span className="quickstart-number" aria-hidden="true">2</span><strong>先做辨识</strong><span>Q 认识、E 不认识，选择后查看答案。</span></li>
                <li><span className="quickstart-number" aria-hidden="true">3</span><strong>再做拼写</strong><span>看释义输入单词；第一次写错仍需正确重拼。</span></li>
                <li><span className="quickstart-number" aria-hidden="true">4</span><strong>自动休息与返场</strong><span>同一模式两轮答对后休息一整轮，随后自动回来。</span></li>
              </ol>
              <button type="button" className="secondary-action" onClick={onRestartGuide}>在学习页重新显示提示</button>
            </section>

            <section className="panel-section" aria-labelledby="shortcuts-title">
              <h3 id="shortcuts-title">快捷键</h3>
              <dl className="shortcut-list">
                <div><dt>辨识</dt><dd>Q 认识；E 不认识；N 下一词；M 改判；← 回看；Delete 移出</dd></div>
                <div><dt>拼写</dt><dd>Enter 提交或前进；空 Enter 看答案；Esc 暂停</dd></div>
              </dl>
            </section>
          </div>
        ) : null}

        {section === "settings" ? (
          <div className="panel-content">
            <section className="panel-section panel-section-first" aria-labelledby="settings-title">
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
              <fieldset className="theme-setting">
                <legend>外观</legend>
                <span className="setting-note">默认跟随设备，也可以固定界面的亮暗模式。</span>
                <div className="theme-options">
                  {[
                    ["system", "跟随系统"],
                    ["light", "亮色"],
                    ["dark", "暗色"],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="theme-preference"
                        value={value}
                        checked={themePreference === value}
                        onChange={(event) => onSetThemePreference(event.target.value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          </div>
        ) : null}

        {section === "deck" ? (
          <div className="panel-content">
            <section className="panel-section panel-section-first" aria-labelledby="deck-tools-title">
              <h3 id="deck-tools-title">导入与导出</h3>
              <p>{sourceDeck.length} 个原始词，{removedEntries.length} 个已移出。导入成功会替换当前词表，并可立即撤销。</p>
              <label className="file-button secondary-action">
                <span>Import 新词表</span>
                <input type="file" accept=".json,.md,.markdown,.txt,.csv,.docx" onChange={onFile} />
              </label>
              <label htmlFor="panel-paste" className="field-label">粘贴导入</label>
              <span className="field-help">没有现成格式也没关系，一行一个单词即可。</span>
              <textarea id="panel-paste" rows="5" value={pasteText} onChange={(event) => onPasteChange(event.target.value)} />
              <button type="button" className="secondary-action" onClick={onPasteImport}>使用粘贴内容</button>
              {message ? <p className="panel-message" role="status">{message}</p> : null}
              <div className="button-grid">
                <button type="button" className="tertiary-action" onClick={onExportJson} disabled={!sourceDeck.length}>Export JSON</button>
                <button type="button" className="tertiary-action" onClick={onExportMarkdown} disabled={!sourceDeck.length}>Export Markdown</button>
              </div>
            </section>

            <section className="panel-section" aria-labelledby="completion-title">
              <h3 id="completion-title">补全词表内容</h3>
              <p>只有单词也能练。需要词义、例句和词源时，可复制格式提示词到任意 AI。</p>
              <button type="button" className="secondary-action" onClick={onCopyCompletionPrompt}>复制词表补全提示词</button>
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
          </div>
        ) : null}
      </aside>
    </div>
  );
}
