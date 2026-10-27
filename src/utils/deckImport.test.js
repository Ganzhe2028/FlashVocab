import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarkdownExport,
  normalizeDeck,
  parseDeckFromText,
  parseDeckFromTextDetailed,
  readImportFile,
} from "./deckImport.js";

test("JSON import accepts supported wrappers and preserves modern and custom fields", () => {
  const raw = `Some generated output:
\`\`\`json
{
  "cards": [{
    "word": "  Preserve  ",
    "definition": "  keep something safe  ",
    "meaning_zh": " 保留 ",
    "word_origin": " Latin praeservare ",
    "counterpart": "discard — throw away",
    "customScore": 7,
    "examples": [{
      "text": "We preserve fruit in jars.",
      "highlight": "preserve fruit",
      "source": "teacher"
    }]
  }]
}
\`\`\``;

  const deck = normalizeDeck(parseDeckFromText(raw));

  assert.equal(deck.length, 1);
  assert.deepEqual(deck[0], {
    word: "  Preserve  ",
    definition: "  keep something safe  ",
    meaning_zh: " 保留 ",
    word_origin: " Latin praeservare ",
    counterpart: "discard — throw away",
    customScore: 7,
    examples: [
      {
        text: "We preserve fruit in jars.",
        highlight: "preserve fruit",
        source: "teacher",
        sentence: "We preserve fruit in jars.",
        focus: "preserve fruit",
      },
    ],
    term: "Preserve",
    syllables: "",
    respell: "",
    pos: "",
    meaning: "keep something safe",
    meaningZh: "保留",
    wordOrigin: "Latin praeservare",
    relatedWord: "discard — throw away",
    microScene: "",
    memorySketch: null,
    distractors: [],
    usageTags: [],
    miniScenario: "",
    contrastScenarios: [],
  });
});

test("compact JSON arrays are not mistaken for Markdown terms", () => {
  const deck = normalizeDeck(parseDeckFromText('[{"term":"Vacant"}]'));
  assert.equal(deck[0].term, "Vacant");
});

test("Markdown import reads metadata and three ordered Sentence/Focus pairs", () => {
  const raw = `[Vacant]

- Meaning (EN): empty; not occupied
- Meaning (ZH): 空的；未被占用
- POS: adj.
- Syllables: Va·cant
- Respell: [VAY-kunt]
- Word Origin: From Latin vacare.
- Related Word: occupied — already being used
- Sentence 1: The bus had a vacant seat by the door.
- Focus 1: vacant seat
- Sentence 2: We found a vacant room at the hotel.
- Focus 2: vacant room
- Sentence 3: The position is still vacant.
- Focus 3: still vacant`;

  const deck = normalizeDeck(parseDeckFromText(raw));

  assert.equal(deck[0].meaningZh, "空的；未被占用");
  assert.equal(deck[0].wordOrigin, "From Latin vacare.");
  assert.equal(deck[0].relatedWord, "occupied — already being used");
  assert.deepEqual(deck[0].examples, [
    {
      sentence: "The bus had a vacant seat by the door.",
      focus: "vacant seat",
    },
    {
      sentence: "We found a vacant room at the hotel.",
      focus: "vacant room",
    },
    {
      sentence: "The position is still vacant.",
      focus: "still vacant",
    },
  ]);
});

test("CSV import supports aliases, quoted newlines, numbered examples, and custom columns", () => {
  const raw = `Word,Definition,Meaning Zh,Sentence 1,Focus 1,Sentence 2,Focus 2,Word Origin,Custom Tag
Preserve,"keep, protect","保留","We preserve fruit
in jars.","preserve fruit","Please preserve this note.","preserve this note","Latin origin","unit-4"`;

  const deck = normalizeDeck(parseDeckFromText(raw));

  assert.equal(deck[0].term, "Preserve");
  assert.equal(deck[0].meaning, "keep, protect");
  assert.equal(deck[0].meaningZh, "保留");
  assert.equal(deck[0].wordOrigin, "Latin origin");
  assert.equal(deck[0]["Custom Tag"], "unit-4");
  assert.deepEqual(deck[0].examples, [
    { sentence: "We preserve fruit\nin jars.", focus: "preserve fruit" },
    {
      sentence: "Please preserve this note.",
      focus: "preserve this note",
    },
  ]);
});

