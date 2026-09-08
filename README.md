# 闪词 3.0

面向临近课堂 quiz 的键盘优先个人词表练习页。导入一份十几到几十个词的临时词表后，应用会沿着一条固定循环推进：**辨识 → 拼写 → 辨识**。

3.0 的执行范围、行为合同和验收证据见 [从零重写执行计划](docs/flashvocab-3-rewrite-plan.md)。旧版 Figma 与两份设计底稿保留为历史来源，不是当前页面模板。

## 快速开始

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

`./run.sh` 也会在缺少依赖时安装并启动开发服务器。

## 当前学习循环

首次没有本地词表时，页面以文件 Import 和粘贴导入为主入口，内置 24 词只是次级试用入口。有保留的词表时，新访问会从第一轮辨识开始。

辨识分两步。进入每个单词的第一页时会自动朗读；`Q` 选择认识、`E` 选择不认识，两种选择都会显示答案并再次朗读当前词。答案页按 `N` 进入下一词；若第一页选了“认识”，还可按 `M` 改判为不认识并立即前进。下一词出现时开始新一轮自动朗读。`←` 回看上一词，`Delete` 或 `Backspace` 将当前词从词表移出；回看与重复提交不会重复计分。

辨识轮结束后直接进入拼写。拼写使用真实输入框，`Enter` 提交；空输入时直接按 `Enter` 会按“不认识”记录，并显示正确单词。首次拼错或空提交后输入框立即清空，用户必须从头正确拼写一次才能前进，改正不会覆盖首次错误；结果完成后再按 `Enter` 前进。`Esc` 进入暂停页，随后 `Enter` 继续原队列，`Space` 先开始一轮辨识；暂停队列始终只有一份。

每个词在辨识和拼写中独立累计连续正确。某个模式连续两轮正确后，该词跳过该模式下一整轮，并在再下一轮返场；返场正确后再次休息一整轮，失败则只释放当前模式。每轮返回全部到期词，不做比例上限或跨模式绑定。所有词都在休息时，应用用有界计算跨过空轮，不显示空白故障页。

## 内容与工具

- 英英释义优先，中文独立下一行；缺失释义明确显示“未提供释义”。
- 阅读时按已有 `usage` 标签每种显示一句；JSON 与 Markdown 导出仍保留全部例句。
- 词源与对应概念默认折叠；自动美式发音默认开启，可在右侧管理面板关闭，手动发音始终保留。
- 单击单词复制原始 `term`；Shift＋单击复制完整的 `src/prompts/deep-understanding.md` 加当前词。复制失败时显示可手动复制的全文。
- Import 支持 JSON、Markdown、txt、CSV 与 DOCX；旧 `.doc` 会提示另存为 `.docx`。JSON 与 Markdown 可导出。
- 替换、移出、找回、重置均使用一个最近操作 Undo 槽。重置只清学习现场并恢复默认偏好，保留词表和已移出集合。

## 本地保存

3.0 只长期保存完整 source deck 与手动移出 ID，使用独立 key `flashvocab-3-assets-v1`。刷新会开始新的学习现场；同一页面切换标签或窗口不会重置。首次没有新 key 时，会从旧 `vocab2-learning-v1` 仅读入词表与移出 ID，不迁移学习记录，也不删除旧 key。

导入 JSON 的未知字段、源顺序和全部例句会保留。导出排除手动移出词，但包含正在自动休息的词。

## 安静的阅读桌面

页面使用暖白背景和窄阅读列。外围品牌、Import、更多、Undo 与 GitHub 在 2.5 秒无指针活动或学习按键后淡出；鼠标、Tab 或打开管理面板会恢复。核心内容和单一进度条不移动。管理内容集中在一个右侧覆盖面板，小屏与 200% 放大可纵向滚动阅读。

## 代码结构

- `src/App.jsx`：副作用边界、页面状态组合与管理操作
- `src/learningAlgorithm.js`：reducer、稳定 ID、评分、洗牌、轮次与 Undo 的纯逻辑
- `src/components/StudyView.jsx`：辨识阅读区
- `src/components/SpellView.jsx`：真实拼写输入与反馈
- `src/components/StatusView.jsx`：准备、暂停和空词表状态
- `src/components/ManagePanel.jsx`：词表、帮助、设置、找回与重置
- `src/hooks/useAppKeyboard.js`：全局学习快捷键
- `src/hooks/useQuietChrome.js`：外围静默规则
- `src/hooks/usePronunciation.js`：Web Speech API 和美式 voice 选择
- `src/storage/learningStorage.js`：3.0 资产保存与旧 key 兼容读取
- `src/utils/deckImport.js`：所有导入、归一化与 Markdown 导出
- `src/data/baseDeck.js`：内置 24 词唯一来源

## 验证

`npm run check` 会执行 ESLint、Node 纯逻辑/解析/存储测试、Vitest/jsdom UI 行为测试和生产构建。2026-09-07 的真实 Chrome 验收还完整走过 24 词辨识与拼写，覆盖 1366×768、1440×900、窄窗、200% 放大、减少动态效果、静默和焦点；截图在 [`docs/validation-2026-09-07/`](docs/validation-2026-09-07/)。
