import { useEffect, useState } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const PANEL_TITLES = {
  deck: "我的词表",
  settings: "设置",
  help: "操作速查",
};

const SPELLING_OPTIONS = [
  ["off", "纯刷词", "大量多次地过完所有单词"],
  ["mistakes", "刷词+拼写错词", "刷完后拼一遍不认识的词"],
  ["all", "刷词+拼写全部", "每轮结束后全部拼一遍"],
];

export default function ManagePanel({
  open,
  panelRef,
  section,
  sourceDeck,
  removedEntries,
  graduatedCount,
  onRestoreGraduated,
  waves,
  onWaveAction,
  onRenameWave,
  aiControls,
  autoPronounceEnabled,
  spellingMode,
  quickKnownEnabled,
  themePreference,
  pronunciationSupported,
  message,
  initialConfirmAction,
  onClose,
  onAddDeck,
  onQuiz,
  onExportJson,
  onExportMarkdown,
  onSetAutoPronounce,
  onSetSpellingMode,
  onSetQuickKnown,
  onSetThemePreference,
  onRestoreRemoved,
  onReset,
  onSample,
  onConfirmConsumed,
}) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

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

  const activeWaves = waves.filter((wave) => wave.status === "active");
  const totalActive = activeWaves.reduce((total, wave) => total + wave.count, 0);

  return (
    <div className="panel-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside ref={panelRef} className="manage-panel" role="dialog" aria-modal="true" aria-labelledby="manage-title">
        <header className="panel-header">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">{section === "deck" ? "词表" : section === "settings" ? "偏好" : "帮助"}</p>
              <h2 id="manage-title">{PANEL_TITLES[section]}</h2>
            </div>
            <button type="button" className="icon-button close-button" onClick={onClose} aria-label="关闭管理面板">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </header>

        {confirmAction ? (
          <section className="confirm-box" aria-labelledby="confirm-title">
            <h3 id="confirm-title">{confirmAction === "reset" ? "重置学习进度？" : "恢复示例词表？"}</h3>
            <p>
              {confirmAction === "reset"
                ? "词表和已移出词会保留；掌握度、两种练习进度、当前队列和偏好回到默认值。"
                : "当前词表和学习现场会被 24 个示例词替换。完成后可以撤销。"}
            </p>
            <div className="inline-actions">
              <button type="button" className="danger-action" onClick={confirm}>确认{confirmAction === "reset" ? "重置" : "恢复"}</button>
              <button type="button" className="tertiary-action" onClick={() => { setConfirmAction(null); onConfirmConsumed(); }}>取消</button>
            </div>
          </section>
        ) : null}

        {section === "deck" ? (
          <div className="panel-content">
            <section className="panel-section panel-section-first" aria-labelledby="current-deck-title">
              <h3 id="current-deck-title">现在学的</h3>
              <p className="deck-summary">
                {activeWaves.length
                  ? <><strong>{activeWaves.map((wave) => wave.name).join("、")}</strong><span>{totalActive} 个词</span></>
                  : <><strong>没有在学的词表</strong><span>选一组继续，或添加新的</span></>}
              </p>
              <button type="button" className="primary-action add-deck-action" onClick={onAddDeck}>
                <span>＋</span> 添加新词表
              </button>
              {message ? <p className="panel-message" role="status">{message}</p> : null}
            </section>

            {waves.length ? (
              <section className="panel-section" aria-labelledby="waves-title">
                <h3 id="waves-title">所有词表</h3>
                <ul className="wave-list">
                  {waves.map((wave) => (
                    <li key={wave.id} className={wave.status === "active" ? "is-active" : ""}>
                      <div className="wave-title-row">
                        {renamingId === wave.id ? (
                          <form
                            className="wave-rename-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              onRenameWave(wave.id, renameValue);
                              setRenamingId(null);
                            }}
                          >
                            <input
                              autoFocus
                              value={renameValue}
                              aria-label={`重命名 ${wave.name}`}
                              onChange={(event) => setRenameValue(event.target.value)}
                              onKeyDown={(event) => { if (event.key === "Escape") setRenamingId(null); }}
                            />
                            <button type="submit" className="text-button">保存</button>
                            <button type="button" className="text-button" onClick={() => setRenamingId(null)}>取消</button>
                          </form>
                        ) : (
                          <>
                            <div className="wave-name-row">
                              <strong>{wave.name}</strong>
                              <button
                                type="button"
                                className="text-button wave-rename-button"
                                onClick={() => { setRenamingId(wave.id); setRenameValue(wave.name); }}
                              >
                                改名
                              </button>
                            </div>
                            <span className="wave-status">{wave.status === "active" ? "在学" : "已收起"}</span>
                          </>
                        )}
                      </div>
                      <span>{wave.count} 个词</span>
                      <div className="inline-actions">
                        {wave.status === "cold"
                          ? <button type="button" className="text-button" onClick={() => onWaveAction("SELECT_WAVE", wave.id)}>练这组</button>
                          : <button type="button" className="text-button" onClick={() => onWaveAction("COLD_WAVE", wave.id)}>先收起</button>}
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" className="secondary-action" disabled={waves.length < 2} onClick={() => onWaveAction("REVIVE_ALL_WAVES")}>全部一起复习</button>
              </section>
            ) : null}

            <details className="panel-details">
              <summary>专项练习</summary>
              <p>不改变认词进度，练完回到刚才的学习。</p>
              <div className="panel-practice-grid">
                {[["mcq", "看释义选词"], ["scenario", "看情景选词"], ["bank", "填搭配"], ["contrast", "辨析近义词"]].map(([kind, label]) => (
                  <button key={kind} type="button" className="secondary-action" onClick={() => onQuiz(kind)}>{label}</button>
                ))}
              </div>
            </details>

            <details className="panel-details">
              <summary>备份与导出</summary>
              <p>{sourceDeck.length} 个词，{removedEntries.length} 个已移出。导出文件可以留着换电脑用。</p>
              <div className="button-grid">
                <button type="button" className="tertiary-action" onClick={onExportJson} disabled={!sourceDeck.length}>导出 JSON</button>
                <button type="button" className="tertiary-action" onClick={onExportMarkdown} disabled={!sourceDeck.length}>导出 Markdown</button>
              </div>
            </details>

            <details className="panel-details">
              <summary>用 DeepSeek 补全资料（进阶）</summary>
              <p>导入时已经可以让 AI 一次补齐；这里是用自己的 key 直接写回词表。key 只留在这个页面，刷新就清空。</p>
              {aiControls}
            </details>

            {removedEntries.length ? (
              <details className="panel-details">
                <summary>已移出的词 · {removedEntries.length}</summary>
                <ul className="removed-list">
                  {removedEntries.map(({ cardId, term }) => (
                    <li key={cardId}><span>{term}</span><button type="button" className="text-button" onClick={() => onRestoreRemoved(cardId)}>找回</button></li>
                  ))}
                </ul>
              </details>
            ) : null}

            {graduatedCount ? (
              <section className="panel-section" aria-labelledby="graduated-title">
                <h3 id="graduated-title">已毕业 {graduatedCount} 词</h3>
                <p>连续三次首答正确后离开主队列；需要时再找回。</p>
                <button type="button" className="secondary-action" onClick={onRestoreGraduated}>找回毕业词</button>
              </section>
            ) : null}

            <details className="panel-details danger-zone">
              <summary>重新开始</summary>
              <button type="button" className="tertiary-action" onClick={() => setConfirmAction("reset")} disabled={!sourceDeck.length}>重置学习进度</button>
              <button type="button" className="tertiary-action" onClick={() => setConfirmAction("sample")}>恢复 24 个示例词</button>
            </details>
          </div>
        ) : null}

        {section === "settings" ? (
          <div className="panel-content">
            <section className="panel-section panel-section-first" aria-labelledby="practice-settings-title">
              <h3 id="practice-settings-title">练习方式</h3>
              <p>下一轮按这个方式练。</p>
              <fieldset className="setting-choice-list">
                <legend className="sr-only">拼写练习</legend>
                {SPELLING_OPTIONS.map(([value, title, description]) => (
                  <label key={value} className={`setting-choice${spellingMode === value ? " is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="spelling-mode"
                      checked={spellingMode === value}
                      onChange={() => onSetSpellingMode(value)}
                    />
                    <span className="setting-choice-mark" aria-hidden="true" />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>

            <section className="panel-section" aria-labelledby="voice-settings-title">
              <h3 id="voice-settings-title">发音</h3>
              <label className="switch-row">
                <span><strong>自动读单词</strong><small>{pronunciationSupported ? "翻开答案、进入下一词时自动读" : "当前浏览器不支持朗读，按钮仍可手动点"}</small></span>
                <input
                  className="switch-input"
                  type="checkbox"
                  role="switch"
                  checked={autoPronounceEnabled}
                  disabled={!pronunciationSupported}
                  onChange={(event) => onSetAutoPronounce(event.target.checked)}
                />
              </label>
            </section>

            <section className="panel-section" aria-labelledby="theme-settings-title">
              <h3 id="theme-settings-title">外观</h3>
              <div className="theme-options" role="group" aria-label="外观">
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
            </section>

            <details className="panel-details advanced-settings">
              <summary>进阶</summary>
              <label className="switch-row quick-known-setting">
                <span><strong>认识的词直接前进</strong><small>按 Q 直接记为认识，不再展开答案。默认关闭。</small></span>
                <input
                  className="switch-input"
                  type="checkbox"
                  role="switch"
                  checked={quickKnownEnabled}
                  onChange={(event) => onSetQuickKnown(event.target.checked)}
                />
              </label>
            </details>
          </div>
        ) : null}

        {section === "help" ? (
          <div className="panel-content">
            <section className="panel-section panel-section-first" aria-labelledby="help-import-title">
              <h3 id="help-import-title">导入</h3>
              <p>整份 Word、Excel、CSV 或文本都可以直接拖进导入页。粘贴时每行一个词，词后面跟中文就行；编号、音标、表格列也会自动识别。</p>
              <p>如果某一行没被认出，导入预览会单独列出来，回到上一步改一下原文即可。</p>
            </section>

            <section className="panel-section" aria-labelledby="shortcuts-title">
              <h3 id="shortcuts-title">键盘</h3>
              <dl className="shortcut-list">
                <div><dt>认词</dt><dd>Q 认识 · E 不认识 · N 下一个 · ← 回看 · Delete 移出</dd></div>
                <div><dt>答案页</dt><dd>{quickKnownEnabled ? "开启直接前进后，Q 直接到下一词，不再显示 M" : "按 Q 后可 M 改判为不认识"}</dd></div>
                <div><dt>拼写</dt><dd>Enter 提交 · 空 Enter 看答案 · Esc 暂停</dd></div>
                <div><dt>选择题</dt><dd>1–9 选择 · N 下一题</dd></div>
              </dl>
            </section>

            <section className="panel-section" aria-labelledby="help-ai-title">
              <h3 id="help-ai-title">AI 补全</h3>
              <p>导入核对页会给出「让 AI 补全」：复制那段话给任意 AI，能把中文释义、词性、词源、对应词、例句和辨析情景一次补齐，专项练习导入后就能直接练；回复整段粘回来即可，不需要懂 JSON。</p>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
