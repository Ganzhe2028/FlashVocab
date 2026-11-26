# 首次上手流程验证（2026-11-26）

本次覆盖 AI 整理交接、失败重改、认词首卡与加练提示、结算与换组返回、主动作和缺释义文案。严格 JSON 校验、学习算法、掌握度计算、存储结构和题目生成未变。

## 环境与方法

- 生产构建 + `npm run preview`，本机 Chrome 无头实例，浅色、1280×800。
- `before/` 与 `after/` 使用同一固定词表、相同操作路径和相同视口；演示图不展示暗色或移动版本。
- 四条无声 WebM 视频使用固定词表与预置 AI 回复。脚本读取剪贴板，确认主导入重改请求包含原回复和原始问题、补全重改请求包含原错误回复；每条录制均断言没有第三方网络请求。
- README 与 `/guide/` 项目截图使用 8 个内置词的干净演示词表，1280×800、deviceScaleFactor=2，输出 2560×1600。

## 结果

- `npm run check`：**100 项 Node 测试、78 项 UI 测试、ESLint、生产构建全绿**，完整输出见 [check.log](check.log)。
- 新回归覆盖：人话错误和原回复带回、首卡提示与导入通知收起、其他 Undo 浮层保持、加练提示、掌握度明细折叠、换组直接打开词表面板并返回、主动作与示例通知。
- 严格 JSON 原有测试继续通过：缺词、别名、类型、缺释义、截断、说明文字、非法 focus 均整批拒绝。
- 390×844、280×653、640×400（约 200% 布局）和 1280 暗色导入页均 `scrollWidth === clientWidth`，见 [measurements.json](measurements.json)。内部回归截图不作为用户 demo。

## 改前 / 改后截图

| 界面 | 改前 | 改后 |
| --- | --- | --- |
| 第 1 步空白与 AI 引导 | [before](before/import-empty.png) | [after](after/import-empty.png) |
| 粘贴失败与重改 | [before](before/import-error.png) | [after](after/import-error.png) |
| 核对页与缺释义 | [before](before/preview-missing.png) | [after](after/preview-missing.png) |
| AI 补全面板 | [before](before/fill-panel.png) | [after](after/fill-panel.png) |
| 补全失败与重改 | [before](before/fill-error.png) | [after](after/fill-error.png) |
| 文件失败备用路径 | [before](before/file-error.png) | [after](after/file-error.png) |
| 新导入首卡 | [before](before/study-first.png) | [after](after/study-first.png) |
| 加练卡 | [before](before/study-practice.png) | [after](after/study-practice.png) |
| 轮末结算 | [before](before/summary.png) | [after](after/summary.png) |
| 换一组词 | [before](before/summary-switch.png) | [after](after/summary-switch.png) |
| 示例词通知 | [before](before/sample-notice.png) | [after](after/sample-notice.png) |
| 认词缺英文释义 | [before](before/study-missing-english.png) | [after](after/study-missing-english.png) |
| 拼写缺英文释义 | [before](before/spell-missing-english.png) | [after](after/spell-missing-english.png) |

## 操作视频

| 视频 | 验证路径 |
| --- | --- |
| [导入失败重改](videos/import-revision.webm) | 粘贴无法识别的内容 → 复制给 AI 重改 → 贴回修正内容 → 核对页 |
| [首卡到加练](videos/study-first-round.webm) | 新导入首卡提示 → 第一次选择收起提示/通知 → 加练提示 → 本轮结算 |
| [结算换组返回](videos/summary-switch.webm) | 结算 → 换一组词 → 词表面板 → 关闭并回到原结算 |
| [补全失败重改](videos/fill-revision.webm) | AI 补全回复失败 → 复制重改 → 贴回完整资料 → 补全成功 |
