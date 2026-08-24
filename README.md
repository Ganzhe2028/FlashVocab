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

**刷词 study**：先看单词，Enter 或 Space 翻开释义和例句，再按 Enter 下一张。Tab 或 ← 上一张，Delete 移除当前词，移除后可 Undo。最后一张翻开后按 Enter 进休息屏。

**休息屏 rest**：Enter 回第 1 张继续刷词，Space 进随手拼。

**随手拼 spell**：只显示词性和词义，键入拼写，Enter 提交；拼对显示带音节的写法，Esc 退出。拼完全部词自动回刷词。

## 循环洗牌

每轮从头开始（Next 绕回、休息屏返回、拼写完成）默认自动洗牌一次，新首卡不会是刚看完的那张。底部 Shuffle Loop 按钮可一键关闭；Reset Deck 恢复原始顺序。

## 词库

内置词库在 `src/App.jsx` 的 `baseDeck`，`vocab.md` 是配套词表，两边保持同步。右上角 Import 可选文件导入（JSON / Markdown / txt / docx），Guidebook 里可粘贴 AI 生成的词卡 JSON。字段约定见 `AGENTS.md`。
