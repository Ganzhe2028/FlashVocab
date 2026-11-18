# 界面文案瘦身验证（2026-11-18）

本轮把常驻小字、重复副标题和每块底下的帮助说明从界面移除；需要补充的信息改放折叠区、帮助面板或 info + tooltip。学习、导入、存储行为没有改动。

## 检查

`npm run check` 通过（日志：[check.log](check.log)）：

- 99 项 Node 测试
- 80 项 UI 测试（较上轮 78 增加 2 条：认词页无 eyebrow/提示、设置卡只有标题且 tooltip 可访问）
- ESLint 通过
- Vite 生产构建通过

## 真实浏览器

生产构建用 `npm run preview` 起在 `http://localhost:4187/`，Playwright 驱动本机 Chromium 截图（headless、`deviceScaleFactor: 2`）。所有截图的指针位置已移到页角，避免 hover 态混入；学习页截图在 `reload` 后拍摄，避免 Undo toast 和 reveal 动画残影。

### 尺寸与溢出

`clientWidth === scrollWidth === bodyScrollWidth`，所有场景无横向溢出；每次测量同时确认 DOM 中 `.eyebrow` 数量为 0。完整数据见 [measurements.json](measurements.json)。

| 场景 | 视口 | clientWidth / scrollWidth |
| --- | --- | --- |
| 导入第 1 步 | 1280×800 | 1280 / 1280 |
| 导入第 2 步 | 1280×800 | 1280 / 1280 |
| 认词答案 | 1280×800 | 1280 / 1280 |
| 结算页 | 1280×800 | 1280 / 1280 |
| 释义选词 | 1280×800 | 1280 / 1280 |
| 暗色认词 / 导入 | 1280×800 | 1280 / 1280 |
| 导入第 1/2 步 | 390×844 | 390 / 390 |
| 认词 / 设置 | 390×844 | 390 / 390 |
| 导入第 1/2 步 | 280×800 | 280 / 280 |
| 认词 | 280×800 | 280 / 280 |
| 200% 等效视口（640×400）导入第 1/2 步、认词 | 640×400 | 640 / 640 |

200% 一栏用 640×400 CSS 视口模拟 1280×800 在 200% 缩放下的布局，和仓库既有验证口径一致。

### 截图

桌面亮色：

- [导入第 1 步](desktop-import-step1.png)：来源切换 → 输入 → 主按钮；AI 转换收在折叠项。
- [文件模式](desktop-import-file.png)：拖放区只留一行主文案。
- [AI 转换展开](desktop-import-step1-ai.png)：一行说明、复制按钮、查看提示词。
- [导入第 2 步](desktop-import-step2.png)：只有词数摘要、词表预览和开始按钮。
- [认词提示](desktop-study-prompt.png) / [认词答案](desktop-study.png)：无 eyebrow、无「凭记忆判断」提示段。
- [结算页](desktop-summary.png)：四个练习按钮只留标题。
- [释义选词](desktop-quiz.png) / [作答反馈](desktop-practice.png)：题号改为右上角 `1 / 5`，无词库说明段。
- [词表](desktop-deck.png)：无「在学/已收起」胶囊，无区块说明段。
- [设置](desktop-settings.png) / [设置 tooltip](desktop-settings-tooltip.png)：三张拼写卡只留标题，生效时机用 info + tooltip。
- [帮助](desktop-help.png)：参考页保留，导入说明改成当前 JSON + 折叠转换，新增数据段。

暗色与窄屏：

- [暗色认词](dark-study.png)、[暗色导入](dark-import.png)
- [390 导入第 1 步](mobile-import-step1.png) / [第 2 步](mobile-import-step2.png) / [认词](mobile-study.png) / [设置](mobile-settings.png)
- [280 导入](narrow-import-step1.png) / [280 认词](narrow-study.png) / [280 设置 tooltip](narrow-settings-tooltip.png)（tooltip 右边缘 269.8px，仍在 280px 视口内）
- [200% 导入](zoom200-import-step1.png) / [200% 认词](zoom200-study.png)

## 文档与截图同步

- README 三张截图已按 1280×800 @2× 重拍：`docs/screenshots/import.png`、`study.png`、`practice.png`。
- `/guide/` 的两张截图按 960×600 重拍：`public/guide/images/import.png`、`study.png`。
- `AGENTS.md` 增加 UI 文案规则并更新受影响的契约描述；`docs/TECHNICAL.md` 更新导入第 1 步和测试基线；导入优先规格文档增加 2026-11-18 更新；`README.md` 与 `/guide/` 同步首屏入口说法；sitemap `lastmod` 改为 2026-11-18；`Updates.md` 增加本轮记录。
