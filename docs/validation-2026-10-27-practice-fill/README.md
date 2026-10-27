# 导入一次补齐专项练习资料 — 独立验证（2026-10-27）

## 目的

验证 Lead 实现的「导入时一次补齐学习卡和专项练习资料」是否满足用户需求：导入新词表时，复制给 DeepSeek 的**一段话**就能直接提供四项专项练习（看释义选词 / 看情景选词 / 填搭配 / 辨析近义词）所需的材料，导入后无需 API key、无需再走「词表 → 用 DeepSeek 补全资料（进阶）」就能直接练。

本目录是独立验证证据，分两轮：初验在 Lead 的实现上发现一个中等问题（英文 `Word:` 标签回复泄漏伪词条）；Lead 修复后，在**最终冻结构建**上复测通过。验证者不改源码，只写本文件夹。

## 命令与环境

| 用途 | 命令 |
| --- | --- |
| 交付门禁 | `npm run check`（ESLint → Node 测试 → Vitest UI 测试 → 生产构建） |
| 生产预览 | `npm run preview -- --port 4173 --strictPort` |
| 浏览器证据（主场景） | `NODE_PATH=/Users/mac/.npm-global/lib/node_modules node /tmp/verify-practice-fill.cjs` |
| 对抗检查 | `node /tmp/adversarial-importfill.mjs` |
| 缺陷复测 | `NODE_PATH=/Users/mac/.npm-global/lib/node_modules node /tmp/retest-english-labels.cjs` |

- 浏览器为真实 Chrome headless（Playwright，`executablePath=/Applications/Chrome.app/Contents/MacOS/Google Chrome`），应用是 `npm run check` 最终构建的 `dist/`（`assets/index-BXRimUmf.js` + `assets/index-n4gYUOi4.css`），地址 `http://127.0.0.1:4173/`。
- 每个视口/外观场景使用新的浏览器上下文，localStorage 独立。
- 本目录所有截图（含 16 张主场景、3 张复测、2 张初验缺陷）都在**最终构建**上重拍/补拍；初验的缺陷截图保留为历史。

## 自动门禁（check.log，最终冻结构建）

- ESLint 通过，无告警。
- Node 逻辑测试：`ℹ tests 99` / `ℹ pass 99` / `ℹ fail 0`。
- Vitest/jsdom UI 测试：`Tests 64 passed (64)`（`src/App.test.jsx`）。
- 生产构建：`vite v8.2.2` 成功，`dist/assets/index-BXRimUmf.js 284.17 kB`、`dist/assets/index-n4gYUOi4.css 32.07 kB`。
- 进程退出码 `EXIT:0`。

## 场景 A：桌面 1440×900 浅色，真实 Chrome

以下 16 张主场景截图均在最终构建上重拍。

1. `desktop-preview.png`：粘贴 `abandon 放弃\nquit 停止` → 核对页显示「2 个词还没补全资料」和唯一的 `开始背这 2 个词` 主按钮。
2. `desktop-fill-panel.png` / `desktop-fill-open.png`：`让 AI 补全` 展开「让 AI 一次补齐」；完整提示词另存为 `fill-prompt.txt`（23 行）。断言提示词包含 `单词 | 词性 | 中文释义 | 英文释义`、词源、对应词、例句1/重点1、例句2/重点2、情景、辨析全部字段，是普通文字（无 JSON / 代码块），且只列缺资料的词。
3. `desktop-filled.png`：粘贴本地模拟的 DeepSeek 回复 → 提示「补全了 2 个词的资料，专项练习可以用了」，缺资料行消失，面板收起。
4. `practice-mcq.png` / `practice-scenario.png` / `practice-bank.png` / `practice-contrast.png`：点 `开始背这 2 个词` 后，从「词表 → 专项练习」依次打开四种练习，每种都有题干与选项组。这是核心验收证据：**导入完直接可练，全程没有 API key，也没进进阶补全**。
   - 看释义选词：`A worker leaves a job by choice.`，选项 abandon / quit
   - 看情景选词：`They ____ the plan at noon.`
   - 填搭配：`We ____ for a month.`，词库 Abandon / Quit
   - 辨析近义词：`She stops playing tennis because her knee hurts.`，选项 abandon / quit
