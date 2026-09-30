# AI Interview Agent：腾讯云镜像仓库 + Sealos 部署说明

维护日期：2026-09-30。

部署顺序：**准备工具和凭证 → 构建 linux/amd64 镜像 → 推送腾讯云镜像仓库 → 验证镜像 → 使用 Sealos skill 部署或更新 → 验收。**

本说明不修改 Sealos skill。应用镜像使用腾讯云仓库；Dockerfile 的基础镜像目前仍来自 GHCR，构建机需要能访问它。

## 1. 项目和当前部署

| 项目 | 配置 |
| --- | --- |
| 代码仓库 | https://github.com/zhaomeiniu5658/ten-framework-voice-dify.git |
| 分支 | `main` |
| 本机目录 | `/Users/zhaoy/Documents/project/ten-framework-voice-dify` |
| Dockerfile | `deploy/aiviewer/Dockerfile` |
| 构建上下文 | 项目根目录 |
| 架构 | `linux/amd64` |
| 腾讯云镜像仓库 | `ccr.ccs.tencentyun.com/tenvoice/ten-voice-ai-interview` |
| Sealos 区域 | `hzh.sealos.run` |
| 命名空间 | `ns-udky0j90` |
| 当前应用 / Deployment | `ten-voice-ai-interview-pqehcrgg` |
| 访问地址 | https://ten-voice-ai-interview-ycudzago.sealoshzh.site |
| 前端 / 内部 API 端口 | `3000` / `8080` |

编写时只读核对：当前 Deployment 有 1 个就绪副本，镜像来自上述腾讯云仓库。后续更新应重新核对 `.sealos/state.json` 和线上资源，不能仅凭本表判断部署成功。旧应用 `ten-voice-ai-interview-nabupmfv` 和旧访问地址不作为本说明的默认更新目标。

只更新本应用，不修改 Dify、new-api、其他应用、共享数据库或 Redis。

## 2. 安装 TCCLI 和基础工具

TCCLI 是腾讯云 API 命令行工具，用于查询、管理腾讯云资源；镜像构建和上传由 Docker 完成。安装 TCCLI 不会自动创建镜像仓库，也不等于完成 Docker 仓库登录。

官方源码仓库：https://github.com/TencentCloud/tencentcloud-cli

macOS 可通过官方 Homebrew 仓库安装：

```bash
brew tap tencentcloud/tccli
brew install tccli
tccli --version
```

如果需要下载源码并安装，使用独立目录和虚拟环境，避免混入业务项目：

```bash
mkdir -p "$HOME/tools"
git clone https://github.com/TencentCloud/tencentcloud-cli.git "$HOME/tools/tencentcloud-cli"
python3 -m venv "$HOME/.venvs/tencentcloud-cli"
source "$HOME/.venvs/tencentcloud-cli/bin/activate"
python -m pip install "$HOME/tools/tencentcloud-cli"
tccli --version
```

两种安装方式选一种；已有可用 TCCLI 时无需重复安装。源码方式后续打开终端需再次激活虚拟环境。

检查其余工具，Docker Desktop 需要已启动：

```bash
git --version
docker version
docker buildx version
kubectl version --client
node --version
python3 --version
```

Sealos skill 的 Node 辅助脚本需要 Node.js 18+；模板校验需要 Python 3.8+ 和 PyYAML。缺少依赖时按 skill 的前置检查补齐。

## 3. 腾讯云授权和镜像仓库

支持浏览器授权的 TCCLI 版本可执行：

```bash
tccli auth login
```

若该版本没有 `auth` 命令，使用 `tccli configure`，仅在本机终端交互填写云 API 凭证、地域和输出格式。不要把 SecretId、SecretKey 发到聊天或写入仓库；不要运行会输出凭证配置的诊断命令。

在腾讯云容器镜像服务控制台确认仓库：

