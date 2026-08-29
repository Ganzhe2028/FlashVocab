import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import App from "./App.jsx";
import { createCardIds } from "./learningAlgorithm.js";
import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORAGE_VERSION,
} from "./storage/learningStorage.js";

const testDeck = [
  {
    term: "Alpha",
    syllables: "Al·pha",
    respell: "[AL-fuh]",
    pos: "n.",
    meaning: "alpha meaning",
    meaningZh: "阿尔法",
    wordOrigin: "Alpha comes from the first Greek letter.",
    relatedWord: "omega — the last Greek letter",
    examples: [
      { sentence: "Alpha starts this small deck.", focus: "Alpha" },
    ],
  },
  {
    term: "Beta",
    syllables: "Be·ta",
    respell: "[BAY-tuh]",
    pos: "n.",
    meaning: "beta meaning",
    meaningZh: "贝塔",
    examples: [
      { sentence: "Beta ends this small deck.", focus: "Beta" },
    ],
  },
];

const saveDeckSnapshot = (sourceDeck = testDeck, overrides = {}) => {
  const cardIds = createCardIds(sourceDeck);
  window.localStorage.setItem(
    LEARNING_STORAGE_KEY,
    JSON.stringify({
      version: LEARNING_STORAGE_VERSION,
      sourceDeck,
      removedCardIds: [],
      learningState: {},
      completedRounds: { study: 0, spell: 0 },
      shuffleOnLoop: false,
      showWordInsights: false,
      familiarModeEnabled: true,
      autoPronounceEnabled: true,
      mode: "study",
      lastRemoved: null,
      studyQueueIds: cardIds,
      spellQueueIds: [],
      index: 0,
      spellIndex: 0,
      ...overrides,
    }),
  );
  return cardIds;
};

const readSnapshot = () =>
  JSON.parse(window.localStorage.getItem(LEARNING_STORAGE_KEY));

const press = (code, key) => {
  fireEvent.keyDown(document, { code, key });
};

const currentTerm = (term) =>
  screen.getByRole("heading", { name: `复制单词 ${term}` });

const alphaMeaning = () => screen.getByText("alpha meaning / 阿尔法");

const finishSingleCardStudyRound = async () => {
  press("Space", " ");
  expect(alphaMeaning().closest("p").classList).not.toContain(
    "is-hidden",
  );
  press("Enter", "Enter");
  await screen.findByRole("heading", { name: "随手拼？" });
};

