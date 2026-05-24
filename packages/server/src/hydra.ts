import { HydraDBClient } from '@hydradb/sdk'
import { v4 as uuidv4 } from 'uuid'

let _hydra: HydraDBClient | null = null
function getHydra(): HydraDBClient {
  if (!_hydra) {
    _hydra = new HydraDBClient({
      token: process.env.HYDRA_API_KEY!,
    })
  }
  return _hydra
}

export function getTenantId(): string {
  return process.env.HYDRA_TENANT_ID!
}
export function getHydraForTest(): HydraDBClient { return getHydra() }

export const SUB_TENANTS = {
  SHARED: 'shared',
  DECISIONS: 'decisions',
  FAILURES: 'failures',
  INTENTS: 'intents',
  agentId: (id: string) => `agent-${id}`,
} as const

export async function ingestContext(params: {
  agentId: string
  content: string
  scope: string
  tags: string[]
  confidence: number
}): Promise<string> {
  const text = `[CONTEXT] scope:${params.scope} tags:${params.tags.join(',')}\n${params.content}`

  const result = await getHydra().ingestionPipeline.ingestMemory({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.SHARED,
    text,
    infer: true,
    metadata: {
      type: 'context',
      agent_id: params.agentId,
      scope: params.scope,
      tags: params.tags,
      confidence: params.confidence,
      created_at: Date.now(),
    },
    additional_metadata: {
      type: 'context',
      scope: params.scope,
    },
  })
  return result.doc_id
}

export async function ingestDecision(params: {
  agentId: string
  summary: string
  reasoning: string
  alternativesConsidered: string[]
  affectedFiles: string[]
  tags: string[]
}): Promise<string> {
  const text = `[DECISION] ${params.summary}\nAgent: ${params.agentId}\nAffected files: ${params.affectedFiles.join(', ')}\nAlternatives considered: ${params.alternativesConsidered.join('; ')}\nReasoning: ${params.reasoning}\nTags: ${params.tags.join(', ')}`

  const result = await getHydra().ingestionPipeline.ingestMemory({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    text,
    infer: true,
    metadata: {
      type: 'decision',
      agent_id: params.agentId,
      affected_files: params.affectedFiles,
      tags: params.tags,
      created_at: Date.now(),
    },
    additional_metadata: {
      type: 'decision',
    },
  })
  return result.doc_id
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
  const text = `[FAILURE] target:${params.target} errorType:${params.errorType}\nTask attempted: ${params.task}\nError: ${params.errorMessage}\nContext at failure: ${params.context}\nAgent: ${params.agentId}\n${params.stackTrace ? `Stack trace:\n${params.stackTrace}` : ''}`

  const result = await getHydra().ingestionPipeline.ingestMemory({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.FAILURES,
    text,
    infer: false,
    metadata: {
      type: 'failure',
      agent_id: params.agentId,
      target: params.target,
      error_type: params.errorType,
      created_at: Date.now(),
    },
    additional_metadata: {
      type: 'failure',
      target: params.target,
    },
  })
  return result.doc_id
}

export async function recallContext(query: string, subTenant = SUB_TENANTS.SHARED) {
  return getHydra().recall.fullRecall({
    tenant_id: getTenantId(),
    sub_tenant_id: subTenant,
    query,
    max_results: 10,
    graph_context: true,
    mode: 'thinking',
  })
}

export async function recallFailuresForTarget(target: string) {
  return getHydra().recall.booleanRecall({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.FAILURES,
    query: `target:${target}`,
    max_results: 10,
  })
}

export async function recallDecisionsForTarget(target: string) {
  return getHydra().recall.fullRecall({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    query: `decisions affecting ${target}`,
    max_results: 10,
    graph_context: true,
  })
}

export async function recallParentContext(parentAgentId: string) {
  return getHydra().recall.fullRecall({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.agentId(parentAgentId),
    query: 'important context decisions patterns failures',
    max_results: 50,
    mode: 'thinking',
  })
}

export async function whyQuery(target: string) {
  return getHydra().recall.qna({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    question: `Why were certain decisions made about ${target}? What reasoning and alternatives were considered?`,
    include_graph_context: true,
  })
}

export async function getGraphSuperNodes() {
  return getHydra().graphHealth.getSuperNodes({
    tenant_id: getTenantId(),
    limit: 50,
  })
}

export async function ingestAgentSummary(agentId: string, summary: string) {
  await getHydra().ingestionPipeline.ingestMemory({
    tenant_id: getTenantId(),
    sub_tenant_id: SUB_TENANTS.agentId(agentId),
    text: summary,
    infer: true,
    metadata: {
      type: 'agent_summary',
      agent_id: agentId,
      created_at: Date.now(),
    },
  })
}