- 仓库地址：`ccr.ccs.tencentyun.com/tenvoice/ten-voice-ai-interview`。
- 命名空间：`tenvoice`；仓库名：`ten-voice-ai-interview`。
- 优先使用私有仓库，并准备 Sealos 拉取权限。
- 若该仓库在当前账号下不存在，先核对账号、地域和仓库类型，再创建对应仓库；不要直接购买新的企业版实例。
- 企业版实例有独立域名，必须使用其控制台给出的域名，不能照抄个人版地址。

云 API 凭证与 Docker Registry 登录凭证是两类凭证。请在目标仓库控制台取得 Docker 登录用户名和密码/令牌；不要假设云 API SecretKey 就是仓库密码。

登录目标仓库，密码在交互提示中输入：

```bash
export TCR_REGISTRY='ccr.ccs.tencentyun.com'
docker login "$TCR_REGISTRY"
```

登录成功后继续。临时凭证有有效期；Sealos 后续扩容、重建也要能拉取镜像，因此需使用适当有效期的拉取凭证并安排轮换。

## 4. 安装并使用 Sealos skill

Sealos skill 来源：https://github.com/labring/sealos-skills

按插件 README 安装；若本机已经安装并可调用，跳过：

```bash
codex plugin marketplace add labring/sealos-skills
codex plugin add sealos@sealos
```

在桌面应用中选择 Sealos 插件，或直接要求智能体使用 `sealos:sealos-deploy`。下面是可复制到聊天框的部署指令，**不是终端命令**：

```text
使用 sealos:sealos-deploy 更新当前 AI Interview Agent。
先读取 .sealos/state.json，并与 Sealos 实际应用、命名空间、镜像和地址核对。
先构建 linux/amd64 镜像并推送到腾讯云仓库
ccr.ccs.tencentyun.com/tenvoice/ten-voice-ai-interview，
确认推送成功、摘要和架构正确、Sealos 有拉取权限后再更新应用。
应用必须在 Sealos 应用管理中可见。
保留线上 Dify、ASR、TTS、Agora 和报告模型配置。
只更新本应用，不修改其他项目，不重复创建应用。
完成 rollout、入口、接口、日志与至少 60 秒稳定性检查，记录语音验收结果。
```

skill 的既有镜像构建辅助脚本主要覆盖 GHCR / Docker Hub。本项目明确选择腾讯云时，应使用下面的 Docker 命令完成构建推送，再把已验证的腾讯云镜像交给 skill 的部署阶段；不要让默认仓库检测切回 GHCR。

## 5. 连接 Sealos 并确认目标

从 Sealos 控制台取得当前工作区 kubeconfig，保存到 `~/.sealos/kubeconfig`，不要展示内容或提交 Git。

```bash
chmod 600 "$HOME/.sealos/kubeconfig"
export KUBECONFIG="$HOME/.sealos/kubeconfig"
export NS='ns-udky0j90'
export APP='ten-voice-ai-interview-pqehcrgg'
export APP_URL='https://ten-voice-ai-interview-ycudzago.sealoshzh.site'

kubectl --insecure-skip-tls-verify -n "$NS" get deployment "$APP"
kubectl --insecure-skip-tls-verify -n "$NS" get pods -l app="$APP"
kubectl --insecure-skip-tls-verify -n "$NS" get deployment "$APP" \
  -o jsonpath='{.spec.template.spec.containers[*].name}{"\n"}{.spec.template.spec.containers[*].image}{"\n"}{.spec.replicas}{"\n"}'
```

这里的 Kubernetes 参数沿用当前 Sealos skill 的约定，不能用于网站 HTTPS 验收。部署前记录原镜像摘要、实际副本数、存储挂载和就绪状态。若应用暂停，先确认是否恢复运行；若状态文件缺失或与线上不符，先由 skill 核对并修复部署记录。

不要输出完整 Deployment YAML、Secret 或环境变量，这些内容可能包含凭证。

## 6. 构建并推送腾讯云镜像

在项目根目录执行。工作区有未提交改动时先确认本次要部署的代码范围，不覆盖本地修改。

