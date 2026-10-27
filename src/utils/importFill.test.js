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

const abandonBlock = `abandon | v. | 放弃；抛弃 | to leave somebody or something
词源: 来自古法语 abandonner，原意「交给别人支配」，后来表示「放手、放弃」。
对应词: quit — quit 是主动停止，abandon 更强调彻底丢下。
例句1: They abandon the plan at noon.
重点1: abandon the plan
例句2: We abandon old habits slowly.
重点2: abandon old habits
情景: The team stops a project because the money is gone.
辨析: She stops playing tennis because her knee hurts. | quit | 主动停止。`;

const quitBlock = `quit | v. | 停止；放弃 | to stop doing something
词源: 来自古法语 quiter，原意「解除义务、放走」。
对应词: abandon — abandon 是彻底丢下，quit 是主动停止。
例句1: They quit the team after the argument.
重点1: quit the team
例句2: We quit sugar for a month.
重点2: quit sugar
情景: A worker leaves a job by choice.
辨析: A company drops an old product for good. | abandon | 彻底丢下。`;

const bareEntries = () => [
  { term: "abandon", meaningZh: "放弃", pos: "v." },
  { term: "quit", meaningZh: "停止", pos: "v." },
];

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

test("the fill prompt asks for every practice field and only lists missing words", () => {
  const prompt = buildFillPrompt([completeEntry, bareEntries()[0], { term: "resilient" }]);
  assert.match(prompt, /中文释义/);
  assert.match(prompt, /词源/);
  assert.match(prompt, /对应词/);
  assert.match(prompt, /例句1/);
  assert.match(prompt, /重点1/);
  assert.match(prompt, /情景/);
  assert.match(prompt, /辨析/);
  assert.match(prompt, /abandon/);
  assert.match(prompt, /resilient/);
  assert.doesNotMatch(prompt, /\bJSON\b/);
  assert.doesNotMatch(prompt, /quit\n/);
  assert.equal(buildFillPrompt([completeEntry]).endsWith("abandon"), false);
  const counterpartPrompt = buildFillPrompt([{ ...completeEntry, examples: [], contrastScenarios: [], miniScenario: "" }]);
  assert.match(counterpartPrompt, /abandon（已有对应词：quit，请沿用）/);
  assert.match(counterpartPrompt, /辨析答案就用它/);
});

test("a rich labeled reply merges every missing practice field", () => {
  const result = mergeFilledEntries(bareEntries(), `${abandonBlock}\n\n${quitBlock}`);
  assert.equal(result.filled, 2);
  assert.equal(result.remaining, 0);
  const [abandon, quit] = result.entries;
  assert.equal(abandon.meaningZh, "放弃");
  assert.match(abandon.meaning, /^to leave/);
  assert.match(abandon.wordOrigin, /古法语/);
  assert.equal(abandon.relatedWord, "quit — quit 是主动停止，abandon 更强调彻底丢下。");
  assert.deepEqual(abandon.examples, [
    { sentence: "They abandon the plan at noon.", focus: "abandon the plan" },
    { sentence: "We abandon old habits slowly.", focus: "abandon old habits" },
  ]);
  assert.equal(abandon.miniScenario, "The team stops a project because the money is gone.");
  assert.deepEqual(abandon.contrastScenarios, [
    { scenario: "The team stops a project because the money is gone.", answer: "abandon", explanation: "" },
    { scenario: "She stops playing tennis because her knee hurts.", answer: "quit", explanation: "主动停止。" },
  ]);
  assert.equal(quit.relatedWord, "abandon — abandon 是彻底丢下，quit 是主动停止。");
  assert.deepEqual(quit.contrastScenarios.map((variant) => variant.answer), ["quit", "abandon"]);
});

test("merging never overwrites supplied data and skips entries that need nothing", () => {
  const supplied = { ...completeEntry, relatedWord: "quit — 我自己写的区别" };
  const result = mergeFilledEntries([supplied], abandonBlock);
  assert.equal(result.filled, 0);
  assert.deepEqual(result.entries, [supplied]);
  const withOwnExample = {
    term: "abandon", meaningZh: "放弃", meaning: "to leave",
    examples: [{ sentence: "They abandon the plan.", focus: "abandon the plan" }],
  };
  const merged = mergeFilledEntries([withOwnExample], abandonBlock).entries[0];
  assert.deepEqual(merged.examples, withOwnExample.examples);
  assert.equal(merged.relatedWord, "quit — quit 是主动停止，abandon 更强调彻底丢下。");
});

