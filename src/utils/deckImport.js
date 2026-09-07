const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

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
    throw new Error("浏览器不支持解析 .docx，请改为粘贴文本。");
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

const extractDocxXml = async (file) => {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const eocdIndex = findEocdIndex(data);
  if (eocdIndex < 0) {
    throw new Error("无法读取 .docx 文件结构。");
  }
  const centralDirOffset = readUint32LE(data, eocdIndex + 16);
  const centralDirSize = readUint32LE(data, eocdIndex + 12);
  const decoder = new TextDecoder("utf-8");
  let offset = centralDirOffset;
  while (offset < centralDirOffset + centralDirSize) {
    if (readUint32LE(data, offset) !== 0x02014b50) {
      break;
    }
    const compressionMethod = readUint16LE(data, offset + 10);
    const compressedSize = readUint32LE(data, offset + 20);
    const fileNameLength = readUint16LE(data, offset + 28);
    const extraLength = readUint16LE(data, offset + 30);
    const commentLength = readUint16LE(data, offset + 32);
    const localHeaderOffset = readUint32LE(data, offset + 42);
    const nameStart = offset + 46;
    const fileName = decoder.decode(
      data.slice(nameStart, nameStart + fileNameLength)
    );
    if (fileName === "word/document.xml") {
      if (readUint32LE(data, localHeaderOffset) !== 0x04034b50) {
        throw new Error("docx 内容已损坏。");
      }
      const localNameLength = readUint16LE(data, localHeaderOffset + 26);
      const localExtraLength = readUint16LE(data, localHeaderOffset + 28);
      const dataStart =
        localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = data.slice(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) {
        return decoder.decode(compressed);
      }
      if (compressionMethod === 8) {
        const inflated = await inflateZipData(compressed);
        return decoder.decode(inflated);
      }
      throw new Error("docx 压缩方式不支持。");
    }
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }
  throw new Error("docx 中未找到正文内容。");
};

const extractDocxText = async (file) => {
  const xmlText = await extractDocxXml(file);
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) {
    return xmlText.replace(/<[^>]+>/g, " ");
  }
  const paragraphs = Array.from(xml.getElementsByTagName("w:p"));
  const lines = paragraphs
    .map((paragraph) => {
      const textNodes = Array.from(paragraph.getElementsByTagName("w:t"));
      return textNodes.map((node) => node.textContent ?? "").join("");
    })
    .map((line) => line.trim())
    .filter(Boolean);
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

export const parseDeckFromText = (rawText) => {
  if (typeof rawText !== "string") {
    throw new Error("无法识别内容，请提供文本内容。");
  }
  const text = rawText.replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("无法识别内容，请提供非空文本。");
  }
  const mdDeck = parseVocabMarkdown(text);
  if (mdDeck.length) {
    return mdDeck;
  }
  const csvDeck = parseCsvDeck(text);
  if (csvDeck.length) {
    return csvDeck;
  }
  const candidates = extractJsonCandidates(text);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const deck = extractDeckFromParsed(parsed);
      if (deck && deck.length) {
        return deck;
      }
    } catch {
      continue;
    }
  }
  throw new Error("无法识别内容，请确保包含 JSON 数组或 deck 字段。");
};

const normalizeEntry = (entry) => {
  const toText = (value) => (value == null ? "" : String(value)).trim();
  const sourceEntry =
    entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
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

  return {
    ...sourceEntry,
    term: toText(entry?.term ?? entry?.word ?? entry?.name),
    syllables: toText(entry?.syllables),
    respell: toText(entry?.respell),
    pos: toText(entry?.pos),
    meaning: toText(entry?.meaning ?? entry?.definition),
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
    examples,
  };
};

export const normalizeDeck = (importedDeck) =>
  (Array.isArray(importedDeck) ? importedDeck : [])
    .map(normalizeEntry)
    .filter((entry) => entry.term);

export const readImportFile = async (file) => {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (name.endsWith(".docx") || type === DOCX_MIME) {
    return extractDocxText(file);
  }
  if (name.endsWith(".doc") || type === DOC_MIME) {
    throw new Error("暂不支持 .doc，请另存为 .docx 或直接粘贴在输入框里。");
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
      ];
      (entry.examples ?? []).forEach((example, index) => {
        lines.push(`- Sentence ${index + 1}: ${example.sentence || ""}`);
        lines.push(`- Focus ${index + 1}: ${example.focus || ""}`);
      });
      return lines.filter((line, index) => line || index < 2).join("\n");
    })
    .join("\n\n");