```bash
cd /Users/zhaoy/Documents/project/ten-framework-voice-dify
git status --short
git rev-parse --short HEAD
node ai_agents/agents/examples/demo/frontend/scripts/test-interview-report.cjs

export IMAGE_REPO='ccr.ccs.tencentyun.com/tenvoice/ten-voice-ai-interview'
export IMAGE_TAG="$(git rev-parse --short HEAD)-$(date +%Y%m%d-%H%M%S)"
export IMAGE_REF="$IMAGE_REPO:$IMAGE_TAG"
mkdir -p "$HOME/.sealos/logs"
export DEPLOY_LOG="$HOME/.sealos/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

set -o pipefail
docker buildx build \
  --platform linux/amd64 \
  -f deploy/aiviewer/Dockerfile \
  -t "$IMAGE_REF" \
  --push . 2>&1 | tee "$DEPLOY_LOG"
```

`--push` 会在构建完成后上传镜像。只有命令成功退出且 manifest 上传完成，才能进入部署阶段。不要用根目录不存在的 Dockerfile，也不要重复使用 `main/latest` 作为每次发布的唯一标识。

查看日志和远程镜像：

```bash
tail -n 50 "$DEPLOY_LOG"
docker buildx imagetools inspect "$IMAGE_REF"
```

确认镜像包含 `linux/amd64`，记录远程返回的 `sha256:...` 摘要。后续部署优先使用 `仓库地址@sha256:...`，确保发布版本明确。

如果复用已有镜像，必须验证它对应本次代码、依赖和架构，再转推腾讯云；不能用旧镜像冒充最新版本。

构建排除规则在 `deploy/aiviewer/Dockerfile.dockerignore`，应确认 `.env`、私密参数、证书和本地缓存未进入构建上下文。

## 7. 配置应用环境变量

本地开发配置位于 `ai_agents/.env`；线上运行读取 Sealos 容器环境变量。修改本地 `.env` 不会自动更新线上。

| 分类 | 变量 | 说明 |
| --- | --- | --- |
| Agora | `AGORA_APP_ID`、`AGORA_APP_CERTIFICATE` | 与实际 RTC 项目鉴权方式一致 |
| ASR | `BYTEDANCE_ASR_APP_ID`、`BYTEDANCE_ASR_TOKEN`、`BYTEDANCE_ASR_API_KEY` | 火山引擎语音识别凭证；按实际鉴权方式填写 |
| ASR | `BYTEDANCE_ASR_RESOURCE_ID`、`BYTEDANCE_ASR_MODEL_VERSION` | 与账号已开通服务匹配；项目示例为 `volc.seedasr.sauc.duration`、`400` |
| TTS | `BYTEDANCE_TTS_APPID`、`BYTEDANCE_TTS_TOKEN`、`BYTEDANCE_TTS_RESOURCE_ID` | 与音色及已开通语音合成服务匹配 |
| Dify | `DIFY_BASE_URL` | 服务器 API 地址，包含 `/v1`；已有地址为 `http://101.200.145.196:8888/v1` |
| Dify | `DIFY_API_KEY`、`DIFY_CHATFLOW_API_KEY` | 目标已发布 Chatflow 的 Key，保留现有有效配置 |
| 报告分析 | `INTERVIEW_ANALYSIS_API_KEY`、`INTERVIEW_ANALYSIS_BASE_URL`、`INTERVIEW_ANALYSIS_MODEL` | 独立于 Dify 的后台分析模型；使用已验证的配置 |
| 报告存储 | `INTERVIEW_REPORT_DIR` | 默认容器临时目录；持久化时指向实际挂载的存储目录 |
| 服务 | `SERVER_PORT=8080`、`PORT=3000`、`NEXT_HOSTNAME=0.0.0.0` | 容器内部端口和监听地址 |
| 服务 | `AGENT_SERVER_URL=http://127.0.0.1:8080` | 当前镜像前后端位于同一容器 |
| 服务 | `NODE_ENV=production`、`NEXT_PUBLIC_EDIT_GRAPH_MODE=false` | 生产运行配置 |
| 日志与并发 | `LOG_PATH`、`LOG_STDOUT=true`、`WORKERS_MAX`、`WORKER_QUIT_TIMEOUT_SECONDS` | 按现有部署和实际负载设置 |

