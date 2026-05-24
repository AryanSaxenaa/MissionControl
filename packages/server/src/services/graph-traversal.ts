import { hydra, TENANT_ID } from '../hydra.js'

export async function getGraphData() {
  let superNodes: any[] = []
  let sources: any[] = []

  try {
    const [superNodesRes, sourcesRes] = await Promise.all([
      hydra.graphHealth.getSuperNodes({ tenant_id: TENANT_ID, limit: 50 }),
      hydra.fetch.listData({ tenant_id: TENANT_ID, page_size: 100 }),
    ])
    superNodes = (superNodesRes as any).super_nodes ?? []
    sources = (sourcesRes as any).sources ?? (sourcesRes as any).items ?? []
  } catch (e) {
    console.error('[graph] failed to fetch graph data:', (e as Error).message)
  }

  return { superNodes, sources }
}
