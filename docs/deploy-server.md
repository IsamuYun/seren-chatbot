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

- **AnythingLLM 是一个能通过公网/内网域名访问的远程实例**（比如 `https://your-anythingllm-domain.example.com`）→ 直接填那个完整 URL 即可，不用管 Docker 网络。这是最简单、也是实际验证过能跑通的方式：本 server 不管部署在哪台机器、是否在 Docker 里，都只是对外发一个普通 HTTPS 请求。
- **AnythingLLM 是宿主机上的桌面版 App / 直接跑在 host 上**，而本 server 跑在 Docker 容器里 → 用 `http://host.docker.internal:<AnythingLLM端口>`（一般是 `3001`）。`docker-compose.yml` 里已经加了 `extra_hosts: host.docker.internal:host-gateway`，Mac/Windows/Linux（含 Ubuntu）都能解析这个地址。
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

## 部署到 Ubuntu 24.04

### 一键脚本（推荐）

仓库根目录的 `install.sh` 把下面「手动方式」的所有步骤（装 Docker、装 nginx、生成 `.env`、`docker compose up -d --build`、配置 nginx 反向代理、可选 certbot 自动 HTTPS）自动化成了一条命令。在一台干净的 Ubuntu 24.04 服务器上：

```bash
git clone <你的仓库地址> seren-chatbot
cd seren-chatbot
sudo ./install.sh
```

交互式运行时脚本会依次问你缺的配置项（AnythingLLM 地址/Key/workspace、要用的域名、certbot 邮箱）。也可以完全无人值守，提前把答案都塞进环境变量：

```bash
sudo DOMAIN=chat.example.com CERTBOT_EMAIL=you@example.com \
     ANYTHINGLLM_BASE_URL=https://kb.example.com \
     ANYTHINGLLM_API_KEY=xxxx \
     ANYTHINGLLM_WORKSPACE_SLUG=my-workspace \
     ./install.sh
```

- 不提供 `DOMAIN` → 只配 HTTP 反向代理（`http://<服务器IP>/`），不碰 certbot。
- 提供了 `DOMAIN` 但没给 `CERTBOT_EMAIL` → nginx 反代配好，但跳过自动申请证书，脚本会打印出之后手动补跑 certbot 的命令。
- `server/.env` 已存在时脚本不会覆盖它——改配置直接编辑该文件，然后重新跑脚本让它 `docker compose up -d --build` 一下即可，不会重新问一遍。
- 脚本可以安全地重复执行（幂等）：已经装过的东西会跳过，已有的证书 certbot 会自动续期/复用。

如果服务器上还没有 clone 仓库，也可以直接用 `curl | sudo bash` 的方式，脚本会自己把仓库 clone 到 `/opt/seren-chatbot`（可用 `INSTALL_DIR` 环境变量改路径）：

```bash
curl -fsSL https://raw.githubusercontent.com/IsamuYun/seren-chatbot/main/install.sh | sudo bash
```

以下是脚本自动化的具体步骤，想手动控制细节，或者排查脚本某一步失败原因时可以对照看。

### 1. 安装 Docker Engine + Compose 插件

Ubuntu 官方仓库里的 `docker.io` 版本较旧，建议装 Docker 官方仓库的版本：

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 开机自启 + 当前用户免 sudo 跑 docker（重新登录一次生效）
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

验证：`docker run hello-world`。

### 2. 把代码放到服务器上

```bash
git clone <你的仓库地址> seren-chatbot
cd seren-chatbot
```

没有 git 仓库的话也可以直接 `rsync -av --exclude node_modules --exclude dist ./ user@server:/opt/seren-chatbot/`。

### 3. 配置环境变量

```bash
cp server/.env.example server/.env
vim server/.env   # 填 ANYTHINGLLM_BASE_URL / ANYTHINGLLM_API_KEY / ANYTHINGLLM_WORKSPACE_SLUG
```

`server/.env` 已经在 `.gitignore` 里，不会被提交；用 `scp`/`rsync` 传代码时也要注意别把本地的 `.env` 一起传上去覆盖，或者干脆只在服务器上单独创建。

### 4. 启动应用

```bash
docker compose up -d --build
docker compose logs -f web   # 看启动日志，确认没有报 "Missing required environment variable"
```

此时应用已经能在 `http://<服务器IP>:4000` 直接访问了。如果只是内网自用、不需要域名/HTTPS，开一下防火墙就够了：

