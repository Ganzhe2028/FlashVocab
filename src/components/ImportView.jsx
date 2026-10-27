import { useMemo, useState } from "react";
import {
  normalizeDeck,
  parseDeckFromTextDetailed,
  readImportFile,
} from "../utils/deckImport.js";
import { buildFillPrompt, mergeFilledEntries } from "../utils/importFill.js";

const EMPTY_ENTRIES = [];

const FORMAT_LABELS = {
  json: "JSON",
  markdown: "Markdown",
  table: "表格",
  list: "文本",
};

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
  wavePlaceholder,
  onManage,
  onSample,
  onImport,
}) {
  const [stage, setStage] = useState("input");
  const [sourceText, setSourceText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [waveName, setWaveName] = useState("");
  const [fillOpen, setFillOpen] = useState(false);
  const [fillReply, setFillReply] = useState("");
  const [fillError, setFillError] = useState("");
  const [fillNotice, setFillNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");

  const entries = draft?.entries ?? EMPTY_ENTRIES;
  const missingZh = useMemo(() => entries.filter((entry) => !entry.meaningZh), [entries]);
  const withZh = entries.length - missingZh.length;
  const withPos = entries.filter((entry) => entry.pos).length;
  const withExamples = entries.filter((entry) => entry.examples?.length).length;
  const skipped = draft?.skipped?.filter((line) => line.reason !== "heading") ?? [];
  const skippedHeadings = draft?.skipped?.filter((line) => line.reason === "heading") ?? [];

  const acceptText = (text, label) => {
    try {
      const parsed = parseDeckFromTextDetailed(text);
      const normalized = normalizeDeck(parsed.entries);
      if (!normalized.length) throw new Error("没有认出可用的单词，请检查词表内容。");
      setDraft({ ...parsed, entries: normalized });
      setSourceText(text);
      setSourceLabel(label);
      setError("");
      setShowAll(false);
      setFillOpen(false);
      setFillNotice("");
      setStage("preview");
    } catch (parseError) {
      setError(parseError?.message || "无法识别这份词表。");
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    try {
      const text = await readImportFile(file);
      acceptText(text, file.name);
    } catch (fileError) {
      setError(fileError?.message || "无法读取这个文件。");
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFile(event.dataTransfer?.files?.[0]);
  };

  const startImport = async () => {
    if (!entries.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await onImport(entries, { name: waveName.trim() });
    } catch (importError) {
      setError(importError?.message || "导入失败，原词表没有变化。");
      setBusy(false);
    }
  };

  const copyFillPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildFillPrompt(entries));
      setCopyNotice("已复制。发给 AI 后，把回复粘贴到下面。");
    } catch {
      setCopyNotice("复制失败，请手动选中上面的文字。");
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
      setFillOpen(false);
      setFillNotice(`补全了 ${result.filled} 个词。`);
    } catch (mergeError) {
      setFillError(mergeError?.message || "没看懂这份回复。");
    }
  };

  if (stage === "preview") {
    return (
      <section className="import-view" aria-labelledby="import-preview-title">
        <button type="button" className="text-button import-back" onClick={() => setStage("input")}>
          ← 换一份词表
        </button>
        <p className="eyebrow">已识别</p>
        <h1 id="import-preview-title">认出 {entries.length} 个词。</h1>
        <p className="import-source">{sourceLabel || "粘贴内容"} · {FORMAT_LABELS[draft.format] ?? "文本"}</p>

        <ul className="import-stats" aria-label="识别结果摘要">
          <li className={withZh ? "is-good" : "is-warn"}>{withZh} 个有中文释义</li>
          <li>{withPos} 个有词性</li>
          <li>{withExamples} 个带例句</li>
          {missingZh.length ? <li className="is-warn">{missingZh.length} 个缺中文释义</li> : null}
        </ul>

        {missingZh.length ? (
          <div className="missing-callout">
            <div>
              <strong>有 {missingZh.length} 个词没有中文释义。</strong>
              <p>不补也能导入，但认词时看不到中文答案。</p>
            </div>
            <button type="button" className="secondary-action" onClick={() => { setFillOpen(true); setFillNotice(""); setCopyNotice(""); }}>
              补中文释义
            </button>
          </div>
        ) : null}
        {fillNotice ? <p className="inline-success" role="status">{fillNotice}</p> : null}

        {fillOpen ? (
          <section className="fill-panel" aria-labelledby="fill-panel-title">
            <div className="fill-heading-row">
              <h2 id="fill-panel-title">让 AI 补这 {missingZh.length} 个词</h2>
              <button type="button" className="text-button" onClick={() => { setFillOpen(false); setCopyNotice(""); }}>收起</button>
            </div>
            <p className="fill-step"><span>1</span>复制下面这段话，发给 DeepSeek、ChatGPT 或任意 AI。</p>
            <textarea className="fill-prompt" readOnly rows="7" value={buildFillPrompt(entries)} onFocus={(event) => event.target.select()} aria-label="补全提示词" />
            <div className="fill-actions">
              <button type="button" className="secondary-action" onClick={copyFillPrompt}>复制这段话</button>
              {copyNotice ? <span className="fill-note" role="status">{copyNotice}</span> : null}
            </div>
            <p className="fill-step"><span>2</span>把 AI 的回复整段粘贴回来，词表会自动补上。</p>
            <textarea
              className="fill-reply"
              rows="6"
              value={fillReply}
              onChange={(event) => setFillReply(event.target.value)}
              placeholder={"abandon | v. | 放弃 | to leave something\nbenefit | n. | 好处 | an advantage"}
              aria-label="AI 回复"
            />
            {fillError ? <p className="inline-error" role="alert">{fillError}</p> : null}
            <button type="button" className="primary-action" onClick={applyFill}>识别并补全</button>
          </section>
        ) : null}

        <ul className="preview-list" aria-label="词表预览">
          {(showAll ? entries : entries.slice(0, 6)).map((entry, index) => (
            <li key={`${entry.term}-${index}`} className={!entry.meaningZh && !entry.meaning ? "is-missing" : ""}>
              <strong>{entry.term}</strong>
              <span className="preview-pos">{entry.pos || ""}</span>
              <span className="preview-meaning">{entry.meaningZh || entry.meaning || "缺释义"}</span>
            </li>
          ))}
        </ul>
        {entries.length > 6 ? (
          <button type="button" className="text-button preview-more" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "收起预览" : `展开全部 ${entries.length} 个`}
          </button>
        ) : null}

        {skipped.length ? (
          <details className="skipped-details">
            <summary>{skipped.length} 行没看懂，已跳过</summary>
            <ul>
              {skipped.slice(0, 20).map((line, index) => (
                <li key={`${line.line}-${index}`}>
                  <code>{line.line}</code>
                  <span>{line.reason === "sentence" ? "像完整句子" : "没有单词"}</span>
                </li>
              ))}
            </ul>
            <p>如果是标题或备注可以不管；如果是单词，回上一步改一下原文。</p>
          </details>
        ) : null}
        {skippedHeadings.length ? <p className="import-skip-note">已忽略 {skippedHeadings.length} 行标题或日期。</p> : null}

        <details className="name-details">
          <summary>给这组词起个名字（可选）</summary>
          <input
            className="wave-name"
            value={waveName}
            placeholder={wavePlaceholder}
            disabled={busy}
            onChange={(event) => setWaveName(event.target.value)}
            aria-label="这组词的名字"
          />
        </details>

        {hasWaves ? <p className="import-keep-note">原来的词表会保留，可在「词表」里切回。</p> : null}
        {error ? <p className="inline-error" role="alert">{error}</p> : null}

        <div className="preview-actions">
          <button type="button" className="primary-action" disabled={busy} onClick={startImport}>
            {busy ? "正在加入…" : `开始背这 ${entries.length} 个词`}
          </button>
          <button type="button" className="secondary-action" disabled={busy} onClick={() => setStage("input")}>
            调整原文
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="import-view" aria-labelledby="import-title">
      {canContinue ? (
        <div className="resume-strip">
          <span>刚才的学习还留着。</span>
          <button type="button" className="secondary-action" onClick={onContinue}>继续学习</button>
        </div>
      ) : null}

      <p className="eyebrow">导入词表</p>
      <h1 id="import-title">{hasWaves ? "再加一组词。" : "把单词表放进来。"}</h1>
      <p className="status-lead">老师发的 Word、Excel、CSV、纯文本都行；也可以直接粘贴。</p>

      <div className="import-grid">
        <label
          className={`drop-card${dragActive ? " is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".docx,.xlsx,.doc,.xls,.csv,.txt,.md,.markdown,.json"
            onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }}
          />
          <span className="drop-icon"><FileIcon /></span>
          <strong>{dragActive ? "松手，开始识别" : "选择或拖入文件"}</strong>
          <span>Word · Excel · CSV · TXT · Markdown</span>
        </label>

        <div className="paste-card">
          <label htmlFor="import-paste">粘贴单词表</label>
          <textarea
            id="import-paste"
            rows="8"
            value={sourceText}
            placeholder={"abandon 放弃\nbenefit 好处\n\ntake off 起飞"}
            onChange={(event) => setSourceText(event.target.value)}
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
            看看认出了什么
          </button>
        </div>
      </div>

      <p className="import-format-hint">每行一个词即可。词后面跟中文、词性、音标都能识别；编号和表格也可以。</p>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}

      <div className="import-footer">
        <button type="button" className="text-button" onClick={onSample}>没有词表？用 24 个示例词试试 →</button>
        {hasWaves ? <button type="button" className="text-button" onClick={onManage}>查看已有词表</button> : null}
      </div>
      <p className="prepare-note">词表只保存在这台设备，不需要登录。刷新会重新开始本轮练习。</p>
    </section>
  );
}
