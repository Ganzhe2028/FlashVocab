# 闪词导入优先改版（2026-10-27）

## 为什么改

真实用户反馈集中在三件事：

1. 第一次打开不知道闪词到底怎么用。
2. 自己输入「英文 + 中文」却被判为无法识别。
3. 老师发的 Word 单词表，要经过「复制闪词里的提示词 → 发给 DeepSeek → 让它返回 JSON → 再复制回闪词」这一串步骤，实际上无法完成。

旧版并不是缺说明，而是把关键动作藏进了「更多 → 怎么用」：导入、AI、JSON、波次、辨识、备考全挤在文字说明里，用户仍然不知道下一步该点哪里。这次按「交互优先于文字指引」重做，不靠再加一段说明来弥补流程本身。

## 现在的首次使用

### 一个入口，不是三个

- 首次打开就是导入页，没有「准备页」「Import」「更多」三个平行入口。
- 顶部只保留：品牌、`词表`（有词时）、设置齿轮、帮助、GitHub、Undo。
- `词表` 打开词表管理；`添加新词表` 回到导入页；设置和帮助各自打开一个专注面板，没有二级 tab。
- 学习中途进入导入页时，顶部会出现「刚才的学习还留着」和「继续学习」；不导入直接返回即可恢复原题、原答案和拼写输入。
- 从导入页新增词表后按 Undo，会回到原来的学习现场，而不是停在导入页。

### 导入页只做一件事

页面上并列两个明确目标：

- 左：选择或拖入文件。支持 `.docx`、`.xlsx`、CSV、TXT、Markdown、JSON；旧 `.doc` 会提示另存为 `.docx`。
- 右：粘贴单词表。输入框里直接展示可接受的格式示例，不需要先读说明。
- 下方：24 个示例词作为次级入口；有词表时另有「查看已有词表」。

导入前不问「这波叫什么」，也不要求填 DeepSeek key。命名折叠在预览页的「给这组词起个名字（可选）」里；不填就按 W1、W2 递增。

### 先看识别结果，再决定导入

文件或粘贴内容解析成功后，进入预览，而不是直接开背：

- 「认出 N 个词」。
- 字段摘要：多少个有中文释义、词性、例句，多少个缺中文释义。
- 前 6 个词的词条预览，可展开全部。
- 没看懂的行单独列出，并说明是「像完整句子」还是「没有单词」；标题和日期只计数，不打扰用户。
- 主按钮是「开始背这 N 个词」，次按钮是「调整原文」。
- 有旧词表时提示「原来的词表会保留，可在「词表」里切回」。

这一步直接解决「我明明输入了中英翻译却识别不了」：用户能看到系统到底认出了什么、漏了哪一行，而不是只收到一句泛泛的失败提示。

## 解析契约

`src/utils/deckImport.js` 先尝试 JSON / Markdown / 带表头的 CSV，再进入宽松文本解析，最后才报错。宽松解析支持：

- `abandon 放弃`
- `1. abandon v. 放弃`
- `abandon /əˈbændən/ v. 放弃；抛弃`
- `abandon (v.) 放弃`
- `take off 起飞`、`look after 照顾`
- `abandon\tv.\t放弃\tto leave somebody`
- `abandon | v. | 放弃 | to leave`
- 无表头 CSV：`abandon,放弃`
- Word 表格：整行按 `单词 / 词性 / 中文 / 例句` 读取；短例句也能进入例句数组
- 英文、中文分行的成对数据：`abandon` 下一行 `放弃`
- 中文在前的行：`放弃 abandon`
- 方括号词条：`[abandon] 放弃`

解析会跳过 `Unit 1 Vocabulary`、`单词 词性 中文`、页码、姓名日期等标题行。无法识别的完整句子不会被硬塞成单词。仍无法识别时，错误消息会指出第一行内容，并给出 `abandon 放弃` 的格式示例。

Word 的表格提取在 `extractDocxText` 内完成：表格每一行转换为 tab 分隔的一行，避免单元格被拆散；普通段落保持逐行文本。Excel 用原生 ZIP + `sharedStrings.xml` + 第一个有内容的 `sheet*.xml` 读取，不新增运行时依赖。

## 缺中文释义时：一次复制，一次粘贴

如果预览里有词缺中文释义，会出现「补中文释义」。展开后只有两步：

1. 复制一段已经包含缺词清单的普通文字，发给 DeepSeek、ChatGPT 或任意 AI。提示词要求输出 `单词 | 词性 | 中文释义 | 英文释义`，不要求 JSON。
2. 把 AI 的回复整段粘回来，点「识别并补全」。

合并按单词匹配，只填缺失字段，不覆盖已有内容；兼容竖线行、Markdown 表格、编号行和 JSON 回复。没有匹配到任何词时直接说明，不会悄悄改词表。这个入口只在缺资料时出现，不是导入的必经步骤。

## 设置页

旧设置页的问题是：开关、说明、拼写单选和外观混在一列里，用户得先理解「辨识字直接前进」「休整」这些概念，才能知道自己在选什么。现在：

- 第一块「练习方式」用三张结果导向的选择卡：
  - 只认词
  - 认词，再拼没认出的词
  - 认词，再拼全部词
