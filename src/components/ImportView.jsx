import { useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeDeck,
} from "../utils/deckImport.js";
import {
  buildFillPrompt,
  buildRevisionPrompt,
  buildWorksheetPrompt,
  mergeFilledEntries,
  needsFillMaterial,
  parseMaterialReply,
} from "../utils/importFill.js";

import { parseJsonDeck } from "../utils/jsonDeck.js";
import InfoTip from "./InfoTip.jsx";

const EMPTY_ENTRIES = [];

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

const learnerError = (error) => {
  const message = error?.message || "没有看懂这份内容。";
  const prefix = message.match(/^第 \d+ 个词条(?:（[^）]+）)?/)?.[0] ?? "";
  if (message.includes("只支持 .json")) return "这个文件还不能直接读取。先把原文件和上面的提示词一起发给 AI。";
  if (message.includes("JSON 格式不正确")) return "内容没有完整识别。可能多了说明文字或逗号，也可能是 AI 回复被截断。";
  if (message.includes("非空 JSON 数组")) return "没有认出词表，请让 AI 按提示重新整理。";
  if (message.includes("缺少单词")) return `${prefix}缺少单词。`;
  if (message.includes("至少填写一个词义")) return `${prefix}还缺词义，中文或英文至少补一种。`;
  if (message.includes("字段名")) return `${prefix}的栏目名和模板不一致。`;
  if (message.includes("focus") || message.includes("sentence")) return `${prefix}的例句或重点没有对应好。`;
  if (message.includes("匹配到这些词")) return "回复里没有这些单词，请让 AI 保留原词后重发。";
  return message.replace(/JSON/g, "词表");
};

function RevisionAssist({ reply, issue }) {
  const [notice, setNotice] = useState("");
  const prompt = buildRevisionPrompt(reply, issue);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("已复制，发给 AI 后把新回复贴回来。");
    } catch {
      setNotice("复制失败，请展开手动复制。");
    }
  };
  return (
    <div className="revision-assist">
      <button type="button" className="secondary-action" onClick={copy}>复制给 AI 重改</button>
      {notice ? <span className="fill-note" role="status">{notice}</span> : null}
      <details className="fill-prompt-details">
        <summary>看看要复制的话</summary>
        <textarea className="fill-prompt" readOnly rows="6" value={prompt} onFocus={(event) => event.target.select()} aria-label="给 AI 的重改请求" />
      </details>
    </div>
  );
}

