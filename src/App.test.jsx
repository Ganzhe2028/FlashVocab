import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App.jsx";
import { createCardIds } from "./learningAlgorithm.js";
import {
  DECK_STORAGE_KEY,
  DECK_STORAGE_VERSION,
} from "./storage/learningStorage.js";
import { THEME_STORAGE_KEY } from "./hooks/useThemePreference.js";
import { MASTERY_STORAGE_KEY } from "./storage/masteryStorage.js";

const alpha = {
  term: "Alpha",
  syllables: "Al-pha",
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
  syllables: "N-A-S-A",
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
const openSettings = () => {
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  return screen.getByRole("dialog", { name: "设置" });
};

const closePanel = () =>
  fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));

const openDeck = () => {
  fireEvent.click(screen.getByRole("button", { name: "词表", exact: true }));
  return screen.getByRole("dialog", { name: "我的词表" });
};

const openImport = () => {
  if (document.querySelector(".import-view")) return;
  if (screen.queryByRole("button", { name: "词表", exact: true })) {
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: /添加新词表/ }));
    return;
  }
  // Empty/deck-less pages may already be showing the import view.
  expect(document.querySelector(".import-view")).toBeTruthy();
};

const previewImport = (text) => {
  openImport();
  fireEvent.click(screen.getByRole("button", { name: "粘贴" }));
  fireEvent.change(screen.getByRole("textbox", { name: "单词表内容" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "识别单词" }));
};

const importViaPaste = (text) => {
  previewImport(text);
  fireEvent.click(screen.getByRole("button", { name: /开始背这/ }));
};

const openPractice = (label) => {
  openDeck();
  fireEvent.click(screen.getByText("专项练习"));
  fireEvent.click(screen.getByRole("button", { name: label }));
};

const enableAutomaticPronunciation = () => {
  openSettings();
  fireEvent.click(screen.getByRole("switch", { name: /自动读单词/ }));
  closePanel();
};

const enableSpelling = () => {
  openSettings();
  fireEvent.click(screen.getByRole("radio", { name: /刷词\+拼写全部/ }));
  closePanel();
};

const startSingleCardSpelling = () => {
  enableSpelling();
  press("q", "KeyQ");
  expect(screen.getByText(alpha.meaning)).toBeTruthy();
  press("n", "KeyN");
  expect(screen.getByRole("heading", { name: alpha.meaningZh })).toBeTruthy();
  expect(document.querySelector(".meaning-en").textContent).toBe(alpha.meaning);
  return screen.getByRole("textbox", { name: "输入英文拼写" });
};

const aiResponse = (request) => {
  const items = JSON.parse(
    JSON.parse(request.body).messages[1].content,
  ).items.map((item) => {
    const counterpart = item.relatedWord
      ? item.relatedWord.split(" — ")[0]
      : "improvise";
    return {
      index: item.index,
      term: item.term,
      meaning: "make a plan",
      meaningZh: "计划",
      relatedWord: `${counterpart} — 当场发挥，目标词事先计划`,
      microScene: "把散乱纸条排成一步步计划。",
      distractors: ["invent", "design"],
      usageTags: ["动作"],
      memorySketch: {
        left: { icon: "notes", label: "散乱纸条" },
        right: { icon: "plan", label: "执行步骤" },
        link: "事先排好",
      },
      miniScenario: "She plans every step in advance.",
      examples: [
        { sentence: `They ${item.term} a plan.`, focus: `${item.term} a plan` },
      ],
      contrastScenarios: [
        {
          scenario: "She prepares every step before starting.",
          answer: item.term,
          explanation: "事先计划。",
        },
        {
          scenario: "A plan fails and she makes up a solution on the spot.",
          answer: counterpart,
          explanation: "当场发挥。",
        },
      ],
    };
  });
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify({ items }) },
        },
      ],
    }),
  };
};

const enableAI = (apiKey = "test-key-not-a-secret") => {
  openDeck();
  fireEvent.click(screen.getByText("用 DeepSeek 补全资料（进阶）"));
  fireEvent.change(screen.getByLabelText("DeepSeek API key"), {
    target: { value: apiKey },
  });
};

