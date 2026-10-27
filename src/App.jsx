import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import ManagePanel from "./components/ManagePanel.jsx";
import AIPreparationControls from "./components/AIPreparationControls.jsx";
import { DEFAULT_PREPARATION_MODEL, prepareDeckWithAI } from "./aiPreparation.js";
import ImportView from "./components/ImportView.jsx";
import QuestionView from "./components/QuestionView.jsx";
import SpellView from "./components/SpellView.jsx";
import StudyView from "./components/StudyView.jsx";
import { EmptyView, MasteredView, PauseView, SummaryView } from "./components/StatusView.jsx";
import { isGraduated } from "./mastery.js";
import { getEntryWaveId } from "./waveModel.js";
import { cloneDeck } from "./data/baseDeck.js";
import { useAppKeyboard } from "./hooks/useAppKeyboard.js";
import { usePronunciation } from "./hooks/usePronunciation.js";
import { useQuietChrome } from "./hooks/useQuietChrome.js";
import { useThemePreference } from "./hooks/useThemePreference.js";
import deepUnderstandingPrompt from "./prompts/deep-understanding.md?raw";
import {
  buildExportDeck,
  createCardIds,
  createInitialState,
  getActiveCardIds,
  getCurrentStudyCardId,
  learningReducer,
} from "./learningAlgorithm.js";
import { readDeckAssets, writeDeckAssets } from "./storage/learningStorage.js";
import { readMastery, writeMastery } from "./storage/masteryStorage.js";
import {
  buildMarkdownExport,
  normalizeDeck,
} from "./utils/deckImport.js";

const POINTER_FOCUS_SELECTOR =
  'button, a[href], input[type="checkbox"], input[type="radio"], [role="button"]';

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

const commitLearningTransition = (_previous, next) => next;

