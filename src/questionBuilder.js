const key = (value) => String(value ?? "").trim().toLocaleLowerCase();

const shuffled = (values, random) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

export const getCounterpartTerm = (entry) =>
  String(entry?.relatedWord ?? "").split(/\s*[—–]\s*|\s+-\s+/)[0].trim();

export const buildMCQ = ({ entry, sourceDeck, random = Math.random }) => {
  const prompt = String(entry?.miniScenario || entry?.meaning || entry?.meaningZh || "").trim();
  if (!prompt || !key(entry?.term)) return null;
  const unique = new Map();
  for (const candidate of sourceDeck) {
    if (key(candidate.term) && key(candidate.term) !== key(entry.term)) {
      unique.set(key(candidate.term), candidate.term);
    }
  }
  const counterpart = unique.get(key(getCounterpartTerm(entry)));
  const near = (Array.isArray(entry.distractors) ? entry.distractors : []).map((term) => unique.get(key(term))).filter(Boolean);
  const preferred = [...new Set([...(counterpart ? [counterpart] : []), ...shuffled(near, random)])];
  const pool = shuffled([...unique.values()].filter((term) => !preferred.some((word) => key(word) === key(term))), random);
  const distractors = [...preferred, ...pool].slice(0, 3);
  if (!distractors.length) return null;
  return {
    kind: "mcq",
    prompt,
    answer: entry.term,
    options: shuffled([entry.term, ...distractors], random),
    explanation: entry.relatedWord || entry.meaning || entry.meaningZh,
  };
};

const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const maskTarget = (sentence, target) => {
  if (typeof sentence !== "string" || !String(target ?? "").trim()) return null;
  const pattern = new RegExp(`(?<![a-z])${escaped(target.trim())}(?![a-z])`, "gi");
  if (!pattern.test(sentence)) return null;
  return sentence.replace(pattern, "____");
};

export const buildScenario = ({ entry, sourceDeck, random = Math.random }) => {
  const examples = (Array.isArray(entry.examples) ? entry.examples : [])
    .map((example) => ({ sentence: example.sentence, prompt: maskTarget(example.sentence, entry.term) }))
    .filter((example) => example.prompt);
  if (!examples.length) return null;
  const example = examples[Math.floor(random() * examples.length)];
  const question = buildMCQ({ entry: { ...entry, miniScenario: example.prompt }, sourceDeck, random });
  return question ? { ...question, kind: "scenario", explanation: [example.sentence, entry.relatedWord].filter(Boolean).join("\n") } : null;
};

export const buildWordBank = ({ entry, sourceDeck, extraDeck = [], extraCount = 3, random = Math.random }) => {
  const examples = (Array.isArray(entry.examples) ? entry.examples : []).filter((example) =>
    typeof example.focus === "string" && example.focus.trim() && example.sentence?.includes(example.focus));
  if (!examples.length) return null;
  const example = examples[Math.floor(random() * examples.length)];
  const blanked = example.sentence.split(example.focus).join("____");
  const prompt = maskTarget(blanked, entry.term) ?? blanked;
  const current = new Map(sourceDeck.filter((candidate) => key(candidate.term)).map((candidate) => [key(candidate.term), candidate.term]));
  current.set(key(entry.term), entry.term);
  const extra = new Map();
  for (const term of [...extraDeck.map((candidate) => candidate.term), ...sourceDeck.map(getCounterpartTerm), ...sourceDeck.flatMap((candidate) => candidate.distractors ?? [])]) {
    if (key(term) && !current.has(key(term))) extra.set(key(term), term);
  }
  const distractors = shuffled([...extra.values()], random).slice(0, Math.max(0, extraCount));
  return {
    kind: "bank", prompt, answer: entry.term,
    options: shuffled([...current.values(), ...distractors], random),
    extraCount: distractors.length,
    explanation: `${example.sentence}\n空缺搭配：${example.focus}`,
  };
};

export const buildContrast = ({ entry, random = Math.random }) => {
  const counterpart = getCounterpartTerm(entry);
  if (!counterpart || key(counterpart) === key(entry.term) || !/^[a-z][a-z\s'’.-]*$/i.test(counterpart)) return null;
  const pair = [entry.term, counterpart];
  const supplied = Array.isArray(entry.contrastScenarios) ? entry.contrastScenarios : [];
  const candidates = [...supplied, ...(entry.miniScenario ? [{ scenario: entry.miniScenario, answer: entry.term }] : [])]
    .filter((variant) => typeof variant?.scenario === "string" && variant.scenario.trim() && pair.some((term) => key(term) === key(variant.answer)));
  if (!candidates.length) return null;
  const variant = candidates[Math.floor(random() * candidates.length)];
  const answer = pair.find((term) => key(term) === key(variant.answer));
  return {
    kind: "contrast", prompt: variant.scenario.trim(), answer,
    options: shuffled(pair, random),
    explanation: [entry.relatedWord, variant.explanation].filter(Boolean).join("\n"),
  };
};

export const buildQuestion = (options) => options.kind === "scenario" ? buildScenario(options) :
  options.kind === "bank" ? buildWordBank(options) : options.kind === "contrast" ? buildContrast(options) : buildMCQ(options);
