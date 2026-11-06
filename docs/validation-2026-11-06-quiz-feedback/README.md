# 通用选题解析边界 · 验证

日期：2026-11-06。

## 修复范围

- 看释义选词的答后解析由「优先 `relatedWord`」改为目标词的 `meaningZh` / `meaning`。
- 看情景选词显示完整原句与目标词义，不再追加对应词材料。
- 辨析近义词仍显示 `relatedWord` 与该情景的解释；选项生成、词表数据和导入流程不变。
- `QuestionView` 不再为没有解析文本的题目渲染空段落。

## 自动化检查

`npm run check` 通过 99 项 Node 测试、78 项 UI 测试、ESLint 和生产构建，完整输出见 [check.log](check.log)。

新增逻辑用例复现 Crunch / skim：题干与选项均不含 skim 时，MCQ 解析只含目标词义，情景题解析只含完整原句与目标词义。UI 用例分别覆盖答对、答错和「我不知道」，均显示目标词义且不显示无关 `relatedWord`。

## 本地生产浏览器检查

生产构建运行于 `http://127.0.0.1:4173/`，通过 Kimi Code 内置浏览器导入 Boo、Full-fledged、Crunch、Utter 四词复现词表并实际作答：

- 看释义选词的 Crunch 题干为研究人员分析数千份问卷。选择 Crunch 后，DOM 反馈为「答对了」「深入计算和处理大量信息 to process large amounts of information」；整页文本不含 skim。[答对截图](mcq-correct.png)。
- 看情景选词显示 `____ the survey results before the meeting.`；作答后反馈为完整原句 `Crunch the survey results before the meeting.` 与目标词的中英文释义，不含 skim。
- 辨析近义词实际比较 skim / Crunch，作答后仍显示「skim — 快速浏览；Crunch 强调深入计算和处理，skim 强调略读。」及该情景解释，确认保留正确的使用场景。
- 恢复干净的 24 词示例词表，在暗色练习页选择「我不知道」。Proximity 的反馈为「接近；邻近 the state of being near; closeness」，不再显示旧截图中的对应词 advance。1280×800 输出同步更新到 `docs/screenshots/practice.png`，副本见 [practice-demo.png](practice-demo.png)。