test("normalization supports legacy sentence aliases and safely ignores invalid cards", () => {
  const deck = normalizeDeck([
    {
      name: " Legacy ",
      example_sentence: "A legacy example.",
      sentence_focus: "legacy example",
      etymology: " old source ",
      related_word: " modern — current ",
      custom: { retained: true },
    },
    null,
    { meaning: "missing term" },
  ]);

  assert.equal(deck.length, 1);
  assert.equal(deck[0].term, "Legacy");
  assert.deepEqual(deck[0].examples, [
    { sentence: "A legacy example.", focus: "legacy example" },
  ]);
  assert.deepEqual(deck[0].custom, { retained: true });
  assert.equal(deck[0].wordOrigin, "old source");
  assert.equal(deck[0].relatedWord, "modern — current");
  assert.deepEqual(normalizeDeck(null), []);
});

test("normalization accepts string examples and preserves every imported example", () => {
  const deck = normalizeDeck([
    {
      term: "Many",
      sentences: ["One.", "Two.", "Three.", "Four."],
    },
  ]);

  assert.deepEqual(deck[0].examples, [
    { sentence: "One.", focus: "" },
    { sentence: "Two.", focus: "" },
    { sentence: "Three.", focus: "" },
    { sentence: "Four.", focus: "" },
  ]);
});

test("invalid and empty input fails with controlled errors", () => {
  assert.throws(() => parseDeckFromText(""), /非空文本/);
  assert.throws(() => parseDeckFromText(null), /提供文本内容/);
  assert.throws(() => parseDeckFromText("not a deck"), /无法识别内容/);
  assert.throws(() => parseDeckFromText("[]"), /无法识别内容/);
  assert.throws(
    () => parseDeckFromText('term,meaning\n"unterminated,value'),
    /无法识别内容/,
  );
});

test("readImportFile keeps plain-text handling and rejects legacy .doc files", async () => {
  const textFile = {
    name: "deck.csv",
    type: "text/csv",
    text: async () => "term,meaning\nWord,Definition",
  };
  assert.equal(
    await readImportFile(textFile),
    "term,meaning\nWord,Definition",
  );

  await assert.rejects(
    readImportFile({ name: "legacy.doc", type: "application/msword" }),
    /暂不支持 \.doc/,
  );
  await assert.rejects(
    readImportFile({ name: "legacy.xls", type: "application/vnd.ms-excel" }),
    /暂不支持旧 \.xls/,
  );
  await assert.rejects(
    readImportFile({ name: "unit5.pdf", type: "application/pdf" }),
    /暂不支持 PDF/,
  );
});

test("Markdown export emits all modern examples and can be parsed again", () => {
  const markdown = buildMarkdownExport([
    {
      term: "Vacant",
      syllables: "Va·cant",
      respell: "[VAY-kunt]",
      pos: "adj.",
      meaning: "empty",
      meaningZh: "空的",
      wordOrigin: "From Latin vacare.",
      relatedWord: "occupied",
      examples: [
        { sentence: "A vacant seat.", focus: "vacant seat" },
        { sentence: "The room is vacant.", focus: "is vacant" },
        { sentence: "This desk remains vacant.", focus: "remains vacant" },
        { sentence: "One vacant place was left.", focus: "vacant place" },
      ],
    },
  ]);

  const deck = normalizeDeck(parseDeckFromText(markdown));
  assert.deepEqual(deck[0].examples, [
    { sentence: "A vacant seat.", focus: "vacant seat" },
    { sentence: "The room is vacant.", focus: "is vacant" },
    { sentence: "This desk remains vacant.", focus: "remains vacant" },
    { sentence: "One vacant place was left.", focus: "vacant place" },
  ]);
  assert.equal(deck[0].syllables, "Va·cant");
  assert.equal(deck[0].respell, "[VAY-kunt]");
  assert.equal(deck[0].pos, "adj.");
  assert.equal(deck[0].meaningZh, "空的");
  assert.equal(deck[0].wordOrigin, "From Latin vacare.");
  assert.equal(deck[0].relatedWord, "occupied");
});
test("plain one-word-per-line imports and AI material survives JSON and Markdown normalization", () => {
  assert.deepEqual(parseDeckFromText("devise\nimprovise"), [{ term: "devise" }, { term: "improvise" }]);
  const source = normalizeDeck([{ term: "devise", microScene: "把纸条排成计划。", memorySketch: { left: { icon: "notes", label: "纸条" }, right: { icon: "plan", label: "计划" }, link: "排好" }, distractors: ["invent"],
    usageTags: ["动作"], miniScenario: "She plans each step.", contrastScenarios: [{ scenario: "A scene.", answer: "devise" }],
    examples: [{ sentence: "We devise a plan.", focus: "devise a plan" }], custom: { kept: true },
  }]);
  const json = normalizeDeck(parseDeckFromText(JSON.stringify(source)));
  assert.deepEqual(json[0].custom, { kept: true });
  const markdown = normalizeDeck(parseDeckFromText(buildMarkdownExport(source)));
  for (const field of ["microScene", "memorySketch", "distractors", "usageTags", "miniScenario", "contrastScenarios", "examples"]) assert.deepEqual(markdown[0][field], source[0][field]);
});

