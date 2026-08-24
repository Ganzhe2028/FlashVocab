import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const baseDeck = [
  {
    term: "Vacant",
    syllables: "Va·cant",
    respell: "[VAY-kunt]",
    pos: "adj.",
    meaning: "empty; not occupied",
    meaningZh: "空的；未被占用",
    examples: [
      {
        sentence: "The bus had a vacant seat by the door.",
        focus: "vacant seat",
      },
      {
        sentence: "We found a vacant room at the hotel.",
        focus: "vacant room",
      },
    ],
  },
  {
    term: "Proximity",
    syllables: "Prox·im·i·ty",
    respell: "[prok-SIM-ih-tee]",
    pos: "n.",
    meaning: "the state of being near; closeness",
    meaningZh: "接近；邻近",
    examples: [
      {
        sentence: "Our school is in close proximity to the library.",
        focus: "in close proximity to",
      },
      {
        sentence: "I like the apartment's proximity to the subway.",
        focus: "proximity to",
      },
    ],
  },
  {
    term: "Devise",
    syllables: "De·vise",
    respell: "[dih-VYZE]",
    pos: "v.",
    meaning: "to plan or invent something carefully",
    meaningZh: "设计；制定；想出",
    examples: [
      {
        sentence: "We devised a plan for the class trip.",
        focus: "devised a plan",
      },
      {
        sentence: "She devised a simple way to save time.",
        focus: "devised a simple way",
      },
    ],
  },
  {
    term: "Mundane",
    syllables: "Mun·dane",
    respell: "[mun-DAYN]",
    pos: "adj.",
    meaning: "ordinary and not interesting",
    meaningZh: "平凡的；乏味的",
    examples: [
      {
        sentence: "Washing dishes feels like a mundane task.",
        focus: "mundane task",
      },
      {
        sentence: "His office job became a mundane routine.",
        focus: "mundane routine",
      },
    ],
  },
  {
    term: "Translucent",
    syllables: "Trans·lu·cent",
    respell: "[trans-LOO-sent]",
    pos: "adj.",
    meaning: "allowing some light to pass through; semi-transparent",
    meaningZh: "半透明的",
    examples: [
      {
        sentence: "Sunlight came through the translucent curtain.",
        focus: "translucent curtain",
      },
      {
        sentence: "The bathroom door has translucent glass.",
        focus: "translucent glass",
      },
    ],
  },
  {
    term: "Probe",
    syllables: "Probe",
    respell: "[PROHB]",
    pos: "v.",
    meaning: "to investigate or examine closely",
    meaningZh: "调查；探查",
    examples: [
      {
        sentence: "The interviewer tried to probe deeper into his answer.",
        focus: "probe deeper",
      },
      {
        sentence: "Police will probe the cause of the fire.",
        focus: "probe the cause",
      },
    ],
  },
  {
    term: "Revive",
    syllables: "Re·vive",
    respell: "[rih-VYV]",
    pos: "v.",
    meaning: "to bring back to life or make active again",
    meaningZh: "复苏；恢复；使复活",
    examples: [
      {
        sentence: "The poster helped revive interest in the club.",
        focus: "revive interest in",
      },
      {
        sentence: "Rain may revive the dry plants by morning.",
        focus: "revive the dry plants",
      },
    ],
  },
  {
    term: "Inhabit",
    syllables: "In·hab·it",
    respell: "[in-HAB-it]",
    pos: "v.",
    meaning: "to live in a place",
    meaningZh: "居住于；栖息于",
    examples: [
      {
        sentence: "Many fish inhabit the river.",
        focus: "inhabit the river",
      },
      {
        sentence: "Only a few families inhabit the island in winter.",
        focus: "inhabit the island",
      },
    ],
  },
  {
    term: "Credibility",
    syllables: "Cred·i·bil·i·ty",
    respell: "[kred-uh-BIL-ih-tee]",
    pos: "n.",
    meaning: "the quality of being believable or trustworthy",
    meaningZh: "可信度；可信性",
    examples: [
      {
        sentence: "He began to lose credibility after he lied.",
        focus: "lose credibility",
      },
      {
        sentence: "The false story hurt the website's credibility.",
        focus: "website's credibility",
      },
    ],
  },
  {
    term: "Lucid",
    syllables: "Lu·cid",
    respell: "[LOO-sid]",
    pos: "adj.",
    meaning: "clear and easy to understand",
    meaningZh: "清晰的；易懂的",
    examples: [
      {
        sentence: "The teacher gave a lucid explanation of the rule.",
        focus: "lucid explanation",
      },
      {
        sentence: "She gave a lucid answer to the question.",
        focus: "lucid answer",
      },
    ],
  },
  {
    term: "Fatigue",
    syllables: "Fa·tigue",
    respell: "[fuh-TEEG]",
    pos: "n.",
    meaning: "extreme tiredness after long effort",
    meaningZh: "疲劳；疲惫",
    examples: [
      {
        sentence: "After the long game, mental fatigue made it hard to focus.",
        focus: "mental fatigue",
      },
      {
        sentence: "By 10 p.m., fatigue set in and everyone grew quiet.",
        focus: "fatigue set in",
      },
    ],
  },
  {
    term: "Impulse",
    syllables: "Im·pulse",
    respell: "[IM-puls]",
    pos: "n.",
    meaning: "a sudden urge to do something without thinking",
    meaningZh: "冲动",
    examples: [
      {
        sentence: "I bought the snacks on impulse near the cashier.",
        focus: "on impulse",
      },
      {
        sentence: "Stores put candy there to encourage impulse buys.",
        focus: "impulse buys",
      },
    ],
  },
  {
    term: "Recede",
    syllables: "Re·cede",
    respell: "[rih-SEED]",
    pos: "v.",
    meaning: "to move back; to gradually become smaller or weaker",
    meaningZh: "后退；逐渐减弱",
    examples: [
      {
        sentence: "The lights receded into the distance as the car drove away.",
        focus: "receded into the distance",
      },
      {
        sentence: "After some rest, the pain receded.",
        focus: "pain receded",
      },
    ],
  },
  {
    term: "Distorted",
    syllables: "Dis·tort·ed",
    respell: "[dis-TOR-tid]",
    pos: "adj.",
    meaning: "changed in shape or meaning; twisted or unclear",
    meaningZh: "扭曲的；失真的",
    examples: [
      {
        sentence: "The old speaker made a distorted sound.",
        focus: "distorted sound",
      },
      {
        sentence: "The mirror gave a distorted view of the room.",
        focus: "distorted view",
      },
    ],
  },
  {
    term: "Deception",
    syllables: "De·cep·tion",
    respell: "[dih-SEP-shun]",
    pos: "n.",
    meaning: "the act of tricking someone by lying or hiding the truth",
    meaningZh: "欺骗；欺诈",
    examples: [
      {
        sentence: "The trick was an act of deception.",
        focus: "act of deception",
      },
      {
        sentence: "The scam used deception to get money.",
        focus: "used deception",
      },
    ],
  },
  {
    term: "Prosperous",
    syllables: "Pros·per·ous",
    respell: "[PROS-per-us]",
    pos: "adj.",
    meaning: "successful, wealthy, or doing well",
    meaningZh: "繁荣的；富裕的",
    examples: [
      {
        sentence: "A prosperous town usually has many busy shops.",
        focus: "prosperous town",
      },
      {
        sentence: "The family became prosperous after years of work.",
        focus: "became prosperous",
      },
    ],
  },
  {
    term: "Elusive",
    syllables: "E·lu·sive",
    respell: "[ih-LOO-siv]",
    pos: "adj.",
    meaning: "difficult to find, catch, or understand",
    meaningZh: "难以捉摸的；难以找到的",
    examples: [
      {
        sentence: "An elusive answer kept bothering the class.",
        focus: "elusive answer",
      },
      {
        sentence: "The small cat was elusive and hard to catch.",
        focus: "was elusive",
      },
    ],
  },
  {
    term: "Bloated",
    syllables: "Blo·at·ed",
    respell: "[BLOH-tid]",
    pos: "adj.",
    meaning: "swollen; or made too big with unnecessary parts",
    meaningZh: "肿胀的；膨胀的",
    examples: [
      {
        sentence: "The project started with a bloated budget.",
        focus: "bloated budget",
      },
      {
        sentence: "I felt bloated after dinner.",
        focus: "felt bloated",
      },
    ],
  },
  {
    term: "Contempt",
    syllables: "Con·tempt",
    respell: "[kun-TEMPT]",
    pos: "n.",
    meaning: "strong disrespect; the feeling that someone is beneath you",
    meaningZh: "轻蔑；蔑视",
    examples: [
      {
        sentence: "He spoke with open contempt about the rule.",
        focus: "open contempt",
      },
      {
        sentence: "She looked at the bully with contempt.",
        focus: "with contempt",
      },
    ],
  },
  {
    term: "Centennial",
    syllables: "Cen·ten·ni·al",
    respell: "[sen-TEN-ee-uhl]",
    pos: "adj.",
    meaning: "relating to the 100th anniversary of something",
    meaningZh: "百年纪念的",
    examples: [
      {
        sentence: "The school held a centennial celebration in May.",
        focus: "centennial celebration",
      },
      {
        sentence: "We saw a centennial sign in the hall.",
        focus: "centennial sign",
      },
    ],
  },
  {
    term: "Atrocity",
    syllables: "A·troc·i·ty",
    respell: "[uh-TROS-ih-tee]",
    pos: "n.",
    meaning: "an extremely cruel or brutal act",
    meaningZh: "暴行；残暴行为",
    examples: [
      {
        sentence: "The documentary described a war atrocity.",
        focus: "war atrocity",
      },
      {
        sentence: "Everyone was shocked by the atrocity.",
        focus: "by the atrocity",
      },
    ],
  },
  {
    term: "Phantoms",
    syllables: "Phan·toms",
    respell: "[FAN-tumz]",
    pos: "n. pl.",
    meaning: "ghosts; shadowy figures (real or imagined)",
    meaningZh: "幻影；幽灵",
    examples: [
      {
        sentence: "He still felt phantom pain in his leg.",
        focus: "phantom pain",
      },
      {
        sentence: "She heard phantom sounds in the quiet room.",
        focus: "phantom sounds",
      },
    ],
  },
  {
    term: "Negligence",
    syllables: "Neg·li·gence",
    respell: "[NEG-lih-jens]",
    pos: "n.",
    meaning: "failure to take proper care; carelessness",
    meaningZh: "疏忽；过失",
    examples: [
      {
        sentence: "The report called it gross negligence.",
        focus: "gross negligence",
      },
      {
        sentence: "The family made a negligence claim after the fall.",
        focus: "negligence claim",
      },
    ],
  },
  {
    term: "Complicity",
    syllables: "Com·plic·i·ty",
    respell: "[kum-PLIS-ih-tee]",
    pos: "n.",
    meaning:
      "involvement in a wrongful act, especially by helping or allowing it",
    meaningZh: "共谋；同谋",
    examples: [
      {
        sentence: "Silence can become complicity in bullying.",
        focus: "complicity in bullying",
      },
      {
        sentence: "He denied complicity in the cheating.",
        focus: "complicity in the cheating",
      },
    ],
  },
];

