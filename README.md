# Vocabulary Loop

Vite + React 单词卡应用：刷词、休息屏、随手拼三种模式循环，词库可导入替换。

## 快速开始

```bash
./run.sh          # 缺 node_modules 会自动 npm install，然后起 dev server
npm run dev       # 手动启动
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
```

## 三种模式

**刷词 study**：先看单词，Enter 或 Space 翻开释义和例句；翻开后按 Enter 或点击「想起来了」记为辨识正确，按 N 或点击「没想起来」记为错误。Tab 或 ← 上一张，Delete 移除当前词，移除后可 Undo。点击单词标题会复制原始拼写且不会翻面。最后一张完成自评后进入休息屏；若手动删完所有单词，会显示完成祝贺，并保留 Undo 与 Reset。

**休息屏 rest**：Enter 回第 1 张继续刷词，Space 进随手拼。

**随手拼 spell**：只显示词性和词义，键入拼写，Enter 提交；第一次提交决定本轮成绩，拼错后重新输入正确也不会覆盖本轮错误。拼对显示带音节的写法，Esc 退出。拼完全部词自动回刷词。

## 暂时熟悉池

辨识和拼写分别记录连续正确次数、隐藏状态和轮次。某个 mode 连续正确 4 轮后，该词从该 mode 的下一轮开始隐藏，并随机完整间隔 1-2 轮。到期词会分批返场：普通词存在时，返场词最多约占新一轮最终队列的 25%；全部普通词都已隐藏时，每轮返场约四分之一的到期词。

返场正确会重新随机间隔 1-2 轮；返场错误只重置当前 mode，并从下一轮恢复普通学习。池中词仍保留在导出结果里，与 Remove/Delete 不同。熟悉池、双 mode 轮次、当前队列、导入词库、删除及最后一次 Undo 状态会保存在浏览器本地，刷新后继续。

## 循环洗牌

每轮从头开始（休息屏返回、拼写完成）会先根据熟悉池状态生成本轮队列，再按开关决定是否洗牌；新首卡不会是刚看完的那张。底部 Shuffle Loop 按钮可一键关闭；Reset Deck 恢复内置词库并清空本地学习记录。

## 词库

内置词库在 `src/App.jsx` 的 `baseDeck`，`vocab.md` 是配套词表，两边保持同步。顶部 Import 可选文件导入（JSON / Markdown / txt / docx），Guidebook 里可粘贴 AI 生成的词卡 JSON。字段约定见 `AGENTS.md`。

顶部 `Export JSON` 会导出本轮尚未删除的单词，保持原始导入顺序；导入 JSON 中的自定义字段也会保留。标准词卡还支持 `wordOrigin`（词根、词缀和词源说明）及 `relatedWord`（最直接的相反词或对应概念），翻开卡片后显示。

## 验证

```bash
npm test          # 轮次、入池、返场比例和模式隔离测试
npm run build     # 生产构建
```

## 提示词

Guidebook 的批量词卡提示词会生成可导入 JSON，包括词根词源和对应概念。顶部「词根·感觉·画面」及 Guidebook 内的同名入口可复制单词深度理解提示词；原文保存在 `src/prompts/deep-understanding.md`。
