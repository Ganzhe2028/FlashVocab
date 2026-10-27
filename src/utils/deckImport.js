import { normalizeMemorySketch } from "../memorySketch.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOC_MIME = "application/msword";
const XLS_MIME = "application/vnd.ms-excel";

const readUint16LE = (data, offset) => data[offset] | (data[offset + 1] << 8);

const readUint32LE = (data, offset) =>
  (data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)) >>>
  0;

const findEocdIndex = (data) => {
  const minOffset = Math.max(0, data.length - 65557);
  for (let i = data.length - 22; i >= minOffset; i -= 1) {
    if (
      data[i] === 0x50 &&
      data[i + 1] === 0x4b &&
      data[i + 2] === 0x05 &&
      data[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
};

const inflateZipData = async (compressed) => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("浏览器不支持解析 Office 文件，请改为粘贴文本。");
  }
  const blob = new Blob([compressed]);
  try {
    const stream = new DecompressionStream("deflate-raw");
    const buffer = await new Response(
      blob.stream().pipeThrough(stream)
    ).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    const stream = new DecompressionStream("deflate");
    const buffer = await new Response(
      blob.stream().pipeThrough(stream)
    ).arrayBuffer();
    return new Uint8Array(buffer);
  }
};

const readZipEntries = async (file, label, matcher) => {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const eocdIndex = findEocdIndex(data);
  if (eocdIndex < 0) throw new Error(`无法读取 ${label} 文件结构。`);
  const centralDirOffset = readUint32LE(data, eocdIndex + 16);
  const centralDirSize = readUint32LE(data, eocdIndex + 12);
  const decoder = new TextDecoder("utf-8");
  const entries = new Map();
  let offset = centralDirOffset;
  while (offset < centralDirOffset + centralDirSize) {
    if (readUint32LE(data, offset) !== 0x02014b50) break;
    const compressionMethod = readUint16LE(data, offset + 10);
    const compressedSize = readUint32LE(data, offset + 20);
    const fileNameLength = readUint16LE(data, offset + 28);
    const extraLength = readUint16LE(data, offset + 30);
    const commentLength = readUint16LE(data, offset + 32);
    const localHeaderOffset = readUint32LE(data, offset + 42);
    const nameStart = offset + 46;
    const fileName = decoder.decode(data.slice(nameStart, nameStart + fileNameLength));
    offset = nameStart + fileNameLength + extraLength + commentLength;
    if (!matcher(fileName)) continue;
    if (readUint32LE(data, localHeaderOffset) !== 0x04034b50) {
      throw new Error(`${label} 内容已损坏。`);
    }
    const localNameLength = readUint16LE(data, localHeaderOffset + 26);
    const localExtraLength = readUint16LE(data, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.slice(dataStart, dataStart + compressedSize);
    if (compressionMethod === 0) {
      entries.set(fileName, decoder.decode(compressed));
    } else if (compressionMethod === 8) {
      entries.set(fileName, decoder.decode(await inflateZipData(compressed)));
    } else {
      throw new Error(`${label} 压缩方式不支持。`);
    }
  }
  return entries;
};

const extractDocxXml = async (file) => {
  const entries = await readZipEntries(file, ".docx", (name) => name === "word/document.xml");
  const xml = entries.get("word/document.xml");
  if (!xml) throw new Error("docx 中未找到正文内容。");
  return xml;
};

const columnIndexFromRef = (ref) => {
  const letters = String(ref ?? "").match(/[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return null;
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
};

const extractXlsxText = async (file) => {
  const entries = await readZipEntries(file, ".xlsx", (name) =>
    name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const parser = new DOMParser();
  const parseXml = (text) => {
    const xml = parser.parseFromString(text, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("Excel 内容无法读取，请改存为 CSV。");
    return xml;
  };
  const shared = [];
  if (entries.has("xl/sharedStrings.xml")) {
    const xml = parseXml(entries.get("xl/sharedStrings.xml"));
    for (const item of Array.from(xml.getElementsByTagName("si"))) {
      shared.push(Array.from(item.getElementsByTagName("t")).map((node) => node.textContent ?? "").join(""));
    }
  }
  const sheetNames = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/sheet(\d+)/)[1]) - Number(b.match(/sheet(\d+)/)[1]));
  if (!sheetNames.length) throw new Error("Excel 中未找到工作表。");
  for (const name of sheetNames) {
    const xml = parseXml(entries.get(name));
    const lines = [];
    for (const row of Array.from(xml.getElementsByTagName("row"))) {
      const cells = [];
      for (const cell of Array.from(row.getElementsByTagName("c"))) {
        const index = columnIndexFromRef(cell.getAttribute("r"));
        if (index == null) continue;
        const type = cell.getAttribute("t");
        let value = "";
        if (type === "s") {
          value = shared[Number(cell.getElementsByTagName("v")[0]?.textContent)] ?? "";
        } else if (type === "inlineStr") {
          value = Array.from(cell.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("");
        } else {
          value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
        }
        cells[index] = String(value).trim();
      }
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (cells.some(Boolean)) lines.push(cells.map((cell) => cell ?? "").join("\t"));
    }
    if (lines.length) return lines.join("\n");
  }
  throw new Error("Excel 工作表里没有可读取的内容。");
};

const paragraphText = (paragraph) =>
  Array.from(paragraph.getElementsByTagName("w:t"))
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();

const extractDocxText = async (file) => {
  const xmlText = await extractDocxXml(file);
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) {
    return xmlText.replace(/<[^>]+>/g, " ");
  }
  const body = xml.getElementsByTagName("w:body")[0];
  const lines = [];

  // Word tables are the normal shape of a teacher's vocabulary list. Keep
  // each row as one tab-separated line so 单词/词性/中文/例句 stay aligned.
  const walk = (parent) => {
    for (const node of Array.from(parent?.children ?? [])) {
      if (node.localName === "p") {
        const text = paragraphText(node);
        if (text) lines.push(text);
      } else if (node.localName === "tbl") {
        for (const row of Array.from(node.getElementsByTagName("w:tr"))) {
          const cells = Array.from(row.getElementsByTagName("w:tc"))
            .map((cell) =>
              Array.from(cell.getElementsByTagName("w:p"))
                .map(paragraphText)
                .filter(Boolean)
                .join(" "),
            )
            .map((cell) => cell.trim());
          if (cells.some(Boolean)) lines.push(cells.join("\t"));
        }
      } else {
        walk(node);
      }
    }
  };
  walk(body);
  if (!lines.length) {
    return Array.from(xml.getElementsByTagName("w:p"))
      .map(paragraphText)
      .filter(Boolean)
      .join("\n");
  }
  return lines.join("\n");
};

const extractJsonCandidates = (text) => {
  const candidates = [];
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const block = match[1].trim();
    if (block) {
      candidates.push(block);
    }
  }
  const firstArray = text.indexOf("[");
  const lastArray = text.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) {
    candidates.push(text.slice(firstArray, lastArray + 1).trim());
  }
  const firstObj = text.indexOf("{");
  const lastObj = text.lastIndexOf("}");
  if (firstObj >= 0 && lastObj > firstObj) {
    candidates.push(text.slice(firstObj, lastObj + 1).trim());
  }
  const trimmed = text.trim();
  if (trimmed) {
    candidates.push(trimmed);
  }
  return [...new Set(candidates)];
};

const extractDeckFromParsed = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.deck)) return parsed.deck;
  if (Array.isArray(parsed?.cards)) return parsed.cards;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.data)) return parsed.data;
  return null;
};