5. `desktop-partial.png`：刷新后从「词表 → 添加新词表」再导入同两词，只粘 abandon 的块（有对应词/例句1/重点1，无情景/辨析）→ 面板保持打开，提示「补全了 1 个词；还有 2 个词没补完，可以再复制一次。」，缺资料行仍在。
6. `worksheet-rescue.png` / `worksheet-ready.png`：粘贴 `unequivocally (54) highbrow (54)\ncommotion (57) disbelief (57)` → 出现「这份表要请 AI 读一下。」；把 4 个词的完整块粘进「AI 词表回复」→ 点「生成词表」→「AI 整理了 4 个词的资料，请核对。」，无缺资料行，出现「开始背这 4 个词」。

浏览器断言共 49 项，全部通过；16 张功能截图由 `visual-report.json` 记录（URL、视口、colorScheme、每张图的证明点、测量值、console/page errors）。应用脚本 console error 0、page error 0、外部网络请求 0。唯一的控制台报错是 `/favicon.ico` 404（应用未放 favicon，属既有静态资源缺口，与本次功能无关，在报告中单列为 benign）。

## 场景 B：布局与外观（最终构建）

`visual-report.json` 的 `measurements` 记录原始数值：

| 场景 | 截图 | clientWidth | scrollWidth | 结果 |
| --- | --- | --- | --- | --- |
| 390×844 浅色 | `mobile-fill-panel.png`、`mobile-filled.png` | 390 | 390 | 无横向溢出，导入视图 14–376 |
| 280×653 浅色 | `narrow-fill-panel.png` | 280 | 280 | 无横向溢出，导入视图 8–272 |
| 1440×900 深色 | `dark-fill-panel.png` | — | — | `data-theme=dark`，面板可读 |
| 1440 宽 + CSS `zoom=2` | `zoom200-fill-panel.png` | 1440 | 1440 | 无横向溢出，导入视图右边界 1400 ≤ 1440 |

## 独立对抗检查（adversarial.log，最终构建）

用 `node` 直接 import 真实模块（`src/utils/importFill.js`、`src/questionBuilder.js`、`src/utils/deckImport.js`）：修复前 **49/52 通过**（3 个失败同属「英文 `Word:` 标签」缺陷）；Lead 修复后 **56/56 全部通过**。新增/修正的检查：

- 英文 `Word:` / `Term:` 词头开块，`Word: abandon | v. | 放弃 | to leave` 同行竖线字段也接受；解析出的词条恰好是 `["abandon","quit"]`，不再出现 `POS` / `Meaning (ZH)` / `Word Origin` 等伪词条。
- 英文 `Word:` 回复能补齐全部缺失字段（中文/英文释义、词性、词源、对应词、例句、情景、辨析），`filled=2`、`remaining=0`，且不写错中文释义。
- 方括号 `[abandon]` + `- POS:` 的 Markdown 风格块可解析；JSON 数组行不会被误判为方括号词块（原有 JSON 回复测试继续通过）。
- 只有标签行、没有词头的回复返回 0 个词条（merge 安全 no-op，不再泄漏伪词条）。
- worksheet 救援：英文 `Word:` 回复只得到真实词条（`unequivocally`、`highbrow`，无伪词条）；无词头的标签回复得到 0 个词条，走可见报错路径。

其余通过项覆盖：

