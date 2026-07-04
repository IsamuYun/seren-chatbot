#!/usr/bin/env bash
# 一键在 Ubuntu 24.04 上安装/更新 Seren chatbot：
#   - 按需安装 Docker Engine、nginx、certbot
#   - 生成 server/.env（交互式提问，或从环境变量读取，便于无人值守运行）
#   - docker compose up -d --build
#   - 配置 nginx 反向代理，域名+邮箱都给了的话自动用 certbot 申请 HTTPS
#
# 用法：
#   sudo ./install.sh                     # 交互式，会依次询问缺的配置项
#   sudo DOMAIN=chat.example.com CERTBOT_EMAIL=you@example.com \
#        ANYTHINGLLM_BASE_URL=https://kb.example.com \
#        ANYTHINGLLM_API_KEY=xxx ANYTHINGLLM_WORKSPACE_SLUG=my-ws \
#        ./install.sh                     # 全自动无人值守
#
# 也可以不预先 clone，直接：
#   curl -fsSL https://raw.githubusercontent.com/IsamuYun/seren-chatbot/main/install.sh | sudo bash

set -euo pipefail

log() { echo -e "\033[1;32m[install]\033[0m $*"; }
err() { echo -e "\033[1;31m[install]\033[0m $*" >&2; }

# 有的最小化环境（比如某些容器）没有 systemd，systemctl 不存在就跳过并提示，
# 而不是直接把整个脚本搞挂掉——真实的 Ubuntu 24.04 服务器/云主机都有 systemd。
svc() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl "$@"
  else
    err "没有找到 systemctl，跳过：systemctl $*（如果这不是标准的 Ubuntu 服务器环境，需要自己手动管理服务启动）"
  fi
}

if [[ $EUID -ne 0 ]]; then
  err "请用 root 权限运行，例如：sudo ./install.sh"
  exit 1
fi

REPO_URL_HTTPS="${REPO_URL_HTTPS:-https://github.com/IsamuYun/seren-chatbot.git}"
REPO_URL_SSH="${REPO_URL_SSH:-git@github.com:IsamuYun/seren-chatbot.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/seren-chatbot}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git gnupg

# ---------- 0. 定位 / 拉取项目代码 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  PROJECT_DIR="$SCRIPT_DIR"
  log "在已有项目目录里运行，直接使用：$PROJECT_DIR"
else
  PROJECT_DIR="$INSTALL_DIR"
  if [[ -d "$PROJECT_DIR/.git" ]]; then
    log "$PROJECT_DIR 已存在 git 仓库，跳过 clone"
  else
    log "克隆仓库到 $PROJECT_DIR"
    git clone "$REPO_URL_HTTPS" "$PROJECT_DIR" 2>/dev/null || git clone "$REPO_URL_SSH" "$PROJECT_DIR"
  fi
fi
cd "$PROJECT_DIR"

# ---------- 1. Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  svc enable --now docker
else
  log "Docker 已安装，跳过"
fi

# ---------- 2. nginx ----------
if ! command -v nginx >/dev/null 2>&1; then
  log "安装 nginx..."
  apt-get install -y nginx
  svc enable --now nginx
else
  log "nginx 已安装，跳过"
fi

# ---------- 3. server/.env ----------
ENV_FILE="$PROJECT_DIR/server/.env"

if [[ -f "$ENV_FILE" ]]; then
  log "$ENV_FILE 已存在，跳过生成（如需改配置，直接编辑该文件后重新运行本脚本即可复用）"
