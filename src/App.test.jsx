import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App.jsx";
import { createCardIds } from "./learningAlgorithm.js";
import { DECK_STORAGE_KEY, DECK_STORAGE_VERSION } from "./storage/learningStorage.js";

const alpha = {
  term: "Alpha",
  syllables: "Al·pha",
  respell: "[AL-fuh]",
  pos: "n.",
  meaning: "the first item in a group",
  meaningZh: "第一项",
  wordOrigin: "来自希腊字母 alpha。",
  relatedWord: "omega — 最后一项",
  examples: [
    { usage: "order", sentence: "Alpha comes first.", focus: "Alpha" },
    { usage: "order", sentence: "Alpha is here.", focus: "Alpha" },
    { usage: "name", sentence: "The team is called Alpha.", focus: "Alpha" },
  ],
};

const beta = {
  term: "Beta",
  syllables: "Be·ta",
  respell: "[BAY-tuh]",
  pos: "n.",
  meaning: "the second item in a group",
  meaningZh: "第二项",
  examples: [{ sentence: "Beta comes second.", focus: "Beta" }],
};

const saveAssets = (sourceDeck = [alpha], removedCardIds = []) => {
  window.localStorage.setItem(
    DECK_STORAGE_KEY,
    JSON.stringify({
      version: DECK_STORAGE_VERSION,
      sourceDeck,
      removedCardIds,
    }),
  );
};

const press = (key, code = key) => fireEvent.keyDown(document, { key, code });
const currentWordButton = () => document.querySelector(".word-copy");

const enterSingleCardSpelling = () => {
  press("Enter", "Enter");
  expect(screen.getByText(alpha.meaning)).toBeTruthy();
  press("Enter", "Enter");
  return screen.getByRole("textbox", { name: "输入英文拼写" });
};

