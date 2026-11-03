import { getCounterpartTerm, maskTarget } from "../questionBuilder.js";
import { normalizeDeck } from "./deckImport.js";
import { parseJsonDeck, JSON_TEMPLATE } from "./jsonDeck.js";

const text = (value) => (typeof value === "string" ? value.trim() : "");
const key = (value) => String(value ?? "").trim().toLocaleLowerCase();
const ENGLISH_WORD_RE = /^[a-z][a-z\s'’.-]*$/i;
const MAX_EXAMPLES = 3;
const MAX_CONTRAST = 4;

const counterpartOf = (entry) => getCounterpartTerm(entry);

const validCounterpart = (entry) => {
  const counterpart = counterpartOf(entry);
  return Boolean(text(counterpart)) && ENGLISH_WORD_RE.test(counterpart) && key(counterpart) !== key(entry?.term);
};

const pairOf = (entry) => validCounterpart(entry) ? [text(entry?.term), counterpartOf(entry)] : [];

const alignFocus = (sentence, focus) => {
  if (!sentence || !focus) return null;
  if (sentence.includes(focus)) return focus;
  const index = sentence.toLocaleLowerCase().indexOf(focus.toLocaleLowerCase());
  return index === -1 ? null : sentence.slice(index, index + focus.length);
};

const normalizeExample = (entry, example) => {
  const term = text(entry?.term);
  const sentence = text(example?.sentence);
  if (!term || !sentence || !maskTarget(sentence, term)) return null;
  let focus = alignFocus(sentence, text(example?.focus));
  if (!focus) focus = alignFocus(sentence, term);
  if (!focus || !maskTarget(focus, term) || !sentence.includes(focus)) return null;
  return { sentence, focus };
};

const normalizeExamples = (entry, examples) => {
  const result = [];
  for (const example of Array.isArray(examples) ? examples : []) {
    const normalized = normalizeExample(entry, example);
    if (!normalized) continue;
    if (result.some((saved) => saved.sentence === normalized.sentence && saved.focus === normalized.focus)) continue;
    result.push(normalized);
    if (result.length >= MAX_EXAMPLES) break;
  }
  return result;
};

const normalizeMiniScenario = (entry, value) => {
  const scenario = text(value);
  if (!scenario) return "";
  const pair = [text(entry?.term), counterpartOf(entry)].filter(Boolean);
  return pair.some((term) => maskTarget(scenario, term)) ? "" : scenario;
};

const normalizeContrastScenarios = (entry, variants) => {
  const pair = pairOf(entry);
  if (pair.length < 2) return [];
  const result = [];
  for (const variant of Array.isArray(variants) ? variants : []) {
    const scenario = text(variant?.scenario);
    const answer = pair.find((term) => key(term) === key(variant?.answer));
    if (!scenario || !answer) continue;
    if (pair.some((term) => maskTarget(scenario, term))) continue;
    const explanation = text(variant?.explanation);
    if (result.some((saved) => key(saved.scenario) === key(scenario) && key(saved.answer) === key(answer))) continue;
    result.push({ scenario, answer, explanation });
    if (result.length >= MAX_CONTRAST) break;
  }
  return result;
};

const hasPracticeExample = (entry) => (Array.isArray(entry?.examples) ? entry.examples : [])
  .some((example) => text(example?.focus) && normalizeExample(entry, example));

const hasContrastMaterial = (entry) => {
  if (!validCounterpart(entry)) return false;
  return Boolean(normalizeMiniScenario(entry, entry?.miniScenario)) ||
    normalizeContrastScenarios(entry, entry?.contrastScenarios).length > 0;
};

export const needsFillMaterial = (entry) => {
  if (!text(entry?.term)) return false;
  return !text(entry.meaningZh) || !text(entry.meaning) || !hasPracticeExample(entry) ||
    !validCounterpart(entry) || !hasContrastMaterial(entry);
};

const MATERIAL_FORMAT = JSON.stringify(JSON_TEMPLATE, null, 2);
const MATERIAL_RULES = `要求：
- 只输出一个完整 JSON 数组，不要代码围栏、说明、表格、竖线行或包装对象。字段名和类型严格按模板。
- term 保持原样；meaningZh 为中文释义，meaning 为简短英文释义，pos 为词性，wordOrigin 为可靠中文词源，不确定留空。
- relatedWord 只写一个对应词及中文区别。contrastScenarios.answer 只能是 term 或 relatedWord 的英文词，不得引入第三个答案词。
- examples 提供两组例句。sentence 和 focus 必须原样包含 term 的精确字符串；focus 是包含该字符串的连续重点。
- 不得只用过去式、过去分词、现在分词或第三人称单数替代 term：term 为 Boo 就写 Fans boo...，不要 booed；term 为 Have a blast 就写 We have a blast...，不要 had a blast。即使目标词常以变形出现，也要改写成包含 term 原形的自然句子，不能牺牲语法；term 为 Enamor 可写 Her kindness and beauty enamor everyone she meets.
- miniScenario 是适用目标词的英文情景；contrastScenarios 每项包含 scenario、answer、explanation，提供对应词的辨析情景。情景不出现答案词。
- 不要漏词或新增词条；保留原有词义和资料。分批时每批也必须是完整 JSON 数组。`;

const promptTerm = (entry) => {
  const counterpart = validCounterpart(entry) ? counterpartOf(entry) : "";
  return counterpart ? `${text(entry.term)}（已有对应词：${counterpart}，请沿用）` : text(entry.term);
};

export const buildFillPrompt = (entries) => {
  const targets = (Array.isArray(entries) ? entries : []).filter(needsFillMaterial);
  return `你是我的英语词表助手。请为下面每个单词补全学习卡和专项练习需要的资料。
严格按这个 JSON 数组格式输出：

${MATERIAL_FORMAT}

${MATERIAL_RULES}

${targets.map(promptTerm).join("\n")}`;
};

export const buildWorksheetPrompt = () => `我在整理一份英语词汇表。请阅读我随这条提示词一起提供的词表文件或文字，先根据词库、词性、释义把每个单词和对应释义配对，再为每个词补全学习卡和专项练习需要的资料。
如果原表是填空或匹配题，请先配对好单词和释义。原表有中文释义就沿用，没有就翻译成简短中文。
严格按这个 JSON 数组格式输出：

${MATERIAL_FORMAT}

${MATERIAL_RULES}

只输出原表里的词，不要输出页码、题号或解释。`;

export const parseMaterialReply = (reply) => normalizeDeck(parseJsonDeck(reply));

const fillMissingText = (target, patch, field) => {
  if (text(target[field]) || !text(patch[field])) return false;
  target[field] = text(patch[field]);
  return true;
};

const mergeEntry = (entry, patch) => {
  const merged = { ...entry };
  let changed = false;
  for (const field of ["meaningZh", "pos", "meaning", "wordOrigin", "relatedWord"]) {
    changed = fillMissingText(merged, patch, field) || changed;
  }
  if (!hasPracticeExample(merged)) {
    const examples = normalizeExamples(merged, patch.examples);
    if (examples.length) {
      const existing = (Array.isArray(merged.examples) ? merged.examples : [])
        .filter((example) => text(example?.sentence));
      merged.examples = [...existing, ...examples.filter((example) =>
        !existing.some((saved) => saved.sentence === example.sentence && text(saved.focus) === example.focus))];
      changed = true;
    }
  }
  if (!normalizeMiniScenario(merged, merged.miniScenario) && patch.miniScenario) {
    const miniScenario = normalizeMiniScenario(merged, patch.miniScenario);
    if (miniScenario) {
      merged.miniScenario = miniScenario;
      changed = true;
    }
  }
  if (!normalizeContrastScenarios(merged, merged.contrastScenarios).length) {
    const candidates = normalizeContrastScenarios(merged, [
      ...(Array.isArray(merged.contrastScenarios) ? merged.contrastScenarios : []),
      ...(Array.isArray(patch.contrastScenarios) ? patch.contrastScenarios : []),
    ]);
    const miniScenario = normalizeMiniScenario(merged, merged.miniScenario);
    if (miniScenario && !candidates.some((variant) => key(variant.answer) === key(merged.term))) {
      candidates.unshift({ scenario: miniScenario, answer: merged.term, explanation: "" });
    }
    if (candidates.length) {
      merged.contrastScenarios = candidates;
      changed = true;
    }
  }
  return { merged, changed };
};

export const mergeFilledEntries = (entries, reply) => {
  const list = Array.isArray(entries) ? entries : [];
  const patches = parseMaterialReply(reply);
  const byTerm = new Map(patches.map((patch) => [key(patch.term), patch]));
  let filled = 0;
  const next = list.map((entry) => {
    const patch = entry?.term ? byTerm.get(key(entry.term)) : null;
    if (!patch) return entry;
    const { merged, changed } = mergeEntry(entry, patch);
    if (!changed) return entry;
    filled += 1;
    return merged;
  });
  return { entries: next, filled, remaining: next.filter(needsFillMaterial).length };
};

const PAGE_REF_RE = /\(\s*\d{1,3}\s*\)/;

export const detectWorksheetMismatch = (entries = []) => {
  const usable = entries.filter((entry) => entry?.term);
  if (usable.length < 2) return false;
  const pageRefTerms = usable.filter((entry) => PAGE_REF_RE.test(entry.term)).length;
  const pageRefMeanings = usable.filter((entry) => PAGE_REF_RE.test(String(entry.meaning ?? ""))).length;
  const longTerms = usable.filter((entry) => (String(entry.term).match(/[A-Za-z]+/g) ?? []).length >= 6).length;
  return pageRefTerms >= 1 ||
    pageRefMeanings >= Math.max(2, Math.ceil(usable.length * 0.4)) ||
    longTerms >= Math.ceil(usable.length * 0.5);
};
