# Seren

面向手机浏览器的极简 Web App：输入问题，一键发送给自托管的 [AnythingLLM](https://anythingllm.com/) 实例（通过其 Developer API），流式展示回答。

## 架构

```
[手机浏览器 / PWA] --same-origin--> [Node/Express 代理] --Bearer Key--> [AnythingLLM]
```

- `client/`：Vite + React + Tailwind CSS 前端，移动优先的单屏聊天界面，支持添加到手机主屏幕（PWA）。
- `server/`：Express 代理后端。AnythingLLM 的 Developer API Key **只存在于服务端环境变量**，浏览器永远看不到它；服务端与前端同源部署，避免了直接从浏览器调用 AnythingLLM 可能遇到的 CORS 问题。

## 配置

1. 在 AnythingLLM 里生成 Developer API Key（Settings → Developer API），并确认要对接的 workspace slug（在该 workspace 设置页 URL 中可见）。
2. 复制 `server/.env.example` 为 `server/.env`，填入：
   - `ANYTHINGLLM_BASE_URL`：AnythingLLM 实例地址（见 `.env.example` 中关于 Docker 网络 / host.docker.internal 的说明）
   - `ANYTHINGLLM_API_KEY`
   - `ANYTHINGLLM_WORKSPACE_SLUG`
   - `PORT`：本 app 自身监听的端口，默认 `4000`（刻意避开 AnythingLLM 常用的默认端口 `3001`，避免同机冲突）

## 本地开发

```bash
# 终端 1：后端
cd server
npm install
npm run dev        # tsx watch, 监听 $PORT（默认 4000）

# 终端 2：前端
cd client
npm install
npm run dev         # Vite dev server (5173)，/api 请求会自动代理到后端
```

浏览器打开 `http://localhost:5173`。

## 生产部署（Docker）

```bash
docker compose up --build
```

- 手机连接同一局域网后，浏览器访问 `http://<内网IP>:4000`，即可使用；点击浏览器菜单「添加到主屏幕」即可像 App 一样全屏使用。
- 如果 AnythingLLM 也跑在 Docker 里，参考 `docker-compose.yml` 里的注释把本服务加入它所在的 network，并把 `ANYTHINGLLM_BASE_URL` 改成 AnythingLLM 的容器服务名。
- 如果 AnythingLLM 是跑在宿主机上（例如桌面版 App），`ANYTHINGLLM_BASE_URL` 用 `http://host.docker.internal:<port>`。

## 目录结构

```
client/   Vite + React + Tailwind 前端（单屏聊天 UI + PWA manifest/图标）
server/   Express 代理后端（/api/ask，转发到 AnythingLLM /stream-chat 并透传 SSE）
Dockerfile         多阶段构建：client 静态资源 + server，最终由 server 同时提供两者
docker-compose.yml 生产部署入口
```
