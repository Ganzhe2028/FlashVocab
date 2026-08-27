import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FamiliarPool from "./components/FamiliarPool.jsx";
import GuideDialog from "./components/GuideDialog.jsx";
import LearningControls from "./components/LearningControls.jsx";
import RestScreen from "./components/RestScreen.jsx";
import SpellCard from "./components/SpellCard.jsx";
import StudyCard from "./components/StudyCard.jsx";
import { cloneDeck } from "./data/baseDeck.js";
import { useAppKeyboard } from "./hooks/useAppKeyboard.js";
import deepUnderstandingPrompt from "./prompts/deep-understanding.md?raw";
import {
  buildMarkdownExport,
  parseDeckFromText,
  normalizeDeck,
  readImportFile,
} from "./utils/deckImport.js";
import {
  LEARNING_STORAGE_VERSION,
  readLearningSnapshot,
  writeLearningSnapshot,
} from "./storage/learningStorage.js";
import {
  buildRoundCardIds,
  createCardIds,
  findNextUnscoredCardIndex,
  getModeProgress,
  recordReview,
} from "./learningAlgorithm.js";

const includeAllActiveCardIds = (queueIds, cardIds, removedCardIds) => {
  const removed = new Set(removedCardIds);
  const next = queueIds.filter((cardId) => !removed.has(cardId));
  const queued = new Set(next);
  cardIds.forEach((cardId) => {
    if (!removed.has(cardId) && !queued.has(cardId)) {
      next.push(cardId);
    }
  });
  return next;
};

const createInitialAppSnapshot = () => {
  const stored = readLearningSnapshot();
  const storedDeck = Array.isArray(stored?.sourceDeck)
    ? normalizeDeck(stored.sourceDeck)
    : [];
  const sourceDeck = storedDeck.length ? storedDeck : cloneDeck();
  const cardIds = createCardIds(sourceDeck);
  const removedCardIds = Array.isArray(stored?.removedCardIds)
    ? stored.removedCardIds
    : [];
  const learningState = stored?.learningState ?? {};
  const completedRounds = {
    study: Number.isInteger(stored?.completedRounds?.study)
      ? stored.completedRounds.study
      : 0,
    spell: Number.isInteger(stored?.completedRounds?.spell)
      ? stored.completedRounds.spell
      : 0,
  };
  const shuffleOnLoop = stored?.shuffleOnLoop ?? true;
  const showWordInsights = stored?.showWordInsights ?? false;
  const familiarModeEnabled = stored?.familiarModeEnabled ?? false;
  const defaultStudyIds = buildRoundCardIds({
    cardIds,
    removedCardIds,
    learningState,
    mode: "study",
    round: completedRounds.study + 1,
    familiarModeEnabled,
    shuffleOnLoop: false,
  });
  const validCardIds = new Set(cardIds);
  const restoredStudyQueueIds = (
    Array.isArray(stored?.studyQueueIds)
      ? stored.studyQueueIds
      : defaultStudyIds
  ).filter((cardId) => validCardIds.has(cardId));
  const restoredSpellQueueIds = (Array.isArray(stored?.spellQueueIds)
    ? stored.spellQueueIds
    : []
  ).filter((cardId) => validCardIds.has(cardId));
  const studyQueueIds = familiarModeEnabled
    ? restoredStudyQueueIds
    : includeAllActiveCardIds(
        restoredStudyQueueIds,
        cardIds,
        removedCardIds,
      );
  const spellQueueIds =
    !familiarModeEnabled && restoredSpellQueueIds.length
      ? includeAllActiveCardIds(
          restoredSpellQueueIds,
          cardIds,
          removedCardIds,
        )
      : restoredSpellQueueIds;
  const mode = ["study", "rest", "spell"].includes(stored?.mode)
    ? stored.mode
    : "study";
  const lastRemoved =
    typeof stored?.lastRemoved?.cardId === "string" &&
    removedCardIds.includes(stored.lastRemoved.cardId)
      ? stored.lastRemoved
      : null;

  return {
    sourceDeck,
    studyQueueIds,
    spellQueueIds,
    removedCardIds,
    learningState,
    completedRounds,
    shuffleOnLoop,
    showWordInsights,
    familiarModeEnabled,
    mode,
    lastRemoved,
    index: Math.min(
      Math.max(Number.isInteger(stored?.index) ? stored.index : 0, 0),
      Math.max(studyQueueIds.length - 1, 0),
    ),
    spellIndex: Math.min(
      Math.max(
        Number.isInteger(stored?.spellIndex) ? stored.spellIndex : 0,
        0,
      ),
      Math.max(spellQueueIds.length - 1, 0),
    ),
  };
};

