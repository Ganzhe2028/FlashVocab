# FlashVocab 技术文档

面向要改代码、要接流程、要判断「这个改动会不会弄坏学习契约」的人。用户视角的说明在根目录 [README](../README.md)，当前行为规格见 [AGENTS.md](../AGENTS.md) 和 [docs/](.) 下的规格文档。

## 目录

1. [技术栈与产物](#1-技术栈与产物)
2. [目录结构](#2-目录结构)
3. [运行时架构](#3-运行时架构)
4. [数据模型与存储](#4-数据模型与存储)
5. [学习算法](#5-学习算法)
6. [导入管线](#6-导入管线)
7. [导入时的 AI 补全](#7-导入时的-ai-补全)
8. [可选的 DeepSeek 进阶补全](#8-可选的-deepseek-进阶补全)
9. [题目生成](#9-题目生成)
10. [发音](#10-发音)
11. [测试与 CI](#11-测试与-ci)
12. [构建、部署与维护](#12-构建部署与维护)
13. [常见改动的落点](#13-常见改动的落点)

## 1. 技术栈与产物

- **React 18 + Vite 8** 的单页应用，没有 router、没有状态管理库、没有 UI 组件库、没有 CSS 框架。
- 运行时依赖只有 `react` 和 `react-dom`。Office 文件的解包、XML 解析、CSV/文本解析全部手写在仓库里，没有引入 `jszip` / `xlsx` / `papaparse`。
- 引擎要求：Node `^20.19.0 || >=22.12.0`（Vite 8 的要求）。本机默认 `node` 可能偏旧，用 Homebrew 的 `node@22` 跑构建更稳。
- 构建产物在 `dist/`，**已纳入版本控制**，发布前需 `npm run build` 后一起提交。
- 线上：<https://bdc.isaacbao.cn>（静态托管，无后端）。

## 2. 目录结构

```
src/
  App.jsx                 组合 reducer、持有存储/剪贴板/下载/发音等全部副作用
  learningAlgorithm.js    状态机、队列、评分、休整、Undo 槽
  mastery.js              掌握度、优先级、毕业判定
  waveModel.js            词表波次（分组）元数据
  questionBuilder.js      四种练习题的构建与选项洗牌
  aiPreparation.js        可选 DeepSeek 进阶补全（六词一批）
  memorySketch.js         记忆图数据结构校验（保留能力，认词页不渲染）
  components/
    ImportView.jsx        三步向导、识别预览、AI 补全、worksheet 救援
    StudyView.jsx         认词
    SpellView.jsx         拼写
    QuestionView.jsx      专项练习
    StatusView.jsx        结算页 / 毕业页
    ManagePanel.jsx       词表 / 设置 / 帮助三段式面板
    AIPreparationControls.jsx
    MemoryPicture.jsx     本地 SVG 记忆图渲染器（当前未挂载）
  hooks/
    useAppKeyboard.js     全局快捷键
    useQuietChrome.js     周边元素自动隐退
    usePronunciation.js   Web Speech 发音
    useThemePreference.js 外观偏好
  storage/
    learningStorage.js    词表与移出记录的持久化与校验
    masteryStorage.js     掌握度的持久化与校验
  utils/
    deckImport.js         文件解包、文本解析、导出
    jsonDeck.js           固定 JSON 校验和模板
    importFill.js         导入时补全的提示词、解析、合并、校验、worksheet 检测
  data/baseDeck.js        内置 24 词示例词表
  prompts/                复制给 AI 的提示词模板（深度理解）
docs/                     规格、设计、以及每次改版的验证证据
vocab.md                  内置词表的人工可读版本
Updates.md                面向用户和开发者的版本变更
AGENTS.md                 开发约定与当前行为契约（每次任务开始先读）
```

## 3. 运行时架构

**单一 reducer + 一个 mode。** 状态机的 `mode` 取值是 `prepare | study | spell | pause | summary | quiz | mastered | empty`，视图完全由它决定，没有路由。

**副作用全部收敛在 `App.jsx`**：localStorage 读写、剪贴板、文件下载、发音、AI 请求、Undo 计时。子组件只发 action。

**事件分发里只计算一次 transition。** 学习相关的发音必须和触发它的那次按键同步，所以 `App.jsx` 先在事件处理器里算出下一个 state，念完再提交；不允许在 effect 里补发音（原因见[发音](#10-发音)）。

**Undo 是单个内存槽**，不落盘。加词表、改名、收起、移出、找回、补全、重置共用它；离开页面即失效。

## 4. 数据模型与存储

### 卡片（card）

`src/data/baseDeck.js` 与导入结果使用同一个形状：

| 字段 | 说明 |
| --- | --- |
| `term` | 单词，展示用 Title Case |
| `pos` / `syllables` / `respell` | 词性、音节（`va·cant`）、注音（`[VAY-kunt]`） |
| `meaning` / `meaningZh` | 英文释义 / 中文释义 |
| `examples[]` | `{ sentence, focus }`，`focus` 必须是 `sentence` 的原样子串 |
| `wordOrigin` / `relatedWord` | 中文词源；对应词（`English word — 中文区别`） |
| `miniScenario` / `contrastScenarios[]` | 情景题与辨析题材料 |
| `distractors[]` / `usageTags[]` / `microScene` / `memorySketch` | 进阶补全生成的可选材料，可随导出往返 |
| `waveId` | 所属词表波次 |

### 稳定 ID

`createCardIds()` 用 `term + pos + meaning + meaningZh`（非 legacy 波次再加 `waveId`）做 FNV-1a 哈希，同签名的重复词追加序号，得到 `card-<hash36>-<n>`。ID 是掌握度、移出记录、Undo 的锚点，**改这个签名等于让所有历史掌握度错位**，属于破坏性改动。

### 存储键

| 键 | 内容 | 版本 |
| --- | --- | --- |
| `flashvocab-3-assets-v1` | `{ version, sourceDeck, removedCardIds, waves }` | schema `2` |
| `flashvocab-mastery-v1` | 每词 `{ streak, mistakes, fuzzy, lastSeen }` | — |
| `flashvocab-theme-v1` | `system` / `light` / `dark` | — |
| `vocab2-learning-v1` | 旧版词表与移出记录，只读、不删 | legacy |

- schema `1` 读入时迁移成无日期的 W1 波次，ID 与移出记录不变。
- 当前键不存在时才回退读 legacy 键；两个键都不写回旧键。
- 写入前都经过 `normalize*` 校验，损坏的数据整体丢弃并给出提示，不做部分修补。
- 刷新页面会重置会话态（队列、当前卡、答案展开、拼写输入、偏好、Undo、API key），但保留上述三个键。

## 5. 学习算法

### 一轮的队列

`buildRoundCardIds()`：

1. 过滤：移出的词、认词模式下已毕业的词、`hidden && dueRound > round` 的词。
2. 洗牌（可注入 `random` 以便测试）。
3. 认词模式再按 `compareMastery` 稳定排序：**待巩固 → 未见 → 渐稳**，同档内按 streak、错误次数、上次见面时间。
4. 如果第一张和上一轮第一张相同，在同优先级里换一张，避免连续两轮同一个词开场。

### 休整（rest）

`recordReview()` 每张卡每个模式独立记 `{ streak, hidden, dueRound, lastScoredRound }`：

- 答对：`streak + 1`；`streak + 1 >= 2` 时进入休整，`dueRound = round + 2`（**歇一整轮，再下一轮回来**）。
- 休整中的词答对：继续休整，重新排到 `round + 2`。
- 答错：`streak = 0`，清掉休整与 `dueRound`，只释放当前模式。
- 同一轮内同一张卡重复出现不会重复计分（`lastScoredRound` 拦截）。

加练（第一遍标「不认识」后本轮内的两次额外曝光）走另一条路径，**不计分、不影响休整**，所以刷两遍不会把词刷成「掌握」。

### 掌握度与毕业

`mastery.js`：

- 只有认词首判和专项练习首答进掌握度，拼写和加练不进。
- `streak >= 3` 毕业（连续三次独立轮次/题组答对），毕业词从认词队列移除，可手动找回，找回会重置 streak 和休整。
- 优先级函数 `masteryPriority()`：`weak(0) < unseen(1) < steady(2)`。

### 空轮保护

一整轮都没有可推进的卡时，`findNextUnscoredCardIndex()` 返回 `-1`，reducer 走「本轮完成」而不是死循环。轮次推进有上界。

## 6. 导入管线

正式导入统一调用 `src/utils/jsonDeck.js` 的 `parseJsonDeck()`。上传只接受 `.json` 文件并调用 `file.text()`；粘贴和 AI 转换结果走同一校验。JSON 必须是非空数组，每项 term 是非空字符串，meaning / meaningZh 至少一个非空。模板由同模块的 `JSON_TEMPLATE` 提供下载并用于提示词，字段名固定，不接受别名、包装对象、代码围栏或说明文字。

可选文本字段必须是字符串，examples 必须是 sentence/focus 对象数组且 focus 在 sentence 中原样出现（允许空 focus）；distractors/usageTags 是字符串数组；contrastScenarios 是 scenario/answer/explanation 对象数组。未知自定义字段保留。校验整份通过才进入预览，一条有错就整份拒绝并指出序号和字段，不静默跳词。预览不保存，明确开始才提交。

`deckImport.js` 保留历史文本/Office 工具和旧存储 normalization，不再供界面直接猜测导入格式。已有资产的兼容读取不变；旧数据中误作单个例句的英文定义仍会修复。非 JSON 材料可通过显式 AI 转换入口生成固定 JSON 后预览，不做 worksheet 猜测。

## 7. 导入时的 AI 补全

`src/utils/importFill.js`，纯前端、不联网——它只生成可复制的文字，并接收用户粘回来的文字。

| 函数 | 职责 |
| --- | --- |
| `needsFillMaterial(entry)` | 判断一个词是否缺「中文 / 英文释义、可出题的例句、对应词、辨析材料」 |
| `buildFillPrompt(entries)` | 只列缺资料的词，输出固定 JSON 数组（词义、词源、对应词、两组原形例句/重点、情景、辨析） |
| `buildWorksheetPrompt()` | worksheet 路径：先要求 AI 完成配对，再按同一套字段输出 |
| `parseMaterialReply(text)` | 调用 parseJsonDeck，同正式导入使用一套严格 JSON 校验 |
| `mergeFilledEntries()` | 按词（大小写不敏感）只填缺失字段，不覆盖已有内容 |
| `detectWorksheetMismatch()` | 历史检测工具；当前导入界面不再猜测 |

合并校验（任一不通过就丢弃该词该字段，不写入）：

- 例句必须包含**原形**词，且 `focus` 能在句中验证；
- 情景不得出现目标词或对应词（出现等于把答案写在题面上）；
- 辨析答案必须属于目标词和它的 `relatedWord`；
- 只有字段标签、没有任何词条起头的回复视为格式错误，防止把 `POS:`、`Meaning (ZH):` 写成伪单词。

返回值 `{ filled, remaining }`：完整 JSON 数组内的部分词条批次可以接受；语法截断则整份拒绝，面板保持打开并允许再次复制补齐剩余词；全部补齐后面板收起。

## 8. 可选的 DeepSeek 进阶补全

`src/aiPreparation.js`，与上一节互不依赖：

- 端点 `https://api.deepseek.com/chat/completions`，默认模型 `deepseek-flash`，用户可改。
- 只在「词表 → 用 DeepSeek 补全资料（进阶）」里出现，导入流程永远不会等它。
- 六词一批，请求记忆短句、记忆图结构化数据、干扰词、用法标签、短情景与双向辨析；返回按 JSON 严格校验（词条身份、长度、focus 例句、两个辨析答案）。
- API key 只存在 `App` 内存里，不进 deck state、不进导出、不进 localStorage，刷新即清空。
- 整批成功才应用；失败、取消、超时或期间词表发生变化都保留原词表，不自动重试。

## 9. 题目生成

`src/questionBuilder.js` 在**进入每道题时现场生成**，不读取导入时预置的选项位置：

| kind | 题干 | 答案 | 干扰项来源 |
| --- | --- | --- | --- |
| `mcq` 看释义选词 | `miniScenario`，缺则 `meaning` / `meaningZh` | `term` | 对应词 → `distractors` → 当前词表随机，最多 3 个 |
| `scenario` 看情景选词 | 例句里把目标词按整词替换成 `____`（不猜变形） | `term` | 同 `mcq` |
| `wordBank` 填搭配 | 例句挖掉 `focus` 短语 | `focus` | 当前词表全部不同词 + 至多 3 个旧表/对应/高混淆词 |
| `contrast` 辨析近义词 | `miniScenario` / `contrastScenarios` 分界线情景 | 二选一 | 目标词与其对应词，位置每次洗牌 |

材料不足时构造器返回 `null`，视图显示缺料原因和补全入口，而不是出一道坏题。选项每次进入重新洗牌；数字键 `1`–`9` 只映射前九项，其余走原生 Tab / 点击。作答后选项立即锁定，防止重复计分。

## 10. 发音

`src/hooks/usePronunciation.js`，几个必须守住的点：

- 学习动作触发的语音必须**在该事件的同步栈里**调用 `speak()`，不能在 effect 里补。
- 激活中的 `utterance` 保持引用直到 `end` / `error`，释放靠事件，不靠 React cleanup。
- **不要**在空闲或 cleanup 里调用浏览器全局 `speechSynthesis.cancel()`：Strict Mode 和 Vite HMR 的正常 cleanup 会把 Chromium 进程级的 TTS 顶住，刷新页面也修不回来，只能整个重启浏览器。
- 选音优先 `Google US English`，其次自然的 macOS / Microsoft 美式语音，排除 Albert、Whisper、Zarvox 这类效果音。
- 播放态是按钮自己的动画类（`is-speaking`），不是文字提示；另有一条视觉隐藏的 `aria-live` 行给读屏。
- 4 秒内没有 `start` 事件就收起动画并显示失败提示，只有最新一条 utterance 有权限清除状态。
- `speechSynthesis.speaking === true` 不能证明真的出声，验证必须同时记录 `start` 与 `end` / `error` 并用耳朵听一次。

## 11. 测试与 CI

```
npm run lint        ESLint（eslint.config.js）
npm run test:unit   node:test，纯逻辑、解析、存储、hooks
npm run test:ui     Vitest + jsdom + Testing Library，src/App.test.jsx
npm run build       Vite 生产构建
npm run check       以上四步串联，交付门槛
```

当前基线：**94 项 Node 测试、66 项 UI 测试、ESLint、生产构建全绿**（2026-10-29 复核；旧多格式 AI 回复测试已替换为 JSON 校验和原子失败测试）。

测试与模块同目录（`*.test.js` / `*.test.jsx`），UI 环境配置在 `src/test/setup.js`。逻辑测试注入固定 `random` 和固定时间，不依赖真实随机数。

`.github/workflows/ci.yml`：push 与 PR 触发，ubuntu-latest + Node 22，`npm ci` 后跑 `npm run check`。

行为改动光跑测试不够：涉及布局、发音、导入的改动要在真实 Chrome 里跑生产构建验证，并把截图和日志放进 `docs/validation-<date>/`。已有证据目录：`validation-2026-09-07`、`validation-2026-10-20`、`validation-2026-10-26`、`validation-2026-10-27`、`validation-2026-10-27-pronunciation`、`validation-2026-10-27-practice-fill`。

## 12. 构建、部署与维护

- `npm run build` 生成 `dist/`，该目录**被 git 跟踪**；改了 `src/` 就要重新构建并一起提交，否则线上和仓库不一致。
- 线上是纯静态托管 `bdc.isaacbao.cn`，没有服务端，也没有环境变量；`index.html` 内联一段读取 `flashvocab-theme-v1` 的脚本，在首帧前定好主题，避免闪白。
- 文档纪律（见 [AGENTS.md](../AGENTS.md)）：任何行为改动都要同步更新对应规格文档、`Updates.md` 与本文件的测试基线；带着过时的数字提交等于制造假证据。
- 文档里有编号摘要时，每个编号都要锚到对应详述段落。

## 13. 常见改动的落点

| 想做的事 | 先看这里 |
| --- | --- |
| 改认词 / 拼写的流程或快捷键 | `learningAlgorithm.js` 的 reducer + `hooks/useAppKeyboard.js`，再改 `App.test.jsx` |
| 改休整、毕业、排序规则 | `learningAlgorithm.js` 的 `recordReview` / `buildRoundCardIds`、`mastery.js` |
| 支持一种新的文件格式 | `utils/deckImport.js` 的文件层 + 文本层，配套 `deckImport.test.js` |
| 改 AI 补全的提示词或解析 | `utils/importFill.js`，校验规则是硬约束，放松前先想清楚会不会写入坏数据 |
| 加一种题型 | `questionBuilder.js` 加构造器 + `QuestionView` 加渲染 + 结算页入口 |
| 改文案 / 布局 | 组件 + `index.css`，注意 390px、280px、200% 放大和减少动态效果四种状态 |
| 换存储结构 | `storage/*` 与 `AGENTS.md` 的持久化段；必须写迁移，并且不能改卡片 ID 的签名 |
