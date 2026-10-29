import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFillPrompt,
  buildWorksheetPrompt,
  detectWorksheetMismatch,
  mergeFilledEntries,
  needsFillMaterial,
  parseMaterialReply,
} from "./importFill.js";

const completeEntry = {
  term: "abandon",
  pos: "v.",
  meaning: "to leave somebody or something",
  meaningZh: "放弃；抛弃",
  wordOrigin: "来自古法语 abandonner，原意「交给别人支配」。",
  relatedWord: "quit — quit 是主动停止，abandon 更强调彻底丢下。",
  examples: [
    { sentence: "They abandon the plan at noon.", focus: "abandon the plan" },
    { sentence: "We abandon old habits slowly.", focus: "abandon old habits" },
  ],
  miniScenario: "The team stops a project because the money is gone.",
  contrastScenarios: [
    { scenario: "The team stops a project because the money is gone.", answer: "abandon", explanation: "" },
    { scenario: "She stops playing tennis because her knee hurts.", answer: "quit", explanation: "主动停止。" },
  ],
};

test("needsFillMaterial lists only entries missing practice-ready material", () => {
  assert.equal(needsFillMaterial(completeEntry), false);
  assert.equal(needsFillMaterial({ ...completeEntry, meaningZh: "" }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, meaning: "" }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, examples: [] }), true);
  assert.equal(needsFillMaterial({
    ...completeEntry,
    examples: [{ sentence: "They abandoned the plan.", focus: "abandoned the plan" }],
  }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, examples: [{ sentence: "They abandon the plan.", focus: "" }] }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, relatedWord: "" }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, contrastScenarios: [], miniScenario: "" }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, contrastScenarios: [], miniScenario: "They abandon the plan at noon." }), true);
  assert.equal(needsFillMaterial({ ...completeEntry, contrastScenarios: [] }), false);
  assert.equal(needsFillMaterial({ term: "" }), false);
});


const reply = (entries) => JSON.stringify(entries);

test("both prompts require the same fixed JSON schema", () => {
  for (const prompt of [buildFillPrompt([{ term: "resilient" }]), buildWorksheetPrompt()]) {
    for (const field of ["term", "meaningZh", "meaning", "examples", "focus", "miniScenario", "contrastScenarios"]) assert.ok(prompt.includes(field));
    assert.match(prompt, /不要代码围栏/);
  }
  assert.match(buildFillPrompt([{ ...completeEntry, examples: [] }]), /abandon（已有对应词：quit，请沿用）/);
  assert.ok(!buildFillPrompt([completeEntry]).endsWith("abandon"));
});

test("JSON reply fills practice fields and never overwrites supplied meanings", () => {
  const result = mergeFilledEntries([{ term: "abandon", meaningZh: "我的释义" }], reply([completeEntry]));
  assert.equal(result.filled, 1);
  assert.equal(result.remaining, 0);
  assert.equal(result.entries[0].meaningZh, "我的释义");
  assert.deepEqual(result.entries[0].examples, completeEntry.examples);
  assert.deepEqual(result.entries[0].contrastScenarios, completeEntry.contrastScenarios);
  assert.equal(mergeFilledEntries([completeEntry], reply([completeEntry])).filled, 0);
});

test("JSON import preserves all supplied rich fields", () => {
  const entry = parseMaterialReply(reply([completeEntry]))[0];
  for (const field of Object.keys(completeEntry)) assert.deepEqual(entry[field], completeEntry[field]);
});

test("legacy blocks and truncated JSON are rejected atomically", () => {
  const entries = [{ term: "abandon", meaningZh: "放弃" }];
  for (const raw of ["abandon | v. | 放弃 | leave", "Word: abandon\nPOS: v.", "[abandon]\n- Meaning (EN): leave", "POS: v.\nMeaning (ZH): 放弃", '[{"term":"abandon","meaning":"leave"},', "nonsense"]) {
    assert.throws(() => parseMaterialReply(raw), /JSON/);
    assert.throws(() => mergeFilledEntries(entries, raw));
    assert.deepEqual(entries, [{ term: "abandon", meaningZh: "放弃" }]);
  }
});

test("complete JSON batches can fill a subset, unmatched terms do not change entries", () => {
  const entries = [{ term: "abandon", meaningZh: "放弃" }, { term: "quit", meaningZh: "停止" }];
  const result = mergeFilledEntries(entries, reply([completeEntry]));
  assert.equal(result.filled, 1);
  assert.equal(result.remaining, 1);
  const noMatch = mergeFilledEntries([{ term: "other" }], reply([completeEntry]));
  assert.equal(noMatch.filled, 0);
  assert.deepEqual(noMatch.entries, [{ term: "other" }]);
});

test("invalid practice semantics do not become usable quiz material", () => {
  const patch = { ...completeEntry, examples: [{ sentence: "They abandoned the plan.", focus: "abandoned the plan" }], miniScenario: "They abandon it.", contrastScenarios: [{ scenario: "A team stops.", answer: "stop", explanation: "foreign answer" }] };
  const result = mergeFilledEntries([{ term: "abandon", meaningZh: "放弃" }], reply([patch]));
  assert.equal(result.entries[0].examples, undefined);
  assert.equal(result.entries[0].miniScenario, undefined);
  assert.equal(result.entries[0].contrastScenarios, undefined);
  assert.equal(result.remaining, 1);
});

test("matching worksheets are detected instead of being previewed as words", () => {
  assert.equal(detectWorksheetMismatch([
    { term: "unequivocally", meaning: "highbrow (54)" },
    { term: "commotion", meaning: "disbelief (57)" },
  ]), true);
  assert.equal(detectWorksheetMismatch([
    { term: "solitary confinement (61)" },
    { term: "quarantine (61)" },
  ]), true);
  assert.equal(detectWorksheetMismatch([
    { term: "a punishment in which a prisoner is kept alone in a separate cell" },
    { term: "the state of peace and happiness achieved after giving up desires" },
  ]), true);
  assert.equal(detectWorksheetMismatch([
    { term: "abandon", meaningZh: "放弃" },
    { term: "benefit", meaningZh: "好处" },
  ]), false);
  assert.equal(detectWorksheetMismatch([{ term: "abandon" }, { term: "benefit" }]), false);
});