- 用 `abandon 放弃\nquit 停止` 加模拟回复构造的 2 词词表，四项 `buildQuestion` 对两个词都返回非空；题干/选项符合配对（mcq 用情景，scenario 遮蔽原形，bank 空出搭配，contrast 答案属目标词与对应词）。
- 中文标签块合并出 meaning、examples、wordOrigin、relatedWord、miniScenario、contrastScenarios；已有字段不被覆盖；不需要补的词不计入 filled。
- English 字段别名（`POS:`、`Meaning (ZH):`、`Meaning (EN):`、`Word Origin:`、`Counterpart:`、`Example 1:`、`Focus 1:`、`Scenario:`、`Contrast:`）在竖线首行或 `[term]` 块内都能正确合并。
- Markdown 表格、JSON、编号竖线行回复按词合并，大小写不敏感。
- 拒绝规则：例句写 `abandoned` 被丢弃；情景出现目标词或对应词被丢弃；辨析答案不属于目标词/对应词对被丢弃。
- 截断回复 `filled=1`、剩余 1 词仍缺资料，另一词不动；部分回复后 `remaining` 反映仍缺资料的词数。
- `buildFillPrompt()` 含完整块字段、无 JSON、只列缺资料的词、把已有对应词写成 `abandon（已有对应词：quit，请沿用）`；`buildWorksheetPrompt()` 含同样的完整字段、要求先配对、只输出原表词项；`parseMaterialReply()` 仍接受旧的纯竖线回复。
- worksheet 检测：页码/错位释义样例返回 true，普通两词表返回 false；富文本 worksheet 回复可直接变成可出题资料。

## 缺陷记录：初验发现 → Lead 修复 → 复测通过

**缺陷（中，已修复）：英文 `Word:` 标签块不被识别，泄漏伪词条。**

初验时 `LABEL_ALIASES` 有 `POS:`、`Meaning (ZH):` 等字段别名，但没有任何能开启词块的词头；`parseHeader` 只认 ≥4 个竖线字段或全角【】行。于是 AI 用 `Word: abandon` 起头输出（提示词之外的常见改写）时解析不到词块，回退到通用解析，产出 `POS`、`Meaning (ZH)`、`Word Origin`、`Counterpart`、`Focus 1` 等伪词条：

- 缺中文释义的词表上，回退结果按词匹配写进原词条：abandon 的中文释义变成「彻底丢下。」、quit 变成「主动停止。」，界面还提示「补全了 2 个词」，属静默写错数据。
- worksheet 救援路径只用 `detectWorksheetMismatch` 把关，伪词条能通过：英文 `Word:` 回复把 12 个伪词条（POS / Meaning (ZH) / Word Origin / Counterpart / Focus 1…）当作词表预览，「开始背这 12 个词」可点，没有报错。
- 初验证据（历史，保留）：`defect-english-word-label.png`、`defect-english-word-label-worksheet.png`、`defect-english-word-label.txt`。

Lead 修复（源码已冻结）：词头接受 `单词:` / `词条:` / `词:` / `Word:` / `Term:`（可带同行竖线字段）与 `[term]` / `【term】`；词头做词形校验；新增「有 ≥2 个素材标签行但没有词块 → 返回 0 条」的保护，merge 变为安全 no-op，worksheet 路径改为可见报错。Node 测试从 96 增至 99。

**复测（最终构建，真实 Chrome）：**

- `retest-english-word-label.png`：同一份 `Word: abandon …` 英文标签回复贴进补全面板 → 「补全了 2 个词的资料，专项练习可以用了。」，预览 `abandon 放弃；抛弃`、`quit 停止；放弃`，缺资料行 0，无伪词条。（先贴无词头的标签回复验证保护：报错「回复里没有匹配到这些词。请确认 AI 保留了原来的单词。」，原预览两行不变。）
- `retest-english-word-label-worksheet.png`：英文 `Word:` 风格 4 词回复贴进 worksheet 救援 → 「AI 整理了 4 个词的资料，请核对。」，预览正好 4 个真实词条（unequivocally / highbrow / commotion / disbelief），无缺资料行，出现「开始背这 4 个词」。
- `retest-english-word-label-worksheet-error.png`：只有 `POS:` / `Meaning (ZH):` 等标签行、没有词头的回复 → 可见错误「没有在回复里找到词表。请让 AI 按提示里的格式重新输出。」，页面仍停在「这份表要请 AI 读一下。」救援面板，原内容未被替换。

