# 界面文案精简验证（2026-11-19）

本记录对应「去掉常驻小字与说明文案」这一轮界面改动。学习算法、存储格式、导入校验和题目生成均未变化。

## 改动范围

- 删除所有 eyebrow 小标签、学习页上方的词表名常驻行、状态页解释段。
- 删除认词前的教学句、拼写页「词性未提供」占位、练习页词库说明与快捷键说明段、结算页题型副标、设置页练习卡片与开关描述。
- 导入页：AI 转换交接折叠为默认收起项；删除粘贴提示、拖放副标、补全提示和 keep-note；隐私说明移入 `InfoTip`。
- 新增 `InfoTip`：info 图标 + 按需 tooltip，悬停、聚焦或点击展开，Esc/失焦关闭；气泡通过 portal 渲染并按视口夹取坐标。
- 修复点击 tooltip 按钮后全局重置焦点导致触屏打不开的问题（`POINTER_FOCUS_SELECTOR` 排除 `.info-tip-button`）。

## 环境与方法

- 生产构建 + `npm run preview`，本机 Chrome 无头模式，通过 CDP 设置 `width=1280, height=800, deviceScaleFactor=2`（2560×1600 输出）与 `prefers-color-scheme`。
- 窄屏与 200% 布局用 `Emulation.setDeviceMetricsOverride`：390×844、280×653、640×400（1280 的 200% 布局），每档读取 `document.documentElement.scrollWidth` 与 `clientWidth`。
- 演示词表为 8 个内置词（W1 名称「Unit 4 · Vocabulary」），不写入仓库数据；截图前清空示例提示和 Undo。

## 结果

- `npm run check`：**99 项 Node 测试、78 项 UI 测试、ESLint、生产构建全绿**，完整输出见 [check.log](check.log)。
- 横向溢出：学习页 390 / 280 / 640 三档 `scrollWidth === clientWidth`；导入页 390 / 280 / 640 同样无横向滚动（见 [measurements.json](measurements.json)）。修复 `InfoTip` 前，导入页在 390 下为 483、280 下为 435，均由隐藏 tooltip 的绝对定位撑开。
- 真实浏览器检查覆盖：首次导入、AI 转换折叠项、核对页、认词翻开前后、四种练习、题组结算、轮次结算、暂停/空/毕业状态、词表与设置面板、明暗两套外观、1280 与 390/280、200% 布局。

## 证据

| 文件 | 内容 |
| --- | --- |
| [import-1280.png](import-1280.png) | 首次导入，浅色，1280×800 @2× |
| [import-dark-1280.png](import-dark-1280.png) | 首次导入，深色 |
| [import-tooltip.png](import-tooltip.png) | 标题旁隐私 tooltip 展开 |
| [import-390.png](import-390.png) | 390px 导入页 |
| [import-280.png](import-280.png) | 280px 导入页 |
| [import-200pct.png](import-200pct.png) | 640px（≈200% 布局）导入页 |
| [study-390.png](study-390.png) | 390px 认词页 |
| [study-280.png](study-280.png) | 280px 认词页 |
| [bank-tooltip.png](bank-tooltip.png) | 词库题快捷键 tooltip |
| [settings-tooltip.png](settings-tooltip.png) | 设置面板「认识的词直接前进」tooltip |

README 与 `/guide/` 的截图已用同一生产构建重拍：`docs/screenshots/{import,study,practice}.png` 与 `public/guide/images/{import,study}.png` 均为 2560×1600。
