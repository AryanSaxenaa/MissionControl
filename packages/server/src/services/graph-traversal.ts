import type { HydraDB } from '@hydradb/sdk'
import { getGraphSuperNodes } from '../hydra.js'
import type { DecisionItem, FailureItem } from '@missioncontrol/types'
import { agents, activeIntents } from '../state.js'

function synthesizeSources(
  recentDecisions: DecisionItem[],
  recentFailures: FailureItem[]
) {
  const decisionSources = recentDecisions.map(d => ({
    source_id: d.sourceId || `decision-${d.createdAt}`,
    sub_tenant_id: 'decisions',
    created_at: new Date(d.createdAt).toISOString(),
    metadata: { agent_id: d.agentId, summary: d.summary },
  }))
  const failureSources = recentFailures.map(f => ({
    source_id: f.sourceId || `failure-${f.createdAt}`,
    sub_tenant_id: 'failures',
    created_at: new Date(f.createdAt).toISOString(),
    metadata: { agent_id: f.agentId, target: f.target, error_type: f.errorType },
  }))
  return [...decisionSources, ...failureSources].slice(0, 200)
}

export async function getGraphData(
  recentDecisions: DecisionItem[],
  recentFailures: FailureItem[]
) {
  let superNodes: HydraDB.SuperNodeItem[] = []

  try {
    const superRes = await getGraphSuperNodes()
    superNodes = superRes.super_nodes ?? []
  } catch (e) {
    console.error('[graph] getSuperNodes failed:', (e as Error).message)
  }

  return {
    superNodes,
    sources: synthesizeSources(recentDecisions, recentFailures),
    activeAgents: [...agents.values()],
    activeIntents: [...activeIntents.values()],
  }
}
