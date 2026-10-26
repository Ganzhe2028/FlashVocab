import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App.jsx";
import { createCardIds } from "./learningAlgorithm.js";
import { DECK_STORAGE_KEY, DECK_STORAGE_VERSION } from "./storage/learningStorage.js";
import { THEME_STORAGE_KEY } from "./hooks/useThemePreference.js";
import { MASTERY_STORAGE_KEY } from "./storage/masteryStorage.js";

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

const nasa = {
  ...alpha,
  term: "NASA",
  syllables: "N·A·S·A",
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
const enableAutomaticPronunciation = () => {
  fireEvent.click(screen.getByRole("button", { name: "更多" }));
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("switch", { name: /自动美式发音/ }));
  fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
};

const enableSpelling = () => {
  fireEvent.click(screen.getByRole("button", { name: "更多" }));
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  fireEvent.click(screen.getByRole("radio", { name: "所有词" }));
  fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
};

const startSingleCardSpelling = () => {
  enableSpelling();
  press("q", "KeyQ");
  expect(screen.queryByText(alpha.meaning)).toBeNull();
  press("n", "KeyN");
  return screen.getByRole("textbox", { name: "输入英文拼写" });
};

const aiResponse = (request) => {
  const items = JSON.parse(JSON.parse(request.body).messages[1].content).items.map((item) => {
    const counterpart = item.relatedWord ? item.relatedWord.split(" — ")[0] : "improvise";
    return { index: item.index, term: item.term,
      meaning: "make a plan", meaningZh: "计划", relatedWord: `${counterpart} — 当场发挥，目标词事先计划`,
      microScene: "把散乱纸条排成一步步计划。", distractors: ["invent", "design"], usageTags: ["动作"],
      memorySketch: { left: { icon: "notes", label: "散乱纸条" }, right: { icon: "plan", label: "执行步骤" }, link: "事先排好" },
      miniScenario: "She plans every step in advance.",
      examples: [{ sentence: `They ${item.term} a plan.`, focus: `${item.term} a plan` }],
      contrastScenarios: [
        { scenario: "She prepares every step before starting.", answer: item.term, explanation: "事先计划。" },
        { scenario: "A plan fails and she makes up a solution on the spot.", answer: counterpart, explanation: "当场发挥。" },
      ],
    };
  });
  return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items }) } }] }) };
};

const enableAI = (apiKey = "test-key-not-a-secret") => {
  fireEvent.click(screen.getByRole("switch", { name: /导入时用 DeepSeek/ }));
  fireEvent.change(screen.getByLabelText("DeepSeek API key"), { target: { value: apiKey } });
};