const HAN_RE = /[\u3400-\u9fff]/;
const PAGE_REF_RE = /\(\s*\d{1,3}\s*\)/;
const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const POS_ANY_RE =
  /\b(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\.(?:\s*[&/]\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\.)?/i;
const POS_BARE_RE = /^(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\b/i;
const POS_BARE_INLINE_RE = /\s(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)(?=\s|[\u3400-\u9fff])/i;
const POS_PAREN_RE =
  /[（(]\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\s*\.?\s*[)）]/i;
const PHONETIC_RE = /(\/[^/\n]{1,50}\/|\[[^\]\n]{1,50}\])/;
const HEADER_TOKENS = new Set([
  "word", "words", "term", "terms", "vocabulary", "english", "meaning",
  "definition", "chinese", "中文", "英文", "英语", "单词", "词汇", "词义",
  "释义", "词性", "音标", "序号", "number", "no", "pos", "part of speech",
  "example", "sentence", "例句", "备注", "unit", "lesson",
]);
const TERM_STOPWORDS = new Set([
  "a", "an", "the", "this", "that", "these", "those", "some", "any",
  "my", "your", "his", "her", "our", "their", "it", "we", "you", "they",
  "he", "she", "i", "please", "unit", "lesson", "module", "chapter",
  "page", "part", "vocabulary", "word", "words",
]);
const PHRASE_PARTICLES = new Set([
  "up", "down", "off", "on", "in", "out", "away", "back", "over",
  "through", "around", "about", "for", "to", "with", "of", "at", "by",
  "from", "into", "onto", "upon", "after", "before",
]);

const cleanImportLine = (rawLine) => {
  let line = String(rawLine ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
  line = line
    .replace(/^\s*[-*•·▪◦●]\s+/, "")
    .replace(/^\s*\d{1,3}[.)、]\s*/, "")
    .replace(/^\s*[（(]\d{1,3}[)）]\s*/, "")
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "")
    .replace(/^\s*#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^\[([^\]]{1,80})\]\s*/, "$1 ")
    .trim();
  return line;
};

const isSectionHeading = (line) => {
  if (!line) return true;
  if (/^(?:unit|lesson|module|chapter|part|section|vocabulary|word list|words)\b/i.test(line) &&
    !HAN_RE.test(line)) return true;
  if (/^(?:第[一二三四五六七八九十\d]+[单元课章节部分]|单词表|词汇表|生词表|姓名|班级|学号|日期|听写|默写)/.test(line)) return true;
  if (/^page\s*\d+/i.test(line) || /^\d{4}[-/.年]\d{1,2}/.test(line)) return true;
  if (/[:：]\s*$/.test(line) && (line.match(WORD_RE) ?? []).length > 1) return true;
  const tokens = line
    .split(/[\s/|,，、]+/)
    .map((token) => token.toLowerCase().replace(/[.:：()（）]/g, ""))
    .filter(Boolean);
  if (tokens.length >= 2 && tokens.every((token) => HEADER_TOKENS.has(token))) return true;
  return false;
};

const isHeaderRow = (cells) => {
  const tokens = cells
    .flatMap((cell) => String(cell).split(/[/,，、|]/))
    .map((cell) => cell.trim().toLowerCase().replace(/[.:：()（）]/g, ""))
    .filter(Boolean);
  return tokens.length >= 2 && tokens.every((token) => HEADER_TOKENS.has(token));
};

const isSentenceLike = (line) => {
  const words = line.match(WORD_RE) ?? [];
  if (HAN_RE.test(line)) return false;
  return (words.length >= 4 && /[.!?。！？]\s*$/.test(line)) || words.length >= 6;
};

const looksLikeExampleCell = (line) => {
  const words = line.match(WORD_RE) ?? [];
  return words.length >= 3 && /^["'“”]?[A-Z]/.test(line) && /[.!?。！？]\s*$/.test(line);
};

const isPosOnly = (cell) => {
  const value = String(cell ?? "").trim().replace(/^[（(]|[)）]$/g, "");
  return POS_ANY_RE.test(value) && value.replace(POS_ANY_RE, "").trim() === "";
};

const normalizePos = (value) => {
  const text = String(value ?? "").trim().replace(/^[（(]|[)）]$/g, "");
  const match = text.match(POS_ANY_RE) ?? text.match(POS_BARE_RE);
  if (!match) return "";
  const normalized = match[0].replace(/\s+/g, " ").trim();
  return normalized.endsWith(".") ? normalized : `${normalized}.`;
};

const cleanMeaningZh = (value) => String(value ?? "")
  .trim()
  .replace(/^[,，;；:：|｜\-–—\s]+/, "")
  .replace(/\s*(?:\d{1,3}|第?\s*\d{1,3}\s*页)\s*$/, "")
  .replace(/\s+/g, " ")
  .trim();

const cleanMeaningEn = (value) => String(value ?? "")
  .trim()
  .replace(/^[,，;；:：|｜\-–—=\s]+/, "")
  .replace(/[,，;；|｜\-–—=\s]+$/, "")
  .replace(/\s+/g, " ")
  .trim();

const splitInlineCells = (line) => {
  if (line.includes("\t")) return line.split(/\t+/).map((cell) => cell.trim()).filter(Boolean);
  if (/[|｜]/.test(line)) return line.split(/\s*[|｜]\s*/).map((cell) => cell.trim()).filter(Boolean);
  if (/[,，]/.test(line)) {
    const records = parseCsvRecords(line);
    if (records.length === 1 && records[0].length >= 2 && records[0].length <= 8) {
      return records[0];
    }
  }
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
  return [line];
};

const looksLikeTermCell = (cell) => {
  const value = String(cell ?? "").trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (!value || !/^[A-Za-z]/.test(value)) return false;
  if (isPosOnly(value) || PHONETIC_RE.test(value) && value.replace(PHONETIC_RE, "").trim() === "") return false;
  if (isSentenceLike(value)) return false;
  const words = value.match(WORD_RE) ?? [];
  if (words.length > 6) return false;
  return true;
};

const parseLooseLine = (rawLine) => {
  const line = rawLine.trim();
  if (!line) return { kind: "empty" };
  if (isSectionHeading(line)) return { kind: "heading" };
  if (!/[A-Za-z]/.test(line)) return { kind: "none" };
  if (isSentenceLike(line)) return { kind: "sentence" };

  let cut = -1;
  let explicit = false;
  const consider = (index, isExplicit = false) => {
    if (index > 0 && (cut < 0 || index < cut)) {
      cut = index;
      explicit = isExplicit;
    }
  };

  const hanIndex = line.search(HAN_RE);
  consider(hanIndex);
  const phonetic = line.match(PHONETIC_RE);
  if (phonetic) consider(phonetic.index + phonetic[0].indexOf(phonetic[0].trim().charAt(0)), true);
  const pos = line.match(POS_ANY_RE);
  if (pos) consider(pos.index, true);
  const barePos = line.match(POS_BARE_INLINE_RE);
  if (barePos) consider(barePos.index + 1, true);
  const posParen = line.match(POS_PAREN_RE);
  if (posParen) consider(posParen.index, true);
  const separator = line.match(/\t+|\s{2,}|\s+[-–—]\s*|\s*[|｜]\s*|\s*[：:]\s*|[,，]\s*(?=[\u3400-\u9fff])/);
  if (separator) consider(separator.index, true);

  const termPrefix = line
    .slice(0, cut < 0 ? line.length : cut)
    .trim()
    .replace(/[,，;；:：|｜\-–—\s(（]+$/, "")
    .replace(/^["'“”《]+|["'“”》]+$/g, "")
    .trim();
  let words = termPrefix.match(WORD_RE) ?? [];
  if (!words.length) return { kind: "none" };
  if (words.length > 6) return { kind: "sentence" };

  let term = termPrefix;
  let remainderStart = cut < 0 ? line.length : cut;
  if (words.length > 1 && !explicit && !HAN_RE.test(line)) {
    const second = words[1].toLowerCase();
    const phrase = words.length === 2 && PHRASE_PARTICLES.has(second);
    if (!phrase) {
      term = words[0];
      const firstWordIndex = line.search(/[A-Za-z]/);
      remainderStart = firstWordIndex + words[0].length;
    }
  }
  term = term.replace(/^["'“”]+|["'“”]+$/g, "").replace(/[,，;；:：|｜]+$/, "").trim();
  term = term.replace(/\s*\(\s*\d{1,3}\s*\)\s*$/, "").trim();
  if (!term || !/^[A-Za-z]/.test(term) || term.length > 60) return { kind: "none" };
  const firstTermWord = (term.match(WORD_RE) ?? [])[0]?.toLowerCase() ?? "";
  if (!HAN_RE.test(line) && TERM_STOPWORDS.has(firstTermWord)) return { kind: "sentence" };
  if (!HAN_RE.test(line) && words.length > 1 && term === words[0] && !explicit && !PAGE_REF_RE.test(line)) {
    return { kind: "sentence" };
  }

  let remainder = line
    .slice(remainderStart)
    .trim()
    .replace(/^[,，;；:：|｜\-–—=\s]+/, "")
    .trim();
  const entry = { term };

  const phoneticInRemainder = remainder.match(PHONETIC_RE);
  if (phoneticInRemainder && phoneticInRemainder.index <= 2) {
    entry.respell = phoneticInRemainder[0].trim();
    remainder = remainder.slice(phoneticInRemainder.index + phoneticInRemainder[0].length).trim()
      .replace(/^[,，;；:：|｜\-–—\s]+/, "");
  }
  const posInRemainder = remainder.match(POS_ANY_RE);
  if (posInRemainder && posInRemainder.index <= 3) {
    entry.pos = normalizePos(posInRemainder[0]);
    remainder = remainder.slice(posInRemainder.index + posInRemainder[0].length).trim()
      .replace(/^[,，;；:：|｜\-–—\s]+/, "");
  } else {
    const parenPos = remainder.match(POS_PAREN_RE);
    if (parenPos && parenPos.index <= 3) {
      entry.pos = normalizePos(parenPos[0]);
      remainder = remainder.slice(parenPos.index + parenPos[0].length).trim()
        .replace(/^[,，;；:：|｜\-–—\s]+/, "");
    } else {
      const barePos = remainder.match(POS_BARE_RE);
      if (barePos) {
        entry.pos = normalizePos(barePos[0]);
        remainder = remainder.slice(barePos[0].length).trim()
          .replace(/^[,，;；:：|｜\-–—\s]+/, "");
      }
    }
  }

  const zhIndex = remainder.search(HAN_RE);
  if (zhIndex >= 0) {
    const englishPart = cleanMeaningEn(remainder.slice(0, zhIndex));
    const zhPart = cleanMeaningZh(remainder.slice(zhIndex));
    if (englishPart && /[A-Za-z]/.test(englishPart)) entry.meaning = englishPart;
    if (zhPart) entry.meaningZh = zhPart;
  } else {
    const englishPart = cleanMeaningEn(remainder);
    if (englishPart && /[A-Za-z]/.test(englishPart)) entry.meaning = englishPart;
  }

  if (!entry.meaning && !entry.meaningZh && !entry.pos && !entry.respell &&
    words.length > 1 && !explicit && !HAN_RE.test(line) && term === words[0]) {
    return { kind: "sentence" };
  }
  return { kind: "entry", entry };
};

const parseTableRow = (rawCells) => {
  const cells = rawCells
    .map((cell) => String(cell ?? "").replace(/^["'“”]+|["'“”]+$/g, "").trim())
    .filter(Boolean);
  if (!cells.length) return null;
  if (isHeaderRow(cells)) return { kind: "heading" };
  while (cells.length > 1 && /^\d{1,3}$/.test(cells[0])) cells.shift();
  const termIndex = cells.findIndex(looksLikeTermCell);
  if (termIndex < 0) {
    const joined = cells.join("  ");
    const parsed = parseLooseLine(joined);
    return parsed.kind === "entry" ? parsed : null;
  }

  const termCell = cells[termIndex];
  const direct = parseLooseLine(termCell);
  if (direct.kind !== "entry") return null;
  const entry = { ...direct.entry };
  for (const [index, cell] of cells.entries()) {
    if (index === termIndex) continue;
    if (isPosOnly(cell)) {
      if (!entry.pos) entry.pos = normalizePos(cell);
      continue;
    }
    if (!HAN_RE.test(cell) && PHONETIC_RE.test(cell) && cell.replace(PHONETIC_RE, "").trim() === "") {
      if (!entry.respell) entry.respell = cell;
      continue;
    }
    if (HAN_RE.test(cell)) {
      if (!entry.meaningZh) {
        const zh = cleanMeaningZh(cell);
        if (zh) entry.meaningZh = zh;
      } else if (looksLikeExampleCell(cell)) {
        entry.examples ??= [];
        entry.examples.push({ sentence: cell, focus: "" });
      }
      continue;
    }
    if (/[A-Za-z]/.test(cell)) {
      if (looksLikeExampleCell(cell)) {
        entry.examples ??= [];
        entry.examples.push({ sentence: cell, focus: "" });
      } else if (!entry.meaning) {
        entry.meaning = cleanMeaningEn(cell);
      }
    }
  }
  return { kind: "entry", entry };
};

const continuationValue = (line) => {
  const parsed = parseLooseLine(line);
  if (parsed.kind === "entry" && parsed.entry && !parsed.entry.term) return null;
  const cells = splitInlineCells(line);
  if (cells.length === 1 && cells[0] === line && !/^[A-Za-z]/.test(line) && HAN_RE.test(line)) {
    return { meaningZh: cleanMeaningZh(line) };
  }
  if (/^[（(]?\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\s*[.)）]?\s*[\u3400-\u9fff]/.test(line)) {
    const match = line.match(POS_ANY_RE) ?? line.match(/^[（(]?\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\s*[.)]?/i);
    if (match) {
      return {
        pos: normalizePos(match[0]),
        meaningZh: cleanMeaningZh(line.slice(match[0].length)),
      };
    }
  }
  return null;
};

const parseChineseFirstLine = (line) => {
  const match = line.match(/^(.+?)[\s,，:：|｜–—-]+([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*){0,4})\s*$/);
  if (!match) return null;
  const meaningZh = cleanMeaningZh(match[1]);
  const term = match[2].trim();
  if (!meaningZh || !HAN_RE.test(meaningZh) || !term) return null;
  if (TERM_STOPWORDS.has(term.toLowerCase())) return null;
  return { term, meaningZh };
};

const parseLooseDeck = (text) => {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const skipped = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = cleanImportLine(raw);
    if (!line) continue;
    if (isSectionHeading(line)) {
      skipped.push({ line: raw.trim(), reason: "heading" });
      continue;
    }
    if (/^[\u3400-\u9fff]/.test(line)) {
      const chineseFirst = parseChineseFirstLine(line);
      if (chineseFirst) {
        entries.push(chineseFirst);
        continue;
      }
    }
    if (!/[A-Za-z]/.test(line)) {
      const continuation = continuationValue(line);
      if (continuation && entries.length) {
        const previous = entries[entries.length - 1];
        if (!previous.meaningZh && continuation.meaningZh) previous.meaningZh = continuation.meaningZh;
        if (!previous.pos && continuation.pos) previous.pos = continuation.pos;
        continue;
      }
      skipped.push({ line: raw.trim(), reason: "unrecognized" });
      continue;
    }
    const cells = splitInlineCells(line);
    const parsed = cells.length > 1 ? parseTableRow(cells) : parseLooseLine(line);
    const resolved = parsed?.kind === "entry" ? parsed : parseLooseLine(line);
    if (resolved.kind !== "entry") {
      if (resolved.kind === "heading") skipped.push({ line: raw.trim(), reason: "heading" });
      else skipped.push({ line: raw.trim(), reason: resolved.kind === "sentence" ? "sentence" : "unrecognized" });
      continue;
    }
    const entry = { ...resolved.entry };
    if (!entry.meaningZh && !entry.meaning) {
      let lookahead = index + 1;
      while (lookahead < lines.length && !cleanImportLine(lines[lookahead])) lookahead += 1;
      if (lookahead < lines.length) {
        const next = cleanImportLine(lines[lookahead]);
        if (!/[A-Za-z]/.test(next) || /^[（(]?\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|phr|phrase|pl|abbr)\s*[.)）]?\s*[\u3400-\u9fff]/.test(next)) {
          const continuation = continuationValue(next);
          if (continuation) {
            if (continuation.meaningZh) entry.meaningZh = continuation.meaningZh;
            if (continuation.pos) entry.pos = continuation.pos;
            index = lookahead;
          }
        }
      }
    }
    entries.push(entry);
  }
  return { entries, skipped };
};

const parseDelimitedDeck = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  if (!lines.some((line) => line.includes("\t") || /[|｜]/.test(line))) return [];
  const rows = lines.map((line) =>
    line.includes("\t")
      ? line.split(/\t+/)
      : line.split(/\s*[|｜]\s*/));
  const entries = [];
  for (const row of rows) {
    const parsed = parseTableRow(row);
    if (parsed?.kind === "entry") entries.push(parsed.entry);
  }
  return entries;
};

const parseJsonDeck = (text) => {
  for (const candidate of extractJsonCandidates(text)) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const deck = extractDeckFromParsed(parsed);
      if (deck && deck.length) return deck;
    } catch {
      // The next candidate may still be valid JSON.
    }
  }
  return null;
};

const MARKDOWN_FIELD_ALIASES = {
  "meaning (en)": "meaning",
  meaning: "meaning",
  definition: "meaning",
  "meaning (zh)": "meaningZh",
  "meaning (zh-cn)": "meaningZh",
  meaningzh: "meaningZh",
  meaning_zh: "meaningZh",
  syllables: "syllables",
  respell: "respell",
  pos: "pos",
  "part of speech": "pos",
  "word origin": "wordOrigin",
  wordorigin: "wordOrigin",
  word_origin: "wordOrigin",
  etymology: "wordOrigin",
  "related word": "relatedWord",
  relatedword: "relatedWord",
  related_word: "relatedWord",
  counterpart: "relatedWord",
  "micro scene": "microScene",
  "memory sketch": "memorySketch",
  "near distractors": "distractors",
  "usage tags": "usageTags",
  "mini scenario": "miniScenario",
  "contrast scenarios": "contrastScenarios",
};

const parseVocabMarkdown = (text) => {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  const flush = () => {
    if (current?.term) {
      current.examples = Object.keys(current.exampleParts ?? {})
        .map(Number)
        .sort((a, b) => a - b)
        .map((index) => current.exampleParts[index])
        .filter((example) => example.sentence);
      delete current.exampleParts;
      entries.push(current);
    }
    current = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const termMatch = line.match(/^\[([^{}]+)\]$/);
    if (termMatch) {
      flush();
      current = { term: termMatch[1].trim(), exampleParts: {} };
      continue;
    }
    if (!current) continue;

    const fieldMatch = line.match(/^-\s*([^:]+):\s*(.*)$/);
    if (!fieldMatch) continue;
    const label = fieldMatch[1].trim();
    const value = fieldMatch[2].trim();
    if (!value) continue;

    const exampleMatch = label.match(/^(sentence|focus)(?:\s+(\d+))?$/i);
    if (exampleMatch) {
      const kind = exampleMatch[1].toLowerCase();
      const index = Number(exampleMatch[2] ?? 1);
      current.exampleParts[index] ??= { sentence: "", focus: "" };
      current.exampleParts[index][kind] = value;
      continue;
    }

    const field = MARKDOWN_FIELD_ALIASES[label.toLowerCase()];
    if (field) {
      current[field] = value;
    }
  }
  flush();
  return entries;
};

const parseCsvRecords = (text) => {
  const records = [];
  let row = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(current.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (inQuotes) return [];
  row.push(current.trim());
  if (row.some(Boolean)) records.push(row);
  return records;
};

const parseCsvDeck = (text) => {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];
  const headerMap = {
    word: "term",
    name: "term",
    term: "term",
    meaning: "meaning",
    definition: "meaning",
    meaningzh: "meaningZh",
    meaning_zh: "meaningZh",
    meaningzh_cn: "meaningZh",
    pos: "pos",
    partofspeech: "pos",
    part_of_speech: "pos",
    syllables: "syllables",
    respell: "respell",
    phrases: "phrases",
    collocations: "phrases",
    sentence: "sentence",
    example: "sentence",
    focus: "sentenceFocus",
    sentencefocus: "sentenceFocus",
    sentence_focus: "sentenceFocus",
    wordorigin: "wordOrigin",
    word_origin: "wordOrigin",
    etymology: "wordOrigin",
    relatedword: "relatedWord",
    related_word: "relatedWord",
    counterpart: "relatedWord",
  };
  const headers = records[0].map((header) => {
    const trimmed = header.trim();
    const normalized = trimmed.toLowerCase().replace(/\s+/g, "");
    const numberedExample = normalized.match(/^(sentence|focus)([1-3])$/);
    if (numberedExample) {
      return `${numberedExample[1]}${numberedExample[2]}`;
    }
    return headerMap[normalized] ?? trimmed;
  });
  if (!headers.includes("term")) {
    return [];
  }
  return records.slice(1).map((cells) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = cells[index] ?? "";
    });
    const numberedExamples = [1, 2, 3]
      .map((index) => ({
        sentence: entry[`sentence${index}`] ?? "",
        focus: entry[`focus${index}`] ?? "",
      }))
      .filter((example) => example.sentence);
    if (numberedExamples.length) entry.examples = numberedExamples;
    return entry;
  });
};

export const parseDeckFromTextDetailed = (rawText) => {
  if (typeof rawText !== "string") {
    throw new Error("无法识别内容，请提供文本内容。");
  }
  const text = rawText.replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("无法识别内容，请提供非空文本。");
  }
  const mdDeck = parseVocabMarkdown(text);
  if (mdDeck.length) {
    return { entries: mdDeck, format: "markdown", skipped: [] };
  }
  const csvDeck = parseCsvDeck(text);
  if (csvDeck.length) {
    return { entries: csvDeck, format: "table", skipped: [] };
  }
  const jsonDeck = parseJsonDeck(text);
  if (jsonDeck) {
    return { entries: jsonDeck, format: "json", skipped: [] };
  }
  const delimitedDeck = parseDelimitedDeck(text);
  if (delimitedDeck.length) {
    return { entries: delimitedDeck, format: "table", skipped: [] };
  }
  const loose = parseLooseDeck(text);
  if (loose.entries.length) {
    return { entries: loose.entries, format: "list", skipped: loose.skipped };
  }
  const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
  throw new Error(
    `无法识别内容：没有认出英文单词${firstLine ? `（第一行是「${firstLine.slice(0, 40)}」）` : ""}。每行写一个词，词后面可以直接跟中文，例如 abandon 放弃。`,
  );
};

export const parseDeckFromText = (rawText) => parseDeckFromTextDetailed(rawText).entries;

const normalizeEntry = (entry) => {
  const toText = (value) => (value == null ? "" : String(value)).trim();
  const sourceEntry =
    entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const toList = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch { /* Legacy plain labels remain readable. */ }
      return value.split(/[,，]/).map((part) => part.trim()).filter(Boolean);
    }
    return [];
  };
  const normalizeExample = (example) => {
    if (typeof example === "string") {
      const sentence = toText(example);
      return sentence ? { sentence, focus: "" } : null;
    }

    const sentence = toText(
      example?.sentence ?? example?.text ?? example?.example,
    );
    const focus = toText(
      example?.focus ??
        example?.sentenceFocus ??
        example?.sentence_focus ??
        example?.highlight,
    );

    return sentence ? { ...example, sentence, focus } : null;
  };

  const rawExamples =
    entry?.examples ?? entry?.sentences ?? entry?.usageExamples ?? [];
  const examples = Array.isArray(rawExamples)
    ? rawExamples.map(normalizeExample).filter(Boolean)
    : [];

  if (!examples.length) {
    const legacySentence = toText(
      entry?.sentence ??
        entry?.example ??
        entry?.exampleSentence ??
        entry?.example_sentence,
    );
    const legacyFocus = toText(
      entry?.sentenceFocus ??
        entry?.sentence_focus ??
        entry?.focus ??
        entry?.highlight,
    );
    if (legacySentence) {
      examples.push({ sentence: legacySentence, focus: legacyFocus });
    }
  }

  let meaning = toText(entry?.meaning ?? entry?.definition);
  let normalizedExamples = examples;
  if (!meaning && examples.length === 1 && !examples[0].focus &&
    /^[a-z]/.test(examples[0].sentence) && !/[.!?。！？]\s*$/.test(examples[0].sentence)) {
    meaning = examples[0].sentence;
    normalizedExamples = [];
  }

  return {
    ...sourceEntry,
    term: toText(entry?.term ?? entry?.word ?? entry?.name),
    syllables: toText(entry?.syllables),
    respell: toText(entry?.respell),
    pos: toText(entry?.pos),
    meaning,
    meaningZh: toText(
      entry?.meaningZh ??
        entry?.meaning_zh ??
        entry?.meaningZH ??
        entry?.meaningzh,
    ),
    wordOrigin: toText(
      entry?.wordOrigin ?? entry?.word_origin ?? entry?.etymology,
    ),
    relatedWord: toText(
      entry?.relatedWord ?? entry?.related_word ?? entry?.counterpart,
    ),
    microScene: toText(entry?.microScene ?? entry?.micro_scene),
    memorySketch: normalizeMemorySketch(entry?.memorySketch ?? entry?.memory_sketch),
    distractors: toList(entry?.distractors).map(toText).filter(Boolean),
    usageTags: toList(entry?.usageTags ?? entry?.usage_tags).map(toText).filter(Boolean),
    miniScenario: toText(entry?.miniScenario ?? entry?.mini_scenario),
    contrastScenarios: toList(entry?.contrastScenarios ?? entry?.contrast_scenarios).filter((variant) => variant && typeof variant === "object" && !Array.isArray(variant)),
    examples: normalizedExamples,
  };
};

