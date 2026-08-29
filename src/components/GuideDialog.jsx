import PointerButton from "./PointerButton.jsx";

export default function GuideDialog({
  open,
  message,
  pasteText,
  importedDeckData,
  exportDeckLength,
  panelRef,
  onClose,
  onCopyPrompt,
  onPasteTextChange,
  onPasteImport,
  onClearPaste,
  onExportJson,
  onExportMd,
  onImportClick,
  onCopyDeepPrompt,
}) {
  if (!open) return null;

  return (
    <div className="guide-overlay" onClick={onClose}>
      <section
        className="guide-panel"
        role="dialog"
        aria-modal="true"
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-header">
          <h2>使用指南</h2>
          <PointerButton type="button" onClick={onClose}>
            关闭
          </PointerButton>
        </div>
        {message ? (
          <div className="import-message" aria-live="polite">
            {message}
          </div>
        ) : null}

        {/* ── 导入词库 ── */}
        <div className="guide-section">
          <h3 className="guide-section-title">📥 导入你的单词</h3>

          {/* Step 1 */}
          <div className="guide-step">
            <div className="guide-step-num">1</div>
            <div className="guide-step-body">
              <div className="guide-step-title">准备好你的单词表</div>
              <p className="guide-step-desc">
                把你要背的单词整理成一行一个的列表，可以直接复制课本或笔记里的单词，不需要任何格式。
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="guide-step">
            <div className="guide-step-num">2</div>
            <div className="guide-step-body">
              <div className="guide-step-title">
                复制提示词，发给 DeepSeek 或 ChatGPT
              </div>
              <p className="guide-step-desc">
                点下方「复制提示词」，让 AI 补全词根词源、对应概念和 B1-B2
                日常例句，生成可直接导入的 JSON 词卡。
              </p>
              <PointerButton
                className="primary guide-step-btn"
                type="button"
                onClick={onCopyPrompt}
              >
                复制提示词
              </PointerButton>
            </div>
          </div>

          {/* Step 3 */}
          <div className="guide-step">
            <div className="guide-step-num">3</div>
            <div className="guide-step-body">
              <div className="guide-step-title">把 AI 的回复粘贴进来</div>
              <p className="guide-step-desc">
                AI 会生成一段包含 2-3 条日常语境例句和高亮片段的 JSON
                代码，把它全选复制，粘贴到下方输入框。
              </p>
              <div className="paste-block">
                <textarea
                  id="paste-input"
                  className="paste-textarea"
                  placeholder="把 AI 生成的内容粘贴到这里…"
                  value={pasteText}
                  onChange={(event) => onPasteTextChange(event.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="guide-step">
            <div className="guide-step-num">4</div>
            <div className="guide-step-body">
              <div className="guide-step-title">点「导入」，开始刷词！</div>
              <p className="guide-step-desc">
                导入成功后关掉这个面板，就能看到你的单词卡了。
              </p>
              <div className="paste-actions">
                <PointerButton
                  className="primary guide-step-btn"
                  type="button"
                  onClick={onPasteImport}
                  disabled={!pasteText.trim()}
                >
                  识别并导入
                </PointerButton>
                <PointerButton
                  type="button"
                  onClick={onClearPaste}
                  disabled={!pasteText.trim()}
                >
                  清空
                </PointerButton>
              </div>
              {importedDeckData && (
                <div className="export-actions">
                  <span className="export-label">✅ 导入成功，保存副本：</span>
                  <PointerButton
                    type="button"
                    className="export-btn"
                    onClick={onExportJson}
                    disabled={!exportDeckLength}
                    title="下载 JSON 文件"
                  >
                    ⬇ JSON
                  </PointerButton>
                  <PointerButton
                    type="button"
                    className="export-btn"
                    onClick={onExportMd}
                    disabled={!exportDeckLength}
                    title="下载 Markdown 文件"
                  >
                    ⬇ Markdown
                  </PointerButton>
                </div>
              )}
            </div>
          </div>

          {/* 也可以直接上传文件 */}
          <p className="guide-alt-import">
            已有 <code>.json / .md / .txt / .csv / .docx</code> 文件？
            <PointerButton
              type="button"
              className="guide-link-btn"
              onClick={onImportClick}
            >
              直接上传
            </PointerButton>
          </p>
        </div>

        <hr className="guide-divider" />

        <div className="guide-section">
          <h3 className="guide-section-title">🧠 词根词缀词源—感觉—画面</h3>
          <p className="guide-import-desc">
            学习某个难词时，把这套提示词发给 AI，再发送一个英文单词。它会从可靠词源、底层感觉、脑内画面、现实场景和近义词边界逐层讲解，帮助你绕开机械中英对照。
          </p>
          <PointerButton
            className="primary guide-step-btn"
            type="button"
            onClick={onCopyDeepPrompt}
          >
            复制深度理解提示词
          </PointerButton>
        </div>

        <hr className="guide-divider" />

        {/* ── 怎么用（折叠） ── */}
        <details className="guide-details">
          <summary className="guide-details-summary">📖 怎么用</summary>

          <div className="guide-section guide-details-body">
            <div className="guide-mode-block">
              <div className="guide-mode-badge">刷词模式</div>
              <p className="guide-mode-desc">
                默认状态，每次显示一张单词卡。
              </p>
              <ul className="guide-key-list">
                <li>
                  <kbd>Space</kbd> 或 <kbd>Enter</kbd> — 翻开释义和 2-3
                  条例句；翻开本身不计分
                </li>
                <li>
                  简约模式翻开后按 <kbd>Enter</kbd> — 直接进入下一张
                </li>
                <li>
                  开启「两轮熟悉返场」后才显示「想起来了 / 没想起来」按钮；
                  <kbd>Enter</kbd> 记正确，<kbd>N</kbd> 记错误
                </li>
                <li>
                  <kbd>Tab</kbd> 或 <kbd>←</kbd> — 上一张
                </li>
                <li>
                  <kbd>Delete</kbd> — 从本轮移除当前单词
                </li>
                <li>点击单词本身 — 复制原始拼写，不触发翻面</li>
                <li>
                  顶部 <kbd>Export JSON</kbd> —
                  按原始顺序导出所有未 Remove 的单词，熟悉池中的词也保留
                </li>
                <li>
                  刷完最后一张后按 <kbd>Enter</kbd> — 进入休息屏
                </li>
                <li>
                  每轮从头开始时自动打乱顺序，底部 Shuffle Loop 按钮可关闭
                </li>
              </ul>
              <p className="guide-mobile-tip">
                📱 手机：直接点卡片翻面，用底部按钮切换。
              </p>
            </div>

            <div className="guide-mode-block">
              <div className="guide-mode-badge guide-mode-badge--spell">
                随手拼模式
              </div>
              <p className="guide-mode-desc">
                刷完一轮后，在休息屏按 <kbd>Space</kbd> 进入。
                <br />
                屏幕只显示词义，你需要凭记忆键入单词拼写。
              </p>
              <ul className="guide-key-list">
                <li>直接键入字母（及空格）— 累积输入</li>
                <li>
                  <kbd>Enter</kbd> — 提交答案
                </li>
                <li>
                  答对后按 <kbd>Enter</kbd> — 下一个词
                </li>
                <li>答错后继续键入 — 自动清空重拼</li>
                <li>第一次提交决定本轮成绩，改正答案不会覆盖错误</li>
                <li>
                  <kbd>Backspace</kbd> — 删除最后一个字符
                </li>
                <li>
                  <kbd>Esc</kbd> — 退出，回到刷词模式
                </li>
              </ul>
            </div>

            <div className="guide-mode-block">
              <div className="guide-mode-badge">暂时熟悉池</div>
              <p className="guide-mode-desc">
                默认关闭。打开底部「两轮熟悉返场」后，任一 mode 连续正确 2
                轮会暂时隐藏；辨识已隐藏时，拼写首次正确即可同步隐藏，之后跟随辨识
                返场。每次隐藏完整的 1-2 轮，再分批随机返场。关闭时所有词保持普通
                循环，已有熟悉进度会保留。
              </p>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