describe("FlashVocab 3.0", () => {
  test.each(["", "[AL-fuh]"])("missing part of speech leaves no placeholder and retains supplied pronunciation (%s)", (respell) => {
    saveAssets([{ term: "Alpha", respell }]);
    render(<App />);
    expect(screen.queryByText("词性未提供")).toBeNull();
    expect(Boolean(document.querySelector(".word-meta"))).toBe(Boolean(respell));
    if (respell) expect(screen.getByText(respell)).toBeTruthy();
  });
  test("large word banks label only nine shortcuts and keep later choices clickable", () => {
    saveAssets(Array.from({ length: 12 }, (_, index) => ({ term: `word${index}`, examples: [{ sentence: `Use word${index} here.`, focus: `word${index}` }] })));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习词库题" }));
    const choices = within(screen.getByRole("group", { name: "选择答案" })).getAllByRole("button");
    expect(choices).toHaveLength(12);
    expect(document.querySelectorAll(".question-options kbd")).toHaveLength(9);
    expect(choices[9].querySelector("kbd")).toBeNull();
    expect(screen.getByText(/前九项可按 1–9/)).toBeTruthy();
    press("0", "Digit0");
    expect(document.querySelector(".question-feedback")).toBeNull();
    fireEvent.click(choices[9]);
    expect(document.querySelector(".question-feedback")).toBeTruthy();
    expect(choices[9].disabled).toBe(true);
  });
  test("quick-known skips only recognized cards and speaks the next card synchronously", () => {
    saveAssets([alpha, beta]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const setting = screen.getByRole("switch", { name: /认识的词直接前进/ });
    expect(setting.checked).toBe(false);
    fireEvent.click(setting);
    fireEvent.click(screen.getByRole("switch", { name: /自动美式发音/ }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    const before = currentWordButton().textContent;
    window.speechSynthesis.speak.mockClear();
    window.speechSynthesis.speak.mockImplementationOnce(() => expect(currentWordButton().textContent).toBe(before));
    press("q", "KeyQ");
    const after = currentWordButton().textContent;
    expect(after).not.toBe(before);
    expect(window.speechSynthesis.speak.mock.calls[0][0].text.toLowerCase()).toBe(after);
    expect(screen.queryByTestId("study-answer")).toBeNull();
    press("w", "KeyW");
    expect(currentWordButton().textContent).not.toBe("");
    expect(screen.getByTestId("study-answer")).toBeTruthy();
    press("n", "KeyN");
    expect(screen.getByRole("heading", { name: "这一轮练完了。" })).toBeTruthy();
  });
  test("intro fallback remains a neutral learning hint alongside import success, then dismisses on judgment", () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByRole("textbox", { name: "粘贴导入" }), { target: { value: "delta" } });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByText(/初见局：可用情景题不足/).classList.contains("learning-hint")).toBe(true);
    expect(document.querySelector(".undo-toast").textContent).toContain("已新增");
    press("q", "KeyQ");
    expect(screen.queryByText(/初见局：可用情景题不足/)).toBeNull();
  });
  test("word banks display title-cased terms while scoring and saving original values", () => {
    saveAssets([{ ...alpha, term: "alpha" }]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习词库题" }));
    const options = screen.getByRole("group", { name: "选择答案" });
    expect(within(options).getByRole("button", { name: /^Omega \d/ })).toBeTruthy();
    fireEvent.click(within(options).getByRole("button", { name: /^Alpha \d/ }));
    expect(screen.getByText("答对了")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck[0].term).toBe("alpha");
  });
  test("missing contrast material gives a preparation path without exposing schema names", () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习对位辨析" }));
    const notice = screen.getByRole("status").textContent;
    expect(notice).toContain("在词表面板用 DeepSeek 补齐");
    expect(notice).not.toMatch(/relatedWord|miniScenario|contrastScenarios/);
    expect(currentWordButton().textContent).toBe("alpha");
    expect(screen.queryByRole("group", { name: "选择答案" })).toBeNull();
  });
  test.each([false, true])("sample feedback distinguishes first load from replacement (existing=%s)", (existing) => {
    if (existing) saveAssets();
    render(<App />);
    if (existing) {
      fireEvent.click(screen.getByRole("button", { name: "Import" }));
      fireEvent.click(screen.getByRole("button", { name: "恢复 24 个示例词" }));
      fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));
      fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    } else fireEvent.click(screen.getByRole("button", { name: "用示例词体验 1 分钟" }));
    expect(screen.getByText(existing ? "已换成 24 个词。" : "已装入 24 个示例词。")).toBeTruthy();
  });
  test.each([true, false])("quiz feedback identifies the correct answer and selected mistake (correct=%s)", (correct) => {
    saveAssets([alpha, beta]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习选择题" }));
    const answer = document.querySelector(".question-prompt").textContent === alpha.meaning ? alpha.term : beta.term;
    const options = within(screen.getByRole("group", { name: "选择答案" })).getAllByRole("button");
    const selected = options.find((option) => option.textContent.startsWith(answer) === correct);
    fireEvent.click(selected);
    expect(within(document.querySelector(".is-correct")).getByText("正确答案")).toBeTruthy();
    expect(document.querySelectorAll(".is-incorrect")).toHaveLength(correct ? 0 : 1);
    if (!correct) expect(within(selected).getByText("你的选择（错）")).toBeTruthy();
    expect(options.every((option) => option.disabled)).toBe(true);
  });
  test("cycle summary separates continuation from the four described practice choices", () => {
    saveAssets([alpha, beta]);
    render(<App />);
    for (let index = 0; index < 2; index += 1) { press("q", "KeyQ"); press("n", "KeyN"); }
    const actions = screen.getByRole("group", { name: "轮次操作" });
    expect(within(actions).getAllByRole("button")).toHaveLength(2);
    const practice = screen.getByRole("region", { name: "练一练" });
    expect(within(practice).getAllByRole("button")).toHaveLength(4);
    const mcq = within(practice).getByRole("button", { name: "练习选择题" });
    expect(document.getElementById(mcq.getAttribute("aria-describedby")).textContent).toBe("释义选词");
    fireEvent.click(mcq);
    expect(screen.getByRole("heading", { name: "选最贴切的词。" })).toBeTruthy();
  });
  test("DeepSeek material is applied atomically, stays local without the key, and can be undone", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, request) => aiResponse(request));
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    enableAI();
    fireEvent.click(screen.getByRole("button", { name: "补齐当前波次资料" }));
    await screen.findByText(/已补齐 1 个词的资料/);
    expect(JSON.stringify(window.localStorage)).not.toContain("test-key-not-a-secret");
    const stored = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY));
    expect(stored.sourceDeck[0].examples).toHaveLength(3);
    expect(stored.sourceDeck[0].microScene).toBe("把散乱纸条排成一步步计划。");
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    press("e", "KeyE");
    expect(screen.getByText("把散乱纸条排成一步步计划。")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Alpha 的记忆图：散乱纸条，事先排好，执行步骤/ })).toBeTruthy();
    expect(screen.queryByText(alpha.wordOrigin)).toBeNull();
    fireEvent.click(document.querySelector(".undo-toast button"));
    expect(screen.queryByText("把散乱纸条排成一步步计划。")).toBeNull();
    expect(currentWordButton().textContent).toBe("alpha");
  });

  test("DeepSeek import failures and cancellation keep the active wave and learning scene", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 });
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    enableAI();
    fireEvent.change(screen.getByRole("textbox", { name: "粘贴导入" }), { target: { value: "Delta" } });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    await screen.findByText(/DeepSeek API key 无效/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockImplementation((url, request) => new Promise((resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    fireEvent.click(screen.getByRole("button", { name: "补齐当前波次资料" }));
    expect(screen.getByRole("button", { name: "使用粘贴内容" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "取消备料" }));
    await screen.findByText(/备料已取消/);
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(currentWordButton().textContent).toBe("alpha");
    expect(JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck).toHaveLength(1);
  });
  test("contrast practice gives a two-word boundary choice and shows the distinction after answering", () => {
    saveAssets([{ ...alpha, miniScenario: "The item appears before all the others." }]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习对位辨析" }));
    expect(screen.getByRole("heading", { name: "这次更接近哪个词？" })).toBeTruthy();
    expect(document.querySelectorAll(".question-options button")).toHaveLength(2);
    press("1", "Digit1");
    expect(screen.getByText(alpha.relatedWord)).toBeTruthy();
    press("n", "KeyN");
    expect(screen.getByRole("heading", { name: "这组题练完了。" })).toBeTruthy();
  });
  test("word bank practice uses focus cloze and displays extra-word count with answer feedback", () => {
    saveAssets([alpha, beta]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习词库题" }));
    expect(screen.getByRole("heading", { name: "从词库找回搭配。" })).toBeTruthy();
    expect(document.querySelector(".question-prompt").textContent).toContain("____");
    expect(screen.getByText(/词库含当前波次全部词/)).toBeTruthy();
    press("1", "Digit1");
    expect(screen.getByText(/空缺搭配：/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "回到刚才的学习" }));
    expect(currentWordButton()).toBeTruthy();
  });
  test("a new wave with usable examples starts with scenario teaching and can return to recognition", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "或者直接粘贴" }), { target: { value: JSON.stringify([alpha, beta]) } });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    expect(screen.getByRole("heading", { name: "根据情景选词。" })).toBeTruthy();
    expect(document.querySelector(".question-prompt").textContent).toContain("____");
    fireEvent.click(screen.getByRole("button", { name: "回到刚才的学习" }));
    expect(currentWordButton()).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
  test("named imports add waves, retain old words, and allow revival or semester review", () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByRole("textbox", { name: "这波叫什么" }), { target: { value: "W5" } });
    fireEvent.change(screen.getByRole("textbox", { name: "粘贴导入" }), { target: { value: JSON.stringify([beta]) } });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(currentWordButton().textContent).toBe("beta");
    const stored = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY));
    expect(stored.sourceDeck).toHaveLength(2);
    expect(stored.waves.map((wave) => wave.status)).toEqual(["cold", "active"]);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "复活 W1" }));
    expect(currentWordButton().textContent).toBe("alpha");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "全部复活，期末总复习" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuemax")).toBe("2");
  });
  test("round summary separates fuzzy from unknown and agrees with persisted mastery", () => {
    saveAssets();
    render(<App />);
    press("w", "KeyW");
    press("n", "KeyN");
    expect(screen.getByText("1 个词，认识 0，模糊 1，不认识 0")).toBeTruthy();
    expect(screen.getByText("待巩固 1，未见 0，渐稳 0，毕业 0")).toBeTruthy();
    const [cardId] = createCardIds([alpha]);
    const stored = JSON.parse(window.localStorage.getItem(MASTERY_STORAGE_KEY));
    expect(stored.mastery[cardId].fuzzy).toBe(1);
    expect(stored.mastery[cardId].mistakes).toBe(0);
  });
  test("saved mastery orders weak words first and graduated words can be found back with Undo", () => {
    saveAssets([alpha, beta]);
    const [alphaId, betaId] = createCardIds([alpha, beta]);
    window.localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify({ version: 1, mastery: {
      [alphaId]: { streak: 3, mistakes: 0, fuzzy: 0, lastSeen: 1000 },
      [betaId]: { streak: 0, mistakes: 1, fuzzy: 0, lastSeen: 2000 },
    } }));
    render(<App />);
    expect(currentWordButton().textContent).toBe("beta");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "找回毕业词" }));
    expect(document.querySelector(".undo-toast")).toBeTruthy();
    fireEvent.click(document.querySelector(".undo-toast button"));
    expect(currentWordButton().textContent).toBe("beta");
    const stored = JSON.parse(window.localStorage.getItem(MASTERY_STORAGE_KEY));
    expect(stored.mastery[alphaId].streak).toBe(3);
  });
  test("live MCQ accepts keyboard choices, shows results, and resumes the same study scene", () => {
    saveAssets([alpha, beta]);
    render(<App />);
    const before = currentWordButton().textContent;
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "练习选择题" }));
    expect(screen.getByRole("heading", { name: "选最贴切的词。" })).toBeTruthy();
    press("1", "Digit1");
    expect(screen.getByRole("status").textContent).toMatch(/答对了|正确答案/);
    press("n", "KeyN");
    press("1", "Digit1");
    press("n", "KeyN");
    expect(screen.getByRole("heading", { name: "这组题练完了。" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/共 2 题/);
    fireEvent.click(screen.getByRole("button", { name: "回到刚才的学习" }));
    expect(currentWordButton().textContent).toBe(before);
  });
  test("spelling is optional and defaults to a recognition summary", () => {
    saveAssets();
    render(<App />);
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(screen.getByRole("heading", { name: "这一轮练完了。" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "输入英文拼写" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /继续下一轮/ }));
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
  });
  test.each([
    ["q", "KeyQ", false, false],
    ["w", "KeyW", true, false],
    ["e", "KeyE", true, true],
  ])("%s controls definition and origin exposure without showing full examples", (key, code, definition, origin) => {
    saveAssets();
    render(<App />);
    press(key, code);
    expect(Boolean(screen.queryByText(alpha.meaning))).toBe(definition);
    expect(Boolean(screen.queryByText(alpha.wordOrigin))).toBe(origin);
    expect(Boolean(screen.queryByRole("img", { name: /Alpha 的记忆图/ }))).toBe(key === "e");
    expect(screen.queryByLabelText("例句")).toBeNull();
    if (key === "q") {
      fireEvent.click(screen.getByRole("button", { name: "查看答案" }));
      expect(screen.getByText(alpha.meaning)).toBeTruthy();
    }
  });
  test("learning can return to preparation and resume the same revealed card", () => {
    saveAssets();
    render(<App />);
    press("e", "KeyE");
    fireEvent.click(screen.getByRole("button", { name: "准备页" }));
    expect(screen.getByRole("heading", { name: "把这次要考的词放进来。" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续刚才的学习" }));
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
  });

  test("an unknown word returns twice before spelling while the original failure remains", () => {
    saveAssets();
    render(<App />);
    enableSpelling();
    press("e", "KeyE");
    press("n", "KeyN");
    expect(screen.getByText("辨识 · 本轮再遇见")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "本轮加练进度 1 / 2" })).toBeTruthy();
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(screen.getByText("辨识 · 本轮再遇见")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "本轮加练进度 2 / 2" })).toBeTruthy();
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
  });
  test("fresh visits lead with Import and keep the sample deck secondary", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "把这次要考的词放进来。" })).toBeTruthy();
    expect(screen.getByText("Import 文件")).toBeTruthy();
    expect(screen.getByRole("button", { name: "用示例词体验 1 分钟" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
  });

  test("fresh visitors can read the quick start and receive guidance inside the real learning flow", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "先看看怎么用" }));
    expect(screen.getByRole("dialog", { name: "1 分钟上手" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "完整学习循环" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "粘贴导入" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    fireEvent.change(screen.getByRole("textbox", { name: "或者直接粘贴" }), {
      target: { value: JSON.stringify([alpha]) },
    });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    expect(screen.getByLabelText("首次辨识提示")).toBeTruthy();
    expect(screen.getByText("第一次先凭记忆判断")).toBeTruthy();
    enableSpelling();
    press("q", "KeyQ");
    expect(screen.getByText("答案页只做一件事")).toBeTruthy();
    press("n", "KeyN");
    expect(screen.getByLabelText("首次拼写提示")).toBeTruthy();
  });

  test("saved decks start a fresh recognition round with layered reading content", () => {
    saveAssets();
    render(<App />);

    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    expect(screen.queryByText(alpha.meaning)).toBeNull();
    press("w", "KeyW");
    expect(screen.getByRole("button", { name: "al·pha" })).toBeTruthy();
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
    expect(screen.getByText(alpha.meaningZh)).toBeTruthy();
    expect(screen.queryByLabelText("例句")).toBeNull();
    expect(screen.queryByText("Alpha is here.")).toBeNull();
    expect(screen.getByText(alpha.relatedWord, { exact: false })).toBeTruthy();
    expect(screen.queryByText(alpha.wordOrigin)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看词源" }));
    expect(screen.getByText(alpha.wordOrigin)).toBeTruthy();
  });

  test("Strict Mode cleanup does not cancel the browser-global speech engine", () => {
    saveAssets();
    const { unmount } = render(<App />);
    window.speechSynthesis.cancel.mockClear();

    unmount();

    expect(window.speechSynthesis.cancel).not.toHaveBeenCalled();
  });

  test("automatic study entry speaks synchronously in the initiating event before rendering the next scene", () => {
    saveAssets();
    render(<App />);
    enableAutomaticPronunciation();
    press("q", "KeyQ");
    press("n", "KeyN");
    let summaryWasVisibleAtSpeech = false;
    const speakMock = window.speechSynthesis.speak;
    speakMock.mockClear();
    speakMock.mockImplementation(() => {
      summaryWasVisibleAtSpeech = Boolean(screen.queryByRole("heading", { name: "这一轮练完了。" }));
    });
    press("Enter", "Enter");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(summaryWasVisibleAtSpeech).toBe(true);
    expect(currentWordButton()).toBeTruthy();
    speakMock.mockImplementation(() => {});
  });

  test("Q then N runs recognition to spelling, and a first spelling error must be corrected", () => {
    saveAssets();
    render(<App />);
    enableAutomaticPronunciation();
    const input = startSingleCardSpelling();
    expect(screen.queryByText("Alpha")).toBeNull();

    fireEvent.change(input, { target: { value: "Alfa" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(input.value).toBe("");
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe("Alpha");
    expect(screen.getByText(/第一次没拼对/)).toBeTruthy();
    expect(screen.getByText("Alpha", { selector: "strong" })).toBeTruthy();

    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByText(/已经改正/)).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByRole("heading", { name: "这一轮练完了。" })).toBeTruthy();
    expect(screen.getByText("1 个词，首次写对 0，需重拼 1")).toBeTruthy();
    press("Enter", "Enter");
    expect(screen.getByRole("progressbar", { name: /辨识进度/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
  });

  test("empty Enter records an unknown spelling and reveals the same correction prompt", () => {
    saveAssets();
    render(<App />);
    enableAutomaticPronunciation();
    const input = startSingleCardSpelling();
    expect(input.value).toBe("");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(input.value).toBe("");
    expect(screen.getByText(/第一次没拼对/)).toBeTruthy();
    expect(screen.getByText("Alpha", { selector: "strong" })).toBeTruthy();
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe("Alpha");

    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByText(/已经改正/)).toBeTruthy();
  });

  test("spelling uses a native input and pause preserves the single queue", () => {
    saveAssets();
    render(<App />);
    let input = startSingleCardSpelling();
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

  test("invalid import keeps the library; a valid new wave can be undone", async () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    const paste = screen.getByRole("textbox", { name: "粘贴导入" });

    fireEvent.change(paste, { target: { value: "not a deck" } });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    expect(screen.getByText(/原词表保持不变/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByRole("textbox", { name: "粘贴导入" }), {
      target: { value: JSON.stringify([{ ...beta, extraField: "preserved" }]) },
    });
    fireEvent.click(screen.getByRole("button", { name: "使用粘贴内容" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "beta" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "撤销新增波次" })[0]);
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.queryByText(/已新增 1 个词，旧波次已冷藏/)).toBeNull();

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY));
      expect(stored.sourceDeck[0].term).toBe("Alpha");
      expect(stored.sourceDeck).toHaveLength(1);
      expect(stored.waves).toHaveLength(1);
    });
  });

  test("removing the final word shows a recoverable empty state and manual find-back", () => {
    saveAssets();
    render(<App />);
    press("Delete", "Delete");
    expect(screen.getByRole("heading", { name: "所有词都已移出。" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^撤销/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "撤销移出单词" }));
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();

    press("Delete", "Delete");
    fireEvent.click(screen.getByRole("button", { name: "打开管理" }));
    fireEvent.click(screen.getByRole("button", { name: "找回" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
  });

  test("a reload keeps deck assets and removals but resets the learning session", () => {
    const ids = createCardIds([alpha, beta]);
    saveAssets([alpha, beta], [ids[1]]);
    const first = render(<App />);
    enableSpelling();
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
    first.unmount();

    render(<App />);
    expect(screen.getByRole("progressbar", { name: /辨识进度/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "输入英文拼写" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  test("reset keeps the deck and removed words, then Undo restores the learning scene", () => {
    const ids = createCardIds([alpha, beta]);
    saveAssets([alpha, beta], [ids[1]]);
    render(<App />);
    startSingleCardSpelling();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "重置学习进度" }));
    fireEvent.click(screen.getByRole("button", { name: "确认重置" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "撤销重置进度" })[0]);
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  test("plain and Shift clicks copy the right content without revealing", async () => {
    saveAssets();
    render(<App />);
    const word = screen.getByRole("button", { name: "alpha" });
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
    fireEvent.click(screen.getByRole("button", { name: "alpha" }), { shiftKey: true });
    expect(await screen.findByRole("textbox", { name: "" })).toBeTruthy();
    expect(screen.getByText("手动复制")).toBeTruthy();
    expect(document.querySelector(".manual-copy textarea").value).toContain("当前单词：Alpha");
  });

  test("recognition headings preserve fully uppercase source terms", () => {
    saveAssets([nasa]);
    render(<App />);

    expect(screen.getByRole("button", { name: "NASA" })).toBeTruthy();
    press("q", "KeyQ");
    expect(screen.getByRole("button", { name: "N·A·S·A" })).toBeTruthy();
  });

  test.each([
    ["known", "q", "KeyQ"],
    ["unknown", "e", "KeyE"],
  ])("a %s recognition choice replays the current word, then advancing speaks the next", (_, key, code) => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    saveAssets([alpha, beta]);
    render(<App />);
    enableAutomaticPronunciation();
    const firstTerm = window.speechSynthesis.speak.mock.calls.at(-1)[0].text;
    let speech = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text);
    expect(speech).toEqual([firstTerm]);
    press(key, code);
    expect(screen.getByTestId("study-answer")).toBeTruthy();
    if (key === "e") {
      expect(screen.queryByRole("button", { name: /M/ })).toBeNull();
    } else {
      expect(screen.getByRole("button", { name: /记错了，下一词/ })).toBeTruthy();
    }
    speech = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text);
    expect(speech).toEqual([
      firstTerm,
      firstTerm,
    ]);
    press("n", "KeyN");
    speech = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text);
    expect(speech).toHaveLength(3);
    expect(speech[2]).not.toBe(firstTerm);
    vi.restoreAllMocks();
  });

  test("M is inactive on an answer reached by choosing unknown", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    saveAssets([alpha, beta]);
    render(<App />);
    enableAutomaticPronunciation();
    const firstTerm = window.speechSynthesis.speak.mock.calls.at(-1)[0].text;
    press("e", "KeyE");
    press("m", "KeyM");
    expect(currentWordButton().textContent.replaceAll("·", "").toLocaleLowerCase()).toBe(firstTerm.toLocaleLowerCase());
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    press("n", "KeyN");
    expect(currentWordButton().textContent.replaceAll("·", "").toLocaleLowerCase()).not.toBe(firstTerm.toLocaleLowerCase());
    vi.restoreAllMocks();
  });

  test.each([["q", "KeyQ", true], ["e", "KeyE", false]])("guidance mentions M only when that correction is available after %s", (key, code, canCorrect) => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "在学习页重新显示提示" }));
    press(key, code);
    expect(screen.getByLabelText("首次辨识提示").textContent.includes("M")).toBe(canCorrect);
    expect(Boolean(screen.queryByRole("button", { name: /记错了，下一词/ }))).toBe(canCorrect);
  });

  test("M on a revealed recognized word corrects the result and advances immediately", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    saveAssets([alpha, beta]);
    render(<App />);
    enableAutomaticPronunciation();
    const firstTerm = window.speechSynthesis.speak.mock.calls.at(-1)[0].text;
    press("q", "KeyQ");
    expect(screen.getByRole("button", { name: /记错了，下一词/ })).toBeTruthy();
    press("m", "KeyM");
    const nextTerm = window.speechSynthesis.speak.mock.calls.at(-1)[0].text;
    expect(nextTerm).not.toBe(firstTerm);
    const speech = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text);
    expect(speech).toEqual([firstTerm, firstTerm, nextTerm]);
    vi.restoreAllMocks();
  });

  test("automatic pronunciation defaults off, can be enabled, and manual replay remains", () => {
    saveAssets();
    render(<App />);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const toggle = screen.getByRole("switch", { name: /自动美式发音/ });
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    window.speechSynthesis.speak.mockClear();
    press("q", "KeyQ");
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("switch", { name: /自动美式发音/ }));
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    window.speechSynthesis.speak.mockClear();
    window.speechSynthesis.cancel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "播放 Alpha 的美式发音" }));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.cancel).not.toHaveBeenCalled();

    window.speechSynthesis.speaking = true;
    fireEvent.click(screen.getByRole("button", { name: "播放 Alpha 的美式发音" }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  test("pronunciation shows missing-voice and playback errors, then clears on successful completion", () => {
    saveAssets();
    const getVoices = window.speechSynthesis.getVoices;
    getVoices.mockReturnValue([]);
    render(<App />);
    const replay = screen.getByRole("button", { name: /播放 Alpha/ });
    fireEvent.click(replay);
    expect(screen.getByText(/没有找到英语语音/)).toBeTruthy();
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    getVoices.mockReturnValue([{ lang: "en-GB", name: "British English" }]);
    fireEvent.click(replay);
    let utterance = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    expect(utterance.lang).toBe("en-GB");
    act(() => utterance.onerror({ error: "audio-busy" }));
    expect(screen.getByText(/发音未能播放/)).toBeTruthy();
    fireEvent.click(replay);
    utterance = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    act(() => utterance.onstart());
    expect(screen.getByText("正在播放。")).toBeTruthy();
    act(() => utterance.onend());
    expect(screen.queryByText("正在播放。")).toBeNull();
    getVoices.mockReturnValue([{ lang: "en-US", name: "Test US Voice" }]);
  });

  test("appearance follows live system changes and persists manual choices", () => {
    let onSystemThemeChange;
    const systemAppearance = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn((_, listener) => { onSystemThemeChange = listener; }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia.mockReturnValue(systemAppearance);
    saveAssets();
    const first = render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("system");

    systemAppearance.matches = false;
    act(() => onSystemThemeChange());
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("radio", { name: "跟随系统" }).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "亮色" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    first.unmount();

    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("radio", { name: "亮色" }).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "暗色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  test("pointer-clicked controls release focus so the next learning key keeps working", () => {
    vi.useFakeTimers();
    saveAssets();
    render(<App />);

    enableSpelling();
    const speaker = screen.getByRole("button", { name: "播放 Alpha 的美式发音" });
    speaker.focus();
    fireEvent.click(speaker, { detail: 1 });
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).not.toBe(speaker);

    press("w", "KeyW");
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
    const insightButton = screen.getByRole("button", { name: "查看词源" });
    insightButton.focus();
    fireEvent.click(insightButton, { detail: 1 });
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).not.toBe(insightButton);

    press("n", "KeyN");
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
  });

  test("quiet peripheral state follows inactivity and learning keys, then returns on pointer or Tab", () => {
    vi.useFakeTimers();
    saveAssets();
    const { container } = render(<App />);
    const shell = container.querySelector(".app-shell");
    act(() => vi.advanceTimersByTime(2500));
    expect(shell.classList.contains("is-quiet")).toBe(true);
    fireEvent.pointerMove(window);
    expect(shell.classList.contains("is-quiet")).toBe(false);
    press("q", "KeyQ");
    expect(shell.classList.contains("is-quiet")).toBe(true);
    press("Tab", "Tab");
    expect(shell.classList.contains("is-quiet")).toBe(false);
    vi.useRealTimers();
  });

  test("header tools open immediately after inactivity without waiting for pointer movement", () => {
    vi.useFakeTimers();
    saveAssets();
    render(<App />);
    act(() => vi.advanceTimersByTime(2500));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByRole("textbox", { name: "粘贴导入" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    act(() => vi.advanceTimersByTime(2500));
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("dialog", { name: "1 分钟上手" })).toBeTruthy();
    vi.useRealTimers();
  });

  test("Undo has one entry, handing keyboard focus from the five-second toast to the header", () => {
    vi.useFakeTimers();
    saveAssets([alpha, beta]);
    render(<App />);
    press("Delete", "Delete");
    expect(document.querySelector(".undo-toast")).toBeTruthy();
    expect(document.querySelector(".undo-button")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^撤销/ })).toHaveLength(1);
    press("q", "KeyQ");
    expect(document.querySelector(".undo-toast")).toBeTruthy();
    document.querySelector(".undo-toast button").focus();
    act(() => vi.advanceTimersByTime(4999));
    expect(document.querySelector(".undo-button")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelector(".undo-toast")).toBeNull();
    expect(screen.getByRole("button", { name: "撤销移出单词" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^撤销/ })).toHaveLength(1);
    expect(document.activeElement).toBe(document.querySelector(".undo-button"));
  });

  test("Enter plus modified and repeated Q shortcuts do not change recognition state", () => {
    saveAssets();
    render(<App />);
    fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(document, { key: "q", code: "KeyQ", metaKey: true });
    fireEvent.keyDown(document, { key: "q", code: "KeyQ", repeat: true });
    expect(screen.queryByText(alpha.meaning)).toBeNull();
  });

  test("Import and More lead to distinct, focused panel sections", () => {
    saveAssets();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByRole("dialog", { name: "波次与词表" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "粘贴导入" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "完整学习循环" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("dialog", { name: "1 分钟上手" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "完整学习循环" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "粘贴导入" })).toBeNull();
  });

  test("the panel contains Tab focus instead of sending it behind the overlay", () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    const dialog = screen.getByRole("dialog", { name: "1 分钟上手" });
    const buttons = screen.getAllByRole("button").filter((button) => dialog.contains(button));
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons.at(-1));
    fireEvent.keyDown(buttons.at(-1), { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  test.each([
    ["Import", "波次与词表"],
    ["更多", "1 分钟上手"],
  ])(
    "%s panel trigger releases focus after Esc so Q keeps learning",
    async (triggerName, dialogName) => {
      saveAssets();
      const { unmount } = render(<App />);
      const trigger = screen.getByRole("button", { name: triggerName });
      trigger.focus();
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: dialogName })).toBeTruthy();
      press("Escape", "Escape");
      await waitFor(() => expect(document.activeElement).not.toBe(trigger));
      press("w", "KeyW");
      expect(screen.getByText(alpha.meaning)).toBeTruthy();
      unmount();
    },
  );
});