const cloneDeck = () =>
  baseDeck.map((item) => ({
    ...item,
    examples: (item.examples ?? []).map((example) => ({ ...example })),
  }));

// Fisher-Yates shuffle; keeps the old last card away from the new first slot
// so a fresh pass never opens with the card that was just on screen.
const shuffleDeck = (deckArr) => {
  const next = [...deckArr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  const lastCard = deckArr[deckArr.length - 1];
  if (next.length > 1 && lastCard && next[0] === lastCard) {
    const swapIndex = 1 + Math.floor(Math.random() * (next.length - 1));
    [next[0], next[swapIndex]] = [next[swapIndex], next[0]];
  }
  return next;
};

const findTextRange = (source, query) => {
  const text = typeof source === "string" ? source : "";
  const needle = typeof query === "string" ? query.trim() : "";
  if (!text || !needle) return null;

  const start = text.toLowerCase().indexOf(needle.toLowerCase());
  if (start === -1) return null;

  return {
    start,
    end: start + needle.length,
  };
};

const getHighlightedSentence = (sentence, sentenceFocus, term) => {
  const match =
    findTextRange(sentence, sentenceFocus) ?? findTextRange(sentence, term);
  if (!match) return null;

  return {
    before: sentence.slice(0, match.start),
    highlight: sentence.slice(match.start, match.end),
    after: sentence.slice(match.end),
  };
};

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
      blob.stream().pipeThrough(stream),
    ).arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    const stream = new DecompressionStream("deflate");
    const buffer = await new Response(
      blob.stream().pipeThrough(stream),
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
      data.slice(nameStart, nameStart + fileNameLength),
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

const parseDeckFromText = (rawText) => {
  const text = rawText.replace(/^\uFEFF/, "");
  const candidates = extractJsonCandidates(text);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const deck = extractDeckFromParsed(parsed);
      if (deck && deck.length) {
        return deck;
      }
    } catch (error) {
      continue;
    }
  }
  throw new Error("无法识别内容，请确保包含 JSON 数组或 deck 字段。");
};