describe("FlashVocab 3.0", () => {
  test.each(["", "[AL-fuh]"])(
    "missing part of speech leaves no placeholder and retains supplied pronunciation (%s)",
    (respell) => {
      saveAssets([{ term: "Alpha", respell }]);
      render(<App />);
      expect(screen.queryByText("词性未提供")).toBeNull();
      expect(Boolean(document.querySelector(".word-meta"))).toBe(
        Boolean(respell),
      );
      if (respell) expect(screen.getByText(respell)).toBeTruthy();
    },
  );
  test("large word banks label only nine shortcuts and keep later choices clickable", () => {
    saveAssets(
      Array.from({ length: 12 }, (_, index) => ({
        term: `word${index}`,
        examples: [
          { sentence: `Use word${index} here.`, focus: `word${index}` },
        ],
      })),
    );
    render(<App />);
    openPractice("填搭配");
    const choices = within(
      screen.getByRole("group", { name: "选择答案" }),
    ).getAllByRole("button");
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
    openSettings();
    fireEvent.click(screen.getByText("进阶"));
    const setting = screen.getByRole("switch", { name: /认识的词直接前进/ });
    expect(setting.checked).toBe(false);
    fireEvent.click(setting);
    fireEvent.click(screen.getByRole("switch", { name: /自动读单词/ }));
    closePanel();
    const before = currentWordButton().textContent;
    window.speechSynthesis.speak.mockClear();
    window.speechSynthesis.speak.mockImplementationOnce(() =>
      expect(currentWordButton().textContent).toBe(before),
    );
    press("q", "KeyQ");
    const after = currentWordButton().textContent;
    expect(after).not.toBe(before);
    expect(
      window.speechSynthesis.speak.mock.calls[0][0].text.toLowerCase(),
    ).toBe(after);
    expect(screen.queryByTestId("study-answer")).toBeNull();
    press("e", "KeyE");
    expect(currentWordButton().textContent).not.toBe("");
    expect(screen.getByTestId("study-answer")).toBeTruthy();
    press("n", "KeyN");
    press("q", "KeyQ");
    press("q", "KeyQ");
    expect(
      screen.getByRole("heading", { name: "这一轮练完了。" }),
    ).toBeTruthy();
  });
  test("file import only accepts JSON and does not save before confirmation", async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: {
        files: [{ name: "words.md", text: async () => "alpha 第一项" }],
      },
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "只支持 .json",
    );
    fireEvent.change(fileInput, {
      target: {
        files: [
          {
            name: "words.json",
            text: async () => JSON.stringify([alpha, beta]),
          },
        ],
      },
    });
    await screen.findByRole("heading", { name: "这些词对吗？" });
    expect(
      JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck,
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "开始背这 2 个词" }));
    expect(
      JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck,
    ).toHaveLength(2);
  });

  test("a bad second JSON entry cannot silently import the valid first entry", () => {
    render(<App />);
    previewImport(JSON.stringify([alpha, { meaningZh: "缺单词" }]));
    expect(screen.getByRole("alert").textContent).toContain("第 2 个词条");
    expect(
      JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck,
    ).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /开始背这/ })).toBeNull();
  });

  test("a fixed JSON word list previews and starts learning", () => {
    render(<App />);
    previewImport(
      JSON.stringify([
        { term: "delta", meaningZh: "德尔塔" },
        { term: "omega", meaningZh: "欧米伽" },
      ]),
    );
    expect(screen.getByRole("heading", { name: "这些词对吗？" })).toBeTruthy();
    const steps = screen.getByRole("list", { name: "导入步骤" });
    expect(
      within(steps)
        .getByText("核对")
        .closest("li")
        .getAttribute("aria-current"),
    ).toBe("step");
    expect(screen.getByText(/2 个有中文释义/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "开始背这 2 个词" }));
    expect(currentWordButton()).toBeTruthy();
    expect(document.querySelector(".undo-toast").textContent).toContain(
      "已新增",
    );
    press("q", "KeyQ");
    expect(screen.getByTestId("study-answer")).toBeTruthy();
  });
  test("word banks display title-cased terms while scoring and saving original values", () => {
    saveAssets([{ ...alpha, term: "alpha" }]);
    render(<App />);
    openPractice("填搭配");
    const options = screen.getByRole("group", { name: "选择答案" });
    expect(
      within(options).getByRole("button", { name: /^Omega \d/ }),
    ).toBeTruthy();
    fireEvent.click(within(options).getByRole("button", { name: /^Alpha \d/ }));
    expect(screen.getByText("答对了")).toBeTruthy();
    expect(
      JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck[0]
        .term,
    ).toBe("alpha");
  });
  test("missing contrast material gives a preparation path without exposing schema names", () => {
    saveAssets();
    render(<App />);
    openPractice("辨析近义词");
    const notice = screen.getByRole("status").textContent;
    expect(notice).toContain("在「词表」里用 DeepSeek 补全");
    expect(notice).not.toMatch(/relatedWord|miniScenario|contrastScenarios/);
    expect(currentWordButton().textContent).toBe("alpha");
    expect(screen.queryByRole("group", { name: "选择答案" })).toBeNull();
  });
  test.each([false, true])(
    "sample feedback distinguishes first load from replacement (existing=%s)",
    (existing) => {
      if (existing) saveAssets();
      render(<App />);
      if (existing) {
        openDeck();
        fireEvent.click(screen.getByText("重新开始"));
        fireEvent.click(
          screen.getByRole("button", { name: "恢复 24 个示例词" }),
        );
        fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));
        closePanel();
      } else
        fireEvent.click(
          screen.getByRole("button", { name: /用 24 个示例词试试/ }),
        );
      expect(
        screen.getByText(
          existing ? "已换成 24 个词。" : "已装入 24 个示例词。",
        ),
      ).toBeTruthy();
    },
  );
  test.each([true, false])(
    "quiz feedback identifies the correct answer and selected mistake (correct=%s)",
    (correct) => {
      saveAssets([alpha, beta]);
      render(<App />);
      openPractice("看释义选词");
      const answer =
        document.querySelector(".question-prompt").textContent === alpha.meaning
          ? alpha.term
          : beta.term;
      const options = within(
        screen.getByRole("group", { name: "选择答案" }),
      ).getAllByRole("button");
      const selected = options.find(
        (option) => option.textContent.startsWith(answer) === correct,
      );
      fireEvent.click(selected);
      expect(
        within(document.querySelector(".is-correct")).getByText("正确答案"),
      ).toBeTruthy();
      expect(document.querySelectorAll(".is-incorrect")).toHaveLength(
        correct ? 0 : 1,
      );
      if (!correct)
        expect(within(selected).getByText("你的选择（错）")).toBeTruthy();
      expect(options.every((option) => option.disabled)).toBe(true);
    },
  );
  test("cycle summary separates continuation from the four described practice choices", () => {
    saveAssets([alpha, beta]);
    render(<App />);
    for (let index = 0; index < 2; index += 1) {
      press("q", "KeyQ");
      press("n", "KeyN");
    }
    const actions = screen.getByRole("group", { name: "轮次操作" });
    expect(within(actions).getAllByRole("button")).toHaveLength(2);
    const practice = screen.getByRole("region", { name: "练一练" });
    expect(within(practice).getAllByRole("button")).toHaveLength(4);
    const mcq = within(practice).getByRole("button", { name: "看释义选词" });
    expect(
      document.getElementById(mcq.getAttribute("aria-describedby")).textContent,
    ).toBe("给定义，选对应词");
    fireEvent.click(mcq);
    expect(
      screen.getByRole("heading", { name: "选最贴切的词。" }),
    ).toBeTruthy();
  });
  test("DeepSeek material is applied atomically, stays local without the key, and can be undone", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, request) =>
      aiResponse(request),
    );
    saveAssets();
    render(<App />);
    enableAI();
    fireEvent.click(screen.getByRole("button", { name: "补齐当前词表资料" }));
    await screen.findByText(/已补齐 1 个词的资料/);
    expect(JSON.stringify(window.localStorage)).not.toContain(
      "test-key-not-a-secret",
    );
    const stored = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY));
    expect(stored.sourceDeck[0].examples).toHaveLength(3);
    expect(stored.sourceDeck[0].microScene).toBe("把散乱纸条排成一步步计划。");
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    press("e", "KeyE");
    expect(screen.queryByText("把散乱纸条排成一步步计划。")).toBeNull();
    expect(screen.queryByRole("img", { name: /Alpha 的记忆图/ })).toBeNull();
    expect(screen.getByLabelText("例句")).toBeTruthy();
    expect(screen.queryByText(alpha.wordOrigin)).toBeNull();
    fireEvent.click(document.querySelector(".undo-toast button"));
    expect(screen.queryByText("把散乱纸条排成一步步计划。")).toBeNull();
    expect(currentWordButton().textContent).toBe("alpha");
  });

  test("DeepSeek filling failures and cancellation keep the active wave and learning scene", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, status: 401 });
    saveAssets();
    render(<App />);
    enableAI();
    fireEvent.click(screen.getByRole("button", { name: "补齐当前词表资料" }));
    await screen.findByText(/DeepSeek API key 无效/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockImplementation(
      (url, request) =>
        new Promise((resolve, reject) => {
          request.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "补齐当前词表资料" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await screen.findByText(/补全已取消/);
    closePanel();
    expect(currentWordButton().textContent).toBe("alpha");
    expect(
      JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY)).sourceDeck,
    ).toHaveLength(1);
  });
  test("contrast practice gives a two-word boundary choice and shows the distinction after answering", () => {
    saveAssets([
      { ...alpha, miniScenario: "The item appears before all the others." },
    ]);
    render(<App />);
    openPractice("辨析近义词");
    expect(
      screen.getByRole("heading", { name: "这次更接近哪个词？" }),
    ).toBeTruthy();
    expect(document.querySelectorAll(".question-options button")).toHaveLength(
      2,
    );
    press("1", "Digit1");
    expect(screen.getByText(alpha.relatedWord)).toBeTruthy();
    press("n", "KeyN");
    expect(
      screen.getByRole("heading", { name: "这组题练完了。" }),
    ).toBeTruthy();
  });
  test("word bank practice uses focus cloze and displays extra-word count with answer feedback", () => {
    saveAssets([alpha, beta]);
    render(<App />);
    openPractice("填搭配");
    expect(
      screen.getByRole("heading", { name: "从词库找回搭配。" }),
    ).toBeTruthy();
    expect(document.querySelector(".question-prompt").textContent).toContain(
      "____",
    );
    expect(screen.getByText(/词库含当前词表全部词/)).toBeTruthy();
    press("1", "Digit1");
    expect(screen.getByText(/空缺搭配：/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "回到刚才的学习" }));
    expect(currentWordButton()).toBeTruthy();
  });
  test("a new wave with usable examples still starts with recognition, not a surprise quiz", () => {
    render(<App />);
    importViaPaste(JSON.stringify([alpha, beta]));
    expect(currentWordButton()).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: /认词进度/ })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "根据情景选词。" }),
    ).toBeNull();
    openPractice("看情景选词");
    expect(
      screen.getByRole("heading", { name: "根据情景选词。" }),
    ).toBeTruthy();
  });
  test("adding a second wave retains old words and allows switching or full review", () => {
    saveAssets();
    render(<App />);
    importViaPaste(JSON.stringify([beta]));
    expect(currentWordButton().textContent).toBe("beta");
    const stored = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY));
    expect(stored.sourceDeck).toHaveLength(2);
    expect(stored.waves.map((wave) => wave.status)).toEqual(["cold", "active"]);
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "练这组" }));
    expect(currentWordButton().textContent).toBe("alpha");
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "全部一起复习" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuemax")).toBe(
      "2",
    );
  });
  test("round summary counts the first unknown once and agrees with persisted mastery", () => {
    saveAssets();
    render(<App />);
    press("e", "KeyE");
    press("n", "KeyN");
    for (let repeat = 0; repeat < 2; repeat += 1) {
      press("q", "KeyQ");
      press("n", "KeyN");
    }
    expect(screen.getByText("1 个词，认识 0，不认识 1")).toBeTruthy();
    expect(screen.queryByText(/模糊/)).toBeNull();
    expect(screen.getByText("待巩固 1，未见 0，渐稳 0，毕业 0")).toBeTruthy();
    const [cardId] = createCardIds([alpha]);
    const stored = JSON.parse(window.localStorage.getItem(MASTERY_STORAGE_KEY));
    expect(stored.mastery[cardId].fuzzy).toBe(0);
    expect(stored.mastery[cardId].mistakes).toBe(1);
  });
  test("a wave can be renamed from the deck panel and undone", () => {
    saveAssets();
    render(<App />);
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "改名" }));
    fireEvent.change(screen.getByRole("textbox", { name: "重命名 W1" }), {
      target: { value: "Unit 5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getAllByText("Unit 5").length).toBeGreaterThan(0);
    fireEvent.click(document.querySelector(".undo-toast button"));
    expect(screen.queryAllByText("Unit 5")).toHaveLength(0);
    expect(screen.getAllByText("W1").length).toBeGreaterThan(0);
  });
  test("saved mastery orders weak words first and graduated words can be found back with Undo", () => {
    saveAssets([alpha, beta]);
    const [alphaId, betaId] = createCardIds([alpha, beta]);
    window.localStorage.setItem(
      MASTERY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        mastery: {
          [alphaId]: { streak: 3, mistakes: 0, fuzzy: 0, lastSeen: 1000 },
          [betaId]: { streak: 0, mistakes: 1, fuzzy: 0, lastSeen: 2000 },
        },
      }),
    );
    render(<App />);
    expect(currentWordButton().textContent).toBe("beta");
    openDeck();
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
    openPractice("看释义选词");
    expect(
      screen.getByRole("heading", { name: "选最贴切的词。" }),
    ).toBeTruthy();
    press("1", "Digit1");
    expect(screen.getByRole("status").textContent).toMatch(/答对了|正确答案/);
    press("n", "KeyN");
    press("1", "Digit1");
    press("n", "KeyN");
    expect(
      screen.getByRole("heading", { name: "这组题练完了。" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/共 2 题/);
    fireEvent.click(screen.getByRole("button", { name: "回到刚才的学习" }));
    expect(currentWordButton().textContent).toBe(before);
  });
  test("spelling is optional and defaults to a recognition summary", () => {
    saveAssets();
    render(<App />);
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(
      screen.getByRole("heading", { name: "这一轮练完了。" }),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "输入英文拼写" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /继续下一轮/ }));
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
  });
  test.each([
    ["q", "KeyQ"],
    ["e", "KeyE"],
  ])(
    "%s reveals definitions and examples with optional insights and no memory picture",
    (key, code) => {
      saveAssets([
        {
          ...alpha,
          microScene: "已有的记忆短句。",
          memorySketch: {
            left: { icon: "notes", label: "纸条" },
            right: { icon: "plan", label: "计划" },
            link: "排好",
          },
        },
      ]);
      render(<App />);
      const choices = screen.getByLabelText("认词选择");
      expect(within(choices).getAllByRole("button")).toHaveLength(2);
      press("w", "KeyW");
      expect(screen.queryByTestId("study-answer")).toBeNull();
      press(key, code);
      const meaning = document.querySelector(".meaning-block");
      expect([...meaning.children].map((line) => line.textContent)).toEqual([
        alpha.meaningZh,
        alpha.meaning,
      ]);
      expect(screen.queryByText(alpha.wordOrigin)).toBeNull();
      expect(screen.queryByText(alpha.relatedWord)).toBeNull();
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.queryByText("已有的记忆短句。")).toBeNull();
      expect(screen.getByLabelText("例句")).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: "查看词源与对应概念" }),
      );
      expect(screen.getByText(alpha.wordOrigin)).toBeTruthy();
      expect(screen.getByText(alpha.relatedWord)).toBeTruthy();
    },
  );
  test("learning can return to preparation and resume the same revealed card", () => {
    saveAssets();
    render(<App />);
    press("e", "KeyE");
    openImport();
    expect(screen.getByRole("heading", { name: "再加一组词。" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /继续学习/ }));
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
  });

  test("an unknown word returns twice before spelling while the original failure remains", () => {
    saveAssets();
    render(<App />);
    enableSpelling();
    press("e", "KeyE");
    press("n", "KeyN");
    expect(screen.getByText("认词 · 再遇见")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "本轮加练进度 1 / 2" }),
    ).toBeTruthy();
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(screen.getByText("认词 · 再遇见")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "本轮加练进度 2 / 2" }),
    ).toBeTruthy();
    press("q", "KeyQ");
    press("n", "KeyN");
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
  });
  test("fresh visits show a three-step wizard with one source picker and minimal chrome", () => {
    render(<App />);
    const steps = screen.getByRole("list", { name: "导入步骤" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(within(steps).getByText("放入")).toBeTruthy();
    expect(within(steps).getByText("核对")).toBeTruthy();
    expect(within(steps).getByText("开始")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "单词表在哪？" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "文件" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "粘贴" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "单词表内容" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /用 24 个示例词试试/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "设置" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "粘贴" }));
    expect(screen.getByRole("textbox", { name: "单词表内容" })).toBeTruthy();
  });

  test("a matching worksheet routes to the AI rescue and replaces the broken preview", () => {
    render(<App />);
    previewImport(
      "unequivocally (54) highbrow (54)\ncommotion (57) disbelief (57)",
    );
    expect(screen.getByRole("alert").textContent).toContain("JSON 格式不正确");
    fireEvent.click(
      screen.getByRole("button", { name: "把其他格式转成 JSON" }),
    );
    expect(
      screen.getByRole("heading", { name: "先转成 JSON 词表。" }),
    ).toBeTruthy();
    const steps = [
      ...document.querySelectorAll(".assist-panel .fill-step"),
    ].map((step) => step.textContent);
    expect(steps[0]).toContain("复制给 AI 的话");
    expect(steps[1]).toContain("DeepSeek");
    expect(steps[2]).toContain("粘贴回来");
    fireEvent.click(screen.getByText("看看这段话"));
    expect(screen.getByRole("textbox", { name: "整理提示词" }).value).toContain(
      "上传的文件",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "AI 词表回复" }), {
      target: {
        value: JSON.stringify([
          {
            term: "unequivocally",
            pos: "adv.",
            meaningZh: "明确地",
            meaning: "in a way that leaves no doubt",
            wordOrigin: "",
            examples: [],
          },
          {
            term: "highbrow",
            pos: "adj.",
            meaningZh: "高雅的",
            meaning: "interested in serious culture",
            wordOrigin: "",
            examples: [],
          },
        ]),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成词表" }));
    expect(screen.getByRole("heading", { name: "这些词对吗？" })).toBeTruthy();
    expect(screen.getByText(/AI 整理了 2 个词/)).toBeTruthy();
    expect(screen.getByText(/2 个有中文释义/)).toBeTruthy();
    expect(screen.queryByText("highbrow (54)")).toBeNull();
  });

  test("JSON definitions are shown as the English meaning, not as an example", () => {
    render(<App />);
    importViaPaste(
      JSON.stringify([
        {
          term: "sacrilegious",
          pos: "adj.",
          meaningZh: "亵渎神圣的",
          meaning: "treating a holy thing or place without respect",
        },
        {
          term: "restrain",
          pos: "v.",
          meaningZh: "制止；抑制",
          meaning: "to stop somebody from doing something, especially by using",
        },
      ]),
    );
    const term = currentWordButton().textContent.trim().toLocaleLowerCase();
    press("e", "KeyE");
    const expected =
      term === "sacrilegious"
        ? "treating a holy thing or place without respect"
        : "to stop somebody from doing something, especially by using";
    expect(document.querySelector(".meaning-en").textContent).toBe(expected);
    expect(screen.queryByText("未提供释义")).toBeNull();
    expect(screen.queryByLabelText("例句")).toBeNull();
  });

  test("a saved deck with a lone definition example is repaired on load", () => {
    saveAssets([
      {
        term: "Alpha",
        meaningZh: "第一项",
        examples: [
          {
            sentence: "treating a holy thing or place without respect",
            focus: "",
          },
        ],
      },
    ]);
    render(<App />);
    press("e", "KeyE");
    expect(document.querySelector(".meaning-en").textContent).toBe(
      "treating a holy thing or place without respect",
    );
    expect(screen.queryByText("未提供释义")).toBeNull();
    expect(screen.queryByLabelText("例句")).toBeNull();
  });

  test("one copy-and-paste AI reply fills every practice requirement before import", () => {
    render(<App />);
    previewImport(
      JSON.stringify([
        { term: "abandon", meaningZh: "放弃" },
        { term: "quit", meaningZh: "停止" },
      ]),
    );
    expect(screen.getByText("2 个词还没补全资料")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "让 AI 补全" }));
    expect(
      screen.getByRole("heading", { name: "让 AI 一次补齐" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("看看这段话"));
    const prompt = screen.getByRole("textbox", { name: "补全提示词" }).value;
    for (const marker of [
      "abandon",
      "quit",
      "中文释义",
      "词源",
      "对应词",
      "sentence",
      "focus",
      "情景",
      "辨析",
    ]) {
      expect(prompt).toContain(marker);
    }
    expect(prompt).toContain("JSON");
    fireEvent.click(screen.getByRole("button", { name: "复制给 AI 的话" }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
      expect.stringContaining("辨析"),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "AI 回复" }), {
      target: {
        value: JSON.stringify([
          {
            term: "abandon",
            pos: "v.",
            meaningZh: "放弃；抛弃",
            meaning: "to leave somebody or something",
            wordOrigin: "来自古法语 abandonner，原意「交给别人支配」。",
            relatedWord: "quit — quit 是主动停止，abandon 更强调彻底丢下。",
            examples: [
              {
                sentence: "They abandon the plan at noon.",
                focus: "abandon the plan",
              },
              {
                sentence: "We abandon old habits slowly.",
                focus: "abandon old habits",
              },
            ],
            miniScenario: "The team stops a project because the money is gone.",
            contrastScenarios: [
              {
                scenario: "The team stops a project because the money is gone.",
                answer: "abandon",
                explanation: "",
              },
              {
                scenario: "She stops playing tennis because her knee hurts.",
                answer: "quit",
                explanation: "主动停止。",
              },
            ],
          },
          {
            term: "quit",
            pos: "v.",
            meaningZh: "停止；放弃",
            meaning: "to stop doing something",
            wordOrigin: "来自古法语 quiter，原意「解除义务、放走」。",
            relatedWord: "abandon — abandon 是彻底丢下，quit 是主动停止。",
            examples: [
              {
                sentence: "They quit the team after the argument.",
                focus: "quit the team",
              },
              { sentence: "We quit sugar for a month.", focus: "quit sugar" },
            ],
            miniScenario: "A worker leaves a job by choice.",
            contrastScenarios: [
              {
                scenario: "A worker leaves a job by choice.",
                answer: "quit",
                explanation: "",
              },
              {
                scenario: "A company drops an old product for good.",
                answer: "abandon",
                explanation: "彻底丢下。",
              },
            ],
          },
        ]),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别并补全" }));
    expect(
      screen.getByText(/补全了 2 个词的资料，专项练习可以用了/),
    ).toBeTruthy();
    expect(screen.queryByText(/还没补全资料/)).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "让 AI 一次补齐" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /开始背这 2 个词/ }));
    expect(currentWordButton()).toBeTruthy();
    for (const [label, heading] of [
      ["看释义选词", "选最贴切的词。"],
      ["看情景选词", "根据情景选词。"],
      ["填搭配", "从词库找回搭配。"],
      ["辨析近义词", "这次更接近哪个词？"],
    ]) {
      openPractice(label);
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
      expect(screen.getByRole("group", { name: "选择答案" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "回到刚才的学习" }));
    }
  });

  test("a partial AI reply keeps the fill panel open for the remaining words", () => {
    render(<App />);
    previewImport(
      JSON.stringify([
        { term: "abandon", meaningZh: "放弃" },
        { term: "quit", meaningZh: "停止" },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "让 AI 补全" }));
    fireEvent.change(screen.getByRole("textbox", { name: "AI 回复" }), {
      target: {
        value: JSON.stringify([
          {
            term: "abandon",
            pos: "v.",
            meaningZh: "放弃",
            meaning: "to leave",
            wordOrigin: "",
            relatedWord: "quit — 主动停止",
            examples: [
              { sentence: "They abandon the plan.", focus: "abandon the plan" },
            ],
          },
        ]),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别并补全" }));
    expect(screen.getByText(/还有 2 个词没补完/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "让 AI 一次补齐" }),
    ).toBeTruthy();
  });

  test("saved decks start a fresh recognition round with layered reading content", () => {
    saveAssets();
    render(<App />);

    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    expect(screen.queryByText(alpha.meaning)).toBeNull();
    press("e", "KeyE");
    expect(screen.getByRole("button", { name: "al·pha" })).toBeTruthy();
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
    expect(screen.getByText(alpha.meaningZh)).toBeTruthy();
    expect(
      within(screen.getByLabelText("例句")).getAllByRole("listitem"),
    ).toHaveLength(2);
    expect(screen.queryByText("Alpha is here.")).toBeNull();
    expect(screen.queryByText(alpha.relatedWord)).toBeNull();
    expect(screen.queryByText(alpha.wordOrigin)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看词源与对应概念" }));
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
      summaryWasVisibleAtSpeech = Boolean(
        screen.queryByRole("heading", { name: "这一轮练完了。" }),
      );
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
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe(
      "Alpha",
    );
    expect(screen.getByText(/第一次没拼对/)).toBeTruthy();
    expect(screen.getByText("Alpha", { selector: "strong" })).toBeTruthy();

    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByText(/已经改正/)).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(
      screen.getByRole("heading", { name: "这一轮练完了。" }),
    ).toBeTruthy();
    expect(screen.getByText("1 个词，首次写对 0，需重拼 1")).toBeTruthy();
    press("Enter", "Enter");
    expect(screen.getByRole("progressbar", { name: /认词进度/ })).toBeTruthy();
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
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe(
      "Alpha",
    );

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

    expect(
      screen.getByRole("heading", { name: "停一下，答案不会丢。" }),
    ).toBeTruthy();
    press("Enter", "Enter");
    input = screen.getByRole("textbox", { name: "输入英文拼写" });
    expect(input.value).toBe("");

    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });
    press(" ", "Space");
    expect(screen.getByRole("progressbar", { name: /认词进度/ })).toBeTruthy();
  });

  test("invalid input stays in the import preview with a clear error; a valid wave can be undone", async () => {
    saveAssets();
    render(<App />);
    openImport();
    fireEvent.click(screen.getByRole("button", { name: "粘贴" }));
    const paste = screen.getByRole("textbox", { name: "单词表内容" });

    fireEvent.change(paste, { target: { value: "not a deck" } });
    fireEvent.click(screen.getByRole("button", { name: "识别单词" }));
    expect(screen.getByRole("alert").textContent).toContain("JSON 格式不正确");
    expect(document.querySelector(".import-view")).toBeTruthy();

    fireEvent.change(paste, {
      target: { value: JSON.stringify([{ ...beta, extraField: "preserved" }]) },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别单词" }));
    fireEvent.click(screen.getByRole("button", { name: /开始背这/ }));
    expect(screen.getByRole("button", { name: "beta" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "撤销新增词表" })[0]);
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();

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
    expect(
      screen.getByRole("heading", { name: "所有词都已移出。" }),
    ).toBeTruthy();
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
    expect(screen.getByRole("progressbar", { name: /认词进度/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "输入英文拼写" })).toBeNull();
    openDeck();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  test("reset keeps the deck and removed words, then Undo restores the learning scene", () => {
    const ids = createCardIds([alpha, beta]);
    saveAssets([alpha, beta], [ids[1]]);
    render(<App />);
    startSingleCardSpelling();

    openDeck();
    fireEvent.click(screen.getByText("重新开始"));
    fireEvent.click(screen.getByRole("button", { name: "重置学习进度" }));
    fireEvent.click(screen.getByRole("button", { name: "确认重置" }));
    closePanel();
    expect(screen.getByRole("button", { name: "alpha" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "撤销重置进度" })[0]);
    expect(screen.getByRole("textbox", { name: "输入英文拼写" })).toBeTruthy();
    openDeck();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  test("plain and Shift clicks copy the right content without revealing", async () => {
    saveAssets();
    render(<App />);
    const word = screen.getByRole("button", { name: "alpha" });
    fireEvent.click(word);
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("Alpha"),
    );
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
    fireEvent.click(screen.getByRole("button", { name: "alpha" }), {
      shiftKey: true,
    });
    expect(await screen.findByRole("textbox", { name: "" })).toBeTruthy();
    expect(screen.getByText("手动复制")).toBeTruthy();
    expect(document.querySelector(".manual-copy textarea").value).toContain(
      "当前单词：Alpha",
    );
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
  ])(
    "a %s recognition choice replays the current word, then advancing speaks the next",
    (_, key, code) => {
      vi.spyOn(Math, "random").mockReturnValue(0.999999);
      saveAssets([alpha, beta]);
      render(<App />);
      enableAutomaticPronunciation();
      const firstTerm = window.speechSynthesis.speak.mock.calls.at(-1)[0].text;
      let speech = window.speechSynthesis.speak.mock.calls.map(
        ([utterance]) => utterance.text,
      );
      expect(speech).toEqual([firstTerm]);
      press(key, code);
      expect(screen.getByTestId("study-answer")).toBeTruthy();
      if (key === "e") {
        expect(screen.queryByRole("button", { name: /M/ })).toBeNull();
      } else {
        expect(
          screen.getByRole("button", { name: /记错了，下一词/ }),
        ).toBeTruthy();
      }
      speech = window.speechSynthesis.speak.mock.calls.map(
        ([utterance]) => utterance.text,
      );
      expect(speech).toEqual([firstTerm, firstTerm]);
      press("n", "KeyN");
      speech = window.speechSynthesis.speak.mock.calls.map(
        ([utterance]) => utterance.text,
      );
      expect(speech).toHaveLength(3);
      expect(speech[2]).not.toBe(firstTerm);
      vi.restoreAllMocks();
    },
  );

  test("M is inactive on an answer reached by choosing unknown", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    saveAssets([alpha, beta]);
    render(<App />);
    enableAutomaticPronunciation();
    const firstTerm = window.speechSynthesis.speak.mock.calls.at(-1)[0].text;
    press("e", "KeyE");
    press("m", "KeyM");
    expect(
      currentWordButton().textContent.replaceAll("·", "").toLocaleLowerCase(),
    ).toBe(firstTerm.toLocaleLowerCase());
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    press("n", "KeyN");
    expect(
      currentWordButton().textContent.replaceAll("·", "").toLocaleLowerCase(),
    ).not.toBe(firstTerm.toLocaleLowerCase());
    vi.restoreAllMocks();
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
    const speech = window.speechSynthesis.speak.mock.calls.map(
      ([utterance]) => utterance.text,
    );
    expect(speech).toEqual([firstTerm, firstTerm, nextTerm]);
    vi.restoreAllMocks();
  });

  test("automatic pronunciation defaults off, can be enabled, and manual replay remains", () => {
    saveAssets();
    render(<App />);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    openSettings();
    const toggle = screen.getByRole("switch", { name: /自动读单词/ });
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    closePanel();
    window.speechSynthesis.speak.mockClear();
    press("q", "KeyQ");
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    openSettings();
    fireEvent.click(screen.getByRole("switch", { name: /自动读单词/ }));
    closePanel();
    window.speechSynthesis.speak.mockClear();
    window.speechSynthesis.cancel.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "播放 Alpha 的美式发音" }),
    );
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.cancel).not.toHaveBeenCalled();

    window.speechSynthesis.speaking = true;
    fireEvent.click(
      screen.getByRole("button", { name: "播放 Alpha 的美式发音" }),
    );
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  test("pronunciation shows missing-voice and playback errors, then clears on successful completion", () => {
    saveAssets();
    const getVoices = window.speechSynthesis.getVoices;
    getVoices.mockReturnValue([]);
    render(<App />);
    const replay = screen.getByRole("button", { name: /播放 Alpha/ });
    fireEvent.click(replay);
    const missingVoice = screen.getByText(/没有找到英语语音/);
    expect(missingVoice.className).toBe("pronunciation-notice");
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    getVoices.mockReturnValue([{ lang: "en-GB", name: "British English" }]);
    fireEvent.click(replay);
    let utterance = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    expect(utterance.lang).toBe("en-GB");
    act(() => utterance.onerror({ error: "audio-busy" }));
    expect(screen.getByText(/发音未能播放/).className).toBe(
      "pronunciation-notice",
    );
    fireEvent.click(replay);
    utterance = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    act(() => utterance.onstart());
    expect(replay.classList.contains("is-speaking")).toBe(true);
    expect(screen.getByText("正在播放美式发音。")).toBeTruthy();
    expect(screen.queryByText("正在播放。")).toBeNull();
    act(() => utterance.onend());
    expect(replay.classList.contains("is-speaking")).toBe(false);
    expect(screen.queryByText("正在播放美式发音。")).toBeNull();
    getVoices.mockReturnValue([{ lang: "en-US", name: "Test US Voice" }]);
  });

  test("playback without a start event clears the speaker indicator and explains the failure", () => {
    vi.useFakeTimers();
    saveAssets();
    render(<App />);
    const replay = screen.getByRole("button", { name: /播放 Alpha/ });
    expect(replay.classList.contains("is-speaking")).toBe(false);
    fireEvent.click(replay);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(replay.classList.contains("is-speaking")).toBe(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(replay.classList.contains("is-speaking")).toBe(false);
    expect(screen.getByText(/发音未能播放/)).toBeTruthy();
    vi.useRealTimers();
  });

  test("appearance follows live system changes and persists manual choices", () => {
    let onSystemThemeChange;
    const systemAppearance = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn((_, listener) => {
        onSystemThemeChange = listener;
      }),
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

    openSettings();
    expect(screen.getByRole("radio", { name: "跟随系统" }).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "亮色" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    first.unmount();

    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");
    openSettings();
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
    const speaker = screen.getByRole("button", {
      name: "播放 Alpha 的美式发音",
    });
    speaker.focus();
    fireEvent.click(speaker, { detail: 1 });
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).not.toBe(speaker);

    press("q", "KeyQ");
    expect(screen.getByText(alpha.meaning)).toBeTruthy();
    const insightButton = screen.getByRole("button", {
      name: "查看词源与对应概念",
    });
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
    fireEvent.click(screen.getByRole("button", { name: "词表", exact: true }));
    expect(screen.getByRole("dialog", { name: "我的词表" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭管理面板" }));
    act(() => vi.advanceTimersByTime(2500));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("dialog", { name: "设置" })).toBeTruthy();
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

  test("word table, settings, and help open as three distinct focused panels", () => {
    saveAssets();
    render(<App />);

    openDeck();
    expect(screen.getByRole("button", { name: /添加新词表/ })).toBeTruthy();
    expect(screen.getByText("所有词表")).toBeTruthy();
    closePanel();

    openSettings();
    expect(screen.getByRole("heading", { name: "练习方式" })).toBeTruthy();
    expect(screen.queryByText("所有词表")).toBeNull();
    closePanel();

    fireEvent.click(screen.getByRole("button", { name: "帮助" }));
    expect(screen.getByRole("dialog", { name: "操作速查" })).toBeTruthy();
    expect(screen.getByText("键盘")).toBeTruthy();
    expect(screen.getByText("按 Q 后可 M 改判为不认识")).toBeTruthy();
    closePanel();
    openSettings();
    fireEvent.click(screen.getByText("进阶"));
    fireEvent.click(screen.getByRole("switch", { name: /认识的词直接前进/ }));
    closePanel();
    fireEvent.click(screen.getByRole("button", { name: "帮助" }));
    expect(screen.getByText(/Q 直接到下一词，不再显示 M/)).toBeTruthy();
  });

  test("the panel contains Tab focus instead of sending it behind the overlay", () => {
    saveAssets();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "帮助" }));
    const dialog = screen.getByRole("dialog", { name: "操作速查" });
    const buttons = screen
      .getAllByRole("button")
      .filter((button) => dialog.contains(button));
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons.at(-1));
    fireEvent.keyDown(buttons.at(-1), { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  test.each([
    ["词表", "我的词表"],
    ["设置", "设置"],
    ["帮助", "操作速查"],
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
      press("q", "KeyQ");
      expect(screen.getByText(alpha.meaning)).toBeTruthy();
      unmount();
    },
  );
});
