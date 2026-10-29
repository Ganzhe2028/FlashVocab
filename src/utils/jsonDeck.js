import { normalizeMemorySketch } from "../memorySketch.js";

// The import boundary accepts one canonical JSON array; legacy parsing is material-only.
export const parseJsonDeck = (rawText) => {
  if (typeof rawText !== "string" || !rawText.trim()) throw new Error("请提供非空 JSON 词表。");
  let deck;
  try { deck = JSON.parse(rawText.replace(/^\uFEFF/, "").trim()); }
  catch { throw new Error("JSON 格式不正确。只粘贴 JSON 数组，不要包含代码围栏、说明文字或多余逗号。"); }
  if (!Array.isArray(deck) || !deck.length) throw new Error("词表必须是非空 JSON 数组，以 [ 开始、] 结束。");
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const isText = (value) => typeof value === "string" && value.trim();
  const textFields = ["term", "meaning", "meaningZh", "pos", "syllables", "respell", "wordOrigin", "relatedWord", "microScene", "miniScenario"];
  deck.forEach((entry, index) => {
    const fail = (message) => { throw new Error(`第 ${index + 1} 个词条${typeof entry?.term === "string" ? `（${entry.term}）` : ""}：${message}`); };
    if (!isObject(entry)) fail("必须是 JSON 对象。");
    if (!isText(entry.term)) fail("缺少单词，请填写非空字符串 term。");
    const aliases = ["word", "name", "definition", "meaning_zh", "meaningZH", "meaningzh", "word_origin", "etymology", "related_word", "counterpart", "sentences", "usageExamples", "sentence", "example", "exampleSentence", "example_sentence", "micro_scene", "memory_sketch", "usage_tags", "mini_scenario", "contrast_scenarios"];
    if (aliases.some((field) => field in entry)) fail("请使用模板中的字段名，不支持 word、definition 等别名。");
    for (const field of textFields) {
      if (field in entry && typeof entry[field] !== "string") fail(`${field} 必须是字符串。`);
    }
    if (!isText(entry.meaning) && !isText(entry.meaningZh)) fail("meaning 或 meaningZh 至少填写一个词义。");
    if ("examples" in entry) {
      if (!Array.isArray(entry.examples)) fail("examples 必须是数组。");
      entry.examples.forEach((example, i) => {
        if (!isObject(example) || !isText(example.sentence) || typeof example.focus !== "string") fail(`examples[${i}] 必须包含 sentence 和 focus 字符串。`);
        if (example.focus && !example.sentence.includes(example.focus)) fail(`examples[${i}].focus 必须原样出现在 sentence 中。`);
      });
    }
    for (const field of ["distractors", "usageTags"]) {
      if (field in entry && (!Array.isArray(entry[field]) || entry[field].some((value) => !isText(value)))) fail(`${field} 必须是字符串数组。`);
    }
    if ("contrastScenarios" in entry && (!Array.isArray(entry.contrastScenarios) || entry.contrastScenarios.some((value) => !isObject(value) || !["scenario", "answer"].every((field) => isText(value[field])) || typeof value.explanation !== "string"))) fail("contrastScenarios 必须包含 scenario、answer、explanation 字符串。");
    if (entry.memorySketch != null && !normalizeMemorySketch(entry.memorySketch)) fail("memorySketch 格式不正确。");
  });
  return deck;
};

export const JSON_TEMPLATE = [{ term: "vacant", pos: "adj.", meaningZh: "空的", meaning: "empty; not occupied", syllables: "va·cant", respell: "[VAY-kunt]", wordOrigin: "", relatedWord: "occupied — 已被占用", examples: [{ sentence: "The bus has a vacant seat.", focus: "vacant seat" }], miniScenario: "A passenger finds a seat with nobody sitting on it.", contrastScenarios: [{ scenario: "Someone is already sitting in the chair.", answer: "occupied", explanation: "已被占用。" }] }];
