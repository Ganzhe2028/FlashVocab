import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDeck } from "./deckImport.js";
import { parseJsonDeck as parseDeckFromText, JSON_TEMPLATE as IMPORT_TEMPLATE } from "./jsonDeck.js";


test("fixed JSON template and normalized export round-trip without losing data", () => {
  const input = [{ ...IMPORT_TEMPLATE[0], custom: { retained: true }, contrastScenarios: [{ scenario: "A seat is empty.", answer: "vacant", explanation: "空的" }] }];
  assert.deepEqual(parseDeckFromText('\uFEFF' + JSON.stringify(input)), input);
  const normalized = normalizeDeck(input);
  assert.deepEqual(parseDeckFromText(JSON.stringify(normalized)), normalized);
});

test("rejects guessing, wrappers, truncated arrays and partial valid results", () => {
  for (const input of ["vacant", "vacant 空的", "[Vacant]\n- Meaning (EN): empty", "term,meaning\nvacant,empty", '{"cards":[{"term":"vacant","meaning":"empty"}]}', '```json\n[{"term":"vacant","meaning":"empty"}]\n```', '[{"term":"vacant","meaning":"empty"},', '[]', '[null]', '["vacant"]']) {
    assert.throws(() => parseDeckFromText(input));
  }
  assert.throws(() => parseDeckFromText(JSON.stringify([IMPORT_TEMPLATE[0], { meaning: "missing word" }])), /第 2 个词条.*缺少单词/);
});

test("validates canonical fields, types, meanings and exact example focus", () => {
  for (const patch of [{ term: 123 }, { meaning: [], meaningZh: "空" }, { examples: "text" }, { examples: [{ sentence: "An empty seat.", focus: "vacant" }] }, { examples: ["A sentence"] }, { distractors: "other" }, { contrastScenarios: [{ scenario: "empty" }] }, { word: "alias" }]) {
    assert.throws(() => parseDeckFromText(JSON.stringify([{ ...IMPORT_TEMPLATE[0], ...patch }])), /第 1 个词条/);
  }
  assert.throws(() => parseDeckFromText('[{"term":"vacant"}]'), /词义/);
  assert.deepEqual(parseDeckFromText('[{"term":"coup d’état","meaningZh":"政变"}]'), [{ term: "coup d’état", meaningZh: "政变" }]);
});
