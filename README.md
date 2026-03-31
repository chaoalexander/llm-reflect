# LLM 反思模型

一个轻量的支持自我反思的 LLM 代理服务，通过引入判别模型对生成模型的回答进行评审和改进，提升回答质量。

## 功能特性

- 🚀 **反思模式**：自动对生成的回答进行评审和改进
- 🔧 **灵活配置**：支持 YAML 配置文件
- 🌐 **OpenAI 兼容**：兼容 OpenAI API 格式
- 📊 **用量统计**：详细统计生成模型和判别模型的 token 用量
- 🔄 **多轮反思**：支持配置反思轮数
- 🧠 **自动难度评估**：支持 auto 模式，根据任务难度自动决定反思轮数
- 📝 **日志记录**：可配置的日志系统

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置

复制 `config.yaml` 并修改配置：

```yaml
# 生成模型配置
generator:
  base_url: "http://localhost:8080"  # 替换为你的 LLM API 地址
  api_key: ""                             # API 密钥（如需）
  model: "qwen3.5-9B"                         # 模型名称

# 判别模型配置
critic:
  base_url: "http://localhost:8080"
  api_key: ""
  model: "qwen3.5-9B"

# 反思轮数配置
# 0 = 不使用反思模式，直接返回原始回答
# 1, 2, 3 = 固定反思轮数
# "auto" = 自动评估难度，根据难度决定反思轮数
reflection_rounds: 1

# 日志配置
logging:
  enabled: true
  level: "info"
  file: "./logs/reflection.log"

# 输出格式：openai | raw
output_format: "openai"

# 服务配置
server:
  host: "127.0.0.1"
  port: 3030
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务启动后，访问 `http://127.0.0.1:3030`

## 自动难度评估模式

当 `reflection_rounds` 设置为 `"auto"` 时，服务会自动评估任务难度：

| 难度 | 标准 | 反思轮次 |
|------|------|----------|
| **simple（简单）** | 目标明确，步骤清晰，工具选择无歧义，无需多源数据整合 | 0 轮（直接返回） |
| **medium（中等）** | 涉及多步骤协调、或需要在多个工具间做选择、或需要数据转换/格式处理 | 1 轮反思 |
| **hard（困难）** | 涉及复杂逻辑推理、多源数据交叉验证、创意性内容生成、或需要领域专业知识 | 2 轮反思 |

在 auto 模式下，生成模型会在首次回答时进行难度评估，响应格式如下：

```json
{
  "difficulty": "medium",
  "difficultyReason": "本任务涉及多步骤协调，需要在多个工具间做选择"
}
```

## API 使用

### Chat Completions

```bash
curl -X POST http://127.0.0.1:3030/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-9B",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ]
  }'
```

### 响应格式

```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "llama3",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "反思后的回答..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  },
  "_reflection": {
    "original_response": "原始回答...",
    "reflection_feedback": ["评审意见..."],
    "reflection_rounds": 1,
    "reflection_tokens": 150,
    "total_with_reflection": 450,
    "difficulty": "medium",
    "difficultyReason": "涉及多步骤协调"
  }
}
```

## 工作原理

### 核心思想

大语言模型本质上是"下一个词预测"的文字接龙。当模型生成回答时，如果前期思考误入歧途，后续的文字接龙将沿着错误方向继续发展，导致整个回答质量无法保证。这就像写文章时开头写错了，后面越写越偏。

### 反思机制

通过模拟人类反思的认知步骤，引入 LLM 反思环节：

1. **批判性审视**：让判别模型以严格且苛刻的视角审视生成的回答
2. **漏洞识别**：从完整性、准确性、可执行性、效率、边界情况等角度指出回答中的问题
3. **重新组织**：基于评审意见，让生成模型重新组织语言，给出改进后的回答

这种机制相当于**通过延长思考时间来换取回答质量**。

### 技术流程

```
第 1 轮：用户输入 → 生成模型（带难度评估）→ 初始回答 + 难度评估
第 2 轮（如果需要）：初始回答 + 评审提示 → 判别模型 → 评审意见
第 3 轮（如果需要）：初始回答 + 评审意见 → 生成模型 → 改进后的回答
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 提升回答质量 | 成倍数消耗 token |
| 减少逻辑漏洞 | 响应时间增加 |
| 发现边界情况 | 过度反思回答质量难保证|
| **适合本地模型或低成本 token** | |

## 支持的 LLM

- OpenAI
- Azure OpenAI
- Ollama
- LM Studio
- 任何兼容 OpenAI API 格式的 LLM 服务

## 聊天页面

启动服务后，可以访问聊天页面进行试用：

```
http://127.0.0.1:3030
```

聊天页面功能：
- 实时对话
- 显示反思轮数和难度评估信息
- 响应式设计，支持移动端

## License

MIT