const normalizeEntry = (entry) => {
  const toText = (value) => (value == null ? "" : String(value)).trim();
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

    return sentence ? { sentence, focus } : null;
  };

  const rawExamples =
    entry?.examples ?? entry?.sentences ?? entry?.usageExamples ?? [];
  const examples = Array.isArray(rawExamples)
    ? rawExamples.map(normalizeExample).filter(Boolean).slice(0, 3)
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
    term: toText(entry?.term ?? entry?.word ?? entry?.name),
    syllables: toText(entry?.syllables),
    respell: toText(entry?.respell),
    pos: toText(entry?.pos),
    meaning: toText(entry?.meaning ?? entry?.definition),
    meaningZh: toText(
      entry?.meaningZh ?? entry?.meaning_zh ?? entry?.meaningZH,
    ),
    examples,
  };
};

const normalizeDeck = (importedDeck) =>
  importedDeck.map(normalizeEntry).filter((entry) => entry.term);

const readImportFile = async (file) => {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (name.endsWith(".docx") || type === DOCX_MIME) {
    return extractDocxText(file);
  }
  if (name.endsWith(".doc") || type === DOC_MIME) {
    throw new Error("暂不支持 .doc，请另存为 .docx 或直接粘贴。");
  }
  return file.text();
};

export default function App() {
  const [deck, setDeck] = useState(() => cloneDeck());
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [lastRemoved, setLastRemoved] = useState(null);
  const [noAnim, setNoAnim] = useState(false);
  const [shuffleOnLoop, setShuffleOnLoop] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importedDeckData, setImportedDeckData] = useState(null);
  const fileInputRef = useRef(null);
  const guidePanelRef = useRef(null);

  // ── Mode state ──────────────────────────────────────
  // 'study' | 'rest' | 'spell'
  const [mode, setMode] = useState("study");
  const [spellIndex, setSpellIndex] = useState(0);
  const [spellInput, setSpellInput] = useState("");
  const [spellResult, setSpellResult] = useState(null); // null | 'correct' | 'wrong'
  const [shakeKey, setShakeKey] = useState(0);

  const promptText = `你是英语词汇整理助手。请把用户提供的单词逐个补全为以下字段，并输出为可导入的 JSON 数组：

字段要求（严格遵守）：
- term: 单词，首字母大写
- syllables: 分节写法（用中点分隔）
- respell: 发音重拼（用方括号包裹）
- pos: 词性缩写（如 "n.", "v.", "adj.", "adv."）
- meaning: 英文简明释义
- meaningZh: 中文释义
- examples: 例句数组，必须提供 2-3 个对象
  - sentence: 例句，必须自然、简洁，适合 B1-B2 学习者理解
  - focus: 例句中需要加粗显示的原文片段，必须与 sentence 中的字符完全一致

例句要求：
- 优先使用学校、家庭、商店、工作、出行等日常语境
- 尽量用短句，方便直接看懂上下文
- 除目标词外，不要再塞进多个难词
- 除非词本身必须如此，否则避免法律、政治、新闻、学术语境

输出格式示例（仅 JSON，不要多余文字）：
[
  {
    "term": "Example",
    "syllables": "Ex·am·ple",
    "respell": "[ig-ZAM-puhl]",
    "pos": "n.",
    "meaning": "a thing that illustrates a rule",
    "meaningZh": "例子；示例",
    "examples": [
      {
        "sentence": "This is a clear example of the rule.",
        "focus": "clear example"
      },
      {
        "sentence": "The teacher gave another example in class.",
        "focus": "another example"
      }
    ]
  }
]

不要输出 phrases / sentence / sentenceFocus 这些旧字段。一定确保每条 example 的 sentence 中原样包含 focus。

一定记得需要以代码块的方式输出 JSON 文件以便用户导入。`;

  const runInstantly = useCallback((action) => {
    setNoAnim(true);
    action();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNoAnim(false);
      });
    });
  }, []);

  const toggleReveal = useCallback(() => {
    if (!deck.length) return;
    setRevealed((prev) => !prev);
  }, [deck.length]);

  const nextCard = useCallback(() => {
    if (!deck.length) return;
    runInstantly(() => {
      // Wrapping past the last card starts a new pass — shuffle it first.
      if (shuffleOnLoop && deck.length > 1 && index === deck.length - 1) {
        setDeck((prev) => shuffleDeck(prev));
      }
      setIndex((prev) => (prev + 1) % deck.length);
      setRevealed(false);
    });
  }, [deck.length, index, shuffleOnLoop, runInstantly]);

  const prevCard = useCallback(() => {
    if (!deck.length) return;
    runInstantly(() => {
      setIndex((prev) => (prev - 1 + deck.length) % deck.length);
      setRevealed(false);
    });
  }, [deck.length, runInstantly]);

  // ── Mode helpers ────────────────────────────────────
  const enterRestMode = useCallback(() => {
    setMode("rest");
    setRevealed(false);
  }, []);

  const enterStudyMode = useCallback(() => {
    // Fresh pass from card 1 (from rest or after finishing spell) — shuffle
    // when the toggle is on.
    if (shuffleOnLoop && deck.length > 1) {
      setDeck((prev) => shuffleDeck(prev));
    }
    setMode("study");
    setIndex(0);
    setRevealed(false);
  }, [deck.length, shuffleOnLoop]);

  const enterSpellMode = useCallback(() => {
    setMode("spell");
    setSpellIndex(0);
    setSpellInput("");
    setSpellResult(null);
  }, []);

  const removeCard = useCallback(() => {
    if (!deck.length) return;
    runInstantly(() => {
      setDeck((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        const removedIndex = index;
        const [removed] = next.splice(removedIndex, 1);
        setLastRemoved({ item: removed, index: removedIndex });
        let nextIndex = removedIndex;
        if (nextIndex >= next.length) {
          nextIndex = 0;
        }
        setIndex(nextIndex);
        return next;
      });
      setRevealed(false);
    });
  }, [deck.length, index, runInstantly]);

  const undoRemove = useCallback(() => {
    if (!lastRemoved) return;
    runInstantly(() => {
      setDeck((prev) => {
        const next = [...prev];
        const insertIndex = Math.min(lastRemoved.index, next.length);
        next.splice(insertIndex, 0, lastRemoved.item);
        setIndex(insertIndex);
        return next;
      });
      setLastRemoved(null);
      setRevealed(false);
    });
  }, [lastRemoved, runInstantly]);

  const resetDeck = useCallback(() => {
    runInstantly(() => {
      setDeck(cloneDeck());
      setIndex(0);
      setRevealed(false);
      setLastRemoved(null);
      setMode("study");
    });
  }, [runInstantly]);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const rawText = await readImportFile(file);
        const importedDeck = parseDeckFromText(rawText);
        const normalized = normalizeDeck(importedDeck);
        if (!normalized.length) {
          throw new Error("内容中没有有效的单词。");
        }
        runInstantly(() => {
          setDeck(normalized);
          setIndex(0);
          setRevealed(false);
          setLastRemoved(null);
        });
        setImportMessage(`已导入 ${normalized.length} 个单词。`);
      } catch (error) {
        setImportMessage(`导入失败：${error?.message || "无法解析文件内容。"}`);
      } finally {
        event.target.value = "";
      }
    },
    [runInstantly],
  );

  const handlePasteImport = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setImportMessage("请先粘贴需要导入的内容。");
      return;
    }
    try {
      const importedDeck = parseDeckFromText(trimmed);
      const normalized = normalizeDeck(importedDeck);
      if (!normalized.length) {
        throw new Error("内容中没有有效的单词。");
      }
      runInstantly(() => {
        setDeck(normalized);
        setIndex(0);
        setRevealed(false);
        setLastRemoved(null);
      });
      setImportedDeckData(normalized);
      setImportMessage(`已导入 ${normalized.length} 个单词。`);
    } catch (error) {
      setImportedDeckData(null);
      setImportMessage(`导入失败：${error?.message || "无法识别粘贴内容。"}`);
    }
  }, [pasteText, runInstantly]);

  const handleExportJson = useCallback(() => {
    if (!importedDeckData) return;
    const json = JSON.stringify(importedDeckData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocab-deck.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [importedDeckData]);

  const handleExportMd = useCallback(() => {
    if (!importedDeckData) return;
    const lines = importedDeckData.map((entry) => {
      const exampleLines = (entry.examples ?? []).flatMap((example, index) =>
        [
          example?.sentence
            ? `- Sentence ${index + 1}: ${example.sentence}`
            : "",
          example?.focus ? `- Focus ${index + 1}: ${example.focus}` : "",
        ].filter(Boolean),
      );
      const body = [
        entry.pos ? `- POS: ${entry.pos}` : "",
        entry.syllables ? `- Syllables: ${entry.syllables}` : "",
        entry.respell ? `- Respell: ${entry.respell}` : "",
        entry.meaning ? `- Meaning (EN): ${entry.meaning}` : "",
        entry.meaningZh ? `- Meaning (ZH): ${entry.meaningZh}` : "",
        ...exampleLines,
      ].filter(Boolean);
      return [`[${entry.term}]`, "", ...body].join("\n");
    });
    const md = lines.join("\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocab-deck.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [importedDeckData]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setImportMessage("提示词已复制到剪贴板。");
    } catch (error) {
      setImportMessage("复制失败，请手动复制提示词。");
    }
  };

  useEffect(() => {
    const handleKeydown = (event) => {
      if (guideOpen) return;
      if (guidePanelRef.current?.contains(document.activeElement)) return;

      // ── REST mode ──────────────────────────────────
      if (mode === "rest") {
        if (event.code === "Enter") {
          event.preventDefault();
          enterStudyMode();
        } else if (event.code === "Space") {
          event.preventDefault();
          enterSpellMode();
        }
        return;
      }

      // ── SPELL mode ─────────────────────────────────
      if (mode === "spell") {
        const key = event.key;

        if (event.code === "Escape") {
          event.preventDefault();
          setMode("study");
          return;
        }

        if (event.code === "Enter") {
          event.preventDefault();
          if (spellResult === "correct") {
            // Advance to next spell word
            if (spellIndex + 1 >= deck.length) {
              // Done with all words
              enterStudyMode();
            } else {
              setSpellIndex((prev) => prev + 1);
              setSpellInput("");
              setSpellResult(null);
            }
          } else if (spellResult === "wrong") {
            // Shake again
            setShakeKey((prev) => prev + 1);
          } else {
            // Submit
            const target = (deck[spellIndex]?.term ?? "").toLowerCase();
            if (spellInput.toLowerCase() === target) {
              setSpellResult("correct");
            } else {
              setSpellResult("wrong");
              setShakeKey((prev) => prev + 1);
            }
          }
          return;
        }

        if (event.code === "Backspace") {
          event.preventDefault();
          if (spellResult !== "correct") {
            setSpellInput((prev) => prev.slice(0, -1));
            setSpellResult(null);
          }
          return;
        }

        // Letter keys and space — single printable character
        if (key.length === 1 && /[a-zA-Z' -]/.test(key)) {
          event.preventDefault();
          if (spellResult === "correct") return;
          if (spellResult === "wrong") {
            // Start over from this letter
            setSpellInput(key);
            setSpellResult(null);
          } else {
            setSpellInput((prev) => prev + key);
          }
          return;
        }

        return;
      }

      // ── STUDY mode (default) ────────────────────────
      if (event.code === "Space") {
        event.preventDefault();
        toggleReveal();
      } else if (event.code === "Tab") {
        event.preventDefault();
        prevCard();
      } else if (event.code === "Enter") {
        event.preventDefault();
        if (revealed) {
          // Last card + revealed → enter rest mode
          if (index === deck.length - 1) {
            enterRestMode();
          } else {
            nextCard();
          }
        } else {
          toggleReveal();
        }
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        prevCard();
      } else if (event.code === "Delete" || event.code === "Backspace") {
        event.preventDefault();
        removeCard();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [
    deck,
    guideOpen,
    index,
    mode,
    nextCard,
    prevCard,
    removeCard,
    revealed,
    spellIndex,
    spellInput,
    spellResult,
    toggleReveal,
    enterRestMode,
    enterStudyMode,
    enterSpellMode,
  ]);

  const hasDeck = deck.length > 0;
  const item = hasDeck ? deck[index] : null;
  const term = hasDeck
    ? revealed
      ? item?.syllables || item?.term
      : item?.term
    : "No words loaded";
  const posTag = item?.pos || "";
  const meaningText = item
    ? [item.meaning, item.meaningZh].filter(Boolean).join(" / ")
    : "";
  const examples = item?.examples ?? [];
  const respell = item?.respell || "";
  const showDetails = revealed && hasDeck;
  const hint = hasDeck
    ? revealed
      ? "Enter for next, Space hides, Tab/<- for previous, Delete removes"
      : "Enter or Space reveals meaning + example sentences"
    : "Deck empty. Press Reset to reload.";
  const activeProgressPosition = hasDeck
    ? mode === "spell"
      ? spellIndex + 1
      : index + 1
    : 0;
  const progress = hasDeck ? activeProgressPosition / deck.length : 0;
  const progressLabel = hasDeck
    ? `${activeProgressPosition} / ${deck.length}`
    : "0 / 0";

  const cardClassName = useMemo(() => {
    return `card${noAnim ? " no-anim" : ""}`;
  }, [noAnim]);

  return (
    <main className="shell">
      <a
        href="https://github.com/Ganzhe2028/vocab2"
        target="_blank"
        rel="noopener noreferrer"
        className="github-btn"
        title="View on GitHub"
        aria-label="View on GitHub"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
            -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
            .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
            -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
            .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
            .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
            0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
      <header>
        <div className="title-row">
          <h1>Vocabulary Loop</h1>
          <div className="header-actions">
            <button type="button" onClick={handleImportClick}>
              Import
            </button>
            <button type="button" onClick={() => setGuideOpen(true)}>
              Guidebook
            </button>
          </div>
        </div>
        <div className="subhead">
          Flashcard flow: Enter reveals, Enter again goes next. Space hides or
          reveals. Tab or &lt;- goes previous. Delete removes. Tap the card if
          you are on mobile.
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,.txt,.doc,.docx,application/json,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          onChange={handleImportFile}
          className="file-input"
        />
        {importMessage ? (
          <div className="import-message">{importMessage}</div>
        ) : null}
      </header>

      {guideOpen ? (
        <div className="guide-overlay" onClick={() => setGuideOpen(false)}>
          <section
            className="guide-panel"
            role="dialog"
            aria-modal="true"
            ref={guidePanelRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="guide-header">
              <h2>使用指南</h2>
              <button type="button" onClick={() => setGuideOpen(false)}>
                关闭
              </button>
            </div>

            {/* ── 导入词库 ── */}
            <div className="guide-section">
              <h3 className="guide-section-title">📥 导入你的单词</h3>

              {/* Step 1 */}
              <div className="guide-step">
                <div className="guide-step-num">1</div>
                <div className="guide-step-body">
                  <div className="guide-step-title">准备好你的单词表</div>
                  <p className="guide-step-desc">
                    把你要背的单词整理成一行一个的列表，可以直接复制课本或笔记里的单词，不需要任何格式。
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="guide-step">
                <div className="guide-step-num">2</div>
                <div className="guide-step-body">
                  <div className="guide-step-title">
                    复制提示词，发给 DeepSeek 或 ChatGPT
                  </div>
                  <p className="guide-step-desc">
                    点下方「复制提示词」，让 AI 按 B1-B2 难度生成更容易理解的例句词卡。
                  </p>
                  <button
                    className="primary guide-step-btn"
                    type="button"
                    onClick={handleCopyPrompt}
                  >
                    复制提示词
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="guide-step">
                <div className="guide-step-num">3</div>
                <div className="guide-step-body">
                  <div className="guide-step-title">把 AI 的回复粘贴进来</div>
                  <p className="guide-step-desc">
                    AI 会生成一段包含 2-3 条日常语境例句和高亮片段的 JSON 代码，把它全选复制，粘贴到下方输入框。
                  </p>
                  <div className="paste-block">
                    <textarea
                      id="paste-input"
                      className="paste-textarea"
                      placeholder="把 AI 生成的内容粘贴到这里…"
                      value={pasteText}
                      onChange={(event) => setPasteText(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="guide-step">
                <div className="guide-step-num">4</div>
                <div className="guide-step-body">
                  <div className="guide-step-title">点「导入」，开始刷词！</div>
                  <p className="guide-step-desc">
                    导入成功后关掉这个面板，就能看到你的单词卡了。
                  </p>
                  <div className="paste-actions">
                    <button
                      className="primary guide-step-btn"
                      type="button"
                      onClick={handlePasteImport}
                      disabled={!pasteText.trim()}
                    >
                      识别并导入
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasteText("");
                        setImportedDeckData(null);
                      }}
                      disabled={!pasteText.trim()}
                    >
                      清空
                    </button>
                  </div>
                  {importedDeckData && (
                    <div className="export-actions">
                      <span className="export-label">
                        ✅ 导入成功，保存副本：
                      </span>
                      <button
                        type="button"
                        className="export-btn"
                        onClick={handleExportJson}
                        title="下载 JSON 文件"
                      >
                        ⬇ JSON
                      </button>
                      <button
                        type="button"
                        className="export-btn"
                        onClick={handleExportMd}
                        title="下载 Markdown 文件"
                      >
                        ⬇ Markdown
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 也可以直接上传文件 */}
              <p className="guide-alt-import">
                已有 <code>.json / .txt / .docx</code> 文件？
                <button
                  type="button"
                  className="guide-link-btn"
                  onClick={handleImportClick}
                >
                  直接上传
                </button>
              </p>
            </div>

            <hr className="guide-divider" />

            {/* ── 怎么用（折叠） ── */}
            <details className="guide-details">
              <summary className="guide-details-summary">📖 怎么用</summary>

              <div className="guide-section guide-details-body">
                <div className="guide-mode-block">
                  <div className="guide-mode-badge">刷词模式</div>
                  <p className="guide-mode-desc">
                    默认状态，每次显示一张单词卡。
                  </p>
                  <ul className="guide-key-list">
                    <li>
                      <kbd>Space</kbd> 或 <kbd>Enter</kbd> — 翻开释义和 2-3
                      条例句 / 隐藏
                    </li>
                    <li>
                      翻开后再按 <kbd>Enter</kbd> — 进入下一张
                    </li>
                    <li>
                      <kbd>Tab</kbd> 或 <kbd>←</kbd> — 上一张
                    </li>
                    <li>
                      <kbd>Delete</kbd> — 从本轮移除当前单词
                    </li>
                    <li>
                      刷完最后一张后按 <kbd>Enter</kbd> — 进入休息屏
                    </li>
                    <li>
                      每轮从头开始时自动打乱顺序，底部 Shuffle Loop 按钮可关闭
                    </li>
                  </ul>
                  <p className="guide-mobile-tip">
                    📱 手机：直接点卡片翻面，用底部按钮切换。
                  </p>
                </div>

                <div className="guide-mode-block">
                  <div className="guide-mode-badge guide-mode-badge--spell">
                    随手拼模式
                  </div>
                  <p className="guide-mode-desc">
                    刷完一轮后，在休息屏按 <kbd>Space</kbd> 进入。
                    <br />
                    屏幕只显示词义，你需要凭记忆键入单词拼写。
                  </p>
                  <ul className="guide-key-list">
                    <li>直接键入字母（及空格）— 累积输入</li>
                    <li>
                      <kbd>Enter</kbd> — 提交答案
                    </li>
                    <li>
                      答对后按 <kbd>Enter</kbd> — 下一个词
                    </li>
                    <li>答错后继续键入 — 自动清空重拼</li>
                    <li>
                      <kbd>Backspace</kbd> — 删除最后一个字符
                    </li>
                    <li>
                      <kbd>Esc</kbd> — 退出，回到刷词模式
                    </li>
                  </ul>
                </div>
              </div>
            </details>
          </section>
        </div>
      ) : null}

      {/* ── Rest Screen ── */}
      {mode === "rest" && (
        <section className={`card rest-screen`} aria-live="polite">
          <h2 className="rest-title">随手拼？</h2>
          <p className="rest-subtitle">
            enter 继续刷词 &nbsp;/&nbsp; space 开始随手拼
          </p>
        </section>
      )}

      {/* ── Spell Mode ── */}
      {mode === "spell" &&
        (() => {
          const spellItem = deck[spellIndex] ?? null;
          const spellPos = spellItem?.pos || "";
          const spellMeaning = spellItem
            ? [spellItem.meaning, spellItem.meaningZh].filter(Boolean).join(" / ")
            : "";
          const spellCorrectDisplay =
            spellItem?.syllables || spellItem?.term || "";
          return (
            <section className={`card spell-card`} aria-live="polite">
              <div className="hint">
                {spellResult === "correct"
                  ? "enter 下一个"
                  : spellResult === "wrong"
                    ? "继续键入重拼 / enter 再shake / esc 退出"
                    : "键入单词 · enter 提交 · esc 退出"}
              </div>

              {/* Meaning only — no word shown */}
              <p className="meaning">
                {spellPos ? <span className="pos-tag">{spellPos}</span> : null}
                <span>{spellMeaning}</span>
              </p>

              {/* Live input display */}
              <div className="spell-input-row">
                <div
                  className={`spell-input-display${
                    spellResult === "correct"
                      ? " correct"
                      : spellResult === "wrong"
                        ? " wrong"
                        : ""
                  }`}
                  key={shakeKey}
                >
                  {spellInput}
                  {spellResult !== "correct" && (
                    <span className="spell-cursor" key={spellInput.length} />
                  )}
                </div>
              </div>

              {/* Answer revealed after submit */}
              {spellResult && (
                <p className="spell-answer">{spellCorrectDisplay}</p>
              )}

              <div className="spell-progress">{progressLabel}</div>
            </section>
          );
        })()}

      {/* ── Study Card ── */}
      {mode === "study" && (
        <section
          className={cardClassName}
          aria-live="polite"
          onClick={toggleReveal}
        >
          <div className="hint">{hint}</div>
          <div className="term-row">
            <h2 className="term">{term}</h2>
            <div className={`pronounce${showDetails ? "" : " is-hidden"}`}>
              <div className="pronounce-value">{respell}</div>
            </div>
          </div>
          <p className={`meaning${showDetails ? "" : " is-hidden"}`}>
            {posTag ? <span className="pos-tag">{posTag}</span> : null}
            <span>{meaningText}</span>
          </p>
          {examples.length ? (
            <ul
              className={`examples${showDetails ? "" : " is-hidden"}`}
              aria-label="Example sentences"
            >
              {examples.map((example, exampleIndex) => {
                const sentenceHighlight = getHighlightedSentence(
                  example?.sentence,
                  example?.focus,
                  item?.term,
                );

                return (
                  <li
                    key={`${example?.sentence ?? "example"}-${exampleIndex}`}
                    className="example-item"
                  >
                    {sentenceHighlight ? (
                      <>
                        {sentenceHighlight.before}
                        <strong>{sentenceHighlight.highlight}</strong>
                        {sentenceHighlight.after}
                      </>
                    ) : (
                      example?.sentence
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      )}

      <section className="meta">
        <div className="progress">
          <div className="progress-bar">
            <span style={{ transform: `scaleX(${progress})` }}></span>
          </div>
          <div className="count">{progressLabel}</div>
        </div>
        <div className="controls">
          <button className="primary" type="button" onClick={toggleReveal}>
            {revealed ? "Hide (Space)" : "Reveal (Space)"}
          </button>
          <button type="button" onClick={prevCard}>
            Prev (Tab / &lt;-)
          </button>
          <button type="button" onClick={nextCard}>
            Next (Enter)
          </button>
          <button type="button" onClick={removeCard}>
            Remove (Delete)
          </button>
          <button type="button" onClick={undoRemove} disabled={!lastRemoved}>
            Undo Remove
          </button>
          <button
            type="button"
            className={shuffleOnLoop ? "primary" : undefined}
            aria-pressed={shuffleOnLoop}
            onClick={() => setShuffleOnLoop((prev) => !prev)}
          >
            Shuffle Loop: {shuffleOnLoop ? "On" : "Off"}
          </button>
          <button type="button" onClick={resetDeck}>
            Reset Deck
          </button>
        </div>
        <div className="loop">Looping deck: on</div>
      </section>

      <div className="footer-note">
        No limits — keep cycling as long as you want.
      </div>
    </main>
  );
}
