# 学习区垂直位置验证（2026-11-26）

本轮只调整认词与拼写在桌面高窗口中的顶部锚点，学习算法、交互、存储和导入行为均未变化。

## 改动范围

- `App.jsx` 给认词、拼写的 `.reading-column` 增加 `is-learning`。
- `index.css` 在宽度和高度均大于 700px 时使用 `padding-top: clamp(64px, 14vh, 120px)`；其他窗口继续使用原间距。
- 不使用整块垂直居中，避免答案展开后标题因内容变高而跳动。

## 环境与方法

- `npm run preview` 提供生产构建，本机 Chrome 无头模式，1280×800、deviceScaleFactor=2。
- 使用内置前 8 词作为干净演示词表；认词答案展开前后分别读取 `.word-heading-row` 的 y 坐标。
- 另测 390×844、280×653 和 1280×650，读取主栏顶部间距及页面宽度。

## 结果

- `npm run check`：99 项 Node 测试、78 项 UI 测试、ESLint、生产构建全部通过，见 [check.log](check.log)。
- 1280×800：顶部间距 112px；标题在答案展开前后均为 y=184，没有位移。
- 390px 与 280px：顶部间距保持 40px，`scrollWidth === clientWidth`，没有横向溢出。
- 1280×650 矮窗口：顶部间距保持 39px，不启用桌面下移规则。
- 实际完成 8 词认词并进入全词拼写后，主栏同样为 `is-learning`、顶部间距 112px，页面无横向溢出。
- 数值见 [measurements.json](measurements.json)。

## 证据

- [study-1280.png](study-1280.png)：1280×800 @2×，答案展开后的认词页。
- [study-390.png](study-390.png)：390px 认词页。
- [study-280.png](study-280.png)：280px 认词页。
- `docs/screenshots/study.png` 与 `public/guide/images/study.png` 已用同一生产构建重拍，均为 2560×1600。
