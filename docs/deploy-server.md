# 部署 Server (Express 代理)

`server/` 是持有 AnythingLLM Developer API Key 的代理后端，生产模式下还会同时托管 `client/` 构建出的静态文件（同源部署，浏览器不需要单独知道 server 地址）。

## 环境变量

复制 `server/.env.example` 为 `server/.env`：

| 变量 | 说明 |
|---|---|
| `PORT` | 本服务监听端口，默认 `4000`。**故意避开 `3001`**——AnythingLLM（无论是桌面版还是 Docker 版）默认就监听 `3001`，两者装在同一台机器上会端口冲突。 |
| `ANYTHINGLLM_BASE_URL` | AnythingLLM 实例地址，不带末尾斜杠。见下方「网络配置」。 |
| `ANYTHINGLLM_API_KEY` | AnythingLLM 里 Settings → Developer API 生成的 Key。 |
| `ANYTHINGLLM_WORKSPACE_SLUG` | 要对接的 workspace slug（该 workspace 设置页 URL 里能看到）。 |

## 本地开发（不打包）

```bash
cd server
npm install
npm run dev        # tsx watch src/index.ts，热重载
```

此模式下 `NODE_ENV` 不是 `production`，server 只提供 `/api/ask` 接口，不会 serve 静态文件——前端单独用 `npm run dev`（见 `deploy-client.md`），Vite 会把 `/api` 请求代理过来。

## 生产构建（不用 Docker，直接跑 Node）

前提：`client/dist` 已经构建好（`cd client && npm run build`），因为 `server/src/index.ts` 里生产模式会去读 `../../client/dist`（相对 `server/dist`，也就是仓库根目录下的 `client/dist`）。

```bash
cd server
npm install
npm run build       # tsc -p tsconfig.json -> server/dist
NODE_ENV=production npm start   # node dist/index.js
```

## Docker 部署（推荐）

仓库根目录的 `Dockerfile` 是多阶段构建：先分别构建 `client` 和 `server`，最终镜像里由 server 同时提供 API 和静态文件，`EXPOSE 4000`。

### 单独用 docker build/run 验证

```bash
docker build -t seren-chatbot .
docker run -d --name seren -p 4000:4000 \
  -e PORT=4000 \
  -e ANYTHINGLLM_BASE_URL=http://host.docker.internal:3001 \
  -e ANYTHINGLLM_API_KEY=xxxx \
  -e ANYTHINGLLM_WORKSPACE_SLUG=your-workspace \
  seren-chatbot
```

### docker compose（日常使用）

```bash
docker compose up --build
```

`docker-compose.yml` 默认读取 `server/.env` 作为 env file。局域网内其它设备访问 `http://<本机内网IP>:4000` 即可。

## 网络配置：`ANYTHINGLLM_BASE_URL` 怎么填

取决于 AnythingLLM 实例跑在哪：

- **AnythingLLM 是宿主机上的桌面版 App / 直接跑在 host 上**，而本 server 跑在 Docker 容器里 → 用 `http://host.docker.internal:<AnythingLLM端口>`（一般是 `3001`）。这是我们本地联调时验证过的方式。
- **AnythingLLM 也是 Docker 容器，且和本 server 在同一个 docker-compose network** → 用 AnythingLLM 的容器服务名，例如 `http://anythingllm:3001`。需要在 `docker-compose.yml` 里把 `web` 服务加入那个 network（文件里已经留了注释示例）。
- **本 server 也不跑在 Docker 里，直接 `npm start`** → 用 `http://localhost:3001`（或 AnythingLLM 实际监听的地址）。

## 部署后如何验证

1. **静态页面能出来**：`curl -s http://<host>:4000/ | head` 应该能看到 `<!doctype html>`。
2. **PWA manifest 能访问**：`curl -o /dev/null -w '%{http_code}\n' http://<host>:4000/manifest.webmanifest` 应该是 `200`。
3. **代理链路通不通**（这一步会真的调用 AnythingLLM，注意会消耗对话额度）：
   ```bash
   curl -N -X POST http://<host>:4000/api/ask \
     -H "Content-Type: application/json" \
     -d '{"message":"你好"}'
   ```
   正常应该看到一串 `data: {...}` 的 SSE chunk 逐个吐出来，最后一条 `close:true`。如果看到 `data: {"type":"error",...}`，说明 `ANYTHINGLLM_BASE_URL` / `ANYTHINGLLM_API_KEY` / `ANYTHINGLLM_WORKSPACE_SLUG` 有一个配错了，或者 AnythingLLM 没启动/network 不通。

## 踩过的坑

- **端口冲突**：最初把本服务默认端口也设成了 `3001`，结果和本机已经在跑的 AnythingLLM 撞了端口，`curl` 请求被 AnythingLLM 而不是本服务接住，报了一个莫名其妙的 404。后来把默认端口改成了 `4000` 并在 `config.ts`、`.env.example`、`vite.config.ts`、`Dockerfile`/`docker-compose.yml` 里都同步更新。如果你看到请求响应对不上、或者日志里端口和预期不一致，先用 `lsof -i :<port>` 确认端口没被其他进程占用。
