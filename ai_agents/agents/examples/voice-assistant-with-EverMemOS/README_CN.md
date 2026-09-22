# 语音助手 (集成 EverMemOS 记忆系统)

一个集成了 [EverMemOS](https://evermemos.com/) 记忆管理能力的智能语音助手，支持持久化对话上下文和长期记忆。

## 🎯 特性

- ✅ 实时语音识别（Deepgram ASR）
- ✅ 智能对话生成（OpenAI 兼容 LLM）
- ✅ 自然语音合成（ElevenLabs TTS）
- ✅ 长期记忆能力（EverMemOS）
- ✅ 混合搜索记忆检索
- ✅ 自动记忆保存和唤起

## 📋 前置要求

### 必需依赖
- Python 3.10+
- Node.js 18+
- Docker (如果使用本地数据库)

### API Keys
- **Agora RTC**: 用于实时音视频通信
- **Deepgram**: 语音转文字 (STT)
- **OpenAI 兼容 API**: LLM 对话生成（如 SiliconFlow、OpenAI 等）
- **ElevenLabs**: 文字转语音 (TTS)
- **EverMemOS**: 记忆系统 API Key

## 🚀 快速开始

### 1. 获取 EverMemOS API Key

访问 [EverMemOS 官网](https://evermemos.com/) 注册并获取 API Key。

EverMemOS 是云托管服务，**无需本地部署数据库**。

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# Agora RTC
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate

# Deepgram STT
DEEPGRAM_API_KEY=your_deepgram_api_key

# LLM Provider (SiliconFlow 示例)
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
OPENAI_API_KEY=your_siliconflow_api_key
OPENAI_MODEL=Qwen/Qwen2.5-14B-Instruct

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Proxy (可选)
PROXY_URL=http://127.0.0.1:7890
```

### 3. 配置 EverMemOS

编辑 `tenapp/property.json` 文件中的 `evermemos_config` 部分：

```json
{
  "property": {
    "greeting": "你好啊，我是你的个人助手",
    "agent_id": "voice_assistant_agent",
    "user_id": "user",
    "enable_memorization": true,
    "memory_save_interval_turns": 2,
    "memory_idle_timeout_seconds": 10.0,
    "evermemos_config": {
      "api_key": "your_evermemos_api_key_here"
    }
  }
}
```

**配置说明**：
- `agent_id`: 助手的唯一标识符
- `user_id`: 用户的唯一标识符（可自定义，如用户名或 UUID）
- `enable_memorization`: 启用记忆功能（设为 `true`）
- `memory_save_interval_turns`: 每 N 轮对话自动保存记忆（推荐 2-5）
- `memory_idle_timeout_seconds`: 对话停止 N 秒后自动保存（推荐 10-30）
- `evermemos_config.api_key`: 你的 EverMemOS API Key

### 4. 安装依赖

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 确保安装 evermemos SDK
pip install evermemos
```

### 5. 运行服务

```bash
# 启动后端服务
task run

# 或使用 Docker
docker-compose up -d
```

### 6. 访问应用

- **前端界面**: http://localhost:3000
- **API 服务器**: http://localhost:8080
- **TMAN Designer**: http://localhost:49483

## 💡 工作原理

### 记忆保存机制

助手会在以下情况自动保存对话记忆：

1. **定期保存**: 每 N 轮对话（默认 2 轮）
2. **空闲保存**: 对话停止 N 秒后（默认 10 秒）
3. **退出保存**: 用户离开时自动保存

### 记忆检索机制

当用户提问时，助手会：

1. 使用混合搜索（关键词 + 语义向量）检索相关记忆
2. 取最相关的 3 条记忆注入 LLM 上下文
3. LLM 自然融入记忆内容生成回答

### 对话示例

**第 1-2 轮对话**（记忆保存）：
```
用户: 你好
助手: 你好啊，我是你的个人助手

用户: 我喜欢喝黑咖啡，不加糖
助手: 好的，我记住了你喜欢黑咖啡
→ 触发保存：2 轮对话完成
```

**第 3 轮对话**（记忆检索）：
```
用户: 我平时喜欢喝什么？
→ 系统检索记忆：找到 "用户喜欢黑咖啡，不加糖"
助手: 你喜欢喝黑咖啡，而且不加糖哦
```

## 📊 日志监控

启动后，观察日志中的 EverMemOS 相关信息：

### 初始化成功
```
[MainControlExtension] EverMemOS memory store initialized successfully
[EverMemosMemoryStore] Initialized with API key: your_api_key...
```

### 保存记忆
```
╔══════════════════════════════════════════════════════════════════╗
║                [EverMemOS] 保存对话到记忆                          ║
╠══════════════════════════════════════════════════════════════════╣
║ 👤 User ID:     'user'                                            ║
║ 🤖 Agent ID:    'voice_assistant_agent'                           ║
║ 💬 Conversation Length: 4 条消息                                  ║
╚══════════════════════════════════════════════════════════════════╝
[EverMemOS] 📝 准备保存 4 条消息
[EverMemOS] ✅ 成功保存 4 条消息到用户 'user' 的记忆
```

### 检索记忆
```
╔══════════════════════════════════════════════════════════════════╗
║                [EverMemOS] 搜索相关记忆                          ║
╠══════════════════════════════════════════════════════════════════╣
║ 👤 User ID:     'user'                                            ║
║ 🤖 Agent ID:    'voice_assistant_agent'                           ║
║ 🔍 Search Query: '我喜欢喝什么'                                   ║
╚══════════════════════════════════════════════════════════════════╝
[EverMemOS] 🔎 正在搜索用户 'user' 的记忆...
[EverMemOS] ✅ 搜索完成! 为用户 'user' 找到 3 条相关记忆
```

## 🔧 故障排查

### 问题 1: 没有看到 EverMemOS 日志

**可能原因**：
- 对话轮数不够（未达到保存阈值）
- evermemos 包未安装
- API Key 配置错误

**解决方案**：
```bash
# 检查 evermemos 包
pip list | grep evermemos

# 重新安装
pip install --upgrade evermemos

# 查看启动日志中是否有错误
# 寻找包含 "EverMemOS" 或 "Failed to initialize" 的日志
```

### 问题 2: 记忆保存失败

**检查要点**：
1. API Key 是否正确
2. 网络连接是否正常
3. 日志中的错误信息

### 问题 3: 无法检索到记忆

**可能原因**：
- 记忆还未保存成功
- 检索查询与记忆内容相关性太低

**建议**：
- 等待足够轮数或时间触发保存
- 使用更明确的提问方式

## 📖 API 说明

### EverMemOS SDK 使用

项目使用 [evermemos Python SDK](https://pypi.org/project/evermemos/)：

```python
from evermemos import EverMemOS

# 初始化
client = EverMemOS(api_key="your_api_key")
memory = client.v0.memories

# 保存消息
response = memory.add(
    message_id="msg_001",
    create_time="2025-01-15T10:00:00Z",
    sender="user",
    sender_name="User",
    group_id="user_voice_assistant_agent",
    content="我喜欢喝黑咖啡",
    flush="true"  # 最后一条消息触发记忆提取
)

# 搜索记忆
response = memory.search(extra_query={
    "query": "咖啡偏好",
    "user_id": "user",
    "retrieve_method": "hybrid",  # 混合搜索
    "memory_types": ["episodic_memory"],
    "top_k": 10
})
```

## 🎨 自定义配置

### 修改保存频率

编辑 `property.json`：

```json
{
  "memory_save_interval_turns": 5,     // 每 5 轮保存
  "memory_idle_timeout_seconds": 30.0  // 30 秒空闲保存
}
```

### 修改检索记忆数量

编辑 `extension.py` 中的 `_retrieve_related_memory` 方法：

```python
# 默认取前 3 条
memorise = [
    result["memory"]
    for result in results[:3]  # 改为 [:5] 取前 5 条
    if isinstance(result, dict) and result.get("memory")
]
```

### 修改问候语

编辑 `property.json`：

```json
{
  "greeting": "你好！我是你的智能助手，我能记住我们之前的对话哦"
}
```

## 📚 相关文档

- [EverMemOS 官方文档](https://evermemos.com/docs)
- [evermemos Python SDK](https://github.com/memogpt/evermemos-python)
- [TEN Framework 文档](https://doc.theten.ai/)
- [项目变更记录](./EVERMEMOS_MIGRATION_SUMMARY.md)
- [记忆优化说明](./MEMORY_OPTIMIZATION_CHANGES.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目基于 Apache 2.0 许可证开源。

## 💬 支持

遇到问题？
- 查看 [故障排查](#🔧-故障排查) 部分
- 提交 [Issue](https://github.com/your-repo/issues)
- 加入社区讨论

---

**注意**: 本项目使用 EverMemOS 云服务，无需本地部署数据库。只需获取 API Key 即可使用完整的记忆管理功能。