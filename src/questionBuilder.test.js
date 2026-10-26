import test from "node:test";
import assert from "node:assert/strict";
import { buildContrast, buildMCQ, buildScenario, buildWordBank, maskTarget } from "./questionBuilder.js";

const sourceDeck = ["devise", "improvise", "vacant", "occupied", "assist", "decline"]
  .map((term) => ({ term, meaning: `meaning of ${term}` }));
const entry = { ...sourceDeck[0], relatedWord: "improvise — 当场发挥", options: ["prebuilt"] };

test("MCQ draws three unique current-deck distractors, prioritizing the counterpart", () => {
  const question = buildMCQ({ entry, sourceDeck, random: () => 0.99 });
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options).size, 4);
  assert.ok(question.options.includes("improvise"));
  assert.ok(question.options.includes("devise"));
  assert.ok(question.options.every((term) => sourceDeck.some((item) => item.term === term)));
  assert.ok(!question.options.includes("prebuilt"));
});

test("MCQ rebuilds combinations and answer positions at each encounter", () => {
  const first = buildMCQ({ entry, sourceDeck, random: () => 0 });
  const second = buildMCQ({ entry, sourceDeck, random: () => 0.99 });
  assert.notDeepEqual(new Set(first.options), new Set(second.options));
  assert.notEqual(first.options.indexOf(entry.term), second.options.indexOf(entry.term));
});

test("small decks use available distinct options and cannot fabricate a one-word quiz", () => {
  assert.equal(buildMCQ({ entry, sourceDeck: [entry] }), null);
  const question = buildMCQ({ entry, sourceDeck: [entry, sourceDeck[1], { ...entry, term: "DEVISE" }] });
  assert.equal(question.options.length, 2);
  assert.equal(buildMCQ({ entry: { term: "bare" }, sourceDeck }), null);
});

test("scenario hides every complete target occurrence and leaves inflected or unrelated substrings alone", () => {
  assert.equal(maskTarget("Vacant seats stay vacant.", "vacant"), "____ seats stay ____.");
  assert.equal(maskTarget("She smiled vacantly.", "vacant"), null);
  const target = { ...sourceDeck[0], examples: [{ sentence: "We devise a plan.", focus: "devise a plan" }] };
  const question = buildScenario({ entry: target, sourceDeck, random: () => 0.9 });
  assert.equal(question.kind, "scenario");
  assert.equal(question.prompt, "We ____ a plan.");
  assert.equal(question.options.length, 4);
  assert.ok(question.explanation.includes("We devise a plan."));
  assert.equal(buildScenario({ entry: sourceDeck[0], sourceDeck }), null);
});

test("word bank blanks the exact focus phrase and includes every current word plus old-wave extras", () => {
  const target = { ...entry, examples: [{ sentence: "We devise a plan today.", focus: "devise a plan" }] };
  const question = buildWordBank({ entry: target, sourceDeck,
    extraDeck: [{ term: "old1" }, { term: "old2" }, { term: "old3" }, { term: "old4" }], random: () => 0.99 });
  assert.equal(question.prompt, "We ____ today.");
  assert.equal(question.answer, "devise");
  assert.equal(question.options.length, sourceDeck.length + 3);
  assert.equal(question.extraCount, 3);
  assert.equal(sourceDeck.every((word) => question.options.includes(word.term)), true);
  assert.equal(new Set(question.options).size, question.options.length);
  assert.match(question.explanation, /devise a plan/);
});

test("word bank can use counterpart extras, reports available count, and skips invalid focus", () => {
  const target = { ...entry, relatedWord: "invent — 构想", examples: [{ sentence: "We devise a plan.", focus: "devise a plan" }] };
  const question = buildWordBank({ entry: target, sourceDeck: [target] });
  assert.equal(question.extraCount, 1);
  assert.deepEqual(new Set(question.options), new Set(["devise", "invent"]));
  assert.equal(buildWordBank({ entry: { ...target, examples: [{ sentence: "Some sentence.", focus: "absent" }] }, sourceDeck }), null);
});

test("contrast uses a boundary scenario and a shuffled pair, including counterpart answers", () => {
  const target = { ...entry, contrastScenarios: [
    { scenario: "She plans every step before work begins.", answer: "devise" },
    { scenario: "The plan fails, so she makes up a solution on the spot.", answer: "improvise" },
  ] };
  const first = buildContrast({ entry: target, random: () => 0 });
  const second = buildContrast({ entry: target, random: () => 0.99 });
  assert.equal(first.answer, "devise");
  assert.equal(second.answer, "improvise");
  assert.deepEqual(new Set(first.options), new Set(["devise", "improvise"]));
  assert.notDeepEqual(first.options, second.options);
  assert.equal(first.explanation, entry.relatedWord);
});

test("contrast skips missing counterparts, absent scenarios, and invalid answer keys", () => {
  assert.equal(buildContrast({ entry }), null);
  assert.equal(buildContrast({ entry: { term: "devise", miniScenario: "A scenario." } }), null);
  assert.equal(buildContrast({ entry: { ...entry, contrastScenarios: [{ scenario: "A scene.", answer: "unrelated" }] } }), null);
});