```bash
sudo ufw allow 4000/tcp
```

如果要走下面的 nginx 反向代理（推荐用于公网访问），就不要对外开放 `4000`，只开 nginx 的 `80`/`443`——见第 5、6 步。

### 5. 用 nginx 做反向代理

仓库里的 `deploy/nginx/seren-chatbot.conf.template` 是现成的反代模板（关键点：`/api/ask` 是 SSE 流式响应，模板里已经关掉了 `proxy_buffering`，否则打字机效果会被 nginx 攒成一次性输出）。手动套用：

```bash
sudo apt install -y nginx

# 把模板里的占位符换成实际值
DOMAIN=chat.example.com   # 没有域名就用你的服务器 IP，或者随便填个占位符
sudo sed -e "s/__SERVER_NAME__/${DOMAIN}/g" -e "s/__APP_PORT__/4000/g" \
  deploy/nginx/seren-chatbot.conf.template | sudo tee /etc/nginx/sites-available/seren-chatbot > /dev/null

sudo ln -sf /etc/nginx/sites-available/seren-chatbot /etc/nginx/sites-enabled/seren-chatbot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

现在 `http://<域名或服务器IP>/` 会反代到本机的 `4000` 端口。

### 6. 开放防火墙端口（走 nginx 的情况）

```bash
sudo ufw allow 'Nginx Full'      # 放行 80 + 443
sudo ufw delete allow 4000/tcp   # 如果之前开过，收回，不让外部绕过 nginx 直连 4000
```

### 7. 用 certbot 自动配置 HTTPS（需要一个已解析到这台服务器的域名）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chat.example.com -m you@example.com --agree-tos --redirect
```

`--redirect` 会让 certbot 顺手把 nginx 的 80 端口配置改成自动跳转到 https。证书到期前 certbot 装的定时任务会自动续期，不用手动管。

### 可选：不用 Docker，直接用 systemd 跑 Node 进程

如果不想用 Docker，可以装 Node 22（推荐用 [NodeSource](https://github.com/nodesource/distributions) 或 `nvm`），手动构建后用 systemd 常驻：

```bash
# 安装 Node 22（NodeSource 方式）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 构建
cd /opt/seren-chatbot/client && npm ci && npm run build
cd /opt/seren-chatbot/server && npm ci && npm run build
```

`/etc/systemd/system/seren-chatbot.service`：

```ini
[Unit]
Description=Seren chatbot server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/seren-chatbot/server
EnvironmentFile=/opt/seren-chatbot/server/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now seren-chatbot
sudo systemctl status seren-chatbot
```

systemd 方式跑起来的 Node 进程一样可以按上面第 5-7 步接 nginx + certbot，只是把 `proxy_pass` 指向的端口换成 systemd 服务实际监听的 `PORT` 即可。

## 踩过的坑

- **端口冲突**：最初把本服务默认端口也设成了 `3001`，结果和本机已经在跑的 AnythingLLM 撞了端口，`curl` 请求被 AnythingLLM 而不是本服务接住，报了一个莫名其妙的 404。后来把默认端口改成了 `4000` 并在 `config.ts`、`.env.example`、`vite.config.ts`、`Dockerfile`/`docker-compose.yml` 里都同步更新。如果你看到请求响应对不上、或者日志里端口和预期不一致，先用 `lsof -i :<port>` 确认端口没被其他进程占用。
- **`host.docker.internal` 在 Linux 上默认不通**：这个域名是 Docker Desktop（Mac/Windows）的特有能力，纯 Docker Engine（Ubuntu 就是）默认不解析。已经在 `docker-compose.yml` 里加了 `extra_hosts: host.docker.internal:host-gateway`（Docker 20.10+ 支持）来补上，三个平台现在行为一致。
- **`install.sh` 里 certbot 失败不该拖垮整个部署**：域名 DNS 还没生效、或者邮箱格式被 ACME 服务器拒绝时 certbot 会报错退出。脚本里已经把这一步的失败单独 catch 住，只打印警告和补救命令，不会因为 `set -e` 把前面已经跑通的「应用 + HTTP 反代」也标记成失败退出。
- **`install.sh` 里的 `systemctl` 调用做了防御性判断**：真实的 Ubuntu 24.04 服务器都有 systemd，但脚本在没有 `systemctl` 的最小化环境（比如某些容器）里跑时不会因为这一步直接崩掉，而是打印一句跳过提示继续往下走。