报告代码会在 `INTERVIEW_ANALYSIS_BASE_URL` 后追加 `/chat/completions`，应核对完整请求路径。例如 OpenAI 兼容接口常使用以 `/v1` 结尾的地址。模型名以供应商账号实际可用型号为准，不能仅相信模板默认值。

云容器不能通过 `host.docker.internal` 访问本地 Mac 的 Dify。也不要复制本地 Dify Key 到另一台 Dify 而不验证。

项目目前没有接入 PostgreSQL/Redis 的报告数据层。报告默认保存在临时文件目录，容器替换可能丢失；需要保留报告时，先为本应用配置独立持久卷及挂载，备份并迁移已有报告。不得复用 new-api 数据库，也不能只添加 `DB_*` 变量就声称完成数据库接入。

## 8. 使用 Sealos skill 部署或更新

### 首次部署

由 skill 生成、校验 `.sealos/template/index.yaml`，通过 Template API 部署，使应用管理可见。不要仅创建裸 Deployment 后就认为完成平台应用登记。

部署前必须确认：

1. 模板中的 `image` 和镜像元数据已改为验证过的腾讯云镜像摘要。
2. 私有镜像的凭证已保存为本应用专用的拉取 Secret，且 `imagePullSecrets` 引用正确；通过平台凭证界面或 skill 的安全流程配置，不把密码放进命令行参数或文档。
3. 模板通过所安装 skill 的模板质量校验。
4. Sealos Service/Ingress 对外使用前端 `3000`；内部 API `8080` 不单独公开。
5. CPU/内存按已验证资源规格设置，并通过实际启动和低负载验证；不能只凭页面能打开判断语音负载足够。

私密部署参数可放在 `.sealos/deploy-args.json`，权限设为 `600`，且必须确认未被 Git 跟踪并已忽略。**权限 600 不代表 Git 会忽略文件。** 若发现已被跟踪，不要提交或输出内容，应先处理凭证暴露及仓库历史问题。

### 更新现有应用

读取并核对 `.sealos/state.json` 后，仅替换目标容器镜像，保留线上凭证和存储。确认腾讯云拉取凭证已配置，再执行以下核心操作；其中镜像摘要必须换成第 6 步的真实结果：

```bash
export NEW_IMAGE='ccr.ccs.tencentyun.com/tenvoice/ten-voice-ai-interview@sha256:替换为真实摘要'

kubectl --insecure-skip-tls-verify -n "$NS" set image \
  deployment/"$APP" "$APP=$NEW_IMAGE"

kubectl --insecure-skip-tls-verify -n "$NS" rollout status \
  deployment/"$APP" --timeout=180s
```

上例假设容器名与应用名相同，执行前以第 5 步输出为准。不要重复执行首次创建流程生成多个应用，也不要重新套用带旧密钥的整份模板覆盖线上配置。

暂停、回滚、删除和清理旧资源应作为独立操作处理。失败时保留原可用版本和诊断证据，不删除其他项目资源。

## 9. 部署验收

```bash
kubectl --insecure-skip-tls-verify -n "$NS" get pods -l app="$APP"
kubectl --insecure-skip-tls-verify -n "$NS" get deployment "$APP" \
  -o jsonpath='{.spec.template.spec.containers[*].image}{"\n"}{.status.readyReplicas}{"\n"}'

curl -sS -o /dev/null -w '首页 HTTP %{http_code}\n' "$APP_URL/"
curl -sS -o /dev/null -w '面试记录 HTTP %{http_code}\n' "$APP_URL/api/interviews"

kubectl --insecure-skip-tls-verify -n "$NS" exec deployment/"$APP" -- \
  curl -fsS http://127.0.0.1:8080/health
```

日志可能含对话及个人资料，仅在受控终端查看，分享前脱敏：

```bash
kubectl --insecure-skip-tls-verify -n "$NS" logs deployment/"$APP" --since=10m --tail=100
```

必须逐项记录结果：

