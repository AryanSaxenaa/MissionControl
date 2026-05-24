import { getHydraForTest as getHydra, getTenantId } from '../hydra.js'

export async function getGraphData() {
  let superNodes: any[] = []
  let sources: any[] = []

  try {
    const hydra = getHydra()
    const tenantId = getTenantId()
    const [superNodesRes, sourcesRes] = await Promise.all([
      hydra.graphHealth.getSuperNodes({ tenant_id: tenantId, limit: 50 }),
      hydra.fetch.listData({ tenant_id: tenantId, page_size: 100 }),
    ].map(p => Promise.race([
      p,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ])))
    superNodes = (superNodesRes as any).super_nodes ?? []
    sources = (sourcesRes as any).sources ?? (sourcesRes as any).items ?? []
  } catch (e) {
    console.error('[graph] failed to fetch graph data:', (e as Error).message)
  }

  return { superNodes, sources }
}
