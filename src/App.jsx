import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import ManagePanel from "./components/ManagePanel.jsx";
import SpellView from "./components/SpellView.jsx";
import StudyView from "./components/StudyView.jsx";
import { EmptyView, PauseView, PrepareView } from "./components/StatusView.jsx";
import { cloneDeck } from "./data/baseDeck.js";
import { useAppKeyboard } from "./hooks/useAppKeyboard.js";
import { usePronunciation } from "./hooks/usePronunciation.js";
import { useQuietChrome } from "./hooks/useQuietChrome.js";
import deepUnderstandingPrompt from "./prompts/deep-understanding.md?raw";
import {
  buildExportDeck,
  createCardIds,
  createInitialState,
  learningReducer,
} from "./learningAlgorithm.js";
import { readDeckAssets, writeDeckAssets } from "./storage/learningStorage.js";
import {
  buildMarkdownExport,
  normalizeDeck,
  parseDeckFromText,
  readImportFile,
} from "./utils/deckImport.js";

const COMPLETION_PROMPT = `请把我提供的英语单词整理成可导入闪词的 JSON 数组。每项保留 term、syllables、respell、pos、meaning、meaningZh、wordOrigin、relatedWord 和 examples。meaning 使用简短易懂的英英释义；examples 提供 2–3 个自然的 B1–B2 例句，每项包含 sentence 与在句中原样出现的 focus。只输出 JSON 代码块，不要附加说明。`;