export default function ImportView({
  canContinue,
  onContinue,
  hasWaves,
  onSample,
  onImport,
}) {
  const [stage, setStage] = useState("input");
  const [sourceMode, setSourceMode] = useState("paste");
  const [sourceText, setSourceText] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [conversionOpen, setConversionOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillReply, setFillReply] = useState("");
  const [fillError, setFillError] = useState("");
  const [fillErrorDetail, setFillErrorDetail] = useState("");
  const [fillNotice, setFillNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [assistReply, setAssistReply] = useState("");
  const [assistError, setAssistError] = useState("");
  const [assistErrorDetail, setAssistErrorDetail] = useState("");
  const [assistCopyNotice, setAssistCopyNotice] = useState("");
  const [failedFile, setFailedFile] = useState("");
  const headingRef = useRef(null);
  const pasteRef = useRef(null);
  const fileRef = useRef(null);

  const entries = draft?.entries ?? EMPTY_ENTRIES;
  const missingMaterial = useMemo(() => entries.filter(needsFillMaterial), [entries]);
  const withZh = entries.filter((entry) => entry.meaningZh).length;
  const skipped = draft?.skipped?.filter((line) => line.reason !== "heading") ?? [];
  const activeStep = stage === "preview" ? 1 : 0;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stage]);

  useEffect(() => {
    if (sourceMode === "paste") pasteRef.current?.focus({ preventScroll: true });
  }, [sourceMode]);

  const acceptText = (text, label = "") => {
    setSourceText(text);
    try {
      const parsed = { entries: parseJsonDeck(text), format: "json", skipped: [] };
      const normalized = normalizeDeck(parsed.entries);
      if (!normalized.length) throw new Error("没有认出可用的单词，请检查词表内容。");
      setDraft({
        ...parsed,
        entries: normalized,
        worksheetLike: false,
        sourceName: label,
      });
      setError("");
      setErrorDetail("");
      setFailedFile("");
      setShowAll(false);
      setFillOpen(false);
      setFillNotice("");
      setAssistReply("");
      setAssistError("");
      setAssistErrorDetail("");
      setAssistCopyNotice("");
      setStage("preview");
    } catch (parseError) {
      setError(learnerError(parseError));
      setErrorDetail(parseError?.message || "无法识别这份词表。");
      if (label && label !== "粘贴内容") setFailedFile(label);
    }
  };

  const handleFile = async (file) => {
    if (!file || parsing) return;
    setError("");
    setErrorDetail("");
    setFailedFile("");
    setParsing(true);
    try {
      if (!file.name.toLowerCase().endsWith(".json")) throw new Error("只支持 .json 词表。请先用下方提示词把原材料转成 JSON。");
      acceptText(await file.text(), file.name);
    } catch (fileError) {
      setError(learnerError(fileError));
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
    setErrorDetail("");
    setFillOpen(false);
    setAssistError("");
    setAssistErrorDetail("");
    setFailedFile("");
    setStage("input");
  };

  const openFailedFileAssist = () => {
    setDraft({ entries: [], skipped: [], worksheetLike: true, sourceName: failedFile || "待转换的材料" });
    setError("");
    setErrorDetail("");
    setAssistReply("");
    setAssistError("");
    setAssistErrorDetail("");
    setAssistCopyNotice("");
    setStage("preview");
  };

  const startImport = async () => {
    if (!entries.length || busy) return;
    setBusy(true);
    setError("");
    setErrorDetail("");
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
      setCopyNotice("已复制。发给 AI 后，把回复贴到下面。");
    } catch {
      setCopyNotice("复制失败，请展开「看看这段话」手动复制。");
    }
  };

  const copyWorksheetPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildWorksheetPrompt());
      setAssistCopyNotice("已复制。把它和你的词表一起发给 DeepSeek 或 ChatGPT。");
    } catch {
      setAssistCopyNotice("复制失败，请展开提示词手动复制。");
    }
  };

  const applyWorksheetReply = () => {
    setAssistError("");
    setAssistErrorDetail("");
    if (!assistReply.trim()) {
      setAssistError("先把 AI 的回复粘贴进来。");
      return;
    }
    try {
      const normalized = normalizeDeck(parseMaterialReply(assistReply));
      if (!normalized.length) throw new Error("没有在回复里找到词表。请让 AI 按提示里的格式重新输出。");
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
      setAssistError(learnerError(replacementError));
      setAssistErrorDetail(replacementError?.message || "没看懂这份回复。");
    }
  };

  const applyFill = () => {
    setFillError("");
    setFillErrorDetail("");
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
      setFillError(learnerError(mergeError));
      setFillErrorDetail(mergeError?.message || "没看懂这份回复。");
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
            <h1 id="import-title" ref={headingRef} tabIndex="-1">先让 AI 整理这份词表。</h1>
            <p className="import-summary">
              {entries.length
                ? "单词和释义分开放，闪词猜不出谁配谁，需要 AI 先整理好。"
                : "把原文件或文字和提示词一起发给 AI，再把生成内容贴回来。"}
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
              <p className="fill-step"><span>3</span>把 AI 生成的内容粘贴回来。</p>
              <textarea
                className="fill-reply"
                rows="6"
                value={assistReply}
                onChange={(event) => setAssistReply(event.target.value)}
                placeholder="把 AI 生成的内容粘贴到这里"
                aria-label="AI 词表回复"
              />
              {assistError ? <p className="inline-error" role="alert">{assistError}</p> : null}
              {assistErrorDetail ? <RevisionAssist reply={assistReply} issue={assistErrorDetail} /> : null}
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
                让 AI 帮忙补全
              </button>
            </div>
          ) : null}
          {fillNotice ? <p className="inline-success" role="status">{fillNotice}</p> : null}

          {fillOpen ? (
            <section className="fill-panel" aria-labelledby="fill-panel-title">
              <div className="fill-heading-row">
                <h2 id="fill-panel-title">让 AI 帮忙补全</h2>
                <button type="button" className="text-button" onClick={() => { setFillOpen(false); setCopyNotice(""); }}>收起</button>
              </div>
              <div className="fill-actions">
                <button type="button" className="secondary-action" onClick={copyFillPrompt}>复制给 AI 的话</button>
                {copyNotice ? <span className="fill-note" role="status">{copyNotice}</span> : null}
              </div>
              <details className="fill-prompt-details">
                <summary>看看这段话</summary>
                <textarea className="fill-prompt" readOnly rows="10" value={buildFillPrompt(entries)} onFocus={(event) => event.target.select()} aria-label="补全提示词" />
              </details>
              <textarea
                className="fill-reply"
                rows="7"
                value={fillReply}
                onChange={(event) => setFillReply(event.target.value)}
                placeholder="把 AI 生成的内容粘贴到这里"
                aria-label="AI 回复"
              />
              {fillError ? <p className="inline-error" role="alert">{fillError}</p> : null}
              {fillErrorDetail ? <RevisionAssist reply={fillReply} issue={fillErrorDetail} /> : null}
              <button type="button" className="primary-action" onClick={applyFill}>识别并补全</button>
            </section>
          ) : null}

          <ul className="preview-list" aria-label="词表预览">
            {(showAll ? entries : entries.slice(0, 5)).map((entry, index) => (
              <li key={`${entry.term}-${index}`} className={!entry.meaningZh || !entry.meaning ? "is-missing" : ""}>
                <strong>{entry.term}</strong>
                <span className="preview-meaning">
                  <span>{entry.meaningZh || entry.meaning || "缺中文释义"}</span>
                  {!entry.meaningZh && entry.meaning ? <small>缺中文释义</small> : null}
                  {!entry.meaning ? <small>缺英文释义</small> : null}
                </span>
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
            </details>
          ) : null}

          {error ? <p className="inline-error" role="alert">{error}</p> : null}

          <button type="button" className="primary-action import-start" disabled={busy} onClick={startImport}>
            {busy ? "正在加入…" : `开始练这 ${entries.length} 个词`}
          </button>
        </div>
        )
      ) : (
        <div className="import-step-body">
          {canContinue ? <button type="button" className="text-button import-back" onClick={onContinue}>← 继续学习</button> : null}
          <div className="import-title-row">
            <h1 id="import-title" ref={headingRef} tabIndex="-1">{hasWaves ? "再加一组词。" : "单词表在哪？"}</h1>
            <InfoTip label="数据存放说明">词表和进度只保存在这台设备，不会上传。</InfoTip>
          </div>

          <details className="conversion-guide" open={conversionOpen} onToggle={(event) => setConversionOpen(event.currentTarget.open)}>
            <summary>用 AI 整理词表</summary>
            <div className="conversion-body">
              <p className="fill-step"><span>1</span>复制这段话，和你的 Word 词表一起发给 AI。</p>
              <div className="fill-actions">
                <button type="button" className="secondary-action" onClick={copyWorksheetPrompt}>复制给 AI 的话</button>
                <span className="conversion-links">
                  <a className="text-button" href="https://chat.deepseek.com/" target="_blank" rel="noreferrer">DeepSeek</a>
                  <a className="text-button" href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a>
                </span>
                {assistCopyNotice ? <span className="fill-note" role="status">{assistCopyNotice}</span> : null}
              </div>
              <details className="fill-prompt-details">
                <summary>看看提示词</summary>
                <textarea className="fill-prompt" readOnly rows="10" value={buildWorksheetPrompt()} onFocus={(event) => event.target.select()} aria-label="整理提示词" />
              </details>
              <p className="fill-step"><span>2</span>把 AI 生成的内容复制回来，贴到下面。</p>
              {failedFile ? (
                <button type="button" className="text-button import-ai-fallback" onClick={openFailedFileAssist}>
                  也可以在这里粘贴 AI 回复
                </button>
              ) : null}
            </div>
          </details>

          <div className="source-tabs" role="group" aria-label="词表来源">
            <button type="button" aria-pressed={sourceMode === "paste"} disabled={parsing} onClick={() => { setSourceMode("paste"); setError(""); setErrorDetail(""); setFailedFile(""); }}>
              粘贴
            </button>
            <button type="button" aria-pressed={sourceMode === "file"} disabled={parsing} onClick={() => { setSourceMode("file"); setError(""); setErrorDetail(""); setFailedFile(""); fileRef.current?.click(); }}>
              文件
            </button>
          </div>

          <input
            ref={fileRef}
            id="deck-file-input"
            className="import-file-input"
            type="file"
            accept=".json,application/json"
            disabled={parsing}
            onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }}
          />
          {sourceMode === "file" ? (
            <label
              htmlFor="deck-file-input"
              className={`drop-card${dragActive ? " is-dragging" : ""}${parsing ? " is-busy" : ""}`}
              aria-busy={parsing || undefined}
              onDragOver={(event) => { event.preventDefault(); if (!parsing) setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <span className="drop-icon"><FileIcon /></span>
              <strong>{parsing ? "正在识别…" : dragActive ? "松手，开始识别" : "把 AI 整理好的文件拖到这里，或点击选择"}</strong>
              <span className="sr-only" role="status">{parsing ? "正在识别文件" : ""}</span>
            </label>
          ) : (
            <div className="paste-panel">
              <textarea
                ref={pasteRef}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="把 AI 生成的内容粘贴到这里"
                aria-label="单词表内容"
              />
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  if (!sourceText.trim()) {
                    setError("先把 AI 生成的内容粘贴到框里。");
                    setErrorDetail("");
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
          {errorDetail && sourceText ? <RevisionAssist reply={sourceText} issue={errorDetail} /> : null}

          {!hasWaves ? (
            <button type="button" className="text-button import-sample" disabled={parsing} onClick={onSample}>
              没有词表？用 24 个示例词试试
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
