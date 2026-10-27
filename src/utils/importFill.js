import { getCounterpartTerm, maskTarget } from "../questionBuilder.js";
import { normalizeDeck, parseDeckFromTextDetailed } from "./deckImport.js";

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

const normalizeRelatedWord = (value) => {
  const raw = text(value);
  if (!raw) return "";
  const parenthesised = raw.match(/^([A-Za-z][A-Za-z\s'’.-]*?)\s*[（(](.+)[)）]\s*$/);
  if (parenthesised) return `${parenthesised[1].trim()} — ${parenthesised[2].trim()}`;
  const separator = raw.match(/\s*[—–]\s*|\s+-\s+|\s*[：:]\s*|\s*\|\s*/);
  if (!separator) return ENGLISH_WORD_RE.test(raw) ? raw : "";
  const word = raw.slice(0, separator.index).trim();
  const rest = raw.slice(separator.index + separator[0].length).trim();
  if (!ENGLISH_WORD_RE.test(word) || key(word) === "") return "";
  return rest ? `${word} — ${rest}` : word;
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

const MATERIAL_FORMAT = `单词 | 词性 | 中文释义 | 英文释义
词源: 一到两句中文，说明可靠的词根或词源；不确定就写「助记：……」
对应词: 一个最容易混淆的英文词 — 一句中文区别说明
例句1: 一句自然英文，必须原样包含这个单词
重点1: 例句1 里连续的一段原文，必须原样包含这个单词
例句2: 另一句自然英文，同样原样包含这个单词
重点2: 例句2 里连续的一段原文，必须原样包含这个单词
情景: 一句英文日常情景，用这个单词比其他词更合适；不要出现这个单词和对应词
辨析: 另一句英文情景，用对应词更合适；不要出现这两个词 | 对应词 | 一句中文边界说明`;

const MATERIAL_RULES = `要求：
- 第一行四个字段用竖线分隔；单词保持原样，不要加 -ed、-ing、-s 这类变形，需要时用 can、will、they 这类说法。
- 词性用 n. / v. / adj. / adv. / phr. 这样的缩写；中文释义和英文释义都要短。
- 例句和情景用 B1–B2 日常英语，短句；重点必须是例句里连续的一段原文。
- 辨析固定三个部分，用竖线分隔：情景 | 对应词 | 中文说明；两个情景都不能出现答案词。
- 第一行第一个字段只写单词本身；括号里给了对应词的，辨析答案就用它，不要换别的词。
- 只输出下面这些词，不要添加、不要漏词；不要编号、不要表格、不要代码块。`;

const promptTerm = (entry) => {
  const counterpart = validCounterpart(entry) ? counterpartOf(entry) : "";
  return counterpart ? `${text(entry.term)}（已有对应词：${counterpart}，请沿用）` : text(entry.term);
};

export const buildFillPrompt = (entries) => {
  const targets = (Array.isArray(entries) ? entries : []).filter(needsFillMaterial);
  return `你是我的英语词表助手。请为下面每个单词补全学习卡和专项练习需要的资料。
严格按这个格式输出，一个词一段，段与段之间空一行：

${MATERIAL_FORMAT}

${MATERIAL_RULES}

${targets.map(promptTerm).join("\n")}`;
};

export const buildWorksheetPrompt = () => `我在做一份英语词汇 worksheet。请阅读我上传的文件，先根据词库、词性、释义把每个单词和对应释义配对，再为每个词补全学习卡和专项练习需要的资料。
如果原表是填空或匹配题，请先配对好单词和释义。原表有中文释义就沿用，没有就翻译成简短中文。
严格按这个格式输出，一个词一段，段与段之间空一行：

${MATERIAL_FORMAT}

${MATERIAL_RULES}

只输出原表里的词，不要输出页码、题号或解释。`;

const LABEL_ALIASES = {
  词性: "pos",
  pos: "pos",
  partofspeech: "pos",
  词类: "pos",
  中文释义: "meaningZh",
  中文意思: "meaningZh",
  中文: "meaningZh",
  meaningzh: "meaningZh",
  chinese: "meaningZh",
  meaningcn: "meaningZh",
  英文释义: "meaning",
  英文意思: "meaning",
  英文: "meaning",
  meaning: "meaning",
  meaningen: "meaning",
  definition: "meaning",
  english: "meaning",
  词源: "wordOrigin",
  词根词源: "wordOrigin",
  wordorigin: "wordOrigin",
  etymology: "wordOrigin",
  origin: "wordOrigin",
  对应词: "relatedWord",
  近义词: "relatedWord",
  易混词: "relatedWord",
  对位词: "relatedWord",
  relatedword: "relatedWord",
  counterpart: "relatedWord",
  例句: "sentence",
  句子: "sentence",
  例: "sentence",
  sentence: "sentence",
  example: "sentence",
  examples: "sentence",
  重点: "focus",
  搭配: "focus",
  重点搭配: "focus",
  强调: "focus",
  focus: "focus",
  phrase: "focus",
  情景: "miniScenario",
  场景: "miniScenario",
  语境: "miniScenario",
  miniscenario: "miniScenario",
  scenario: "miniScenario",
  辨析: "contrast",
  辨析情景: "contrast",
  对比: "contrast",
  边界: "contrast",
  contrast: "contrast",
};

const normalizeLabel = (label) => text(label)
  .toLocaleLowerCase()
  .replace(/[`*_]/g, "")
  .replace(/[（()）]/g, "")
  .replace(/[\s_]/g, "")
  .replace(/\d+$/, "");

const stripDecoration = (line) => text(line)
  .replace(/^[-*+]\s+/, "")
  .replace(/^\d+\s*[.、)]\s+/, "")
  .replace(/\*\*/g, "")
  .trim();

const HEADER_NAMES = new Set(["单词", "单词表", "word", "words", "term", "vocabulary"]);
const TERM_RE = /^[A-Za-z][A-Za-z0-9 .'’&/-]*$/;

const isTermLike = (value) => {
  const term = text(value);
  return Boolean(term) && term.length <= 60 && TERM_RE.test(term) && !HEADER_NAMES.has(key(term));
};

const TERM_STARTER_RE = /^(?:单词|词条|词|word|term)\s*[:：]\s*(.+)$/i;

const parseTermStarter = (line) => {
  const match = stripDecoration(line).match(TERM_STARTER_RE);
  if (!match) return null;
  const cells = match[1].split("|").map((cell) => text(cell));
  const term = cells[0].replace(/^\[|\]$/g, "").trim();
  if (!isTermLike(term)) return null;
  return { term, pos: cells[1] ?? "", meaningZh: cells[2] ?? "", meaning: cells[3] ?? "" };
};

const parseHeader = (line) => {
  const cleaned = stripDecoration(line);
  const bracketed = cleaned.match(/^(?:【|\[)\s*(.+?)\s*(?:】|\])$/);
  if (bracketed) {
    const term = bracketed[1].trim();
    return isTermLike(term) ? { term, cells: [] } : null;
  }
  const cells = cleaned.split("|").map((cell) => text(cell));
  if (cells[0] === "") cells.shift();
  if (cells.length < 4) return null;
  const term = cells[0].replace(/^\[|\]$/g, "").trim();
  if (!isTermLike(term) || /[:：]/.test(term)) return null;
  return { term, pos: cells[1], meaningZh: cells[2], meaning: cells[3] };
};

const parseBlocks = (reply) => {
  const blocks = [];
  let current = null;
  for (const rawLine of String(reply ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = parseHeader(line) ?? parseTermStarter(line);
    if (header) {
      current = {
        term: header.term,
        pos: header.pos ?? "",
        meaningZh: header.meaningZh ?? "",
        meaning: header.meaning ?? "",
        wordOrigin: "",
        relatedWord: "",
        miniScenario: "",
        examples: [],
        contrastLines: [],
      };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const labelled = stripDecoration(line).match(/^([^:：|]{1,20})\s*[:：]\s*(.+)$/);
    if (!labelled) continue;
    const field = LABEL_ALIASES[normalizeLabel(labelled[1])];
    if (!field) continue;
    const value = labelled[2].trim();
    if (!value) continue;
    if (field === "sentence") {
      current.examples.push({ sentence: value, focus: "" });
    } else if (field === "focus") {
      const pending = [...current.examples].reverse().find((example) => !example.focus);
      if (pending) pending.focus = value;
      else current.examples.push({ sentence: "", focus: value });
    } else if (field === "contrast") {
      const cells = value.split("|").map((cell) => cell.trim());
      if (cells.length >= 2) {
        current.contrastLines.push({ scenario: cells[0], answer: cells[1], explanation: cells.slice(2).join(" | ") });
      }
    } else {
      current[field] = value;
    }
  }
  return blocks;
};

const patchFromBlock = (block) => {
  const term = text(block.term);
  if (!term) return null;
  const patch = {
    term,
    pos: text(block.pos),
    meaningZh: text(block.meaningZh),
    meaning: text(block.meaning),
    wordOrigin: text(block.wordOrigin),
  };
  const relatedWord = normalizeRelatedWord(block.relatedWord);
  if (relatedWord) patch.relatedWord = relatedWord;
  patch.examples = normalizeExamples(patch, block.examples);
  const pair = pairOf(patch);
  const miniScenario = normalizeMiniScenario(patch, block.miniScenario);
  if (miniScenario) patch.miniScenario = miniScenario;
  const contrastScenarios = normalizeContrastScenarios(patch, block.contrastLines);
  if (pair.length === 2 && miniScenario && !contrastScenarios.some((variant) => key(variant.answer) === key(pair[0]))) {
    contrastScenarios.unshift({ scenario: miniScenario, answer: pair[0], explanation: "" });
  }
  if (!patch.miniScenario) {
    const targetVariant = contrastScenarios.find((variant) => key(variant.answer) === key(pair[0]));
    if (targetVariant) patch.miniScenario = targetVariant.scenario;
  }
  if (contrastScenarios.length) patch.contrastScenarios = contrastScenarios;
  return patch;
};

const countKnownLabelLines = (reply) => String(reply ?? "").split(/\r?\n/).reduce((count, rawLine) => {
  const labelled = stripDecoration(rawLine).match(/^([^:：|]{1,20})\s*[:：]\s*(.+)$/);
  if (!labelled || !LABEL_ALIASES[normalizeLabel(labelled[1])]) return count;
  return count + 1;
}, 0);

export const parseMaterialReply = (reply) => {
  const raw = typeof reply === "string" ? reply : "";
  if (!raw.trim()) return [];
  const fromBlocks = parseBlocks(raw).map(patchFromBlock).filter(Boolean);
  if (fromBlocks.length) return fromBlocks;
  if (countKnownLabelLines(raw) >= 2) return [];
  try {
    return normalizeDeck(parseDeckFromTextDetailed(raw).entries);
  } catch {
    return [];
  }
};

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
