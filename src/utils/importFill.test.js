import test from "node:test";
import assert from "node:assert/strict";
import { buildFillPrompt, buildWorksheetPrompt, detectWorksheetMismatch, mergeFilledEntries } from "./importFill.js";

test("the fill prompt asks for simple lines and lists only missing words", () => {
  const prompt = buildFillPrompt([{ term: "abandon", meaningZh: "放弃" }, { term: "resilient" }]);
  assert.match(prompt, /resilient/);
  assert.doesNotMatch(prompt, /\babandon\b/);
  assert.match(prompt, /中文释义/);
  assert.doesNotMatch(prompt, /JSON/);
});

test("AI replies in pipe, Markdown-table, JSON, and numbered forms merge by term", () => {
  const entries = [{ term: "abandon", meaningZh: "放弃" }, { term: "resilient" }];
  for (const reply of [
    "resilient | adj. | 有韧性的 | able to recover quickly",
    "单词 | 词性 | 中文释义 | 英文释义\n|---|---|---|---\nresilient | adj. | 有韧性的 | able to recover quickly",
    '[{"term":"resilient","pos":"adj.","meaningZh":"有韧性的","meaning":"able to recover quickly"}]',
    "1. resilient | adj. | 有韧性的 | able to recover quickly",
  ]) {
    const result = mergeFilledEntries(entries, reply);
    assert.equal(result.filled, 1);
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
  assert.deepEqual(result.entries, [{ term: "resilient" }]);
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

test("the worksheet rescue prompt asks for a plain piped word list", () => {
  const prompt = buildWorksheetPrompt();
  assert.match(prompt, /上传的文件/);
  assert.match(prompt, /单词 \| 词性 \| 中文释义 \| 英文释义/);
  assert.match(prompt, /不要求|不要/);
  assert.doesNotMatch(prompt, /JSON/);
});
