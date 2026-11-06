# 认词大标题字体测试验证（2026-11-06）

## 范围

- 默认：认词页 `.word-heading` 使用本地 Crimson Text Bold；其他文字不变。
- 设置：「外观 → 单词大标题使用 Crimson Text」可切换 Crimson Text / 系统字体。
- 持久化：`flashvocab-word-font-v1` 保存 `crimson` 或 `system`，刷新后恢复；重置学习进度不清除。

## 自动检查

`npm run check` 全绿：ESLint、99 项 Node 测试、79 项 UI 测试、Vite 生产构建。完整输出见 [check.log](check.log)。

新增 UI 回归覆盖默认开启、关闭后的根节点状态与 localStorage、重新挂载恢复，以及重新开启。生产构建包含本地 WOFF2 和 OFL 许可；预览服务器对 `/fonts/crimson-text-bold.woff2` 返回 `200 OK`、`Content-Type: font/woff2`、`Content-Length: 16484`。

## 生产浏览器检查

在内置浏览器打开 `http://127.0.0.1:4173/` 的生产构建：

1. 默认大标题 proximity 实际显示为 Crimson Text 衬线字形；暗色和亮色均正常。
2. 关闭开关后，同一标题立即恢复系统无衬线字体；重新加载并打开设置，开关仍为关闭。
3. 聚焦开关后按空格可重新开启 Crimson Text，键盘操作有效。
4. 390px 窄屏检查长单词 negligence：标题、发音按钮、元信息和操作区完整可见，无遮挡或横向溢出。
5. 重拍 `docs/screenshots/study.png`（2560×1600）与 `public/guide/images/study.png`（960×600）。

## 截图

- [Crimson Text 暗色](crimson-dark.png)
- [设置开关](settings-dark.png)
- [系统字体亮色对照](system-light.png)
- [Crimson Text 亮色原始捕获](crimson-light-capture.png)
- [390px 长单词](crimson-mobile-long-word.png)