else
  log "配置 AnythingLLM 连接信息"
  : "${PORT:=4000}"
  : "${ANYTHINGLLM_BASE_URL:=}"
  : "${ANYTHINGLLM_API_KEY:=}"
  : "${ANYTHINGLLM_WORKSPACE_SLUG:=}"

  if [[ -z "$ANYTHINGLLM_BASE_URL" && -t 0 ]]; then
    read -rp "AnythingLLM 地址（如 https://kb.example.com，不带末尾斜杠）: " ANYTHINGLLM_BASE_URL
  fi
  if [[ -z "$ANYTHINGLLM_API_KEY" && -t 0 ]]; then
    read -rp "AnythingLLM Developer API Key: " ANYTHINGLLM_API_KEY
  fi
  if [[ -z "$ANYTHINGLLM_WORKSPACE_SLUG" && -t 0 ]]; then
    read -rp "AnythingLLM workspace slug: " ANYTHINGLLM_WORKSPACE_SLUG
  fi

  if [[ -z "$ANYTHINGLLM_BASE_URL" || -z "$ANYTHINGLLM_API_KEY" || -z "$ANYTHINGLLM_WORKSPACE_SLUG" ]]; then
    err "缺少 AnythingLLM 配置。请设置环境变量 ANYTHINGLLM_BASE_URL / ANYTHINGLLM_API_KEY / ANYTHINGLLM_WORKSPACE_SLUG 后重新运行（无人值守场景），或交互式运行本脚本手动输入。"
    exit 1
  fi

  cat > "$ENV_FILE" <<EOF
PORT=${PORT}
ANYTHINGLLM_BASE_URL=${ANYTHINGLLM_BASE_URL}
ANYTHINGLLM_API_KEY=${ANYTHINGLLM_API_KEY}
ANYTHINGLLM_WORKSPACE_SLUG=${ANYTHINGLLM_WORKSPACE_SLUG}
EOF
  chmod 600 "$ENV_FILE"
  log "已写入 $ENV_FILE"
fi

APP_PORT="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2)"
APP_PORT="${APP_PORT:-4000}"

# ---------- 4. 构建并启动容器 ----------
log "构建并启动容器（docker compose up -d --build）..."
docker compose up -d --build

# ---------- 5. nginx 反向代理 ----------
: "${DOMAIN:=}"
if [[ -z "$DOMAIN" && -t 0 ]]; then
  read -rp "用于 nginx/HTTPS 的域名（留空则只做 HTTP 反代，不申请证书）: " DOMAIN
fi

SERVER_NAME="${DOMAIN:-_}"
NGINX_SITE=/etc/nginx/sites-available/seren-chatbot

sed \
  -e "s/__SERVER_NAME__/${SERVER_NAME}/g" \
  -e "s/__APP_PORT__/${APP_PORT}/g" \
  "$PROJECT_DIR/deploy/nginx/seren-chatbot.conf.template" > "$NGINX_SITE"

mkdir -p /etc/nginx/sites-enabled
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/seren-chatbot
rm -f /etc/nginx/sites-enabled/default

nginx -t
svc reload nginx
log "nginx 反向代理已生效：80 -> 127.0.0.1:${APP_PORT}"

# ---------- 6. 防火墙 ----------
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null || true
  ufw delete allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
  log "ufw：已放行 Nginx Full (80/443)，并移除对外直接开放 ${APP_PORT} 端口的规则（如果之前有加过的话）"
fi

# ---------- 7. HTTPS（可选） ----------
if [[ -n "$DOMAIN" ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    log "安装 certbot..."
    apt-get install -y certbot python3-certbot-nginx
  fi

  : "${CERTBOT_EMAIL:=}"
  if [[ -z "$CERTBOT_EMAIL" && -t 0 ]]; then
    read -rp "证书到期提醒邮箱: " CERTBOT_EMAIL
  fi

  if [[ -n "$CERTBOT_EMAIL" ]]; then
    if certbot --nginx -d "$DOMAIN" -m "$CERTBOT_EMAIL" --agree-tos -n --redirect; then
      log "HTTPS 已配置完成：https://${DOMAIN}"
    else
      err "certbot 申请证书失败（常见原因：域名还没解析到这台服务器的 IP，或者刚改的 DNS 还没生效）。"
      err "应用本身和 HTTP 反向代理已经正常工作，域名解析好之后重新运行本脚本，或手动执行：certbot --nginx -d ${DOMAIN} -m ${CERTBOT_EMAIL} --agree-tos --redirect"
    fi
  else
    err "没有提供邮箱，跳过自动申请证书。之后可以手动运行：certbot --nginx -d ${DOMAIN}"
  fi
else
  log "未提供域名，跳过 HTTPS。当前是纯 HTTP 反向代理：http://<服务器IP>/"
fi

log "完成。用 'docker compose logs -f web' 查看应用日志。"
