import { HydraDBClient } from '@hydradb/sdk'
import type { HydraDB } from '@hydradb/sdk'

let _hydra: HydraDBClient | null = null
function getHydra(): HydraDBClient {
  if (!_hydra) {
    _hydra = new HydraDBClient({
      token: process.env.HYDRA_API_KEY!,
    })
  }
  return _hydra
}

function tenantId(): string {
  return process.env.HYDRA_TENANT_ID!
}

export const SUB_TENANTS = {
  SHARED: 'shared',
  DECISIONS: 'decisions',
  FAILURES: 'failures',
  INTENTS: 'intents',
  agentId: (id: string) => `agent-${id}`,
} as const

const HYDRA_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, ms = HYDRA_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timed = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`HydraDB call timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timed]).finally(() => {
    clearTimeout(timer!)
    promise.catch(() => {})
  })
}

async function doIngest(params: {
  subTenant: string
  text: string
  infer: boolean
  metadata: Record<string, unknown>
  additionalMetadata?: Record<string, unknown>
}): Promise<string> {
  const result = await withTimeout(getHydra().ingestionPipeline.ingestMemory({
    tenant_id: tenantId(),
    sub_tenant_id: params.subTenant,
    text: params.text,
    infer: params.infer,
    metadata: params.metadata,
    additional_metadata: params.additionalMetadata,
  }))
  return result.doc_id
}

export async function ingestContext(params: {
  agentId: string
  content: string
  scope: string
  tags: string[]
  confidence: number
}): Promise<string> {
  return doIngest({
    subTenant: SUB_TENANTS.SHARED,
    text: `[CONTEXT] scope:${params.scope} tags:${params.tags.join(',')}\n${params.content}`,
    infer: true,
    metadata: {
      type: 'context',
      agent_id: params.agentId,
      scope: params.scope,
      tags: params.tags,
      confidence: params.confidence,
      created_at: Date.now(),
    },
    additionalMetadata: { type: 'context', scope: params.scope },
  })
}

export async function ingestDecision(params: {
  agentId: string
  summary: string
  reasoning: string
  alternativesConsidered: string[]
  affectedFiles: string[]
  tags: string[]
}): Promise<string> {
  return doIngest({
    subTenant: SUB_TENANTS.DECISIONS,
    text: `[DECISION] ${params.summary}\nAgent: ${params.agentId}\nAffected files: ${params.affectedFiles.join(', ')}\nAlternatives considered: ${params.alternativesConsidered.join('; ')}\nReasoning: ${params.reasoning}\nTags: ${params.tags.join(', ')}`,
    infer: true,
    metadata: {
      type: 'decision',
      agent_id: params.agentId,
      affected_files: params.affectedFiles,
      tags: params.tags,
      created_at: Date.now(),
    },
    additionalMetadata: { type: 'decision' },
  })
}

export async function ingestFailure(params: {
  agentId: string
  task: string
  target: string
  errorType: string
  errorMessage: string
  context: string
  stackTrace?: string
}): Promise<string> {
  return doIngest({
    subTenant: SUB_TENANTS.FAILURES,
    text: `[FAILURE] target:${params.target} errorType:${params.errorType}\nTask attempted: ${params.task}\nError: ${params.errorMessage}\nContext at failure: ${params.context}\nAgent: ${params.agentId}\n${params.stackTrace ? `Stack trace:\n${params.stackTrace}` : ''}`,
    infer: false,
    metadata: {
      type: 'failure',
      agent_id: params.agentId,
      target: params.target,
      error_type: params.errorType,
      created_at: Date.now(),
    },
    additionalMetadata: { type: 'failure', target: params.target },
  })
}

export async function ingestAgentSummary(agentId: string, summary: string) {
  await doIngest({
    subTenant: SUB_TENANTS.agentId(agentId),
    text: summary,
    infer: true,
    metadata: {
      type: 'agent_summary',
      agent_id: agentId,
      created_at: Date.now(),
    },
  })
}

export async function recallContext(query: string, subTenant = SUB_TENANTS.SHARED): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.fullRecall({
    tenant_id: tenantId(),
    sub_tenant_id: subTenant,
    query,
    max_results: 10,
    graph_context: true,
    mode: 'thinking',
  })) as Promise<HydraDB.RetrievalResult>
}

export async function recallFailuresForTarget(target: string): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.booleanRecall({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.FAILURES,
    query: `target:${target}`,
    max_results: 10,
  })) as Promise<HydraDB.RetrievalResult>
}

export async function recallDecisionsForTarget(target: string): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.fullRecall({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    query: `decisions affecting ${target}`,
    max_results: 10,
    graph_context: true,
  })) as Promise<HydraDB.RetrievalResult>
}

export async function recallParentContext(parentAgentId: string): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.fullRecall({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.agentId(parentAgentId),
    query: 'important context decisions patterns failures',
    max_results: 50,
    mode: 'thinking',
  })) as Promise<HydraDB.RetrievalResult>
}

export async function whyQuery(target: string): Promise<HydraDB.QnASearchResponse> {
  return withTimeout(getHydra().recall.qna({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    question: `Why were certain decisions made about ${target}? What reasoning and alternatives were considered?`,
    include_graph_context: true,
  })) as Promise<HydraDB.QnASearchResponse>
}

export async function getGraphSuperNodes(): Promise<HydraDB.SuperNodeResponse> {
  return withTimeout(getHydra().graphHealth.getSuperNodes({
    tenant_id: tenantId(),
    limit: 50,
  })) as Promise<HydraDB.SuperNodeResponse>
}

export async function listSources() {
  return withTimeout(getHydra().fetch.listData({
    tenant_id: tenantId(),
    page_size: 100,
  }))
}