test("inflected or invalid examples and spoiling scenarios are rejected", () => {
  const reply = `abandon | v. | 放弃 | to leave
对应词: quit — 主动停止
例句1: They abandoned the plan.
重点1: abandoned the plan
例句2: We abandon old habits slowly.
重点2: abandon old habits
情景: The team will abandon a project.
辨析: She quit tennis. | quit | 主动停止。`;
  const merged = mergeFilledEntries(bareEntries(), reply).entries[0];
  assert.deepEqual(merged.examples, [{ sentence: "We abandon old habits slowly.", focus: "abandon old habits" }]);
  assert.equal(merged.miniScenario, undefined);
  assert.equal(merged.contrastScenarios, undefined);
  assert.equal(needsFillMaterial(merged), true);
});

test("contrast answers must belong to the term and its counterpart", () => {
  const reply = `abandon | v. | 放弃 | to leave
对应词: quit — 主动停止
例句1: They abandon the plan.
重点1: abandon the plan
辨析: The team drops a project for good. | stop | 主动停止。`;
  const merged = mergeFilledEntries(bareEntries(), reply).entries[0];
  assert.equal(merged.contrastScenarios, undefined);
  assert.equal(needsFillMaterial(merged), true);
});

test("a missing focus falls back to the exact word occurrence", () => {
  const reply = `abandon | v. | 放弃 | to leave
对应词: quit — 主动停止
例句1: They abandon the plan.
例句2: We abandon old habits slowly.`;
  const merged = mergeFilledEntries(bareEntries(), reply).entries[0];
  assert.deepEqual(merged.examples, [
    { sentence: "They abandon the plan.", focus: "abandon" },
    { sentence: "We abandon old habits slowly.", focus: "abandon" },
  ]);
});

test("truncated replies keep the panel useful and report the remaining words", () => {
  const result = mergeFilledEntries(bareEntries(), `abandon | v. | 放弃 | to leave\n对应词: quit — 主动停止\n`);
  assert.equal(result.filled, 1);
  assert.equal(result.remaining, 2);
  assert.equal(result.entries[0].meaning, "to leave");
  assert.equal(result.entries[0].relatedWord, "quit — 主动停止");
});

test("AI replies in pipe, Markdown-table, JSON, and numbered forms merge by term", () => {
  const entries = [{ term: "abandon", meaningZh: "放弃" }, { term: "resilient" }];
  for (const reply of [
    "resilient | adj. | 有韧性的 | able to recover quickly",
    "单词 | 词性 | 中文释义 | 英文释义\n|---|---|---|---\nresilient | adj. | 有韧性的 | able to recover quickly",
    '[{"term":"resilient","pos":"adj.","meaningZh":"有韧性的","meaning":"able to recover quickly"}]',
    "1. resilient | adj. | 有韧性的 | able to recover quickly",
    "| resilient | adj. | 有韧性的 | able to recover quickly |",
  ]) {
    const result = mergeFilledEntries(entries, reply);
    assert.equal(result.filled, 1, reply);
    assert.equal(result.entries[0].meaningZh, "放弃");
    assert.deepEqual(
      [result.entries[1].term, result.entries[1].pos, result.entries[1].meaningZh, result.entries[1].meaning],
      ["resilient", "adj.", "有韧性的", "able to recover quickly"],
    );
  }
});

test("unmatched AI replies leave the deck untouched and report zero fills", () => {
  const result = mergeFilledEntries([{ term: "resilient" }], "untamed | adj. | 未被驯服的");
  assert.equal(result.filled, 0);
  assert.equal(result.remaining, 1);
  assert.deepEqual(result.entries, [{ term: "resilient" }]);
  assert.deepEqual(mergeFilledEntries([{ term: "resilient" }], "随便一段没有词表的话"), { entries: [{ term: "resilient" }], filled: 0, remaining: 1 });
});

