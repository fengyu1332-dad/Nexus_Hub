/**
 * n8n REST API 客户端
 *
 * 通过 n8n REST API 实现管理后台对工作流的监控和操控。
 * 认证方式: X-N8N-API-KEY header（需在 docker-compose 中配置 N8N_API_KEY）
 */

const API_BASE = process.env.N8N_API_BASE || 'http://localhost:5678/rest'
const API_KEY = process.env.N8N_API_KEY || ''

// ── Types ────────────────────────────────────────────────

export interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  versionId?: string
}

export interface N8nExecution {
  id: string
  workflowId: string
  workflowName?: string
  status: 'success' | 'error' | 'running' | 'waiting'
  startedAt: string
  stoppedAt?: string
  mode?: string
}

// ── Internal fetch wrapper ───────────────────────────────

async function n8nFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T | null> {
  if (!API_KEY) {
    console.warn('[n8n] N8N_API_KEY not configured')
    return null
  }

  const url = `${API_BASE}${path}`
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': API_KEY,
        ...(options?.headers || {}),
      },
    })

    if (!res.ok) {
      console.warn(`[n8n] ${options?.method || 'GET'} ${path} → ${res.status}`)
      return null
    }

    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch (e) {
    console.warn(`[n8n] Request failed: ${path}`, e)
    return null
  }
}

// ── Public API ────────────────────────────────────────────

export const n8n = {
  /** 检查 n8n 是否在线 */
  async ping(): Promise<boolean> {
    const res = await n8nFetch<{ data: unknown[] }>('/workflows?limit=1')
    return res !== null
  },

  /** 获取所有工作流列表 */
  async listWorkflows(): Promise<N8nWorkflow[]> {
    const res = await n8nFetch<{ data: N8nWorkflow[] }>('/workflows')
    return res?.data || []
  },

  /** 获取单个工作流详情 */
  async getWorkflow(workflowId: string): Promise<any | null> {
    const res = await n8nFetch<{ data: any }>(`/workflows/${workflowId}`)
    return res?.data || null
  },

  /** 激活工作流 */
  async activateWorkflow(workflowId: string): Promise<boolean> {
    const res = await n8nFetch<any>(`/workflows/${workflowId}/activate`, {
      method: 'POST',
    })
    return res !== null
  },

  /** 停用工作流 */
  async deactivateWorkflow(workflowId: string): Promise<boolean> {
    const res = await n8nFetch<any>(`/workflows/${workflowId}/deactivate`, {
      method: 'POST',
    })
    return res !== null
  },

  /** 手动执行工作流（可选传入输入数据） */
  async executeWorkflow(
    workflowId: string,
    inputData?: Record<string, unknown>
  ): Promise<{ executionId?: string } | null> {
    const res = await n8nFetch<{ executionId?: string }>(
      `/workflows/${workflowId}/execute`,
      {
        method: 'POST',
        body: inputData ? JSON.stringify({ data: inputData }) : undefined,
      }
    )
    return res
  },

  /** 获取工作流的最近执行历史 */
  async listExecutions(
    workflowId: string,
    limit = 10
  ): Promise<N8nExecution[]> {
    const res = await n8nFetch<{ data: N8nExecution[] }>(
      `/executions?workflowId=${workflowId}&limit=${limit}`
    )
    return res?.data || []
  },

  /** 获取执行详情 */
  async getExecution(executionId: string): Promise<any | null> {
    const res = await n8nFetch<{ data: any }>(`/executions/${executionId}`)
    return res?.data || null
  },
}