- Sealos 应用管理可见，应用名、访问地址、Service 端口一致。
- 新副本 Ready，运行镜像摘要与本次腾讯云镜像一致，旧版本已完成滚动替换。
- 首页和面试记录接口正常，浏览器实际加载新版本。
- Dify 参数接口和真实对话请求正常；`/parameters` 的 HTTP 200 只证明该接口鉴权通过。
- 核对 Chatflow 必填输入。已有流程曾要求岗位 `PM` 和简历 `resuem`，字段拼写以目标 Dify `/parameters` 为准。
- 进入语音房间，用麦克风说话，验证 ASR 识别、Dify 回复和 TTS 播放；变量齐全或没有报错都不等于语音链路已通过。
- 结束面试后能生成报告、查看历史；有持久卷时验证重建后报告仍存在。
- 观察至少 60 秒，确认没有新增重启、就绪状态反复变化或持续 Warning 事件。
- 将脱敏验证结果写入 `.sealos/runtime-truth.json`，成功后更新 `.sealos/state.json` 和发布历史。

真实麦克风测试未执行时，交付中必须写“语音端到端待验收”，不能标记全部通过。

## 10. 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| `ImagePullBackOff` / `ErrImagePull` | 查目标 Pod 事件中的具体错误；核对腾讯云镜像路径、摘要、凭证、仓库网络访问策略及凭证有效期 |
| 长时间 `ContainerCreating` | 先区分拉镜像、挂载和节点错误，不反复重建；记录 Pod、节点、时间、事件后排查 |
| `ProgressDeadlineExceeded` | 表示更新未完成，不能因首页 200 宣布成功，首页可能仍由旧副本提供 |
| `exec format error` | 检查镜像是否含 `linux/amd64` |
| 页面正常但历史接口 404 | 检查访问的应用和实际运行镜像，避免仍访问旧入口 |
| Dify 401 / 400 | 分别检查 Key 与地址是否对应、Chatflow 必填输入是否提供 |
| 报告生成失败 | 检查独立分析模型配置、接口路径及供应商响应，不仅检查 Dify |
| 重建后报告丢失 | 检查 `INTERVIEW_REPORT_DIR` 是否挂载持久卷；临时目录不提供持久化 |
| 避开节点无效 | 检查 Pod 模板是否存在固定 `nodeName`；不要在固定节点的同时添加排除该节点的硬亲和性，会导致调度失败 |

读取单个 Pod 事件：

```bash
# 将 POD_NAME 替换为本应用发生问题的 Pod 名称
kubectl --insecure-skip-tls-verify -n "$NS" get events \
  --field-selector involvedObject.name=POD_NAME \
  -o custom-columns=REASON:.reason,MESSAGE:.message
```

未确认平台调度约束前不手动指定节点；镜像拉取失败不应默认归因于节点故障。需要平台支持时提供脱敏事件，不提供 kubeconfig 或密码。

## 11. 交付记录

每次发布填写：

```text
发布时间：
Git 提交 / 是否含未提交改动：
腾讯云镜像地址、Tag、Digest、架构：
Sealos 区域 / 命名空间 / 应用名：
访问地址：
原镜像 / 本次镜像：
滚动更新结果：
首页 / API / Dify / 报告验证结果：
ASR / TTS 真实语音测试结果：
报告持久化与备份情况：
稳定性观察结果：
部署日志及验证证据位置：
未完成事项：
其他服务影响：
```

## 参考资料

- [腾讯云 TCCLI 官方仓库与安装说明](https://github.com/TencentCloud/tencentcloud-cli)
- [腾讯云镜像仓库访问凭证说明](https://cloud.tencent.com/document/product/1141/41829)
- [Sealos Skills 安装与使用](https://github.com/labring/sealos-skills/blob/main/readmes/README.zh-CN.md)
- 项目构建文件：`deploy/aiviewer/Dockerfile`、`deploy/aiviewer/Dockerfile.dockerignore`。
- 当前 Sealos 部署记录：`.sealos/state.json`；验证记录应与发布版本一致，旧验证记录不能证明新版本通过。
