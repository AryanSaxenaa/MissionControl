import type { HydraDB } from '@hydradb/sdk'
import { getGraphSuperNodes } from '../hydra.js'

// Sources (decisions/failures) are built from in-memory ring buffers in index.ts
// because ingestMemory() creates HydraDB memories, not document sources.
// listData() always returns empty — don't call it here.
export async function getGraphData() {
  let superNodes: HydraDB.SuperNodeItem[] = []

  try {
    const superRes = await getGraphSuperNodes()
    superNodes = superRes.super_nodes ?? []
  } catch (e) {
    console.error('[graph] getSuperNodes failed:', (e as Error).message)
  }

  return { superNodes }
}
