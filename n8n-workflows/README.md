# Nexus Hub — n8n 工作流导入指南

## 前置条件

1. `docker compose up -d` 已启动
2. n8n Web UI 可访问：`http://localhost:5678`
3. DeepSeek API Key 已在 `.env` 中配置（`DEEPSEEK_API_KEY=sk-xxx`）

---

## 导入步骤

### 1. 配置 n8n 环境变量

打开 n8n → **Settings** → **Environment Variables**，添加：

```
AI_WEBHOOK_SECRET=nexus-hub-test-secret-2026
DEEPSEEK_API_KEY=sk-your-actual-key
DEEPSEEK_API_BASE=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

### 2. 导入工作流

在 n8n 中：**Import from File** → 选择以下 JSON 文件：

---

## 工作流文件说明

| 文件 | Agent | 功能 | 可独立运行 |
|---|---|---|---|
| `nexus-owl-intel.json` | 🦉 Owl | 网页抓取 → 文本清洗 | ✅ |
| `nexus-newton-writer.json` | 🧠 Newton | DeepSeek 生成 Markdown | ✅ (需 Owl 数据) |
| `nexus-sherlock-factcheck.json` | 🔍 Sherlock | 事实核查 + 路由判定 | ✅ (需 Newton 草稿) |
| `nexus-midas-publish.json` | ⚡ Midas | POST → 发布上线 | ✅ (需 Sherlock 通过) |
| **`nexus-master-pipeline.json`** | 🏭 **全流水线** | **Owl → Newton → Sherlock → Midas** | ✅ 一键运行 |

---

## 推荐使用方式

### 方式一：全自动主流水线（推荐）

1. Import `nexus-master-pipeline.json`
2. 配置情报源 URL（编辑 "📋 配置情报源" 节点中的 sources 数组）
3. 激活 Schedule Trigger（默认每 6 小时）
4. 打开 Workflow → Active

### 方式二：分步调试

1. 先 Import `nexus-owl-intel.json` → Execute → 验证抓取结果
2. 再 Import `nexus-newton-writer.json` → 传入 Owl 输出 → 验证文章质量
3. 再 Import `nexus-sherlock-factcheck.json` → 传入 Newton 草稿 → 验证核查
4. 最后 Import `nexus-midas-publish.json` → 传入通过的内容 → 发布

---

## 主流水线节点拓扑

```
⏰ Schedule Trigger (每6h)
        │
        ▼
📋 配置情报源 (Code)
        │
        ▼
🦉 Owl 情报抓取 (HTTP Request → browserless:3000/content)
        │
        ▼
🔬 HTML 清洗 (HTML Extract)
        │
        ▼
🧹 Owl 输出 (Code)
        │
        ▼
🧠 Newton Prompt (Code) → 🤖 DeepSeek 生成 (temp=0.7)
        │
        ▼
📤 Newton 草稿 (Code)
        │
        ▼
🔍 Sherlock Prompt (Code) → 🤖 DeepSeek 核查 (temp=0)
        │
        ▼
📊 Sherlock 判定 (Code)
        │
        ▼
    🚦 通过审核? (IF)
     ╱         ╲
  ✅ 是        ❌ 否
   ╱             ╲
⚡ Midas      驳回 (人工审核)
Payload
   │
📡 POST 发布
   │
🎉 发布成功!
```

---

## 自定义 System Prompt

编辑 Newton Prompt 节点的 `systemPrompt` 变量可调整 AI 人设：

- **学术深度**：增加 "引用至少 3 篇学术论文" 要求
- **语言风格**：调整为 "小红书风格" "知乎体" 等
- **格式**：添加 Mermaid 图表、PlantUML 等高级格式指令
