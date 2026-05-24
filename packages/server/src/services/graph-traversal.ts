import type { HydraDB } from '@hydradb/sdk'
import { getGraphSuperNodes, listSources } from '../hydra.js'

export async function getGraphData() {
  let superNodes: HydraDB.SuperNodeItem[] = []
  let sources: HydraDB.SourceInfo[] = []

  try {
    const [superRes, sourcesRes] = await Promise.all([
      getGraphSuperNodes(),
      listSources(),
    ])
    superNodes = superRes.super_nodes ?? []
    sources = (sourcesRes as any).sources ?? (sourcesRes as any).items ?? []
  } catch (e) {
    console.error('[graph] failed to fetch graph data:', (e as Error).message)
  }

  return { superNodes, sources }
}
