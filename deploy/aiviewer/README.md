# AI Interview Agent 测试服务器部署

目标 `https://aiviewer.ai.maypharm.cn`，服务器 `101.200.145.196`，代码目录 `/ten-voice-agent/AI面试`，仓库分支 `main`。

## 当前状态（2026-09-22）

这些文件尚未在服务器执行。DNS 已指向目标 IP；SSH 登录仍被拒绝，目标 HTTPS 当前证书域名不匹配。2026-09-22 外部检查 new-api HTTPS、Dify 8888（跟随跳转）均返回 200。

本地已验证：Compose 语法、面试图连接完整性、Linux amd64 镜像构建、API/前端/代理健康检查、容器重启恢复和 API 退出后的自动恢复。启动时检查必需环境变量；缺项只输出变量名，退出非零。检查使用占位凭据且未发布宿主端口，没有进行真实语音或服务器 Dify 联调。远程端口、代理布局、HTTPS 和正式凭据仍待可用 SSH 登录后验证。

TEN 的 Go/Next.js 平台本身没有 PostgreSQL 或 Redis 数据层。面试会话存于 Dify。用户是否继续使用服务器现有 Dify 数据层，或要求独立 RDS，尚待确认。不要仅填写 DB_HOST 等未被代码使用的变量后声称已接入 RDS，也不要迁移/修改现有 Dify 数据库。若要求独立持久化，需要先明确数据范围并实现对应适配。

## 1. 只读检查

登录后先执行 `docker ps`、`ss -tulpn`，确认 3001 可用，并检查 CPU、内存和磁盘。确认现有 Nginx 是宿主服务还是容器，读取其挂载路径与网络。不占用已有 80/443/3000/8000/8001/8080/8888，不调整服务器全局防火墙或已有安全组规则，以免影响现有服务。

备份现有代理配置及 `nginx -T` 输出到服务器 root 私有目录（权限 700/600），不要提交到 Git。记录已有服务访问结果、容器状态及数据库配置摘要（不输出密码）。

## 2. 代码与配置

在目标目录不存在时克隆仓库 main；已存在则先检查，不覆盖本地改动。部署文件应随经检查的提交进入仓库，或以明确文件清单同步到该目录。不要同步本地 .env、node_modules 或本机安装产物。

```bash
cd '/ten-voice-agent/AI面试/deploy/aiviewer'
cp .env.example .env
chmod 600 .env
```

通过受控方式填写 Agora、字节 ASR/TTS 及服务器 Dify 专用 Chatflow API Key。DIFY_API_KEY 和 DIFY_CHATFLOW_API_KEY 指向该专用应用；本机 Dify Key 不能直接用于服务器 Dify。DIFY_BASE_URL 必须从新容器内可达，模板中的宿主机 8888 仅为待核实示例。

当前本地 Chatflow 与服务器 Dify 独立；需要在服务器新增/导入专用“AI面试”Chatflow，配置模型、提示词、代码节点和会话变量并发布，不覆盖旧应用。仓库 `ai_agents/agents/examples/demo/dify/` 保存提示词与代码节点逻辑。导入前确认服务器 Dify 版本兼容性。

## 3. 独立构建与运行

Compose 项目 `ten-voice-ai-interview`；容器 `ten-voice-ai-interview`；网络 `aiviewer-interview`。

Dockerfile 只复制面试所需源码，依赖在镜像构建时安装，容器重启不重新安装。构建上下文排除 .env、证书、依赖缓存。镜像只保留 `va_dify_azure` 图，不修改源仓库的其他图。镜像包含 TEN API 与生产模式 Next.js；不运行 Designer。

```bash
docker compose --env-file .env config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose exec -T app curl -fsS http://127.0.0.1:8080/health
curl -I http://127.0.0.1:3001
```

只有前端绑定 `127.0.0.1:3001`，API 8080 仅在容器内，不发布到宿主。若 3001 被占用，改 .env 的 APP_HTTP_PORT，并同步代理 upstream。`restart: unless-stopped` 随 Docker 恢复。确认 Docker 本身随系统启动。

## 4. 独立 Nginx vhost 与 HTTPS

模板 `nginx/*.conf` 默认用于宿主 Nginx，不可未经检查直接套入 Docker Nginx。

- 宿主 Nginx：upstream 使用 `127.0.0.1:3001`。
- Docker Nginx：必须确认可达路由。可把已有 Nginx 持久加入独立 `aiviewer-interview` 网络，upstream 使用 `aiviewer-interview:3000`；新增网络要记录在该代理的 Compose override 中，不能只做一次临时 `docker network connect`。先备份、验证修改范围，不重建整个 Dify 栈。
- 证书和 ACME webroot 必须对实际 Nginx 可见；容器代理需要检查挂载。不要在已有 Docker Nginx 前再装一个占用 80/443 的宿主 Nginx。

先检查服务器现有证书的 SAN：只有包含 `aiviewer.ai.maypharm.cn` 或 `*.ai.maypharm.cn` 的有效证书才能复用。`*.maypharm.cn` 不覆盖它；`*.api.maypharm.cn` 只覆盖类似 `kuake.api.maypharm.cn` 的域名。若可复用，在新域名配置中填写已有证书路径，并确认续期安排。

若没有覆盖本域名的证书，先安装本域名单独的 `http-bootstrap.conf`，验证并 reload。使用已有 ACME 工具优先；若无工具，准备独立 Certbot webroot 目录。证书申请仅使用本域名：

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d aiviewer.ai.maypharm.cn --agree-tos --register-unsafely-without-email
```

有管理员邮箱时优先改用 `--email <管理员邮箱>`。证书签发后，用完整 HTTPS vhost 替换该 bootstrap 文件，不把两份同时启用。只修改这个新域名配置。

按实际运行方式二选一：

```bash
nginx -t && nginx -s reload
# 或（实际容器名可能不同）
docker exec docker-nginx-1 nginx -t && docker exec docker-nginx-1 nginx -s reload
```

配置持久化续期任务与成功续期后的代理 reload hook，并执行 `certbot renew --dry-run`。不要用跳过 TLS 校验的请求作为证书有效的验收依据。

## 5. 验收与回滚

运行 `bash scripts/verify.sh`；在服务器本地私密查看本应用日志（可能含用户对话或凭据，分享前脱敏）。完整验收还应包括：麦克风授权、语音问答、12题报告、结束后不重复出题；重启本应用容器后恢复；证书域名和有效期；现有 new-api 与 Dify 的前后对比。不要重启宿主机来验证本应用。

RDS 连接未实现或未经实际连接验证时，验收应明确“不适用/待确认”，不得标为成功。不要开放 5432、6379、3001、4000 或 Docker API。安全组收紧 22 必须有已验证的管理员 IP 和其他运维访问清单后再做，不能按假设阻断现有服务。

回滚仅停止此 Compose 项目并撤销本域名 vhost、恢复本次改动的代理配置；先 `nginx -t` 再 reload。不要执行现有 Dify/new-api 的 `docker compose down`，不清理共享 Docker 数据或卷。