export default function App() {
  const [initialSnapshot] = useState(createInitialAppSnapshot);
  const [sourceDeck, setSourceDeck] = useState(initialSnapshot.sourceDeck);
  const [studyQueueIds, setStudyQueueIds] = useState(
    initialSnapshot.studyQueueIds,
  );
  const [spellQueueIds, setSpellQueueIds] = useState(
    initialSnapshot.spellQueueIds,
  );
  const [index, setIndex] = useState(initialSnapshot.index);
  const [revealed, setRevealed] = useState(false);
  const [lastRemoved, setLastRemoved] = useState(initialSnapshot.lastRemoved);
  const [noAnim, setNoAnim] = useState(false);
  const [shuffleOnLoop, setShuffleOnLoop] = useState(
    initialSnapshot.shuffleOnLoop,
  );
  const [showWordInsights, setShowWordInsights] = useState(
    initialSnapshot.showWordInsights,
  );
  const [familiarModeEnabled, setFamiliarModeEnabled] = useState(
    initialSnapshot.familiarModeEnabled,
  );
  const [removedCardIds, setRemovedCardIds] = useState(
    initialSnapshot.removedCardIds,
  );
  const [learningState, setLearningState] = useState(
    initialSnapshot.learningState,
  );
  const [completedRounds, setCompletedRounds] = useState(
    initialSnapshot.completedRounds,
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importedDeckData, setImportedDeckData] = useState(null);
  const fileInputRef = useRef(null);
  const guidePanelRef = useRef(null);

  // ── Mode state ──────────────────────────────────────
  // 'study' | 'rest' | 'spell'
  const [mode, setMode] = useState(initialSnapshot.mode);
  const [spellIndex, setSpellIndex] = useState(initialSnapshot.spellIndex);
  const [spellInput, setSpellInput] = useState("");
  const [spellResult, setSpellResult] = useState(null); // null | 'correct' | 'wrong'
  const [shakeKey, setShakeKey] = useState(0);

  const cardIds = useMemo(() => createCardIds(sourceDeck), [sourceDeck]);
  const sourceItemById = useMemo(
    () =>
      new Map(
        cardIds.map((cardId, entryIndex) => [cardId, sourceDeck[entryIndex]]),
      ),
    [cardIds, sourceDeck],
  );
  const currentStudyRound = completedRounds.study + 1;
  const currentSpellRound = completedRounds.spell + 1;

  const buildModeQueueIds = useCallback(
    (targetMode, round, avoidFirstCardId = null) => {
      return buildRoundCardIds({
        cardIds,
        removedCardIds,
        learningState,
        mode: targetMode,
        round,
        familiarModeEnabled,
        shuffleOnLoop,
        avoidFirstCardId,
      });
    },
    [
      cardIds,
      familiarModeEnabled,
      learningState,
      removedCardIds,
      shuffleOnLoop,
    ],
  );

  const promptText = `你是英语词汇整理助手。请把用户提供的单词逐个补全为以下字段，并输出为可导入的 JSON 数组：

字段要求（严格遵守）：
- term: 单词，首字母大写
- syllables: 分节写法（用中点分隔）
- respell: 发音重拼（用方括号包裹）
- pos: 词性缩写（如 "n.", "v.", "adj.", "adv."）
- meaning: 英文简明释义
- meaningZh: 中文释义
- wordOrigin: 用 1-3 句中文简述可靠的词根、词缀和词源，以及各部分怎样组合成当前含义；不确定或仅为助记时必须明确说明
- relatedWord: 一个最直接的相反词或对应概念，并简短说明区别；没有自然、可靠的配对时输出空字符串
- examples: 例句数组，必须提供 2-3 个对象
  - sentence: 例句，必须自然、简洁，适合 B1-B2 学习者理解
  - focus: 例句中需要加粗显示的原文片段，必须与 sentence 中的字符完全一致

例句要求：
- 优先使用学校、家庭、商店、工作、出行等日常语境
- 尽量用短句，方便直接看懂上下文
- 除目标词外，不要再塞进多个难词
- 除非词本身必须如此，否则避免法律、政治、新闻、学术语境

输出格式示例（仅 JSON，不要多余文字）：
[
  {
    "term": "Example",
    "syllables": "Ex·am·ple",
    "respell": "[ig-ZAM-puhl]",
    "pos": "n.",
    "meaning": "a thing that illustrates a rule",
    "meaningZh": "例子；示例",
    "wordOrigin": "来自 Latin exemplum，指从一组事物中取出来作为样本的东西。",
    "relatedWord": "counterexample — 用来反驳或推翻某个说法的反例",
    "examples": [
      {
        "sentence": "This is a clear example of the rule.",
        "focus": "clear example"
      },
      {
        "sentence": "The teacher gave another example in class.",
        "focus": "another example"
      }
    ]
  }
]

不要输出 phrases / sentence / sentenceFocus 这些旧字段。一定确保每条 example 的 sentence 中原样包含 focus。

一定记得需要以代码块的方式输出 JSON 文件以便用户导入。`;

  useEffect(() => {
    const snapshot = {
      version: LEARNING_STORAGE_VERSION,
      sourceDeck,
      removedCardIds,
      learningState,
      completedRounds,
      shuffleOnLoop,
      showWordInsights,
      familiarModeEnabled,
      mode,
      lastRemoved,
      studyQueueIds,
      spellQueueIds,
      index,
      spellIndex,
    };
    const result = writeLearningSnapshot(snapshot);
    if (!result.success) {
      setImportMessage(
        (previous) =>
          previous || "学习进度暂时无法保存，本次使用不受影响。",
      );
    }
  }, [
    completedRounds,
    familiarModeEnabled,
    index,
    learningState,
    lastRemoved,
    mode,
    removedCardIds,
    shuffleOnLoop,
    showWordInsights,
    sourceDeck,
    spellQueueIds,
    spellIndex,
    studyQueueIds,
  ]);

  const runInstantly = useCallback((action) => {
    setNoAnim(true);
    action();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNoAnim(false);
      });
    });
  }, []);

  const toggleReveal = useCallback(() => {
    if (!studyQueueIds.length) return;
    setRevealed((prev) => !prev);
  }, [studyQueueIds.length]);

  const enterRestMode = useCallback(() => {
    setCompletedRounds((previous) => ({
      ...previous,
      study: currentStudyRound,
    }));
    setMode("rest");
    setRevealed(false);
  }, [currentStudyRound]);

  const prevCard = useCallback(() => {
    if (!studyQueueIds.length) return;
    runInstantly(() => {
      setIndex(
        (prev) =>
          (prev - 1 + studyQueueIds.length) % studyQueueIds.length,
      );
      setRevealed(false);
    });
  }, [runInstantly, studyQueueIds.length]);

  const enterStudyMode = useCallback(() => {
    const nextRound = completedRounds.study + 1;
    const previouslyPresentedCardId =
      mode === "spell" ? spellQueueIds[spellIndex] : studyQueueIds[index];
    const nextQueueIds = buildModeQueueIds(
      "study",
      nextRound,
      previouslyPresentedCardId ?? null,
    );
    if (!nextQueueIds.length) {
      setCompletedRounds((previous) => ({
        ...previous,
        study: nextRound,
      }));
      setMode("rest");
      setImportMessage(`辨识第 ${nextRound} 轮暂无返场词，已跳过。`);
      return;
    }
    setStudyQueueIds(nextQueueIds);
    setMode("study");
    setIndex(0);
    setRevealed(false);
  }, [
    buildModeQueueIds,
    completedRounds.study,
    index,
    mode,
    spellQueueIds,
    spellIndex,
    studyQueueIds,
  ]);

  const enterSpellMode = useCallback(() => {
    const nextRound = completedRounds.spell + 1;
    const nextQueueIds = buildModeQueueIds("spell", nextRound);
    if (!nextQueueIds.length) {
      setCompletedRounds((previous) => ({
        ...previous,
        spell: nextRound,
      }));
      setMode("rest");
      setImportMessage(`拼写第 ${nextRound} 轮暂无返场词，已跳过。`);
      return;
    }
    setSpellQueueIds(nextQueueIds);
    setMode("spell");
    setSpellIndex(0);
    setSpellInput("");
    setSpellResult(null);
  }, [buildModeQueueIds, completedRounds.spell]);

  const recordModeReview = useCallback(
    (cardId, targetMode, round, correct) => {
      if (!cardId) return;
      setLearningState((previous) =>
        recordReview({
          learningState: previous,
          cardId,
          mode: targetMode,
          round,
          correct,
          familiarModeEnabled,
        }),
      );
    },
    [familiarModeEnabled],
  );

  const completeStudyAnswer = useCallback(
    (correct) => {
      const currentCardId = studyQueueIds[index];
      if (!currentCardId || !revealed) return;
      const nextUnscoredIndex = findNextUnscoredCardIndex({
        queueIds: studyQueueIds,
        currentIndex: index,
        learningState,
        mode: "study",
        round: currentStudyRound,
      });
      recordModeReview(currentCardId, "study", currentStudyRound, correct);
      if (nextUnscoredIndex === -1) {
        enterRestMode();
      } else {
        runInstantly(() => {
          setIndex(nextUnscoredIndex);
          setRevealed(false);
        });
      }
    },
    [
      currentStudyRound,
      enterRestMode,
      index,
      learningState,
      recordModeReview,
      revealed,
      runInstantly,
      studyQueueIds,
    ],
  );

  const removeCard = useCallback(() => {
    const cardId =
      mode === "spell" ? spellQueueIds[spellIndex] : studyQueueIds[index];
    if (!cardId) return;
    runInstantly(() => {
      setLastRemoved({
        cardId,
        studyPosition: mode === "study" ? index : -1,
        spellPosition: mode === "spell" ? spellIndex : -1,
        studyRound: mode === "study" ? currentStudyRound : null,
        spellRound: mode === "spell" ? currentSpellRound : null,
      });
      const nextRemovedCardIds = removedCardIds.includes(cardId)
        ? removedCardIds
        : [...removedCardIds, cardId];
      setRemovedCardIds((previous) =>
        previous.includes(cardId) ? previous : [...previous, cardId],
      );
      let nextStudyQueueIds = studyQueueIds.filter(
        (queuedCardId) => queuedCardId !== cardId,
      );
      if (mode !== "study") {
        nextStudyQueueIds = buildRoundCardIds({
          cardIds,
          removedCardIds: nextRemovedCardIds,
          learningState,
          mode: "study",
          round: currentStudyRound,
          familiarModeEnabled,
          shuffleOnLoop,
          avoidFirstCardId: studyQueueIds[index] ?? null,
        });
      }
      const nextSpellQueueIds = spellQueueIds.filter(
        (queuedCardId) => queuedCardId !== cardId,
      );
      const nextRemovedCount = new Set(nextRemovedCardIds).size;
      const remainingSourceCount = sourceDeck.length - nextRemovedCount;
      setMode(
        nextStudyQueueIds.length || remainingSourceCount === 0
          ? "study"
          : "rest",
      );
      setStudyQueueIds(nextStudyQueueIds);
      setSpellQueueIds(nextSpellQueueIds);
      setIndex((previous) => {
        if (!nextStudyQueueIds.length) return 0;
        return mode === "study"
          ? Math.min(previous, nextStudyQueueIds.length - 1)
          : 0;
      });
      setSpellIndex((previous) =>
        nextSpellQueueIds.length
          ? Math.min(previous, nextSpellQueueIds.length - 1)
          : 0,
      );
      setRevealed(false);
    });
  }, [
    cardIds,
    currentSpellRound,
    currentStudyRound,
    familiarModeEnabled,
    index,
    learningState,
    mode,
    removedCardIds,
    runInstantly,
    shuffleOnLoop,
    sourceDeck,
    spellQueueIds,
    spellIndex,
    studyQueueIds,
  ]);

  const undoRemove = useCallback(() => {
    if (!lastRemoved) return;
    if (!sourceItemById.has(lastRemoved.cardId)) return;
    const studyProgress = getModeProgress(
      learningState,
      lastRemoved.cardId,
      "study",
    );
    const spellProgress = getModeProgress(
      learningState,
      lastRemoved.cardId,
      "spell",
    );
    const restoreStudyAtSavedPosition =
      mode === "study" &&
      lastRemoved.studyPosition >= 0 &&
      lastRemoved.studyRound === currentStudyRound;
    const shouldRestoreStudy =
      (restoreStudyAtSavedPosition ||
        (mode === "study" &&
          (!familiarModeEnabled || !studyProgress.hidden))) &&
      !studyQueueIds.includes(lastRemoved.cardId);
    const studyInsertIndex = restoreStudyAtSavedPosition
      ? Math.min(lastRemoved.studyPosition, studyQueueIds.length)
      : studyQueueIds.length;
    runInstantly(() => {
      setRemovedCardIds((previous) =>
        previous.filter((cardId) => cardId !== lastRemoved.cardId),
      );
      if (shouldRestoreStudy) {
        setStudyQueueIds((previous) => {
          if (previous.includes(lastRemoved.cardId)) return previous;
          const next = [...previous];
          next.splice(
            Math.min(studyInsertIndex, next.length),
            0,
            lastRemoved.cardId,
          );
          return next;
        });
        setIndex(studyInsertIndex);
      }
      const restoreSpellAtSavedPosition =
        mode === "spell" &&
        lastRemoved.spellPosition >= 0 &&
        lastRemoved.spellRound === currentSpellRound;
      if (
        restoreSpellAtSavedPosition ||
        (mode === "spell" &&
          (!familiarModeEnabled || !spellProgress.hidden))
      ) {
        setSpellQueueIds((previous) => {
          if (previous.includes(lastRemoved.cardId)) return previous;
          const next = [...previous];
          const insertIndex = restoreSpellAtSavedPosition
            ? Math.min(lastRemoved.spellPosition, next.length)
            : next.length;
          next.splice(insertIndex, 0, lastRemoved.cardId);
          return next;
        });
      }
      setLastRemoved(null);
      setRevealed(false);
    });
  }, [
    currentSpellRound,
    currentStudyRound,
    familiarModeEnabled,
    lastRemoved,
    learningState,
    mode,
    runInstantly,
    sourceItemById,
    studyQueueIds,
  ]);

  const resetDeck = useCallback(() => {
    runInstantly(() => {
      const restoredDeck = cloneDeck();
      setSourceDeck(restoredDeck);
      setStudyQueueIds(createCardIds(restoredDeck));
      setSpellQueueIds([]);
      setIndex(0);
      setSpellIndex(0);
      setRevealed(false);
      setLastRemoved(null);
      setRemovedCardIds([]);
      setLearningState({});
      setCompletedRounds({ study: 0, spell: 0 });
      setMode("study");
    });
  }, [runInstantly]);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const rawText = await readImportFile(file);
        const importedDeck = parseDeckFromText(rawText);
        const normalized = normalizeDeck(importedDeck);
        if (!normalized.length) {
          throw new Error("内容中没有有效的单词。");
        }
        runInstantly(() => {
          setSourceDeck(normalized);
          setStudyQueueIds(createCardIds(normalized));
          setSpellQueueIds([]);
          setIndex(0);
          setSpellIndex(0);
          setRevealed(false);
          setLastRemoved(null);
          setRemovedCardIds([]);
          setLearningState({});
          setCompletedRounds({ study: 0, spell: 0 });
          setMode("study");
        });
        setImportedDeckData(normalized);
        setImportMessage(`已导入 ${normalized.length} 个单词。`);
      } catch (error) {
        setImportMessage(`导入失败：${error?.message || "无法解析文件内容。"}`);
      } finally {
        event.target.value = "";
      }
    },
    [runInstantly],
  );

  const handlePasteImport = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setImportMessage("请先粘贴需要导入的内容。");
      return;
    }
    try {
      const importedDeck = parseDeckFromText(trimmed);
      const normalized = normalizeDeck(importedDeck);
      if (!normalized.length) {
        throw new Error("内容中没有有效的单词。");
      }
      runInstantly(() => {
        setSourceDeck(normalized);
        setStudyQueueIds(createCardIds(normalized));
        setSpellQueueIds([]);
        setIndex(0);
        setSpellIndex(0);
        setRevealed(false);
        setLastRemoved(null);
        setRemovedCardIds([]);
        setLearningState({});
        setCompletedRounds({ study: 0, spell: 0 });
        setMode("study");
      });
      setImportedDeckData(normalized);
      setImportMessage(`已导入 ${normalized.length} 个单词。`);
    } catch (error) {
      setImportedDeckData(null);
      setImportMessage(`导入失败：${error?.message || "无法识别粘贴内容。"}`);
    }
  }, [pasteText, runInstantly]);

  const exportDeck = useMemo(() => {
    const removed = new Set(removedCardIds);
    return sourceDeck.filter((_, entryIndex) => !removed.has(cardIds[entryIndex]));
  }, [cardIds, removedCardIds, sourceDeck]);

  const handleExportJson = useCallback(() => {
    if (!exportDeck.length) return;
    const json = JSON.stringify(exportDeck, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocab-deck.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setImportMessage(`已导出 ${exportDeck.length} 个剩余单词。`);
  }, [exportDeck]);

  const handleExportMd = useCallback(() => {
    if (!exportDeck.length) return;
    const md = buildMarkdownExport(exportDeck);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocab-deck.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [exportDeck]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setImportMessage("提示词已复制到剪贴板。");
    } catch {
      setImportMessage("复制失败，请手动复制提示词。");
    }
  };

  const handleCopyDeepPrompt = async () => {
    try {
      await navigator.clipboard.writeText(deepUnderstandingPrompt);
      setImportMessage("词根词源—感觉—画面提示词已复制到剪贴板。");
    } catch {
      setImportMessage("复制失败，请在 Guidebook 中手动复制提示词。");
    }
  };

  const advanceSpell = useCallback(() => {
    if (spellIndex + 1 >= spellQueueIds.length) {
      setCompletedRounds((previous) => ({
        ...previous,
        spell: currentSpellRound,
      }));
      enterStudyMode();
      return;
    }
    setSpellIndex((previous) => previous + 1);
    setSpellInput("");
    setSpellResult(null);
  }, [
    currentSpellRound,
    enterStudyMode,
    spellIndex,
    spellQueueIds.length,
  ]);

  const submitSpell = useCallback(() => {
    const spellCardId = spellQueueIds[spellIndex];
    const spellItem = sourceItemById.get(spellCardId);
    const target = (spellItem?.term ?? "").toLowerCase();
    const correct = Boolean(target) && spellInput.toLowerCase() === target;
    recordModeReview(spellCardId, "spell", currentSpellRound, correct);
    if (correct) {
      setSpellResult("correct");
      return;
    }
    setSpellResult("wrong");
    setShakeKey((previous) => previous + 1);
  }, [
    currentSpellRound,
    recordModeReview,
    sourceItemById,
    spellIndex,
    spellInput,
    spellQueueIds,
  ]);

  const replaySpellShake = useCallback(() => {
    setShakeKey((previous) => previous + 1);
  }, []);

  const deleteSpellCharacter = useCallback(() => {
    setSpellInput((previous) => previous.slice(0, -1));
    setSpellResult(null);
  }, []);

  const typeSpellCharacter = useCallback((key, { replace }) => {
    setSpellInput((previous) => (replace ? key : previous + key));
    setSpellResult(null);
  }, []);

  useAppKeyboard({
    guideOpen,
    guidePanelRef,
    mode,
    revealed,
    spellResult,
    onEnterStudyMode: enterStudyMode,
    onEnterSpellMode: enterSpellMode,
    onToggleReveal: toggleReveal,
    onPreviousCard: prevCard,
    onCompleteStudyAnswer: completeStudyAnswer,
    onRemoveCard: removeCard,
    onAdvanceSpell: advanceSpell,
    onSubmitSpell: submitSpell,
    onReplaySpellShake: replaySpellShake,
    onDeleteSpellCharacter: deleteSpellCharacter,
    onTypeSpellCharacter: typeSpellCharacter,
  });

  const hasDeck = studyQueueIds.length > 0;
  const hasSpellDeck = spellQueueIds.length > 0;
  const completedByRemoval = !exportDeck.length && Boolean(lastRemoved);
  const item = hasDeck
    ? sourceItemById.get(studyQueueIds[index]) ?? null
    : null;
  const spellCardId = spellQueueIds[spellIndex] ?? null;
  const spellItem = sourceItemById.get(spellCardId) ?? null;
  const activeDeckLength =
    mode === "spell" ? spellQueueIds.length : studyQueueIds.length;
  const activeProgressPosition = activeDeckLength
    ? mode === "spell"
      ? spellIndex + 1
      : index + 1
    : 0;
  const progress = activeDeckLength
    ? activeProgressPosition / activeDeckLength
    : 0;
  const progressLabel = activeDeckLength
    ? `${activeProgressPosition} / ${activeDeckLength}`
    : "0 / 0";
  const currentStudyProgress = item
    ? getModeProgress(learningState, studyQueueIds[index], "study")
    : null;
  const currentSpellProgress = spellCardId
    ? getModeProgress(learningState, spellCardId, "spell")
    : null;
  const familiarEntries = useMemo(
    () =>
      familiarModeEnabled
        ? sourceDeck
            .map((entry, entryIndex) => {
              const cardId = cardIds[entryIndex];
              return {
                entry,
                cardId,
                study: getModeProgress(learningState, cardId, "study"),
                spell: getModeProgress(learningState, cardId, "spell"),
              };
            })
            .filter(
              ({ cardId, study, spell }) =>
                !removedCardIds.includes(cardId) &&
                (study.hidden || spell.hidden),
            )
        : [],
    [
      cardIds,
      familiarModeEnabled,
      learningState,
      removedCardIds,
      sourceDeck,
    ],
  );
  const familiarStudyCount = familiarEntries.filter(
    ({ study }) => study.hidden,
  ).length;
  const familiarSpellCount = familiarEntries.filter(
    ({ spell }) => spell.hidden,
  ).length;

  const copyCurrentTerm = useCallback(async () => {
    if (!item?.term) return;
    try {
      await navigator.clipboard.writeText(item.term);
      setImportMessage(`已复制 ${item.term}。`);
    } catch {
      setImportMessage("复制失败，请手动选择单词。");
    }
  }, [item?.term]);

  const handleTermClick = useCallback(
    (event) => {
      event.stopPropagation();
      event.currentTarget.blur();
      copyCurrentTerm();
    },
    [copyCurrentTerm],
  );

  const handleTermKeyDown = useCallback(
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.blur();
      copyCurrentTerm();
    },
    [copyCurrentTerm],
  );

  const clearPasteImport = useCallback(() => {
    setPasteText("");
    setImportedDeckData(null);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleOnLoop((previousValue) => !previousValue);
  }, []);

  const toggleWordInsights = useCallback(() => {
    setShowWordInsights((previousValue) => !previousValue);
  }, []);

  const toggleFamiliarMode = useCallback(() => {
    const nextValue = !familiarModeEnabled;
    setFamiliarModeEnabled(nextValue);
    if (!nextValue) {
      setStudyQueueIds((previous) =>
        includeAllActiveCardIds(previous, cardIds, removedCardIds),
      );
      if (spellQueueIds.length) {
        setSpellQueueIds((previous) =>
          includeAllActiveCardIds(previous, cardIds, removedCardIds),
        );
      }
    }
  }, [cardIds, familiarModeEnabled, removedCardIds, spellQueueIds.length]);

  const cardClassName = useMemo(() => {
    return `card${noAnim ? " no-anim" : ""}`;
  }, [noAnim]);

  return (
    <main className="shell">
      <a
        href="https://github.com/Ganzhe2028/vocab2"
        target="_blank"
        rel="noopener noreferrer"
        className="github-btn"
        title="View on GitHub"
        aria-label="View on GitHub"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
            -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
            .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
            -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
            .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
            .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
            0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
      <header>
        <div className="title-row">
          <h1>Vocabulary Loop</h1>
          <div className="header-actions">
            <button type="button" onClick={handleImportClick}>
              Import
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!exportDeck.length}
            >
              Export JSON
            </button>
            <button type="button" onClick={() => setGuideOpen(true)}>
              Guidebook
            </button>
            <button type="button" onClick={handleCopyDeepPrompt}>
              词根·感觉·画面
            </button>
          </div>
        </div>
        <div className="subhead">
          Enter reveals, then marks remembered. N marks not yet.
          {familiarModeEnabled
            ? " Four consecutive correct rounds move a word into the familiar pool."
            : ""}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,.txt,.csv,.docx,application/json,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleImportFile}
          className="file-input"
        />
        {importMessage ? (
          <div className="import-message">{importMessage}</div>
        ) : null}
      </header>

      <GuideDialog
        open={guideOpen}
        message={importMessage}
        pasteText={pasteText}
        importedDeckData={importedDeckData}
        exportDeckLength={exportDeck.length}
        panelRef={guidePanelRef}
        onClose={() => setGuideOpen(false)}
        onCopyPrompt={handleCopyPrompt}
        onPasteTextChange={setPasteText}
        onPasteImport={handlePasteImport}
        onClearPaste={clearPasteImport}
        onExportJson={handleExportJson}
        onExportMd={handleExportMd}
        onImportClick={handleImportClick}
        onCopyDeepPrompt={handleCopyDeepPrompt}
      />
      {mode === "rest" && <RestScreen />}

      {mode === "spell" && (
        <SpellCard
          currentRound={currentSpellRound}
          input={spellInput}
          item={spellItem}
          progress={currentSpellProgress}
          progressLabel={progressLabel}
          result={spellResult}
          shakeKey={shakeKey}
          showFamiliarStatus={familiarModeEnabled}
        />
      )}

      {mode === "study" && (
        <StudyCard
          cardClassName={cardClassName}
          completedByRemoval={completedByRemoval}
          currentRound={currentStudyRound}
          hasDeck={hasDeck}
          item={item}
          onCompleteAnswer={completeStudyAnswer}
          onTermClick={handleTermClick}
          onTermKeyDown={handleTermKeyDown}
          onToggleReveal={toggleReveal}
          progress={currentStudyProgress}
          revealed={revealed}
          showFamiliarStatus={familiarModeEnabled}
          showWordInsights={showWordInsights}
        />
      )}

      <LearningControls
        currentSpellRound={currentSpellRound}
        currentStudyRound={currentStudyRound}
        familiarSpellCount={familiarSpellCount}
        familiarStudyCount={familiarStudyCount}
        hasDeck={hasDeck}
        hasSpellDeck={hasSpellDeck}
        lastRemoved={lastRemoved}
        mode={mode}
        onCompleteAnswer={completeStudyAnswer}
        onPrevCard={prevCard}
        onRemoveCard={removeCard}
        onResetDeck={resetDeck}
        onToggleReveal={toggleReveal}
        onToggleFamiliarMode={toggleFamiliarMode}
        onToggleShuffle={toggleShuffle}
        onToggleWordInsights={toggleWordInsights}
        onUndoRemove={undoRemove}
        progress={progress}
        progressLabel={progressLabel}
        revealed={revealed}
        familiarModeEnabled={familiarModeEnabled}
        showWordInsights={showWordInsights}
        shuffleOnLoop={shuffleOnLoop}
      />

      {familiarModeEnabled ? <FamiliarPool entries={familiarEntries} /> : null}

      <div className="footer-note">
        No limits — keep cycling as long as you want.
      </div>
    </main>
  );
}