export default function App() {
  const [loaded] = useState(() => {
    const assets = readDeckAssets();
    const mastery = readMastery();
    return { ...assets, mastery: mastery.mastery, warning: [assets.warning, mastery.warning].filter(Boolean).join(" ") };
  });
  const [state, commitTransition] = useReducer(
    commitLearningTransition,
    loaded.assets,
    (assets) =>
      createInitialState({
        mastery: loaded.mastery,
        assets: assets
          ? { ...assets, sourceDeck: normalizeDeck(assets.sourceDeck) }
          : null,
      }),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSection, setPanelSection] = useState("deck");
  const [panelConfirmRequest, setPanelConfirmRequest] = useState(null);
  const [aiSettings, setAiSettings] = useState({ apiKey: "", model: DEFAULT_PREPARATION_MODEL });
  const [preparing, setPreparing] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState({ current: 0, total: 0 });
  const preparationRequestRef = useRef(null);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const [panelMessage, setPanelMessage] = useState(loaded.warning ?? "");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState("");
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const panelRef = useRef(null);
  const spellInputRef = useRef(null);
  const headerUndoRef = useRef(null);
  const focusUndoAfterToastRef = useRef(false);
  const { isSupported: pronunciationSupported, speak, message: pronunciationMessage } = usePronunciation();
  const { themePreference, setThemePreference } = useThemePreference();
  const { quiet, showChrome, hideForLearning } = useQuietChrome({ heldOpen: panelOpen });

  const dispatch = useCallback((action) => {
    const previous = latestStateRef.current;
    const next = learningReducer(previous, action);
    if (next === previous) return;
    latestStateRef.current = next;
    if (action.type === "UNDO") setPanelMessage("");
    if (next.autoPronounceEnabled && !["ADD_WAVE", "APPLY_PREPARATION"].includes(action.type)) {
      const quickAdvance = action.type === "CHOOSE_STUDY" && previous.quickKnownEnabled && action.correct === true;
      let cardId = null;
      let deck = next.sourceDeck;
      if (action.type === "CHOOSE_STUDY" && !quickAdvance) cardId = getCurrentStudyCardId(previous);
      else if (action.type === "SUBMIT_SPELL") cardId = previous.spellQueueIds[previous.spellIndex];
      else if (next.mode === "study" && (previous.mode !== "study" ||
        getCurrentStudyCardId(previous) !== getCurrentStudyCardId(next) || previous.studyIndex !== next.studyIndex ||
        previous.studySteps !== next.studySteps || (!previous.autoPronounceEnabled && !next.revealed))) {
        cardId = getCurrentStudyCardId(next);
      }
      if (["CHOOSE_STUDY", "SUBMIT_SPELL"].includes(action.type) && !quickAdvance) deck = previous.sourceDeck;
      if (cardId) speak(deck[createCardIds(deck).indexOf(cardId)]?.term);
    }
    commitTransition(next);
  }, [speak]);

  const cardIds = useMemo(() => createCardIds(state.sourceDeck), [state.sourceDeck]);
  const itemById = useMemo(
    () => new Map(cardIds.map((cardId, index) => [cardId, state.sourceDeck[index]])),
    [cardIds, state.sourceDeck],
  );
  const currentStudyId = getCurrentStudyCardId(state);
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
      waves: state.waves,
    });
    if (!result.success) {
      setPanelMessage("本次可继续，下次可能不保留。浏览器没有允许保存这份词表。");
    }
  }, [state.removedCardIds, state.sourceDeck, state.waves]);

  useEffect(() => {
    if (!writeMastery(state.mastery).success) setPanelMessage("掌握度本次可用，但浏览器未允许保存；下次可能不保留。");
  }, [state.mastery]);

  useEffect(() => {
    const request = preparationRequestRef.current;
    if (request && (request.sourceDeck !== state.sourceDeck || request.waves !== state.waves || request.removedCardIds !== state.removedCardIds)) request.controller.abort();
  }, [state.sourceDeck, state.waves, state.removedCardIds]);

  useEffect(() => () => preparationRequestRef.current?.controller.abort(), []);

  useEffect(() => {
    if (!state.undo) {
      focusUndoAfterToastRef.current = false;
      setUndoToastVisible(false);
      return undefined;
    }
    setUndoToastVisible(true);
    const timer = window.setTimeout(() => {
      focusUndoAfterToastRef.current = Boolean(document.activeElement?.closest(".undo-toast"));
      setUndoToastVisible(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [state.undo]);

  useEffect(() => {
    if (!undoToastVisible && focusUndoAfterToastRef.current) {
      focusUndoAfterToastRef.current = false;
      headerUndoRef.current?.focus();
    }
  }, [undoToastVisible]);

  useEffect(() => {
    if (state.mode === "spell") spellInputRef.current?.focus();
  }, [state.mode, state.spellIndex, state.spellResult]);

  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.querySelector("button, input, textarea")?.focus();
  }, [panelOpen]);

  const closePanel = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setPanelOpen(false);
    setPanelConfirmRequest(null);
  }, []);

  const openPanel = useCallback((section = "deck") => {
    setPanelConfirmRequest(null);
    setPanelSection(section);
    setPanelOpen(true);
  }, []);

  const openSampleConfirm = useCallback(() => {
    setPanelConfirmRequest("sample");
    setPanelSection("deck");
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

  const chooseStudy = useCallback((correct) => {
    dispatch({ type: "CHOOSE_STUDY", correct });
  }, [dispatch]);

  const advanceStudy = useCallback(
    (correctOverride) => {
      if (!state.revealed || state.studyResult === null) return;
      const finalResult = typeof correctOverride === "boolean"
        ? correctOverride
        : state.studyResult;
      dispatch({ type: "ADVANCE_STUDY", correct: finalResult });
    },
    [dispatch, state],
  );

  const submitSpell = useCallback(() => {
    if (!state.spellInput.trim() && state.spellResult !== null) return;
    dispatch({ type: "SUBMIT_SPELL" });
  }, [dispatch, state.spellInput, state.spellResult]);

  const prepareMaterial = useCallback(async (deck) => {
    if (preparationRequestRef.current) throw new Error("正在补全资料，请等本次完成或取消。");
    const controller = new AbortController();
    const snapshot = latestStateRef.current;
    const request = { controller, sourceDeck: snapshot.sourceDeck, waves: snapshot.waves, removedCardIds: snapshot.removedCardIds, timedOut: false };
    preparationRequestRef.current = request;
    setPreparing(true);
    const timeout = window.setTimeout(() => { request.timedOut = true; controller.abort(); }, 120000);
    try {
      const result = await prepareDeckWithAI({ deck, apiKey: aiSettings.apiKey, model: aiSettings.model,
        signal: controller.signal, onProgress: setPreparationProgress });
      const current = latestStateRef.current;
      if (controller.signal.aborted || current.sourceDeck !== request.sourceDeck || current.waves !== request.waves || current.removedCardIds !== request.removedCardIds) throw new Error("词表已变化或补全已取消，结果未应用。");
      return result.deck;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(request.timedOut ? "DeepSeek 补全超时，请重试。原词表保持不变。" : "补全已取消，原词表保持不变。");
      throw error;
    } finally {
      window.clearTimeout(timeout);
      preparationRequestRef.current = null;
      setPreparing(false);
    }
  }, [aiSettings.apiKey, aiSettings.model]);

  const importDeck = useCallback(async (rawDeck, options = {}) => {
    const normalized = normalizeDeck(rawDeck);
    if (!normalized.length) throw new Error("内容中没有有效的单词。");
    dispatch({ type: "ADD_WAVE", sourceDeck: normalized, name: options.name ?? "" });
  }, [dispatch]);

  const prepareCurrentWave = useCallback(async () => {
    const snapshot = latestStateRef.current;
    const active = new Set(getActiveCardIds(snapshot));
    const ids = createCardIds(snapshot.sourceDeck);
    const positions = ids.flatMap((cardId, index) => active.has(cardId) ? [index] : []);
    try {
      const deck = await prepareMaterial(positions.map((index) => snapshot.sourceDeck[index]));
      dispatch({ type: "APPLY_PREPARATION", entries: deck.map((entry, index) => ({ cardId: ids[positions[index]], entry })) });
      setPanelMessage(`已补齐 ${deck.length} 个词的资料；可撤销，也可开始情景题或辨析题。`);
    } catch (error) {
      setPanelMessage(`补全未应用：${error?.message || "请求失败，请重试。"}`);
    }
  }, [dispatch, prepareMaterial]);

  const useSample = useCallback(() => {
    dispatch({ type: "USE_SAMPLE", sourceDeck: cloneDeck() });
    setPanelMessage(latestStateRef.current.notice);
  }, [dispatch]);

  const releasePointerFocus = useCallback((event) => {
    if (event.detail === 0) return;
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement.matches(POINTER_FOCUS_SELECTOR)
      ) {
        activeElement.blur();
      }
    }, 0);
  }, []);

  useAppKeyboard({
    mode: state.mode,
    revealed: state.revealed,
    studyResult: state.studyResult,
    panelOpen,
    onChooseStudy: chooseStudy,
    onAdvanceStudy: advanceStudy,
    onPrevious: () => dispatch({ type: "PREVIOUS_STUDY" }),
    onRemove: () => dispatch({ type: "REMOVE_CURRENT" }),
    onResume: () => dispatch({ type: "RESUME_SPELL" }),
    onPauseToStudy: () => dispatch({ type: "PAUSE_TO_STUDY" }),
    onPauseSpell: () => dispatch({ type: "PAUSE_SPELL" }),
    onClosePanel: closePanel,
    onLearningKey: hideForLearning,
    onShowChrome: showChrome,
    onContinueRound: () => dispatch({ type: "CONTINUE_ROUND" }),
    quiz: state.quiz,
    onAnswerQuiz: (answer) => dispatch({ type: "ANSWER_QUIZ", answer }),
    onNextQuiz: () => dispatch({ type: "NEXT_QUIZ" }),
  });

  const progress =
    state.mode === "study"
      ? state.studyPracticeId
        ? { current: 3 - state.studyPractices.find((practice) => practice.cardId === state.studyPracticeId).remaining, total: 2, label: "本轮加练" }
        : { current: state.studyIndex + 1, total: state.studyQueueIds.length, label: "认词" }
      : state.mode === "spell"
        ? { current: state.spellIndex + 1, total: state.spellQueueIds.length, label: "拼写" }
        : null;

  return (
    <div
      className={`app-shell${quiet ? " is-quiet" : ""}`}
      onClick={releasePointerFocus}
    >
      <header className="app-header" onFocusCapture={showChrome}>
        <div className="brand">闪词</div>
        <nav className="header-actions" aria-label="全局工具">
          {state.undo && !undoToastVisible ? <button ref={headerUndoRef} type="button" className="header-button undo-button" onClick={() => dispatch({ type: "UNDO" })}>{state.undo.label}</button> : null}
          {state.waves.length ? <button type="button" className="header-button" onClick={() => openPanel("deck")}>词表</button> : null}
          <button type="button" className="header-icon-button" onClick={() => openPanel("settings")} aria-label="设置">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2h-4v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.9-2.9.1-.1A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.5-1H3v-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1 2.9-2.9.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3h4v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.9 2.9-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2v4h-.2a1.6 1.6 0 0 0-1.5 1Z" /></svg>
          </button>
          <button type="button" className="header-icon-button" onClick={() => openPanel("help")} aria-label="帮助">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4 2c-.9.6-1.6 1.1-1.6 2.2M12 17h.01" /></svg>
          </button>
          <a className="github-link" href="https://github.com/Ganzhe2028/FlashVocab" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看闪词">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 .297a12 12 0 0 0-3.793 23.388c.6.113.82-.26.82-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.386-1.332-1.755-1.332-1.755-1.089-.745.083-.73.083-.73 1.205.084 1.839 1.237 1.839 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.303-5.466-1.332-5.466-5.931 0-1.31.468-2.381 1.235-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 6.099c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.769.84 1.233 1.911 1.233 3.221 0 4.61-2.805 5.625-5.475 5.921.43.371.823 1.102.823 2.222v3.295c0 .32.216.694.825.576A12 12 0 0 0 12 .297Z" clipRule="evenodd" />
            </svg>
          </a>
        </nav>
      </header>

      {undoToastVisible && state.undo ? (
        <div className="undo-toast" role="status">
          <span>{state.notice || "管理操作已完成。"}</span>
          <button type="button" onClick={() => dispatch({ type: "UNDO" })}>{state.undo.label}</button>
        </div>
      ) : null}

      <main className="reading-column">
        {state.mode !== "prepare" && state.waves.length ? <p className="learning-context">{state.waves.filter((wave) => wave.status === "active").map((wave) => wave.name).join(" · ")} · {getActiveCardIds(state).length} 个词</p> : null}
        {state.notice && !undoToastVisible ? <p className="page-notice" role="status">{state.notice}</p> : null}
        {state.mode === "prepare" ? (
          <ImportView
            canContinue={Boolean(state.resumeMode)}
            onContinue={() => dispatch({ type: "CONTINUE_LEARNING" })}
            hasWaves={Boolean(state.waves.length)}
            wavePlaceholder={`W${state.waves.length + 1}`}
            onManage={() => openPanel("deck")}
            onSample={useSample}
            onImport={importDeck}
          />
        ) : null}
        {state.mode === "study" && currentStudyItem ? (
          <StudyView
            item={currentStudyItem}
            isPractice={Boolean(state.studyPracticeId)}
            revealed={state.revealed}
            studyResult={state.studyResult}
            quickKnownEnabled={state.quickKnownEnabled}
            insightsExpanded={state.insightsExpanded}
            pronunciationSupported={pronunciationSupported}
            pronunciationMessage={pronunciationMessage}
            copyFeedback={copyFeedback}
            onCopy={copyCurrentWord}
            onPronounce={() => speak(currentStudyItem.term)}
            onChoose={chooseStudy}
            onAdvance={advanceStudy}
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
        {state.mode === "summary" ? (
          <SummaryView
            summary={state.roundSummary}
            onContinue={() => dispatch({ type: "CONTINUE_ROUND" })}
            onPrepare={() => dispatch({ type: "OPEN_PREPARE" })}
            onQuiz={(kind) => dispatch({ type: "START_QUIZ", kind })}
          />
        ) : null}
        {state.mode === "quiz" ? (
          <QuestionView
            quiz={state.quiz}
            onAnswer={(answer) => dispatch({ type: "ANSWER_QUIZ", answer })}
            onNext={() => dispatch({ type: "NEXT_QUIZ" })}
            onEnd={() => dispatch({ type: "END_QUIZ" })}
            onRestart={() => dispatch({ type: "START_QUIZ", kind: state.quiz.kind })}
          />
        ) : null}
        {state.mode === "empty" ? (
          <EmptyView
            onManage={() => openPanel("deck")}
            onSample={openSampleConfirm}
          />
        ) : null}
        {state.mode === "mastered" ? (
          <MasteredView
            onRestore={() => dispatch({ type: "RESTORE_GRADUATED" })}
            onQuiz={() => dispatch({ type: "START_QUIZ" })}
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
        aiControls={<AIPreparationControls settings={aiSettings} onChange={setAiSettings} busy={preparing} progress={preparationProgress} idPrefix="panel-ai" onCancel={() => preparationRequestRef.current?.controller.abort()} onPrepareExisting={prepareCurrentWave} hasWords={getActiveCardIds(state).length > 0} />}
        open={panelOpen}
        panelRef={panelRef}
        section={panelSection}
        sourceDeck={state.sourceDeck}
        removedEntries={removedEntries}
        graduatedCount={getActiveCardIds(state).filter((cardId) => isGraduated(state.mastery, cardId)).length}
        waves={state.waves.map((wave) => ({ ...wave, count: state.sourceDeck.filter((entry) => getEntryWaveId(entry) === wave.id).length }))}
        onWaveAction={(type, waveId) => { dispatch({ type, waveId }); closePanel(); }}
        onRestoreGraduated={() => { dispatch({ type: "RESTORE_GRADUATED" }); closePanel(); }}
        autoPronounceEnabled={state.autoPronounceEnabled}
        spellingMode={state.spellingMode}
        quickKnownEnabled={state.quickKnownEnabled}
        themePreference={themePreference}
        pronunciationSupported={pronunciationSupported}
        message={panelMessage}
        initialConfirmAction={panelConfirmRequest}
        onClose={closePanel}
        onAddDeck={() => { closePanel(); dispatch({ type: "OPEN_PREPARE" }); }}
        onQuiz={(kind) => { dispatch({ type: "START_QUIZ", kind }); closePanel(); }}
        onExportJson={() => downloadText(JSON.stringify(exportDeck, null, 2), "application/json", "flashvocab-deck.json")}
        onExportMarkdown={() => downloadText(buildMarkdownExport(exportDeck), "text/markdown", "flashvocab-deck.md")}
        onSetAutoPronounce={(value) => dispatch({ type: "SET_AUTO_PRONOUNCE", value })}
        onSetSpellingMode={(value) => dispatch({ type: "SET_SPELLING_MODE", value })}
        onSetQuickKnown={(value) => dispatch({ type: "SET_QUICK_KNOWN", value })}
        onSetThemePreference={setThemePreference}
        onRestoreRemoved={(cardId) => dispatch({ type: "RESTORE_REMOVED", cardId })}
        onReset={() => { dispatch({ type: "RESET_PROGRESS" }); setAiSettings({ apiKey: "", model: DEFAULT_PREPARATION_MODEL }); }}
        onSample={useSample}
        onConfirmConsumed={() => setPanelConfirmRequest(null)}
      />
    </div>
  );
}