test("the worksheet rescue prompt asks for the complete practice block", () => {
  const prompt = buildWorksheetPrompt();
  assert.match(prompt, /上传的文件/);
  assert.match(prompt, /单词 \| 词性 \| 中文释义 \| 英文释义/);
  assert.match(prompt, /例句1/);
  assert.match(prompt, /对应词/);
  assert.match(prompt, /辨析/);
  assert.match(prompt, /不要/);
  assert.doesNotMatch(prompt, /\bJSON\b/);
});

test("a rich worksheet reply becomes directly importable practice material", () => {
  const parsed = parseMaterialReply(`${abandonBlock}\n\n${quitBlock}`);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].term, "abandon");
  assert.equal(parsed[0].contrastScenarios.length, 2);
  assert.equal(parsed[1].miniScenario, "A worker leaves a job by choice.");
  assert.equal(parseMaterialReply("untamed | adj. | 未被驯服的 | wild and not controlled")[0].meaning, "wild and not controlled");
});

test("English labeled replies that start each word with Word: merge as practice material", () => {
  const reply = `Word: abandon
POS: v.
Meaning (ZH): 放弃；抛弃
Meaning (EN): to leave somebody or something
Word Origin: 来自古法语 abandonner。
Counterpart: quit — quit 是主动停止，abandon 更强调彻底丢下。
Example 1: They abandon the plan at noon.
Focus 1: abandon the plan
Example 2: We abandon old habits slowly.
Focus 2: abandon old habits
Scenario: The team stops a project because the money is gone.
Contrast: She stops playing tennis because her knee hurts. | quit | 主动停止。

Word: quit
POS: v.
Meaning (ZH): 停止；放弃
Meaning (EN): to stop doing something
Counterpart: abandon — abandon 是彻底丢下，quit 是主动停止。
Example 1: They quit the team after the argument.
Focus 1: quit the team
Scenario: A worker leaves a job by choice.
Contrast: A company drops an old product for good. | abandon | 彻底丢下。`;
  const result = mergeFilledEntries([{ term: "abandon", meaningZh: "放弃" }, { term: "quit" }], reply);
  assert.equal(result.filled, 2);
  assert.equal(result.remaining, 0);
  assert.equal(result.entries[0].meaningZh, "放弃");
  assert.equal(result.entries[0].meaning, "to leave somebody or something");
  assert.equal(result.entries[0].relatedWord, "quit — quit 是主动停止，abandon 更强调彻底丢下。");
  assert.deepEqual(result.entries[0].examples[0], { sentence: "They abandon the plan at noon.", focus: "abandon the plan" });
  assert.equal(result.entries[1].contrastScenarios[1].answer, "abandon");
});

test("structured labeled replies without a word starter never leak pseudo-entries", () => {
  const reply = `POS: v.
Meaning (ZH): 彻底丢下。
Word Origin: 来自拉丁语。
Counterpart: quit — 主动停止。
Focus 1: quit tennis`;
  assert.deepEqual(parseMaterialReply(reply), []);
  const result = mergeFilledEntries([{ term: "abandon", meaningZh: "放弃" }, { term: "quit" }], reply);
  assert.equal(result.filled, 0);
  assert.equal(result.remaining, 2);
  assert.deepEqual(result.entries[1], { term: "quit" });
});

test("bracketed markdown-style reply blocks are accepted", () => {
  const reply = `[abandon]
- POS: v.
- Meaning (ZH): 放弃；抛弃
- Meaning (EN): to leave somebody or something
- Counterpart: quit — quit 是主动停止
- Sentence 1: They abandon the plan at noon.
- Focus 1: abandon the plan
- Mini Scenario: The team stops a project because the money is gone.
- Contrast Scenarios: The team stops a project because the money is gone. | abandon | 因外部原因彻底丢下。`;
  const parsed = parseMaterialReply(reply);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].term, "abandon");
  assert.equal(parsed[0].meaningZh, "放弃；抛弃");
  assert.deepEqual(parsed[0].examples, [{ sentence: "They abandon the plan at noon.", focus: "abandon the plan" }]);
  assert.equal(parsed[0].contrastScenarios[0].answer, "abandon");
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
