# AI 提示词要求代码块包裹 · 验证

记录时间：2026-11-03T14:49:59+0800。

用户要求：复制给 AI 的那段提示词，要明确让 AI 把 JSON 放在最外层代码块里，不要裸输出 JSON。既然提示词这么要求，粘贴环节就必须能接住整段代码块，所以 `parseJsonDeck()` 在解析前先拆掉**一层**最外层围栏；围栏外面还有说明文字仍按格式错误拒绝。

## 改了什么

- `src/utils/importFill.js`：`MATERIAL_RULES` 第一条改为要求代码块包裹，`buildWorksheetPrompt()` 与 `buildFillPrompt()` 共用这条规则，两段提示词实际输出的那一行是：

````text
- 把整个 JSON 数组放进一个 ```json 代码块里输出，代码块外不写任何文字、说明、表格或包装对象；不要裸输出 JSON。字段名和类型严格按模板。
````

- `src/utils/jsonDeck.js`：新增 `unwrapOuterFence()`，只在整段文本**恰为一个**代码块时取块内内容，其他情况原样解析；错误提示同步改为「粘贴 JSON 数组即可，外面带代码块也行，但不要夹带说明文字或多余逗号」。
- `src/components/ImportView.jsx`、`src/components/ManagePanel.jsx`：只改原本就不成立的三处说法——补全面板「只粘贴 AI 返回的 JSON 数组，不带代码围栏」、粘贴框提示「只粘贴 JSON 数组，不带代码围栏或说明文字」、帮助面板「不带代码围栏」。
- 只改「代码围栏被拒绝」这类会变成假话的文案；「把 AI 返回的 JSON 粘贴回来」等仍然成立的说法保持原样，避免顺手改写带来的额外 diff。
- `docs/screenshots/import.png`：仓库约定首次使用界面改文案就要重拍，已按 1280×800 @2× 从生产构建重新截图。
- 文档同步：`docs/TECHNICAL.md` 第 6、7 节与测试基线、`public/guide/index.html` 的格式小节、`AGENTS.md` 导入契约；README 正文没有改，只换掉了首屏截图。

## 自动化检查

`npm run check` 通过 98 项 Node 测试、75 项 UI 测试、ESLint 与生产构建，完整输出见 [check.log](check.log)。新增覆盖：

- `src/utils/jsonDeck.test.js`：带 `json` 语言标记和无标记的两层包裹、BOM 加大写 `JSON`、前后空白都能解析；只有开头没有收尾围栏的截断回复仍报格式错误；围栏后再跟说明文字仍被拒绝。
- `src/utils/importFill.test.js`：两段提示词都包含「代码块里输出」和「不要裸输出 JSON」。
- `src/App.test.jsx`：粘贴代码块包裹的两词回复可直接进入认词，无错误提示；转换引导第二步文案改为「带代码块也行」。

## 真实浏览器检查

生产构建起在 `http://127.0.0.1:5182/`，用系统 Chrome 无头驱动，全新 localStorage，视口 1280×800 @2× 与 390×844 @2×：

- 第 1 步折叠的「看看提示词」文本经 DOM 读取确认含代码块规则；这一屏与 README 的 [首屏截图](../screenshots/import.png) 是同一帧，没有另存重复图。
- 粘贴代码块包裹的 3 词数组并点「识别单词」，直接进入核对页，显示「3 个词 · 3 个有中文释义」，[核对页截图](fence-preview-1280.png)。
- 核对页展开「让 AI 补全」，补全提示词同样含代码块规则，[补全面板截图](fence-fill-panel-1280.png)。
- 同一段代码块后面追加「说明：以上是词表。」再提交，落在错误提示上，不进入预览，[拒绝截图](fence-prose-rejected-1280.png)。
- 390px 窄屏粘贴同一段代码块，同样进入核对页显示 3 个词，[窄屏截图](fence-preview-390.png)。

## 未覆盖

- 没有真实调用 DeepSeek/ChatGPT 验证它们是否照做；提示词只负责要求，解析端对裸数组和单层代码块都接受，两种回复都能导入。
- 多层嵌套代码块、代码块外夹带说明文字仍属拒绝范围，这是有意的严格边界。
