import { useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeDeck,
  parseDeckFromTextDetailed,
  readImportFile,
} from "../utils/deckImport.js";
import {
  buildFillPrompt,
  buildWorksheetPrompt,
  detectWorksheetMismatch,
  mergeFilledEntries,
  needsFillMaterial,
  parseMaterialReply,
} from "../utils/importFill.js";

const EMPTY_ENTRIES = [];
const MATERIAL_REPLY_PLACEHOLDER = `abandon | v. | 放弃；抛弃 | to leave somebody or something
对应词: quit — 主动停止，abandon 更强调彻底丢下
例句1: They abandon the plan at noon.
重点1: abandon the plan
情景: The team stops a project because the money is gone.
辨析: She stops playing tennis because her knee hurts. | quit | 主动停止。`;

const STEPS = [
  ["input", "放入"],
  ["preview", "核对"],
  ["start", "开始"],
];

const FileIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M12 5h17l9 9v27a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" />
    <path d="M29 5v9h9M17 25h15M17 32h11" />
  </svg>
);

export default function ImportView({
  canContinue,
  onContinue,
  hasWaves,
  onSample,
  onImport,
}) {
  const [stage, setStage] = useState("input");
  const [sourceMode, setSourceMode] = useState("file");
  const [sourceText, setSourceText] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillReply, setFillReply] = useState("");
  const [fillError, setFillError] = useState("");
  const [fillNotice, setFillNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [assistReply, setAssistReply] = useState("");
  const [assistError, setAssistError] = useState("");
  const [assistCopyNotice, setAssistCopyNotice] = useState("");
  const [failedFile, setFailedFile] = useState("");
  const headingRef = useRef(null);
  const pasteRef = useRef(null);

  const entries = draft?.entries ?? EMPTY_ENTRIES;
  const missingMaterial = useMemo(() => entries.filter(needsFillMaterial), [entries]);
  const withZh = entries.filter((entry) => entry.meaningZh).length;
  const skipped = draft?.skipped?.filter((line) => line.reason !== "heading") ?? [];
  const skippedHeadings = draft?.skipped?.filter((line) => line.reason === "heading") ?? [];
  const activeStep = stage === "preview" ? 1 : 0;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stage]);

  useEffect(() => {
    if (sourceMode === "paste") pasteRef.current?.focus({ preventScroll: true });
  }, [sourceMode]);

  const acceptText = (text, label = "") => {
    try {
      const parsed = parseDeckFromTextDetailed(text);
      const normalized = normalizeDeck(parsed.entries);
      if (!normalized.length) throw new Error("没有认出可用的单词，请检查词表内容。");
      setDraft({
        ...parsed,
        entries: normalized,
        worksheetLike: detectWorksheetMismatch(normalized),
        sourceName: label,
      });
      setSourceText(text);
      setError("");
      setFailedFile("");
      setShowAll(false);
      setFillOpen(false);
      setFillNotice("");
      setAssistReply("");
      setAssistError("");
      setAssistCopyNotice("");
      setStage("preview");
    } catch (parseError) {
      setError(parseError?.message || "无法识别这份词表。");
    }
  };

  const handleFile = async (file) => {
    if (!file || parsing) return;
    setError("");
    setFailedFile("");
    setParsing(true);
    try {
      acceptText(await readImportFile(file), file.name);
    } catch (fileError) {
      setError(fileError?.message || "无法读取这个文件。");
      setFailedFile(file.name);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (!parsing) handleFile(event.dataTransfer?.files?.[0]);
  };

  const backToInput = () => {
    setError("");
    setFillOpen(false);
    setAssistError("");
    setFailedFile("");
    setStage("input");
  };

  const openFailedFileAssist = () => {
    if (!failedFile) return;
    setDraft({ entries: [], skipped: [], worksheetLike: true, sourceName: failedFile });
    setError("");
    setAssistReply("");
    setAssistError("");
    setAssistCopyNotice("");
    setStage("preview");
  };

  const startImport = async () => {
    if (!entries.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await onImport(entries);
    } catch (importError) {
      setError(importError?.message || "导入失败，原词表没有变化。");
      setBusy(false);
    }
  };

  const copyFillPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildFillPrompt(entries));
      setCopyNotice("已复制。发给 AI 后，把整段回复粘贴到下面。");
    } catch {
      setCopyNotice("复制失败，请展开「看看这段话」手动复制。");
    }
  };

  const copyWorksheetPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildWorksheetPrompt());
      setAssistCopyNotice("已复制。接下来去 DeepSeek 上传原文件。");
    } catch {
      setAssistCopyNotice("复制失败，请展开「看看这段话」手动复制。");
    }
  };

  const applyWorksheetReply = () => {
    setAssistError("");
    if (!assistReply.trim()) {
      setAssistError("先把 AI 的回复粘贴进来。");
      return;
    }
    try {
      const normalized = normalizeDeck(parseMaterialReply(assistReply));
      if (!normalized.length) throw new Error("没有在回复里找到词表。请让 AI 按提示里的格式重新输出。");
      if (detectWorksheetMismatch(normalized)) throw new Error("回复里还带着页码，或者单词和释义没有配好。请让 AI 按格式重发。");
      setDraft({
        entries: normalized,
        skipped: [],
        worksheetLike: false,
        sourceName: draft?.sourceName ?? "",
      });
      setAssistReply("");
      setAssistCopyNotice("");
      setFillNotice(`AI 整理了 ${normalized.length} 个词的资料，请核对。`);
    } catch (replacementError) {
      setAssistError(replacementError?.message || "没看懂这份回复。");
    }
  };

  const applyFill = () => {
    setFillError("");
    if (!fillReply.trim()) {
      setFillError("先把 AI 的回复粘贴进来。");
      return;
    }
    try {
      const result = mergeFilledEntries(entries, fillReply);
      if (!result.filled) throw new Error("回复里没有匹配到这些词。请确认 AI 保留了原来的单词。");
      setDraft((previous) => ({ ...previous, entries: result.entries }));
      setFillReply("");
      setCopyNotice("");
      if (result.remaining) {
        setFillNotice(`补全了 ${result.filled} 个词；还有 ${result.remaining} 个词没补完，可以再复制一次。`);
      } else {
        setFillOpen(false);
        setFillNotice(`补全了 ${result.filled} 个词的资料，专项练习可以用了。`);
      }
    } catch (mergeError) {
      setFillError(mergeError?.message || "没看懂这份回复。");
    }
  };

  return (
    <section className="import-view" aria-labelledby="import-title">
      <ol className="import-steps" aria-label="导入步骤">
        {STEPS.map(([key, label], index) => (
          <li
            key={key}
            className={index < activeStep ? "is-done" : index === activeStep ? "is-active" : ""}
            aria-current={index === activeStep ? "step" : undefined}
          >
            <span className="import-step-number" aria-hidden="true">{index < activeStep ? "✓" : index + 1}</span>
            <span className="sr-only">{index < activeStep ? "已完成：" : index === activeStep ? "当前步骤：" : "后续步骤："}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {stage === "preview" ? (
        draft?.worksheetLike ? (
          <div className="import-step-body">
            <button type="button" className="text-button import-back" onClick={backToInput}>← 换一份</button>
            <h1 id="import-title" ref={headingRef} tabIndex="-1">这份表要请 AI 读一下。</h1>
            <p className="import-summary">
              {entries.length
                ? "它像是匹配/填空题：单词和释义分开放，闪词猜不出谁配谁。"
                : "这份文件闪词读不出来，但 AI 可以。"}
            </p>
            {draft.sourceName ? <p className="assist-source">{draft.sourceName}</p> : null}

            <div className="assist-panel">
              <div className="fill-step fill-step-action">
                <span>1</span>
                <div className="fill-actions">
                  <button type="button" className="secondary-action" onClick={copyWorksheetPrompt}>复制给 AI 的话</button>
                  {assistCopyNotice ? <span className="fill-note" role="status">{assistCopyNotice}</span> : null}
                </div>
              </div>
              <details className="fill-prompt-details">
                <summary>看看这段话</summary>
                <textarea className="fill-prompt" readOnly rows="10" value={buildWorksheetPrompt()} onFocus={(event) => event.target.select()} aria-label="整理提示词" />
              </details>
              <p className="fill-step"><span>2</span>打开 <a className="text-button" href="https://chat.deepseek.com/" target="_blank" rel="noreferrer">DeepSeek</a>，上传这份原文件，再把刚复制的话发过去。</p>
              <p className="fill-step"><span>3</span>把 AI 的回复粘贴回来。</p>
              <textarea
                className="fill-reply"
                rows="6"
                value={assistReply}
                onChange={(event) => setAssistReply(event.target.value)}
                placeholder={MATERIAL_REPLY_PLACEHOLDER}
                aria-label="AI 词表回复"
              />
              {assistError ? <p className="inline-error" role="alert">{assistError}</p> : null}
              <button type="button" className="primary-action" onClick={applyWorksheetReply}>生成词表</button>
            </div>
          </div>
        ) : (
        <div className="import-step-body">
          <button type="button" className="text-button import-back" onClick={backToInput}>← 换一份</button>
          <h1 id="import-title" ref={headingRef} tabIndex="-1">这些词对吗？</h1>
          <p className="import-summary">
            <strong>{entries.length} 个词</strong>
            <span> · {withZh} 个有中文释义</span>
          </p>

          {missingMaterial.length ? (
            <div className="missing-inline">
              <span>{missingMaterial.length} 个词还没补全资料</span>
              <button
                type="button"
                className="text-button"
                onClick={() => { setFillOpen(true); setFillNotice(""); setCopyNotice(""); }}
              >
                让 AI 补全
              </button>
            </div>
          ) : null}
          {fillNotice ? <p className="inline-success" role="status">{fillNotice}</p> : null}

          {fillOpen ? (
            <section className="fill-panel" aria-labelledby="fill-panel-title">
              <div className="fill-heading-row">
                <h2 id="fill-panel-title">让 AI 一次补齐</h2>
                <button type="button" className="text-button" onClick={() => { setFillOpen(false); setCopyNotice(""); }}>收起</button>
              </div>
              <p className="fill-hint">会补上中文释义、词性、英文释义、词源、对应词、例句和辨析情景；已有的不会被覆盖。</p>
              <div className="fill-step fill-step-action">
                <span>1</span>
                <div className="fill-actions">
                  <button type="button" className="secondary-action" onClick={copyFillPrompt}>复制给 AI 的话</button>
                  {copyNotice ? <span className="fill-note" role="status">{copyNotice}</span> : null}
                </div>
              </div>
              <details className="fill-prompt-details">
                <summary>看看这段话</summary>
                <textarea className="fill-prompt" readOnly rows="10" value={buildFillPrompt(entries)} onFocus={(event) => event.target.select()} aria-label="补全提示词" />
              </details>
              <p className="fill-step"><span>2</span>把 AI 的回复整段粘贴回来。</p>
              <textarea
                className="fill-reply"
                rows="7"
                value={fillReply}
                onChange={(event) => setFillReply(event.target.value)}
                placeholder={MATERIAL_REPLY_PLACEHOLDER}
                aria-label="AI 回复"
              />
              <p className="fill-hint">词多时一次可能输出不完：先粘贴已经生成的部分，剩下的还能再补。</p>
              {fillError ? <p className="inline-error" role="alert">{fillError}</p> : null}
              <button type="button" className="primary-action" onClick={applyFill}>识别并补全</button>
            </section>
          ) : null}

          <ul className="preview-list" aria-label="词表预览">
            {(showAll ? entries : entries.slice(0, 5)).map((entry, index) => (
              <li key={`${entry.term}-${index}`} className={!entry.meaningZh && !entry.meaning ? "is-missing" : ""}>
                <strong>{entry.term}</strong>
                <span className="preview-meaning">{entry.meaningZh || entry.meaning || "缺释义"}</span>
              </li>
            ))}
          </ul>
          {entries.length > 5 ? (
            <button type="button" className="text-button preview-more" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "收起" : `展开全部 ${entries.length} 个`}
            </button>
          ) : null}

          {skipped.length ? (
            <details className="skipped-details">
              <summary>{skipped.length} 行没识别</summary>
              <ul>
                {skipped.slice(0, 20).map((line, index) => (
                  <li key={`${line.line}-${index}`}>
                    <code>{line.line}</code>
                    <span>{line.reason === "sentence" ? "像完整句子" : "没有单词"}</span>
                  </li>
                ))}
              </ul>
              <p>可以不管，或者回上一步改一下原文。</p>
            </details>
          ) : null}
          {skippedHeadings.length ? <p className="import-skip-note">已忽略 {skippedHeadings.length} 行标题或日期。</p> : null}

          {hasWaves ? <p className="import-keep-note">会加进「词表」，原来的不会丢。</p> : null}
          {error ? <p className="inline-error" role="alert">{error}</p> : null}

          <button type="button" className="primary-action import-start" disabled={busy} onClick={startImport}>
            {busy ? "正在加入…" : `开始背这 ${entries.length} 个词`}
          </button>
        </div>
        )
      ) : (
        <div className="import-step-body">
          {canContinue ? <button type="button" className="text-button import-back" onClick={onContinue}>← 继续学习</button> : null}
          <h1 id="import-title" ref={headingRef} tabIndex="-1">{hasWaves ? "再加一组词。" : "单词表在哪？"}</h1>

          <div className="source-tabs" role="group" aria-label="词表来源">
            <button type="button" aria-pressed={sourceMode === "file"} disabled={parsing} onClick={() => { setSourceMode("file"); setError(""); setFailedFile(""); }}>
              文件
            </button>
            <button type="button" aria-pressed={sourceMode === "paste"} disabled={parsing} onClick={() => { setSourceMode("paste"); setError(""); setFailedFile(""); }}>
              粘贴
            </button>
          </div>

          {sourceMode === "file" ? (
            <label
              className={`drop-card${dragActive ? " is-dragging" : ""}${parsing ? " is-busy" : ""}`}
              aria-busy={parsing || undefined}
              onDragOver={(event) => { event.preventDefault(); if (!parsing) setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".docx,.xlsx,.doc,.xls,.csv,.txt,.md,.markdown,.json"
                disabled={parsing}
                onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }}
              />
              <span className="drop-icon"><FileIcon /></span>
              <strong>{parsing ? "正在识别…" : dragActive ? "松手，开始识别" : "上传文件"}</strong>
              <span>{parsing ? "马上就好" : "点击选择，或拖到这里"}</span>
              <span className="drop-formats">Word · Excel · CSV · 文本</span>
              <span className="sr-only" role="status">{parsing ? "正在识别文件" : ""}</span>
            </label>
          ) : (
            <div className="paste-panel">
              <p className="paste-hint">一行一个词，中文写在后面。</p>
              <textarea
                ref={pasteRef}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={"abandon 放弃\nbenefit 好处"}
                aria-label="单词表内容"
              />
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  if (!sourceText.trim()) {
                    setError("先把单词表粘贴到框里。");
                    return;
                  }
                  acceptText(sourceText, "粘贴内容");
                }}
              >
                识别单词
              </button>
            </div>
          )}

          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          {failedFile ? (
            <button type="button" className="text-button import-ai-fallback" onClick={openFailedFileAssist}>
              把这份文件交给 AI 整理
            </button>
          ) : null}

          {!hasWaves ? (
            <button type="button" className="text-button import-sample" disabled={parsing} onClick={onSample}>
              没有词表？用 24 个示例词试试
            </button>
          ) : null}
          <p className="import-privacy">只保存在这台设备</p>
        </div>
      )}
    </section>
  );
}
