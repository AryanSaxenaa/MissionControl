import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws-events.js'
import { ResolveConflictSchema } from '../validators.js'

// In-memory conflict store (populated via broadcast side-effects; authoritative list for dashboard)
const activeConflicts = new Map<string, import('@missioncontrol/types').ConflictResult>()

export function trackConflict(c: import('@missioncontrol/types').ConflictResult) {
  activeConflicts.set(c.id, c)
}

export default async function conflictRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return [...activeConflicts.values()]
  })

  fastify.post('/:id/resolve', async (req, reply) => {
    const { id } = req.params as Record<string, string>
    const body = ResolveConflictSchema.parse(req.body)

    activeConflicts.delete(id)
    broadcast({ type: 'conflict:resolved', conflictId: id, resolution: body.resolution })

    return { ok: true }
  })
}
