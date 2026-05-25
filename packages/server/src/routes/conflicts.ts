import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws-events.js'
import { ResolveConflictSchema } from '../validators.js'

export default async function conflictRoutes(fastify: FastifyInstance) {
  fastify.post('/:id/resolve', async (req, reply) => {
    const { id } = req.params as Record<string, string>
    const body = ResolveConflictSchema.parse(req.body)

    broadcast({ type: 'conflict:resolved', conflictId: id, resolution: body.resolution })

    return { ok: true }
  })
}
