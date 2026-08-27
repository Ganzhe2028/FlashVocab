# Vocabulary Loop

Vite + React 单词卡应用：刷词、休息屏、随手拼三种模式循环，词库可导入替换。

## 快速开始

```bash
./run.sh          # 缺 node_modules 会自动 npm install，然后起 dev server
npm run dev       # 手动启动
npm run check     # lint + 全部测试 + 生产构建
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
```

## 三种模式

**刷词 study**：先看单词，Enter 或 Space 翻开释义和例句。简约模式翻开后按 Enter 直接进入下一张；开启「两轮熟悉返场」后才显示「想起来了 / 没想起来」按钮，并启用 Enter 记正确、N 记错误。Tab 或 ← 上一张，Delete 移除当前词，移除后可 Undo。点击单词标题会复制原始拼写且不会翻面。最后一张完成后进入休息屏；若手动删完所有单词，会显示完成祝贺，并保留 Undo 与 Reset。

**休息屏 rest**：Enter 回第 1 张继续刷词，Space 进随手拼。

**随手拼 spell**：只显示词性和词义，键入拼写，Enter 提交；第一次提交决定本轮成绩，拼错后重新输入正确也不会覆盖本轮错误。拼对显示带音节的写法，Esc 退出。拼完全部词自动回刷词。

## 可选复杂模式

应用默认保持简约模式，底部有两个独立且会自动保存的开关：

- `词源与对应概念`：打开后，翻开词卡会额外显示 `wordOrigin` 和 `relatedWord`；关闭只隐藏展示，不删除字段。
- `两轮熟悉返场`：打开后显示「想起来了 / 没想起来」自评按钮，并让辨识和拼写累计连续正确次数。任一 mode 连续正确 2 轮后，该词从下一轮开始隐藏；若辨识已经隐藏，拼写首次正确就会与辨识同步隐藏，之后只在辨识实际返场的学习循环中一起进入拼写返场。每次完整间隔 1-2 轮后分批返场。关闭时隐藏自评按钮和 `N` 快捷键，所有词参与普通循环，Enter 仅进入下一张，不改变 streak、隐藏或返场状态；已有熟悉进度保留，重新打开后继续。

复杂模式开启时，返场词最多约占新一轮最终队列的 25%；同步词优先进入拼写返场，未排进当轮的词会继续等待。辨识返场正确会为绑定的两边一起安排下次间隔，辨识返场错误会解除两边的同步隐藏；拼写返场错误只解除拼写侧。池中词仍保留在导出结果里，与 Remove/Delete 不同。两个开关、学习进度、当前队列、导入词库、删除及最后一次 Undo 状态都会保存在浏览器本地。

## 循环洗牌

每轮从头开始（休息屏返回、拼写完成）会按当前模式生成队列：简约模式包含所有未删除单词，复杂模式会应用熟悉池隐藏与返场，再按开关决定是否洗牌。新首卡不会是刚看完的那张。底部 Shuffle Loop 按钮可一键关闭；Reset Deck 恢复内置词库并清空本地学习记录，但保留功能开关偏好。

## 词库

内置词库的唯一来源是 `src/data/baseDeck.js`，`vocab.md` 是配套词表，两边保持同步。顶部 Import 支持 JSON、Markdown、纯文本、CSV 和 DOCX；Guidebook 里也可直接粘贴 AI 生成的 JSON 或 Markdown。导入会统一归一化字段，CSV 支持引号包裹的逗号与换行；旧版 `.doc` 不支持，请另存为 `.docx`。字段约定见 `AGENTS.md`。

顶部 `Export JSON` 会导出本轮尚未删除的单词，保持原始导入顺序；导入 JSON 中的自定义字段也会保留。标准词卡支持 `wordOrigin`（词根、词缀和词源说明）及 `relatedWord`（最直接的相反词或对应概念）；打开「词源与对应概念」后会在翻面时显示。内置 24 词已全部填好这两个字段。

## 验证

```bash
npm run lint      # 静态检查
npm test          # 以当前输出为准，包含逻辑与 UI 行为测试
npm run build     # 生产构建
npm run check     # 一次执行以上全部检查
```

## 代码结构

- `src/App.jsx`：状态协调和三种模式切换
- `src/components/`：卡片、控制栏、Guidebook 与熟悉池界面
- `src/hooks/useAppKeyboard.js`：全局键盘行为
- `src/learningAlgorithm.js`：纯学习调度算法
- `src/storage/learningStorage.js`：带版本与校验的浏览器持久化
- `src/utils/deckImport.js`：所有导入、归一化与 Markdown 导出
- `src/data/baseDeck.js`：内置词库

学习队列只保存稳定 card ID，不保存词卡对象引用；刷新恢复、删除、Undo、导入和导出都以同一 ID 模型处理。损坏或过期的本地数据会被安全忽略，不会阻止应用启动。

## 提示词

Guidebook 的批量词卡提示词会生成可导入 JSON，包括词根词源和对应概念。顶部「词根·感觉·画面」及 Guidebook 内的同名入口可复制单词深度理解提示词；原文保存在 `src/prompts/deep-understanding.md`。