describe("FlashVocab 3.0", () => {
  test("fresh visits lead with Import and keep the sample deck secondary", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "把这次要考的词放进来。" })).toBeTruthy();
    expect(screen.getByText("Import 文件")).toBeTruthy();
    expect(screen.getByRole("button", { name: "先用 24 个示例词体验" })).toBeTruthy();
  });

  test("saved decks start a fresh recognition round with layered reading content", () => {
    saveAssets();
    render(<App />);

    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();
    expect(screen.queryByText(alpha.meaning)).toBeNull();
    press("Enter", "Enter");
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
    expect(screen.getByText(alpha.meaningZh)).toBeTruthy();
    expect(screen.getByText((_, element) => element.tagName === "LI" && element.textContent.includes("Alpha comes first."))).toBeTruthy();
    expect(screen.queryByText("Alpha is here.")).toBeNull();
    expect(screen.getByText((_, element) => element.tagName === "LI" && element.textContent.includes("The team is called Alpha."))).toBeTruthy();
    expect(screen.queryByText(alpha.wordOrigin)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看词源与对应概念" }));
    expect(screen.getByText(alpha.wordOrigin)).toBeTruthy();
  });

  test("Enter runs recognition to spelling, and a first spelling error must be corrected", () => {
    saveAssets();
    render(<App />);
    const input = enterSingleCardSpelling();
    expect(screen.queryByText("Alpha")).toBeNull();

    fireEvent.change(input, { target: { value: "Alfa" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe("Alpha");
    expect(screen.getByText(/第一次没拼对/)).toBeTruthy();
    expect(screen.getByText("Alpha", { selector: "strong" })).toBeTruthy();

    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByText(/已经改正/)).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByRole("progressbar", { name: /辨识进度/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();
  });

  test("spelling uses a native input and pause preserves the single queue", () => {
    saveAssets();
    render(<App />);
    let input = enterSingleCardSpelling();
    fireEvent.change(input, { target: { value: "Al" } });
    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    expect(screen.getByRole("heading", { name: "停一下，答案不会丢。" })).toBeTruthy();
    press("Enter", "Enter");
    input = screen.getByRole("textbox", { name: "输入英文拼写" });
    expect(input.value).toBe("");

    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });
    press(" ", "Space");
    expect(screen.getByRole("progressbar", { name: /辨识进度/ })).toBeTruthy();
  });

  test("invalid replacement keeps the current deck; valid replacement can be undone", async () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    const paste = screen.getByRole("textbox", { name: "粘贴导入" });

    fireEvent.change(paste, { target: { value: "not a deck" } });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    expect(screen.getByText(/原词表保持不变/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.change(screen.getByRole("textbox", { name: "粘贴导入" }), {
      target: { value: JSON.stringify([{ ...beta, extraField: "preserved" }]) },
    });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "Be·ta" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "撤销替换词表" })[0]);
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY));
      expect(stored.sourceDeck[0].term).toBe("Alpha");
    });
  });

  test("removing the final word shows a recoverable empty state and manual find-back", () => {
    saveAssets();
    render(<App />);
    press("Delete", "Delete");
    expect(screen.getByRole("heading", { name: "所有词都已移出。" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "撤销上次移出" }));
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();

    press("Delete", "Delete");
    fireEvent.click(screen.getByRole("button", { name: "打开管理" }));
    fireEvent.click(screen.getByRole("button", { name: "找回" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();
  });

  test("a reload keeps deck assets and removals but resets the learning session", () => {
    const ids = createCardIds([alpha, beta]);
    saveAssets([alpha, beta], [ids[1]]);
    const first = render(<App />);
    press("Enter", "Enter");
    press("Enter", "Enter");
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
    first.unmount();

    render(<App />);
    expect(screen.getByRole("progressbar", { name: /辨识进度/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "输入英文拼写" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  test("reset keeps the deck and removed words, then Undo restores the learning scene", () => {
    const ids = createCardIds([alpha, beta]);
    saveAssets([alpha, beta], [ids[1]]);
    render(<App />);
    enterSingleCardSpelling();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "重置学习进度" }));
    fireEvent.click(screen.getByRole("button", { name: "确认重置" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "Al·pha" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "撤销重置进度" })[0]);
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  test("plain and Shift clicks copy the right content without revealing", async () => {
    saveAssets();
    render(<App />);
    const word = screen.getByRole("button", { name: "Al·pha" });
    fireEvent.click(word);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("Alpha"));
    expect(document.activeElement).not.toBe(word);
    expect(screen.queryByText(alpha.meaning)).toBeNull();

    fireEvent.click(word, { shiftKey: true });
    await waitFor(() => {
      const copied = navigator.clipboard.writeText.mock.calls.at(-1)[0];
      expect(copied).toContain("当前单词：Alpha");
      expect(copied.length).toBeGreaterThan(200);
    });
    expect(screen.queryByText(alpha.meaning)).toBeNull();
  });

  test("clipboard failure exposes the full text for manual copying", async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Al·pha" }), { shiftKey: true });
    expect(await screen.findByRole("textbox", { name: "" })).toBeTruthy();
    expect(screen.getByText("手动复制")).toBeTruthy();
    expect(document.querySelector(".manual-copy textarea").value).toContain("当前单词：Alpha");
  });

  test("pronunciation follows reveal, recognition failure order, and spelling submission", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    saveAssets([alpha, beta]);
    render(<App />);
    const firstTerm = currentWordButton().textContent;
    const firstSpokenCount = window.speechSynthesis.speak.mock.calls.length;
    press("Enter", "Enter");
    expect(window.speechSynthesis.speak.mock.calls.length).toBe(firstSpokenCount + 1);
    press("n", "KeyN");
    const speech = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text);
    expect(speech.at(-2)).toBe(firstTerm.replaceAll("·", ""));
    expect(speech.at(-1)).not.toBe(speech.at(-2));
    vi.restoreAllMocks();
  });

  test("automatic pronunciation can be turned off while manual replay remains", () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    const toggle = screen.getByRole("switch", { name: /自动美式发音/ });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    window.speechSynthesis.speak.mockClear();
    press("Enter", "Enter");
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    window.speechSynthesis.speaking = true;
    fireEvent.click(screen.getByRole("button", { name: "播放 Alpha 的美式发音" }));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.resume).toHaveBeenCalled();
    expect(window.speechSynthesis.speak.mock.calls[0][0].volume).toBe(1);
  });

  test("pointer-clicked controls release focus so the next learning key keeps working", () => {
    vi.useFakeTimers();
    saveAssets();
    render(<App />);

    const speaker = screen.getByRole("button", { name: "播放 Alpha 的美式发音" });
    speaker.focus();
    fireEvent.click(speaker, { detail: 1 });
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).not.toBe(speaker);

    press("Enter", "Enter");
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
    const insightButton = screen.getByRole("button", { name: "查看词源与对应概念" });
    insightButton.focus();
    fireEvent.click(insightButton, { detail: 1 });
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).not.toBe(insightButton);

    press("Enter", "Enter");
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
  });

  test("quiet chrome hides after inactivity and learning keys, then returns on pointer or Tab", () => {
    vi.useFakeTimers();
    saveAssets();
    const { container } = render(<App />);
    const shell = container.querySelector(".app-shell");
    act(() => vi.advanceTimersByTime(2500));
    expect(shell.classList.contains("is-quiet")).toBe(true);
    fireEvent.pointerMove(window);
    expect(shell.classList.contains("is-quiet")).toBe(false);
    press("Enter", "Enter");
    expect(shell.classList.contains("is-quiet")).toBe(true);
    press("Tab", "Tab");
    expect(shell.classList.contains("is-quiet")).toBe(false);
    vi.useRealTimers();
  });

  test("Undo toast lasts five seconds while the quiet header action remains available", () => {
    vi.useFakeTimers();
    saveAssets([alpha, beta]);
    render(<App />);
    press("Delete", "Delete");
    expect(document.querySelector(".undo-toast")).toBeTruthy();
    press("Enter", "Enter");
    expect(document.querySelector(".undo-toast")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(document.querySelector(".undo-toast")).toBeNull();
    expect(screen.getByRole("button", { name: "撤销移出单词" })).toBeTruthy();
  });

  test("modified and repeated study shortcuts do not change learning state", () => {
    saveAssets();
    render(<App />);
    fireEvent.keyDown(document, { key: "Enter", code: "Enter", metaKey: true });
    fireEvent.keyDown(document, { key: "Enter", code: "Enter", repeat: true });
    expect(screen.queryByText(alpha.meaning)).toBeNull();
  });

  test.each(["Import", "更多"])(
    "%s panel trigger releases focus after Esc so Enter keeps learning",
    async (triggerName) => {
      saveAssets();
      const { unmount } = render(<App />);
      const trigger = screen.getByRole("button", { name: triggerName });
      trigger.focus();
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: "管理这份词表" })).toBeTruthy();
      press("Escape", "Escape");
      await waitFor(() => expect(document.activeElement).not.toBe(trigger));
      press("Enter", "Enter");
      expect(screen.getByText(alpha.meaning)).toBeTruthy();
      unmount();
    },
  );
});