test("teacher-style plain lists accept Chinese pairs, numbering, POS, phonetics, and phrases", () => {
  const deck = normalizeDeck(parseDeckFromText(`abandon 放弃
1. benefit v. 好处；利益
take off /teɪk ɒf/ phr. 起飞
translucent (adj.) 半透明的
fragile adj 易碎的
[resilient] 有韧性的`));

  assert.deepEqual(deck.map((entry) => [entry.term, entry.pos, entry.meaningZh, entry.respell]), [
    ["abandon", "", "放弃", ""],
    ["benefit", "v.", "好处；利益", ""],
    ["take off", "phr.", "起飞", "/teɪk ɒf/"],
    ["translucent", "adj.", "半透明的", ""],
    ["fragile", "adj.", "易碎的", ""],
    ["resilient", "", "有韧性的", ""],
  ]);
});

test("tab, pipe, headerless CSV, and chip-style rows stay aligned", () => {
  const raw = `Word\tPOS\tChinese\tExample
abandon\tv.\t放弃\tHe abandoned the plan.
benefit\tn.\t好处\tIt has many benefits.`;
  const table = normalizeDeck(parseDeckFromText(raw));
  assert.equal(table[0].term, "abandon");
  assert.equal(table[0].meaningZh, "放弃");
  assert.equal(table[0].examples[0].sentence, "He abandoned the plan.");

  const pipe = normalizeDeck(parseDeckFromText("abandon | v. | 放弃 | to leave somebody"));
  assert.deepEqual([pipe[0].term, pipe[0].pos, pipe[0].meaningZh, pipe[0].meaning], ["abandon", "v.", "放弃", "to leave somebody"]);

  const csv = normalizeDeck(parseDeckFromText("abandon,放弃\nbenefit,好处"));
  assert.deepEqual(csv.map((entry) => entry.meaningZh), ["放弃", "好处"]);
});

test("split lines, Chinese-first pairs, and document headings still import the words", () => {
  const split = normalizeDeck(parseDeckFromText("abandon\n放弃\nbenefit\n好处"));
  assert.deepEqual(split.map((entry) => [entry.term, entry.meaningZh]), [["abandon", "放弃"], ["benefit", "好处"]]);

  const chineseFirst = normalizeDeck(parseDeckFromText("放弃 abandon\n好处 benefit"));
  assert.deepEqual(chineseFirst.map((entry) => [entry.term, entry.meaningZh]), [["abandon", "放弃"], ["benefit", "好处"]]);

  const detailed = parseDeckFromTextDetailed("Unit 1 Vocabulary\n单词 词性 中文\nabandon v. 放弃\nPage 2");
  assert.equal(normalizeDeck(detailed.entries)[0].term, "abandon");
  assert.ok(detailed.skipped.length >= 2);
});

test("unrecognized prose still fails with a concrete example", () => {
  assert.throws(() => parseDeckFromText("not a deck"), /没有认出英文单词/);
  assert.throws(() => parseDeckFromText("Some generated output:"), /没有认出英文单词/);
});

test("AI pipe rows keep a multiword English definition in meaning, not examples", () => {
  const deck = normalizeDeck(parseDeckFromText(`sacrilegious | adj. | 亵渎神圣的 | treating a holy thing or place without respect
restrain | v. | 制止；抑制 | to stop somebody/something from doing something, especially by using`));
  assert.equal(deck[0].meaning, "treating a holy thing or place without respect");
  assert.deepEqual(deck[0].examples, []);
  assert.equal(deck[1].meaning, "to stop somebody/something from doing something, especially by using");
  assert.deepEqual(deck[1].examples, []);
});

test("legacy entries with a lone lowercase definition example are repaired on load", () => {
  const deck = normalizeDeck([{
    term: "sacrilegious",
    meaningZh: "亵渎神圣的",
    examples: [{ sentence: "treating a holy thing or place without respect", focus: "" }],
  }]);
  assert.equal(deck[0].meaning, "treating a holy thing or place without respect");
  assert.deepEqual(deck[0].examples, []);

  const realExample = normalizeDeck([{
    term: "abandon",
    examples: [{ sentence: "He abandoned the plan.", focus: "" }],
  }]);
  assert.equal(realExample[0].meaning, "");
  assert.deepEqual(realExample[0].examples, [{ sentence: "He abandoned the plan.", focus: "" }]);
});
