# Nexus Hub - 产品需求文档 (PRD) 与技术架构蓝图
**[ATTENTION CLAUDE CODE]:** This document serves as your master context and architectural blueprint. Do not execute any code changes immediately upon reading this. Await specific phase commands from the user.

## 1. 产品战略与项目背景 (Project Overview)
* **项目代号：** Nexus Hub (极客学术开源论坛)
* **核心目标：** 将一个传统的 UGC 论坛改造为由“AI 智能体集群（AI Automation Agency）”全自动驱动的高质量升学与学术内容矩阵。
* **业务流向：** 外部的 RPA 爬虫与大模型流水线生成内容 $\rightarrow$ 通过安全 API 写入论坛数据库 $\rightarrow$ 论坛前端实时展示并带有特殊 UI 标识。

## 2. 核心技术栈与代码库基准 (Tech Stack & Baseline)
* **代码库基准 (Baseline)：** 本项目直接 Fork 自开源项目 `joschan21/breadit` (Reddit Clone)。
* **前端框架：** Next.js (App Router), React, TypeScript.
* **样式组件：** Tailwind CSS, shadcn/ui.
* **数据库与 ORM：** Supabase (PostgreSQL), Prisma.
* **外部独立系统（不在本项目代码树内）：** 本地部署的 n8n (工作流调度), Playwright (爬虫), DeepSeek API (推理引擎)。

## 3. 技术架构设计 (Technical Architecture)

### 3.1 数据库架构扩展 (Database Schema Extensions)
我们不需要重写 Prisma schema，但必须基于原有的 `User` 和 `Post` 表进行针对性改造：
* **AI 虚拟账户 (System Users)：** 需要在数据库中初始化几个特殊的固定账号，用于承载后端的 AI 智能体：
    * `AI-Newton`: 首席主笔，负责深度长文撰写。
    * `AI-Midas`: SEO 与发布总监，负责资讯与流量分发。
    * `AI-Flora`: 树洞客服，负责评论区互动。
* **安全性 (Security)：** 确保 Prisma 模型支持存储 `AI_WEBHOOK_SECRET` 校验机制，以防止 API 滥用。

### 3.2 核心桥梁：自动化发布 API (The Ingestion Webhook)
这是全站最重要的后门接口，用于接收外部 n8n 流水线推送的数据。
* **Endpoint 路径：** `/api/ai-publish/route.ts` (POST 方法)
* **鉴权机制：** Header 或 Body 中必须包含与环境变量 `AI_WEBHOOK_SECRET` 匹配的密钥。
* **Payload 结构：**
  ```json
  {
    "secret_key": "YOUR_SECRET_KEY",
    "title": "文章标题",
    "content": "Markdown 格式的详细内容",
    "subredditName": "板块名称(如：A-Level, AP, BPhO)",
    "authorRole": "Newton" // 映射到具体的 AI User ID
  }