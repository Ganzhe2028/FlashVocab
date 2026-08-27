import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarkdownExport,
  normalizeDeck,
  parseDeckFromText,
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

test("normalization accepts string examples and caps examples at three", () => {
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
      ],
    },
  ]);

  const deck = normalizeDeck(parseDeckFromText(markdown));
  assert.deepEqual(deck[0].examples, [
    { sentence: "A vacant seat.", focus: "vacant seat" },
    { sentence: "The room is vacant.", focus: "is vacant" },
  ]);
  assert.equal(deck[0].syllables, "Va·cant");
  assert.equal(deck[0].respell, "[VAY-kunt]");
  assert.equal(deck[0].pos, "adj.");
  assert.equal(deck[0].meaningZh, "空的");
  assert.equal(deck[0].wordOrigin, "From Latin vacare.");
  assert.equal(deck[0].relatedWord, "occupied");
});
