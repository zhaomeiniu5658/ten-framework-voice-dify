# Web Audio Control Go Extension

## 简介

这是一个用 Go 编写的 TEN Framework Web 音频控制扩展。它提供了一个 Web 界面，用户可以通过浏览器控制音频播放并实时查看转写文本。

## 功能特性

- ✅ Web 界面控制
- ✅ WebSocket 实时通信
- ✅ 发送音频播放命令
- ✅ 接收并显示转写文本
- ✅ 美观的现代化 UI
- ✅ 自动重连机制

## 架构说明

```text
用户浏览器 <--HTTP/WebSocket--> Web Server (Go Extension) <--TEN Protocol--> TEN Framework
                                                                   |
                                                                   v
                                                         Audio Player Extension
                                                                   |
                                                                   v
                                                           ASR Extension (转写)
```

## 配置属性

### `http_port` (int64, 可选，默认: 8001)

HTTP 服务器监听端口。

示例：

```json
{
  "http_port": 8001
}
```

## API

### 发送的命令

#### `start_play`

发送音频播放命令。

**命令属性**：

- `file_path` (string): 音频文件路径
- `loop_playback` (bool): 是否循环播放

### 接收的数据

#### `display_text`

接收转写文本数据。

**数据属性**：

- `text` (string): 转写的文本内容

## 使用方法

### 1. 在 Graph 中配置

```json
{
  "nodes": [
    {
      "type": "extension",
      "name": "web_control",
      "addon": "web_audio_control_go",
      "property": {
        "http_port": 8001
      }
    },
    {
      "type": "extension",
      "name": "audio_player",
      "addon": "audio_file_player_python"
    },
    {
      "type": "extension",
      "name": "asr",
      "addon": "your_asr_extension"
    }
  ],
  "connections": [
    {
      "extension": "web_control",
      "cmd_out": [
        {
          "name": "start_play",
          "dest": [
            {
              "extension": "audio_player"
            }
          ]
        }
      ]
    },
    {
      "extension": "audio_player",
      "audio_frame_out": [
        {
          "name": "pcm_frame",
          "dest": [
            {
              "extension": "asr"
            }
          ]
        }
      ]
    },
    {
      "extension": "asr",
      "data_out": [
        {
          "name": "display_text",
          "dest": [
            {
              "extension": "web_control"
            }
          ]
        }
      ]
    }
  ]
}
```

### 2. 访问 Web 界面

启动应用后，在浏览器中访问：

```text
http://localhost:8001
```

### 3. 使用界面

1. 在 "Audio File Path" 输入框中输入音频文件路径
2. 可选：勾选 "Loop Playback" 启用循环播放
3. 点击 "▶️ Start Transcription" 按钮开始
4. 转写文本将实时显示在下方的 "Transcription Results" 区域

## Web 界面特性

### 连接状态指示

- 🟢 **Connected**: 与服务器连接正常
- 🔴 **Disconnected**: 与服务器断开连接（会自动重连）

### 实时转写显示

- 转写文本会实时通过 WebSocket 推送到浏览器
- 每条文本以卡片形式展示
- 自动滚动到最新内容

### 错误提示

- 文件不存在时会显示错误提示
- 网络错误会有明确的错误消息

## WebSocket 消息格式

### 服务器 -> 客户端

```json
{
  "type": "text",
  "data": "转写的文本内容"
}
```

## HTTP API

### POST /api/start_play

启动音频播放。

**请求参数**（Form Data）：

- `file_path`: 音频文件路径（必填）
- `loop_playback`: 是否循环播放（true/false，可选）

**响应**：

```json
{
  "status": "ok",
  "message": "Playback started"
}
```

**错误响应**：

```json
{
  "error": "错误信息"
}
```

## 技术栈

- **后端**: Go
- **Web 框架**: net/http (标准库)
- **WebSocket**: gorilla/websocket
- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **TEN Framework**: Go binding

## 开发说明

### 依赖项

```go
require (
    github.com/gorilla/websocket v1.5.1
    ten_framework/ten_runtime v0.11.25
)
```

### 项目结构

```text
web_audio_control_go/
├── main.go                 # 扩展入口
├── server/
│   ├── server.go          # Web 服务器实现
│   └── static/
│       └── index.html     # Web 前端页面
├── manifest.json          # 扩展清单
├── property.json          # 默认配置
├── go.mod                 # Go 模块定义
└── docs/                  # 文档
```

## 许可证

Apache License 2.0

## 作者

TEN Framework Team

## 更新日志

### v0.11.25 (2025-10-29)

- 初始版本
- Web 界面控制
- WebSocket 实时通信
- 音频播放命令发送
- 转写文本接收和显示
