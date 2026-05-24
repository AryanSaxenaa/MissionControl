import type { ConflictResult as _ConflictResult } from '@missioncontrol/types'
export type ConflictResult = _ConflictResult

class MissionControlError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown,
  ) {
    super(message)
    this.name = 'MissionControlError'
  }
}

async function fetchJson<T>(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 30000, ...fetchOpts } = opts
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(url, { ...fetchOpts, signal: controller.signal })
    clearTimeout(timeout)

    if (!resp.ok) {
      const text = await resp.text().catch(() => 'unknown error')
      throw new MissionControlError(`HTTP ${resp.status}: ${text}`, resp.status)
    }

    return (await resp.json()) as T
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof MissionControlError) throw err
    throw new MissionControlError(err instanceof Error ? err.message : 'Network error')
  }
}

export class Agent {
  private serverUrl: string
  private agentId: string = ''
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private currentIntentId: string | null = null

  constructor(private config: {
    serverUrl: string
    name: string
    kind: 'claude-code' | 'codex' | 'opencode' | 'custom'
    parentAgentId?: string
  }) {
    this.serverUrl = config.serverUrl.replace(/\/$/, '')
  }

  async register(): Promise<{ agentId: string; inheritedContext: string }> {
    const data = await fetchJson<{ agentId: string; inheritedContext: string }>(`${this.serverUrl}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.config.name,
        kind: this.config.kind,
        parentAgentId: this.config.parentAgentId,
        pid: typeof process !== 'undefined' ? process.pid : undefined,
      }),
    })
    this.agentId = data.agentId
    this.startHeartbeat()
    return data
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await fetchJson(`${this.serverUrl}/api/agents/${this.agentId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
          timeoutMs: 5000,
        })
      } catch {
        // swallow heartbeat errors
      }
    }, 5000)
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref()
  }

  async declareIntent(action: string, target: string, description: string): Promise<{
    intentId: string
    clear: boolean
    conflicts: ConflictResult[]
    relevantContext: string
  }> {
    const data = await fetchJson<{
      intentId: string
      conflicts: ConflictResult[]
      relevantContext: string
    }>(`${this.serverUrl}/api/intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: this.agentId, action, target, description }),
    })
    this.currentIntentId = data.intentId
    return { ...data, clear: data.conflicts.length === 0 }
  }

  async completeCurrentIntent(): Promise<void> {
    if (!this.currentIntentId) return
    await fetchJson(`${this.serverUrl}/api/intents/${this.currentIntentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    this.currentIntentId = null
  }

  async writeContext(content: string, scope: string, tags: string[], confidence = 0.8): Promise<void> {
    await fetchJson(`${this.serverUrl}/api/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: this.agentId, content, scope, tags, confidence }),
    })
  }

  async recordDecision(
    summary: string,
    reasoning: string,
    alternativesConsidered: string[],
    affectedFiles: string[],
    tags: string[] = []
  ): Promise<void> {
    await fetchJson(`${this.serverUrl}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: this.agentId, summary, reasoning, alternativesConsidered, affectedFiles, tags }),
    })
  }

  async recordFailure(
    task: string,
    target: string,
    error: Error,
    additionalContext = ''
  ): Promise<{ sourceId: string; isKnown: boolean; relatedFailures: string }> {
    return fetchJson(`${this.serverUrl}/api/failures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.agentId,
        task,
        target,
        errorType: error.constructor.name,
        errorMessage: error.message,
        context: additionalContext,
        stackTrace: error.stack,
      }),
    })
  }

  async checkFailures(target: string): Promise<Array<{ summary: string; errorType: string }>> {
    const data = await fetchJson<{ failures: Array<{ summary: string; errorType: string }> }>(
      `${this.serverUrl}/api/failures/check?target=${encodeURIComponent(target)}&agentId=${this.agentId}`
    )
    return data.failures
  }

  async queryContext(scope: string, tags: string[] = []): Promise<string> {
    const params = new URLSearchParams({
      scope,
      agentId: this.agentId,
      ...(tags.length ? { tags: tags.join(',') } : {}),
    })
    const data = await fetchJson<{ items: Array<{ content: string; scope: string }> }>(`${this.serverUrl}/api/context/query?${params}`)
    return data.items.map((i) => `- ${i.content} (scope: ${i.scope})`).join('\n')
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    await fetchJson(`${this.serverUrl}/api/agents/${this.agentId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }).catch(() => {})
  }
}

export { generateClaudeCodeHooks, buildClaudeSettingsHooks } from './hooks/claude-code.js'
export { generateOpenCodeHooks } from './hooks/opencode.js'

export interface MissionControlConfig {
  server: { port: number }
  dashboard: { port: number }
  hydra: { apiKey: string; tenantId: string }
}

export function defineConfig(config: MissionControlConfig): MissionControlConfig {
  if (!config.hydra?.apiKey) console.warn('[MissionControl] HYDRA_API_KEY is missing from config')
  if (!config.hydra?.tenantId) console.warn('[MissionControl] HYDRA_TENANT_ID is missing from config')
  return config
}
