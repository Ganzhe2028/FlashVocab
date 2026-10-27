import test from "node:test";
import assert from "node:assert/strict";
import { DEEPSEEK_ENDPOINT, needsPreparation, prepareDeckWithAI } from "./aiPreparation.js";

export const preparedPatch = (index, term) => ({
  index, term, meaning: "make a careful plan", meaningZh: "仔细筹划",
  relatedWord: "improvise — 当场发挥，目标词重在事先计划",
  examples: [{ sentence: `They ${term} a plan.`, focus: `${term} a plan` }, { sentence: `We ${term} a way forward.`, focus: `${term} a way` }],
  microScene: "把散乱纸条排成一步步计划。", distractors: ["invent", "design"], usageTags: ["动作"],
  memorySketch: { left: { icon: "notes", label: "散乱纸条" }, right: { icon: "plan", label: "执行步骤" }, link: "事先排好" },
  miniScenario: "She plans each step before starting.",
  contrastScenarios: [
    { scenario: "She prepares each step in advance.", answer: term, explanation: "事先谋划。" },
    { scenario: "A plan fails and she makes up a solution on the spot.", answer: "improvise", explanation: "当场发挥。" },
  ],
});

const response = (items) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items }) } }] }) });
const generatedResponse = (request) => response(JSON.parse(request.body).messages.map((message) => message.role === "user" ? JSON.parse(message.content).items : []).flat().map((entry) => preparedPatch(entry.index, entry.term)));

test("DeepSeek preparation batches six words, preserves source fields, and keeps credentials out of results", async () => {
  const source = Array.from({ length: 7 }, (_, index) => ({ term: `word${index}`, custom: "must stay local" }));
  source[0].wordOrigin = "User-authored origin";
  source[0].examples = [{ sentence: "Original example without a focus.", focus: "" }];
  const calls = [];
  const progress = [];
  const result = await prepareDeckWithAI({ deck: source, apiKey: "test-only-secret", now: () => 1234,
    onProgress: (event) => progress.push(event.current),
    fetchImpl: async (url, request) => { calls.push([url, request]); return generatedResponse(request); },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], DEEPSEEK_ENDPOINT);
  assert.equal(calls[0][1].headers.Authorization, "Bearer test-only-secret");
  assert.equal(calls[0][1].body.includes("must stay local"), false);
  assert.deepEqual(progress, [0, 6, 7]);
  assert.equal(result.preparedCount, 7);
  assert.equal(result.deck[0].custom, "must stay local");
  assert.equal(result.deck[0].wordOrigin, "User-authored origin");
  assert.equal(result.deck[0].examples[0].sentence, source[0].examples[0].sentence);
  assert.equal(result.deck[0].examples.length, 3);
  assert.equal(result.deck[0].preparation.generatedAt, 1234);
  assert.equal(JSON.stringify(result).includes("test-only-secret"), false);
  assert.equal(source[0].microScene, undefined);
  assert.equal(needsPreparation(result.deck[0]), false);
  const reused = await prepareDeckWithAI({ deck: result.deck, apiKey: "", fetchImpl: () => { throw new Error("must not repeat"); } });
  assert.equal(reused.preparedCount, 0);
  assert.equal(reused.skippedCount, 7);
});

test("preparation rejects missing keys, incomplete responses, wrong terms, and leaked answer words", async () => {
  await assert.rejects(prepareDeckWithAI({ deck: [{ term: "devise" }], apiKey: "" }), /API key/);
  for (const items of [[], [preparedPatch(99, "devise")], [{ ...preparedPatch(0, "devise"), term: "wrong" }],
    [{ ...preparedPatch(0, "devise"), miniScenario: "She can devise a plan." }], [{ ...preparedPatch(0, "devise"), microScene: "" }]]) {
    await assert.rejects(prepareDeckWithAI({ deck: [{ term: "devise" }], apiKey: "fake", fetchImpl: async () => response(items) }));
  }
});

test("HTTP and later-batch failures are atomic and never include response bodies or keys", async () => {
  const source = [{ term: "devise" }, { term: "arrange" }];
  let calls = 0;
  await assert.rejects(prepareDeckWithAI({ deck: source, apiKey: "fake", batchSize: 1,
    fetchImpl: async (url, request) => ++calls === 1 ? generatedResponse(request) : { ok: false, status: 401, json() { throw new Error("must not expose body"); } },
  }), /API key 无效/);
  assert.equal(calls, 2);
  assert.deepEqual(source, [{ term: "devise" }, { term: "arrange" }]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareDeckWithAI({ deck: source, apiKey: "fake", signal: controller.signal,
    fetchImpl() { throw new Error("must not run"); } }), { name: "AbortError" });
});

test("preparation adds exact-target examples to inflected originals and rejects unusable generated examples", async () => {
  const source = [{ term: "devise", examples: [{ sentence: "She devised a plan.", focus: "devised a plan" }] }];
  const result = await prepareDeckWithAI({ deck: source, apiKey: "fake", fetchImpl: async (url, request) => generatedResponse(request) });
  assert.equal(result.deck[0].examples.length, 3);
  assert.deepEqual(result.deck[0].examples[0], source[0].examples[0]);
  assert.equal(needsPreparation(result.deck[0]), false);
  await assert.rejects(prepareDeckWithAI({ deck: source, apiKey: "fake", fetchImpl: async () => response([{ ...preparedPatch(0, "devise"), examples: source[0].examples }]) }), /补全资料不完整/);
  await assert.rejects(prepareDeckWithAI({ deck: source, apiKey: "fake", fetchImpl: async () => response([{ ...preparedPatch(0, "devise"), memorySketch: { left: { icon: "script", label: "bad" } } }]) }), /补全资料不完整/);
});
