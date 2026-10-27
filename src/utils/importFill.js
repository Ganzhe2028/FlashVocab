import { normalizeDeck, parseDeckFromTextDetailed } from "./deckImport.js";

export const buildFillPrompt = (entries) => {
  const terms = entries
    .filter((entry) => !entry.meaningZh)
    .map((entry) => entry.term);
  return `你是我的英语词表助手。请补全下面每个词的中文释义、词性和简短英文释义。
请严格按这个格式一行一个词，用竖线分隔，不要编号、不要表格、不要解释：
单词 | 词性 | 中文释义 | 英文释义
词性用 n. / v. / adj. / adv. / phr. 这样的缩写；中文释义要短；英文释义要短。
只输出下面这些词对应的行，不要添加别的词。

${terms.join("\n")}`;
};

export const mergeFilledEntries = (entries, reply) => {
  const updates = normalizeDeck(parseDeckFromTextDetailed(reply).entries);
  const byTerm = new Map(updates.map((entry) => [entry.term.trim().toLocaleLowerCase(), entry]));
  let filled = 0;
  const next = entries.map((entry) => {
    const patch = byTerm.get(entry.term.trim().toLocaleLowerCase());
    if (!patch) return entry;
    const merged = { ...entry };
    let changed = false;
    for (const field of ["meaningZh", "pos", "meaning", "respell"]) {
      if (!merged[field] && patch[field]) {
        merged[field] = patch[field];
        changed = true;
      }
    }
    if (!merged.examples?.length && patch.examples?.length) {
      merged.examples = patch.examples;
      changed = true;
    }
    if (changed) filled += 1;
    return merged;
  });
  return { entries: next, filled };
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

export const buildWorksheetPrompt = () => `我在做一份英语词汇 worksheet。请阅读我上传的文件，把单词库里的每个单词和释义表里的对应释义配对，整理成词表。
如果原表是填空或匹配题，请先根据词库、词性和释义把每个词配对好。
严格按这个格式输出，一行一个词，用竖线分隔：
单词 | 词性 | 中文释义 | 英文释义
中文释义要短；没有中文就翻译成简短中文。英文释义保留原表意思，可以缩短。
只输出词表行，不要解释、不要编号、不要 Markdown 表格。`;
