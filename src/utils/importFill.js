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