export const normalizeDeck = (importedDeck) =>
  (Array.isArray(importedDeck) ? importedDeck : [])
    .map(normalizeEntry)
    .filter((entry) => entry.term);

export const readImportFile = async (file) => {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (name.endsWith(".xlsx") || type === XLSX_MIME) {
    return extractXlsxText(file);
  }
  if (name.endsWith(".xls") || type === XLS_MIME) {
    throw new Error("暂不支持旧 .xls，请另存为 .xlsx 或 CSV。");
  }
  if (name.endsWith(".docx") || type === DOCX_MIME) {
    return extractDocxText(file);
  }
  if (name.endsWith(".doc") || type === DOC_MIME) {
    throw new Error("暂不支持 .doc，请另存为 .docx 或直接粘贴在输入框里。");
  }
  if (name.endsWith(".pdf") || type === "application/pdf") {
    throw new Error("暂不支持 PDF，请从 PDF 里复制文字粘贴，或另存为 Word / CSV。");
  }
  if (String(type).startsWith("image/") || /\.(png|jpe?g|heic|webp)$/i.test(name)) {
    throw new Error("图片无法直接识别，请把单词表复制成文字粘贴，或使用老师发的 Word / Excel 文件。");
  }
  return file.text();
};

export const buildMarkdownExport = (items) =>
  items
    .map((entry) => {
      const lines = [
        `[${entry.term}]`,
        "",
        entry.pos ? `- POS: ${entry.pos}` : "",
        entry.syllables ? `- Syllables: ${entry.syllables}` : "",
        entry.respell ? `- Respell: ${entry.respell}` : "",
        entry.meaning ? `- Meaning (EN): ${entry.meaning}` : "",
        entry.meaningZh ? `- Meaning (ZH): ${entry.meaningZh}` : "",
        entry.wordOrigin ? `- Word Origin: ${entry.wordOrigin}` : "",
        entry.relatedWord ? `- Related Word: ${entry.relatedWord}` : "",
        entry.microScene ? `- Micro Scene: ${entry.microScene.replaceAll("\n", " ")}` : "",
        entry.memorySketch ? `- Memory Sketch: ${JSON.stringify(entry.memorySketch)}` : "",
        entry.distractors?.length ? `- Near Distractors: ${JSON.stringify(entry.distractors)}` : "",
        entry.usageTags?.length ? `- Usage Tags: ${JSON.stringify(entry.usageTags)}` : "",
        entry.miniScenario ? `- Mini Scenario: ${entry.miniScenario}` : "",
        entry.contrastScenarios?.length ? `- Contrast Scenarios: ${JSON.stringify(entry.contrastScenarios)}` : "",
      ];
      (entry.examples ?? []).forEach((example, index) => {
        lines.push(`- Sentence ${index + 1}: ${example.sentence || ""}`);
        lines.push(`- Focus ${index + 1}: ${example.focus || ""}`);
      });
      return lines.filter((line, index) => line || index < 2).join("\n");
    })
    .join("\n\n");