**缺陷（低，记录）：`/favicon.ico` 404。** 应用没有 favicon，任何页面加载都会在控制台留下一条 Failed to load resource。与本次功能无关、属既有小缺口，记录在 `visual-report.json.benignConsoleErrors`。

**限制（非缺陷）：** `1. abandon` + `POS:` 这类纯编号+标签、没有竖线首行或词头的回复不会被合并（`filled=0`，原词表不变，安全无副作用），记作不支持的变体；提示词要求的竖线首行格式、编号竖线行、英文 `Word:` 标签与 `[term]` 块均正常。

## 截图清单

| 文件 | 场景 | 证明 |
| --- | --- | --- |
| `desktop-preview.png` | 1440×900 浅色 | 「2 个词还没补全资料」+ 单一主按钮 |
| `desktop-fill-panel.png` | 同上 | 「让 AI 一次补齐」面板内容与三步说明 |
| `desktop-fill-open.png` | 同上 | 完整普通文字提示词，含四种练习所需字段 |
| `desktop-filled.png` | 同上 | 补全成功提示、缺资料行消失 |
| `practice-mcq.png` | 同上 | 看释义选词题干 + 选项组 |
| `practice-scenario.png` | 同上 | 看情景选词题干（原形遮蔽）+ 选项组 |
| `practice-bank.png` | 同上 | 填搭配题干 + 词库选项 |
| `practice-contrast.png` | 同上 | 辨析近义词题干（对应词一侧）+ 选项组 |
| `desktop-partial.png` | 同上 | 部分回复：面板保持打开、剩余词提示 |
| `worksheet-rescue.png` | 同上 | 匹配/填空 worksheet 的 AI 救援入口 |
| `worksheet-ready.png` | 同上 | 4 词救援完成、无缺资料行、可导入 |
| `dark-fill-panel.png` | 1440×900 深色 | 深色模式补全面板可读 |
| `mobile-fill-panel.png` | 390×844 浅色 | 移动端补全面板 + 提示词，无横向溢出 |
| `mobile-filled.png` | 390×844 浅色 | 移动端补全完成状态 |
| `narrow-fill-panel.png` | 280×653 浅色 | 280px 极窄布局可用，无横向溢出 |
| `zoom200-fill-panel.png` | 1440×900 + zoom 2 | 200% 缩放无横向溢出 |
| `retest-english-word-label.png` | 1440×900 浅色 | 修复后：`Word:` 回复补齐材料、无伪词条、缺资料行消失 |
| `retest-english-word-label-worksheet.png` | 1440×900 浅色 | 修复后：`Word:` 回复得到干净的 4 词 worksheet 预览 |
| `retest-english-word-label-worksheet-error.png` | 1440×900 浅色 | 修复后：无词头标签回复显示错误并保留原救援面板 |
| `defect-english-word-label.png` | 1440×900 浅色 | 初验缺陷历史：`Word:` 回复写错中文释义 |
| `defect-english-word-label-worksheet.png` | 1440×900 浅色 | 初验缺陷历史：worksheet 救援接受伪词条词表 |

## 说明与边界

- **粘贴的「AI 回复」是本地 fixture**：按合规 DeepSeek 输出形状手写（含例句/重点/情景/辨析），全程没有 API key、没有外部 AI 请求（Playwright 记录的外部请求为 0）；本验证不评价真实 DeepSeek 的回复质量与长度。
- 结论覆盖「提示词 → 这种形状的回复 → 应用的合并/校验/出题 → 四种练习」链路；长词表一次回不完时的多次复制只验证了部分回复的保留与剩余提示。
- 未修改 `src/`、`dist/`、`AGENTS.md`、`README.md`、`Updates.md`、`docs/` 根文件或 package 文件，未执行 git commit。