const downloadText = (content, type, filename) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export default function App() {
  const [loaded] = useState(() => readDeckAssets());
  const [state, dispatch] = useReducer(
    learningReducer,
    loaded.assets,
    (assets) =>
      createInitialState({
        assets: assets
          ? { ...assets, sourceDeck: normalizeDeck(assets.sourceDeck) }
          : null,
      }),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelConfirmRequest, setPanelConfirmRequest] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [panelMessage, setPanelMessage] = useState(loaded.warning ?? "");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState("");
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const panelRef = useRef(null);
  const panelTriggerRef = useRef(null);
  const spellInputRef = useRef(null);
  const queuedAfterFailureRef = useRef(false);
  const { isSupported: pronunciationSupported, queueSpeech, speak } = usePronunciation();
  const { quiet, showChrome, hideForLearning } = useQuietChrome({ heldOpen: panelOpen });

  const cardIds = useMemo(() => createCardIds(state.sourceDeck), [state.sourceDeck]);
  const itemById = useMemo(
    () => new Map(cardIds.map((cardId, index) => [cardId, state.sourceDeck[index]])),
    [cardIds, state.sourceDeck],
  );
  const currentStudyId = state.studyQueueIds[state.studyIndex] ?? null;
  const currentSpellId = state.spellQueueIds[state.spellIndex] ?? null;
  const currentStudyItem = itemById.get(currentStudyId) ?? null;
  const currentSpellItem = itemById.get(currentSpellId) ?? null;
  const removedEntries = useMemo(
    () =>
      state.removedCardIds
        .map((cardId) => ({ cardId, term: itemById.get(cardId)?.term }))
        .filter((entry) => entry.term),
    [itemById, state.removedCardIds],
  );
  const exportDeck = useMemo(() => {
    return buildExportDeck(state.sourceDeck, state.removedCardIds);
  }, [state.removedCardIds, state.sourceDeck]);

  useEffect(() => {
    const result = writeDeckAssets({
      sourceDeck: state.sourceDeck,
      removedCardIds: state.removedCardIds,
    });
    if (!result.success) {
      setPanelMessage("本次可继续，下次可能不保留。浏览器没有允许保存这份词表。");
    }
  }, [state.removedCardIds, state.sourceDeck]);

  useEffect(() => {
    if (!state.undo) {
      setUndoToastVisible(false);
      return undefined;
    }
    setUndoToastVisible(true);
    const timer = window.setTimeout(() => setUndoToastVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [state.undo]);

  useEffect(() => {
    if (state.mode !== "study") {
      queuedAfterFailureRef.current = false;
      return;
    }
    if (!state.autoPronounceEnabled || !currentStudyItem?.term) return;
    if (queuedAfterFailureRef.current) {
      queuedAfterFailureRef.current = false;
      queueSpeech(currentStudyItem.term);
    } else {
      speak(currentStudyItem.term);
    }
  }, [
    currentStudyId,
    currentStudyItem?.term,
    queueSpeech,
    speak,
    state.autoPronounceEnabled,
    state.mode,
  ]);

  useEffect(() => {
    if (state.mode === "spell") spellInputRef.current?.focus();
  }, [state.mode, state.spellIndex, state.spellResult]);

  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.querySelector("button, input, textarea")?.focus();
  }, [panelOpen]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setPanelConfirmRequest(null);
    window.setTimeout(() => panelTriggerRef.current?.focus(), 0);
  }, []);

  const openPanel = useCallback(() => {
    panelTriggerRef.current = document.activeElement;
    setPanelConfirmRequest(null);
    setPanelOpen(true);
  }, []);

  const openSampleConfirm = useCallback(() => {
    panelTriggerRef.current = document.activeElement;
    setPanelConfirmRequest("sample");
    setPanelOpen(true);
  }, []);

  const copyText = useCallback(async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(successMessage);
      setManualCopy("");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    } catch {
      setCopyFeedback("复制失败，可在下方手动复制。");
      setManualCopy(text);
    }
  }, []);

  const copyCurrentWord = useCallback(
    (event) => {
      event.stopPropagation();
      event.currentTarget.blur();
      if (!currentStudyItem?.term) return;
      const deepRequest = `${deepUnderstandingPrompt.trim()}\n\n当前单词：${currentStudyItem.term}`;
      copyText(
        event.shiftKey ? deepRequest : currentStudyItem.term,
        event.shiftKey ? "深度理解请求已复制。" : "单词已复制。",
      );
    },
    [copyText, currentStudyItem?.term],
  );

  const reveal = useCallback(() => {
    if (state.autoPronounceEnabled) speak(currentStudyItem?.term);
    dispatch({ type: "REVEAL" });
  }, [currentStudyItem?.term, speak, state.autoPronounceEnabled]);

  const answerStudy = useCallback(
    (correct) => {
      if (!state.revealed) return;
      if (!correct && state.autoPronounceEnabled) {
        speak(currentStudyItem?.term);
        queuedAfterFailureRef.current = true;
      }
      dispatch({ type: "ANSWER_STUDY", correct });
    },
    [currentStudyItem?.term, speak, state.autoPronounceEnabled, state.revealed],
  );

  const submitSpell = useCallback(() => {
    if (!state.spellInput.trim()) return;
    if (state.autoPronounceEnabled) speak(currentSpellItem?.term);
    dispatch({ type: "SUBMIT_SPELL" });
  }, [currentSpellItem?.term, speak, state.autoPronounceEnabled, state.spellInput]);

  const importDeck = useCallback((rawDeck) => {
    const normalized = normalizeDeck(rawDeck);
    if (!normalized.length) throw new Error("内容中没有有效的单词。");
    dispatch({ type: "REPLACE_DECK", sourceDeck: normalized });
    setPanelMessage(`已导入 ${normalized.length} 个词，并开始第一轮辨识。`);
    setPasteText("");
  }, []);

  const handleFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await readImportFile(file);
        importDeck(parseDeckFromText(text));
      } catch (error) {
        setPanelMessage(`导入失败：${error?.message || "无法解析文件内容。"} 原词表保持不变。`);
      } finally {
        event.target.value = "";
      }
    },
    [importDeck],
  );

  const handlePasteImport = useCallback(() => {
    try {
      importDeck(parseDeckFromText(pasteText));
    } catch (error) {
      setPanelMessage(`导入失败：${error?.message || "无法识别粘贴内容。"} 原词表保持不变。`);
    }
  }, [importDeck, pasteText]);

  const useSample = useCallback(() => {
    dispatch({ type: "USE_SAMPLE", sourceDeck: cloneDeck() });
    setPanelMessage("已恢复 24 个示例词。");
  }, []);

  useAppKeyboard({
    mode: state.mode,
    revealed: state.revealed,
    panelOpen,
    onReveal: reveal,
    onHide: () => dispatch({ type: "HIDE" }),
    onAnswer: answerStudy,
    onPrevious: () => dispatch({ type: "PREVIOUS_STUDY" }),
    onRemove: () => dispatch({ type: "REMOVE_CURRENT" }),
    onResume: () => dispatch({ type: "RESUME_SPELL" }),
    onPauseToStudy: () => dispatch({ type: "PAUSE_TO_STUDY" }),
    onPauseSpell: () => dispatch({ type: "PAUSE_SPELL" }),
    onClosePanel: closePanel,
    onLearningKey: hideForLearning,
    onShowChrome: showChrome,
  });

  const progress =
    state.mode === "study"
      ? { current: state.studyIndex + 1, total: state.studyQueueIds.length, label: "辨识" }
      : state.mode === "spell"
        ? { current: state.spellIndex + 1, total: state.spellQueueIds.length, label: "拼写" }
        : null;

  return (
    <div className={`app-shell${quiet ? " is-quiet" : ""}`}>
      <header className="app-header" onFocusCapture={showChrome}>
        <div className="brand">闪词 <span>3.0</span></div>
        <nav className="header-actions" aria-label="全局工具">
          {state.undo ? <button type="button" className="header-button undo-button" onClick={() => dispatch({ type: "UNDO" })}>{state.undo.label}</button> : null}
          <button type="button" className="header-button import-button" onClick={openPanel}>Import</button>
          <button ref={panelTriggerRef} type="button" className="header-button" onClick={openPanel}>更多</button>
          <a className="github-link" href="https://github.com/Ganzhe2028/vocab2" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看闪词">GH</a>
        </nav>
      </header>

      {undoToastVisible && state.undo ? (
        <div className="undo-toast" role="status">
          <span>{state.notice || "管理操作已完成。"}</span>
          <button type="button" onClick={() => dispatch({ type: "UNDO" })}>{state.undo.label}</button>
        </div>
      ) : null}

      <main className="reading-column">
        {state.notice && !undoToastVisible ? <p className="page-notice" role="status">{state.notice}</p> : null}
        {state.mode === "prepare" ? (
          <PrepareView
            pasteText={pasteText}
            message={panelMessage}
            onPasteChange={setPasteText}
            onPasteImport={handlePasteImport}
            onFile={handleFile}
            onSample={useSample}
          />
        ) : null}
        {state.mode === "study" && currentStudyItem ? (
          <StudyView
            item={currentStudyItem}
            revealed={state.revealed}
            insightsExpanded={state.insightsExpanded}
            pronunciationSupported={pronunciationSupported}
            copyFeedback={copyFeedback}
            onCopy={copyCurrentWord}
            onPronounce={() => speak(currentStudyItem.term)}
            onReveal={reveal}
            onHide={() => dispatch({ type: "HIDE" })}
            onAnswer={answerStudy}
            onToggleInsights={() => dispatch({ type: "TOGGLE_INSIGHTS" })}
          />
        ) : null}
        {state.mode === "spell" && currentSpellItem ? (
          <SpellView
            item={currentSpellItem}
            value={state.spellInput}
            result={state.spellResult}
            inputRef={spellInputRef}
            onChange={(value) => dispatch({ type: "SET_SPELL_INPUT", value })}
            onSubmit={submitSpell}
            onAdvance={() => dispatch({ type: "ADVANCE_SPELL" })}
            onPause={() => dispatch({ type: "PAUSE_SPELL" })}
          />
        ) : null}
        {state.mode === "pause" ? (
          <PauseView
            onResume={() => dispatch({ type: "RESUME_SPELL" })}
            onStudy={() => dispatch({ type: "PAUSE_TO_STUDY" })}
          />
        ) : null}
        {state.mode === "empty" ? (
          <EmptyView
            canUndo={Boolean(state.undo)}
            onUndo={() => dispatch({ type: "UNDO" })}
            onManage={openPanel}
            onSample={openSampleConfirm}
          />
        ) : null}

        {manualCopy ? (
          <section className="manual-copy" aria-labelledby="manual-copy-title">
            <div><strong id="manual-copy-title">手动复制</strong><button type="button" className="text-button" onClick={() => setManualCopy("")}>关闭</button></div>
            <textarea readOnly value={manualCopy} rows="6" onFocus={(event) => event.target.select()} />
          </section>
        ) : null}
      </main>

      {progress ? (
        <footer className="progress-footer">
          <div className="progress-meta"><span>{progress.label}</span><span>{progress.current} / {progress.total}</span></div>
          <div className="progress-track" aria-label={`${progress.label}进度 ${progress.current} / ${progress.total}`} role="progressbar" aria-valuemin="1" aria-valuemax={progress.total} aria-valuenow={progress.current}>
            <span style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <button type="button" className="remove-current" onClick={() => dispatch({ type: "REMOVE_CURRENT" })}>从本词表移出</button>
        </footer>
      ) : null}

      <ManagePanel
        open={panelOpen}
        panelRef={panelRef}
        sourceDeck={state.sourceDeck}
        removedEntries={removedEntries}
        autoPronounceEnabled={state.autoPronounceEnabled}
        pronunciationSupported={pronunciationSupported}
        pasteText={pasteText}
        message={panelMessage}
        initialConfirmAction={panelConfirmRequest}
        onClose={closePanel}
        onFile={handleFile}
        onPasteChange={setPasteText}
        onPasteImport={handlePasteImport}
        onExportJson={() => downloadText(JSON.stringify(exportDeck, null, 2), "application/json", "flashvocab-deck.json")}
        onExportMarkdown={() => downloadText(buildMarkdownExport(exportDeck), "text/markdown", "flashvocab-deck.md")}
        onCopyCompletionPrompt={() => copyText(COMPLETION_PROMPT, "词表补全提示词已复制。")}
        onSetAutoPronounce={(value) => dispatch({ type: "SET_AUTO_PRONOUNCE", value })}
        onRestoreRemoved={(cardId) => dispatch({ type: "RESTORE_REMOVED", cardId })}
        onReset={() => dispatch({ type: "RESET_PROGRESS" })}
        onSample={useSample}
        onConfirmConsumed={() => setPanelConfirmRequest(null)}
      />
    </div>
  );
}