describe("App behavior", () => {
  test("starts in study mode with the first card hidden", () => {
    saveDeckSnapshot();
    render(<App />);

    expect(currentTerm("Alpha")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(alphaMeaning().closest("p").classList).toContain(
      "is-hidden",
    );
  });

  test("buttons cannot retain focus or become keyboard Tab targets", () => {
    saveDeckSnapshot();
    render(<App />);

    const importButton = screen.getByRole("button", { name: "Import" });
    importButton.focus();
    fireEvent.click(importButton);

    fireEvent.click(screen.getByRole("button", { name: "Guidebook" }));
    expect(document.activeElement).not.toBe(importButton);
    expect(document.querySelectorAll("button").length).toBeGreaterThan(4);
    expect(
      [...document.querySelectorAll("button")].every(
        (button) => button.tabIndex === -1,
      ),
    ).toBe(true);
  });

  test("revealing an answer plays its American pronunciation and allows replay", () => {
    saveDeckSnapshot();
    render(<App />);

    press("Space", " ");

    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = window.speechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toBe("Alpha");
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBe(0.9);
    expect(utterance.voice.name).toBe("Test US Voice");

    press("Space", " ");
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);

    press("Space", " ");
    fireEvent.click(
      screen.getByRole("button", { name: "播放 Alpha 的美式发音" }),
    );
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(3);
    expect(alphaMeaning().closest("p").classList).not.toContain(
      "is-hidden",
    );
  });

  test("automatic pronunciation can be disabled while manual replay remains available", async () => {
    saveDeckSnapshot();
    render(<App />);

    const pronunciationSwitch = screen.getByRole("switch", {
      name: "自动美式发音",
    });
    expect(pronunciationSwitch.checked).toBe(true);
    fireEvent.click(pronunciationSwitch);
    press("Space", " ");

    press("Enter", "Enter");

    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(currentTerm("Beta")).toBeTruthy();
    press("Space", " ");
    fireEvent.click(
      screen.getByRole("button", { name: "播放 Beta 的美式发音" }),
    );
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(readSnapshot().autoPronounceEnabled).toBe(false);
    });
  });

  test("missing speech synthesis support does not interrupt study", () => {
    const speechSynthesis = window.speechSynthesis;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: undefined,
    });

    try {
      saveDeckSnapshot();
      render(<App />);

      const pronunciationSwitch = screen.getByRole("switch", {
        name: "自动美式发音",
      });
      expect(pronunciationSwitch.disabled).toBe(true);
      expect(() => press("Space", " ")).not.toThrow();
      expect(alphaMeaning().closest("p").classList).not.toContain(
        "is-hidden",
      );
    } finally {
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: speechSynthesis,
      });
    }
  });

  test("optional complex features default off and persist independently", async () => {
    saveDeckSnapshot(testDeck, {
      showWordInsights: false,
      familiarModeEnabled: false,
    });
    render(<App />);

    const insightsSwitch = screen.getByRole("switch", {
      name: "词源与对应概念",
    });
    const familiarSwitch = screen.getByRole("switch", {
      name: "两轮熟悉返场",
    });
    expect(insightsSwitch.checked).toBe(false);
    expect(familiarSwitch.checked).toBe(false);
    expect(screen.queryByText(/辨识 0\/2/)).toBeNull();
    expect(screen.queryByText(/暂时熟悉池/)).toBeNull();

    press("Space", " ");
    expect(
      screen.queryByRole("button", { name: "想起来了 (Enter)" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "没想起来 (N)" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Next (Enter)" })).toBeTruthy();
    press("KeyN", "n");
    expect(currentTerm("Alpha")).toBeTruthy();
    expect(
      screen.queryByText("Alpha comes from the first Greek letter."),
    ).toBeNull();

    fireEvent.click(insightsSwitch);
    expect(
      screen.getByText("Alpha comes from the first Greek letter."),
    ).toBeTruthy();

    fireEvent.click(familiarSwitch);
    expect(
      screen.getByRole("button", { name: "想起来了 (Enter)" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "没想起来 (N)" }),
    ).toBeTruthy();
    expect(screen.getByText(/辨识 0\/2/)).toBeTruthy();
    expect(screen.getByText(/暂时熟悉池/)).toBeTruthy();

    await waitFor(() => {
      const snapshot = readSnapshot();
      expect(snapshot.showWordInsights).toBe(true);
      expect(snapshot.familiarModeEnabled).toBe(true);
    });
  });

  test("simple mode completes a round without changing familiarity", async () => {
    const [alphaId] = saveDeckSnapshot([testDeck[0]], {
      familiarModeEnabled: false,
    });
    render(<App />);

    await finishSingleCardStudyRound();

    await waitFor(() => {
      const snapshot = readSnapshot();
      expect(snapshot.learningState[alphaId].study.streak).toBe(0);
      expect(snapshot.learningState[alphaId].study.hidden).toBe(false);
      expect(snapshot.learningState[alphaId].study.lapseCount).toBe(0);
      expect(snapshot.completedRounds.study).toBe(1);
    });
  });

  test("turning off familiar mode immediately restores hidden cards", async () => {
    const cardIds = createCardIds(testDeck);
    saveDeckSnapshot(testDeck, {
      familiarModeEnabled: true,
      learningState: {
        [cardIds[1]]: {
          study: { streak: 2, hidden: true, dueRound: 9 },
        },
      },
      studyQueueIds: [cardIds[0]],
    });
    render(<App />);

    expect(screen.getByText("1 / 1")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("switch", { name: "两轮熟悉返场" }),
    );
    expect(screen.getByText("1 / 2")).toBeTruthy();

    await waitFor(() => {
      const snapshot = readSnapshot();
      expect(snapshot.familiarModeEnabled).toBe(false);
      expect(snapshot.studyQueueIds).toEqual(cardIds);
    });
  });

  test("Space reveals, advancing plays the next word, and N records a miss before rest", async () => {
    const [alphaId, betaId] = saveDeckSnapshot();
    render(<App />);

    press("Space", " ");
    expect(alphaMeaning().closest("p").classList).not.toContain(
      "is-hidden",
    );

    press("Enter", "Enter");
    expect(currentTerm("Beta")).toBeTruthy();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    expect(window.speechSynthesis.speak.mock.calls[1][0].text).toBe("Beta");

    press("Enter", "Enter");
    press("KeyN", "n");
    await screen.findByRole("heading", { name: "随手拼？" });
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(4);
    expect(window.speechSynthesis.speak.mock.calls[3][0].text).toBe("Beta");

    await waitFor(() => {
      const snapshot = readSnapshot();
      expect(snapshot.learningState[alphaId].study.streak).toBe(1);
      expect(snapshot.learningState[betaId].study.streak).toBe(0);
      expect(snapshot.learningState[betaId].study.lapseCount).toBe(1);
      expect(snapshot.completedRounds.study).toBe(1);
      expect(snapshot.mode).toBe("rest");
    });
  });

  test("rest mode enters spelling practice with Space", async () => {
    saveDeckSnapshot([testDeck[0]]);
    render(<App />);
    await finishSingleCardStudyRound();

    press("Space", " ");

    expect(alphaMeaning()).toBeTruthy();
    expect(screen.getByText(/键入单词/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "复制单词 Alpha" })).toBeNull();
  });

  test("a corrected spelling does not overwrite the first wrong score", async () => {
    const [alphaId] = saveDeckSnapshot([testDeck[0]]);
    render(<App />);
    await finishSingleCardStudyRound();
    press("Space", " ");
    window.speechSynthesis.speak.mockClear();
    window.speechSynthesis.cancel.mockClear();

    press("KeyX", "x");
    press("Enter", "Enter");
    expect(screen.getByText("Al·pha")).toBeTruthy();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.speak.mock.calls[0][0].text).toBe("Alpha");

    for (const letter of "Alpha") {
      press(`Key${letter.toUpperCase()}`, letter);
    }
    press("Enter", "Enter");
    expect(screen.getByText("enter 下一个")).toBeTruthy();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    expect(window.speechSynthesis.speak.mock.calls[1][0].text).toBe("Alpha");
    expect(
      screen.getByRole("button", { name: "播放 Alpha 的美式发音" }),
    ).toBeTruthy();

    await waitFor(() => {
      const spellProgress = readSnapshot().learningState[alphaId].spell;
      expect(spellProgress.lastScoredRound).toBe(1);
      expect(spellProgress.streak).toBe(0);
      expect(spellProgress.lapseCount).toBe(1);
    });
  });

  test("one correct spelling links to an already familiar recognition card", async () => {
    const [alphaId] = createCardIds([testDeck[0]]);
    saveDeckSnapshot([testDeck[0]], {
      mode: "rest",
      completedRounds: { study: 2, spell: 0 },
      learningState: {
        [alphaId]: {
          study: {
            streak: 2,
            hidden: true,
            dueRound: 4,
            skipRounds: 1,
          },
        },
      },
      studyQueueIds: [alphaId],
    });
    render(<App />);

    press("Space", " ");
    for (const letter of "Alpha") {
      press(`Key${letter.toUpperCase()}`, letter);
    }
    press("Enter", "Enter");

    await waitFor(() => {
      const progress = readSnapshot().learningState[alphaId];
      expect(progress.study.hidden).toBe(true);
      expect(progress.spell.streak).toBe(1);
      expect(progress.spell.hidden).toBe(true);
      expect(progress.spell.syncedWithStudy).toBe(true);
      expect(progress.spell.dueRound).toBe(4);
    });
  });

  test("Remove hides the card and Undo Remove restores it", async () => {
    const [alphaId] = saveDeckSnapshot();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Remove (Delete)" }));
    expect(currentTerm("Beta")).toBeTruthy();
    await waitFor(() => {
      expect(readSnapshot().removedCardIds).toContain(alphaId);
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo Remove" }));
    expect(currentTerm("Alpha")).toBeTruthy();
    await waitFor(() => {
      expect(readSnapshot().removedCardIds).not.toContain(alphaId);
    });
  });

  test("imports a Markdown deck pasted into the Guidebook", async () => {
    saveDeckSnapshot();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Guidebook" }));

    const markdown = `[Lantern]\n\n- Meaning (EN): a portable light\n- Meaning (ZH): 灯笼\n- Sentence 1: We carried a lantern at night.\n- Focus 1: a lantern`;
    fireEvent.change(screen.getByPlaceholderText("把 AI 生成的内容粘贴到这里…"), {
      target: { value: markdown },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别并导入" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(currentTerm("Lantern")).toBeTruthy();
    expect(screen.getByText("已导入 1 个单词。")).toBeTruthy();
    await waitFor(() => {
      expect(readSnapshot().sourceDeck[0].term).toBe("Lantern");
    });
  });

  test("starts safely when localStorage contains corrupt JSON", () => {
    window.localStorage.setItem(LEARNING_STORAGE_KEY, "{not-valid-json");

    expect(() => render(<App />)).not.toThrow();
    expect(currentTerm("Vacant")).toBeTruthy();
  });
});