- 每张卡只说明会发生什么，不再解释内部轮次。
- 「发音」独立成一块，使用真正的 toggle，并只保留一条行为说明。
- 「外观」保持三段选择。
- 「认识的词直接前进」折叠进「进阶」，默认关闭。
- 重置进度和恢复示例词回到「词表 → 重新开始」，不再混在设置里。

## 学习流程

- 任何新词表都从认词开始，不会再因为词表恰好带例句就直接进入情景题。情景题、填搭配、辨析近义词只在结算页或「词表 → 专项练习」出现。
- 认词页只有 Q 认识 / E 不认识、N 下一个；答案页才出现 M 改判。首次使用的提示卡被移除，按钮本身已经写明操作。
- 结算页的练习名称改为「看释义选词 / 看情景选词 / 填搭配 / 辨析近义词」，并在按钮下给一句短说明。
- 词表管理里的用户词改为「在学 / 已收起」「练这组 / 先收起 / 全部一起复习」，不再暴露「冷藏」「复活」「波次」这些内部说法。

## 明确移除

- 「更多 → 怎么用 → 1 分钟上手」的完整文字教程。
- 认词和拼写页的首次提示卡，以及「在学习页重新显示提示」。
- 导入时等待 DeepSeek、用 API key 作为导入前置条件的路径。
- 面向学习者的 JSON 补全提示词。
- 顶部 `准备页`、`Import`、`更多` 三入口和面板二级 tab。
- 新词表自动进入情景题的「初见局」。

## 验证

自动检查：`npm run check` 通过，84 项 Node 测试、58 项 UI 测试、ESLint 和 Vite 生产构建全绿。日志见 [check.log](validation-2026-10-27/check.log)。

真实 Chrome 生产构建验证：

- 教师风格 DOCX 表格：认出 5 个词，含 `take off` 短语和 5 条例句；[预览截图](validation-2026-10-27/docx-preview.png)。
- 教师风格 XLSX：认出 5 个词；[预览截图](validation-2026-10-27/xlsx-preview.png)。
- 粘贴 `abandon 放弃 / benefit 好处；利益 / 1. take off v. 起飞 / translucent /... / resilient`：正确识别 5 个词，缺 1 个中文释义；补全流程可用；[预览](validation-2026-10-27/desktop-preview.png)、[补全](validation-2026-10-27/desktop-fill.png)。
- 桌面亮色：导入、词表、设置、帮助见 [导入](validation-2026-10-27/desktop-import.png)、[词表](validation-2026-10-27/desktop-deck.png)、[设置](validation-2026-10-27/desktop-settings.png)、[帮助](validation-2026-10-27/desktop-help.png)。
- 暗色：DOCX 预览与学习页见 [暗色预览](validation-2026-10-27/dark-docx-preview.png)、[暗色学习](validation-2026-10-27/dark-study.png)。
- 390px：导入、预览、学习、设置、词表均无横向溢出；见 [移动导入](validation-2026-10-27/mobile-import.png)、[移动预览](validation-2026-10-27/mobile-preview.png)、[移动学习](validation-2026-10-27/mobile-study.png)、[移动设置](validation-2026-10-27/mobile-settings.png)、[移动词表](validation-2026-10-27/mobile-deck.png)。
- 280px：导入与预览 `clientWidth = scrollWidth = 280`；见 [窄屏导入](validation-2026-10-27/narrow-import.png)、[窄屏预览](validation-2026-10-27/narrow-preview.png)。
- 200% CSS 放大：预览 `clientWidth = scrollWidth = 1440`；见 [放大预览](validation-2026-10-27/zoom200-preview.png)、[放大设置](validation-2026-10-27/zoom200-settings.png)。

## 已知边界

- 旧 `.doc` 仍需另存为 `.docx`，旧 `.xls` 需另存为 `.xlsx` 或 CSV；PDF、图片和扫描件不支持，避免用不可靠 OCR 误导用户。
- AI 补全依赖用户自己打开的第三方 AI；闪词只负责生成可复制的普通文字和合并回复。DeepSeek API 补全仍在「词表 → 进阶」内，需要自己的 key。
- Excel 只读取第一个有内容的工作表；多工作表需要拆成多个文件或复制到同一张表。
- 没有中文释义的词仍可导入，但认词答案会是空的；预览会明确提示。

## 涉及文件

- `src/components/ImportView.jsx`：新导入页、预览、AI 补全入口。
- `src/utils/deckImport.js`：DOCX/XLSX 提取、宽松列表解析、跳过行报告。
- `src/utils/importFill.js`：生成普通文字补全提示词，按词合并 AI 回复。
- `src/components/ManagePanel.jsx`：词表 / 设置 / 帮助三段式面板，专项练习，三张练习方式卡。
- `src/App.jsx`：新顶部入口、导入与 Undo 接线、移除引导卡与导入时 AI。
- `src/learningAlgorithm.js`：新词表从认词开始；从导入页 Undo 恢复原学习现场。
- `src/components/StatusView.jsx`、`StudyView.jsx`、`SpellView.jsx`、`QuestionView.jsx`：去掉引导卡，统一用户用词。
- `src/App.test.jsx`、`src/utils/deckImport.test.js`、`src/utils/importFill.test.js`、`src/waveModel.test.js`：更新与新增回归。
- `src/index.css`：导入区、预览、补全、设置卡、移动端与 200% 布局。
