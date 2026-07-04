# 部署 Client (Vite + React + Tailwind 前端)

`client/` 是一个纯静态的 SPA：Vite 构建后产出 `client/dist`，本身不含任何密钥或后端逻辑，所有对话请求都是打相对路径 `/api/ask`。**它不是独立部署的**——生产环境下由 `server/` 同源托管（见 `deploy-server.md`），这样浏览器端天然没有 CORS 问题，也不会暴露 AnythingLLM 的 API Key（Key 从头到尾只存在于 server 端）。

## 本地开发

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

`vite.config.ts` 里配置了开发代理：请求 `/api/*` 会被转发到 `http://localhost:4000`（即本地跑起来的 server，见 `deploy-server.md` 的本地开发部分）。所以本地联调时要两个终端分别起 client 和 server。

浏览器打开 `http://localhost:5173`，也可以用手机连同一个 Wi-Fi，访问电脑的局域网 IP + 5173 端口做真机联调（注意 Vite dev server 默认只监听 localhost，如果要手机访问需要 `npm run dev -- --host`）。

## 生产构建

```bash
cd client
npm run build         # 产出 client/dist
```

`dist/` 是纯静态文件（`index.html` + `assets/*.js|css` + `manifest.webmanifest` + `icons/`），构建产物本身不需要任何环境变量——所有配置（AnythingLLM 地址、Key、workspace）都只在 server 端设置。

这个构建步骤已经内置在仓库根目录的 `Dockerfile` 里（`client-build` 这个 stage 会自动执行 `npm run build`），走 `docker compose up --build` 部署时不需要手动构建 client。只有在**不用 Docker、手动跑 server**的场景下，才需要先手动 `npm run build` 出 `client/dist`，因为 server 生产模式会直接读这个目录（详见 `deploy-server.md`）。

## PWA / 添加到主屏幕

`index.html` 已经接好了 `manifest.webmanifest`、`apple-touch-icon`、`apple-mobile-web-app-capable` 等 meta，图标在 `public/icons/`（`icon.svg` 是矢量源文件，`icon-192.png`/`icon-512.png`/`apple-touch-icon.png` 是用 `rsvg-convert` 从它生成的）。

部署上线后，用手机浏览器打开地址（如 `http://<内网IP>:4000`）：
- **iOS Safari**：分享 → 添加到主屏幕。
- **Android Chrome**：菜单 → 添加到主屏幕 / 安装应用。

加进主屏幕后会全屏打开（`display: standalone`），没有浏览器地址栏。如果要换图标/名字，改 `public/icons/icon.svg` 后重新跑一遍 `rsvg-convert` 生成三个尺寸，再改 `public/manifest.webmanifest` 里的 `name`/`short_name`。

## 如果以后要跟 server 分开部署

当前架构默认是同源部署（一个 Docker 镜像里 server 顺带托管 client 的静态文件）。如果以后有需求把 client 单独放到别的静态托管（比如 CDN 或另一台机器），需要额外做两件事，目前**都还没实现**：

1. 让 client 请求的 `/api/ask` 改成完整的 server 地址（目前写死是相对路径）。
2. server 的 `/api/ask` 路由要加 CORS 响应头，允许 client 所在的域名跨域访问。

在没有这个需求之前，保持同源部署是最简单、也最不容易在移动端浏览器上出 CORS/Key 泄露问题的方案。
