# 2026-10-31 Google SEO 验证记录

这一轮只改可抓取层和说明页，不改学习流程、界面或存储。先跑完整检查，再把生产构建用静态服务器和真实 Chrome 验一遍。

## 改动清单

- `index.html`：title、description、canonical、robots、Open Graph/Twitter、图标、主题色、`WebSite` + `Organization` + `WebApplication` JSON-LD、无 JS 时的 `<noscript>` 说明。
- `public/robots.txt`、`public/sitemap.xml`：允许抓取并声明首页与 `/guide/`。
- `public/favicon.svg`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`、`og.png`：闪电标记图标与 1200×630 分享图。
- `public/guide/index.html` + `public/guide/images/`：静态使用说明页，独立 canonical、`WebPage`/`BreadcrumbList`/`FAQPage` 结构化数据，两处站内链接指回应用。
- 文档：`README` 未受影响；`AGENTS.md`、`docs/TECHNICAL.md`、`Updates.md` 已同步。

## 自动检查

`npm run check`（2026-10-31 22:44）退出码 0：

- ESLint 通过。
- Node 逻辑测试 97 项通过、0 失败。
- Vitest/jsdom UI 测试 74 项通过。
- Vite 生产构建成功：`dist/index.html` 6.79 kB（gzip 2.23 kB），JS 265.15 kB（gzip 89.89 kB），CSS 32.07 kB（gzip 7.32 kB）。

构建产物一并包含：`dist/robots.txt`、`dist/sitemap.xml`、`dist/favicon.svg`、`dist/icon-192.png`、`dist/icon-512.png`、`dist/apple-touch-icon.png`、`dist/og.png`、`dist/guide/index.html`、`dist/guide/images/{import,study}.png`。

## 静态服务器路由

`python3 -m http.server 4173 --directory dist` 后逐个请求：

| 路径 | 状态 | Content-Type | 字节 |
| --- | --- | --- | --- |
| `/` | 200 | text/html | 6795 |
| `/robots.txt` | 200 | text/plain | 69 |
| `/sitemap.xml` | 200 | application/xml | 298 |
| `/guide/` | 200 | text/html | 23210 |
| `/guide` | 301 | — | 重定向到 `/guide/` |
| `/favicon.svg` | 200 | image/svg+xml | 227 |
| `/og.png` | 200 | image/png | 69948 |
| `/icon-192.png` | 200 | image/png | 7943 |
| `/icon-512.png` | 200 | image/png | 25245 |
| `/apple-touch-icon.png` | 200 | image/png | 6943 |
| `/guide/images/import.png` | 200 | image/png | 30029 |

## 结构化数据与 head 校验

用 Python 解析构建后的 HTML：

- 首页 JSON-LD 解析成功，`@graph` 类型为 `WebSite`、`Organization`、`WebApplication`；`WebApplication` 名称「闪词」、`applicationCategory` 为 `EducationalApplication`、`isAccessibleForFree` 为 true。
- 首页必需项全部存在：title、description、canonical、robots、`og:image`、`twitter:card`、icon、`sitemap` 链接。
- `/guide/` JSON-LD 解析成功，类型为 `WebPage`、`BreadcrumbList`、`FAQPage`；FAQPage 有 7 条，正文 `<details>` 也是 7 条，一一对应。
- 说明页目录 9 个锚点全部命中正文 id；两张图片文件存在。
- `sitemap.xml` 可被 XML 解析器读取，包含 `https://bdc.isaacbao.cn/` 与 `https://bdc.isaacbao.cn/guide/`。

## Chrome 检查

用 headless Chrome 156 + CDP 的 `Emulation.setDeviceMetricsOverride` 与 `Emulation.setEmulatedMedia` 模拟尺寸和配色，等页面加载、滚动触发懒加载后测量：

| 页面 | 视口 | 配色 | 横向溢出 | 图片 | 控制台错误 |
| --- | --- | --- | --- | --- | --- |
| 首页 | 1280×900 | light | 无（scrollWidth = clientWidth = 1280） | — | 0 |
| 首页 | 390×844 | light | 无（390 = 390） | — | 0 |
| `/guide/` | 1280×900 | light | 无（1280 = 1280） | 2/2 加载 | 0 |
| `/guide/` | 390×844 | light | 无（390 = 390） | 2/2 加载 | 0 |
| `/guide/` | 390×844 | dark | 无（390 = 390） | 2/2 加载 | 0 |

首页 React 仍正常挂载（`#root` 有 1 个子节点，页面文本为三步向导），标题已是「闪词 FlashVocab｜把单词表丢进来，三分钟开始背单词」，没有因为新增 head/noscript 出现布局或控制台问题。说明页在明暗两套配色下都读到 `body` 背景色与文字色，`<h1>` 唯一，9 个 `<h2>` 顺序正常。

截图（1×，桌面截图是首屏，移动截图是整页）：

- [home-1280-light.png](home-1280-light.png)
- [home-390-light.png](home-390-light.png)
- [guide-1280-light.png](guide-1280-light.png)
- [guide-390-light-full.png](guide-390-light-full.png)
- [guide-390-dark.png](guide-390-dark.png)

## 还没法在本机确认的部分

- Google 搜索结果页对自动请求弹「异常流量」人机验证，这台机器无法直接查 `site:bdc.isaacbao.cn` 或「闪词」的排名，`web_search` 也没有可用 API key。收录状态以 Search Console 为准。
- Search Console 的域名验证、sitemap 提交、请求编入属于站点所有者操作，本轮没有验证 token，所以没有加 `google-site-verification`。
- 线上部署依赖推送后托管平台重新构建；部署完成后按下节复查。

## 线上复查

（部署后补：首页 title、`/robots.txt`、`/sitemap.xml`、`/guide/`、`/og.png` 的状态码和内容。）
