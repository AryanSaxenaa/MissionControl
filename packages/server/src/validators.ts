import { z } from 'zod'

export const RegisterAgentSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['claude-code', 'codex', 'opencode', 'custom']),
  pid: z.number().optional(),
  parentAgentId: z.string().optional(),
})

export const HeartbeatSchema = z.object({
  status: z.enum(['active', 'idle', 'failed', 'completed']),
  currentTask: z.string().optional(),
})

export const IngestContextSchema = z.object({
  agentId: z.string().min(1),
  content: z.string().min(1),
  scope: z.string().min(1),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
})

export const QueryContextSchema = z.object({
  scope: z.string().min(1),
  tags: z.string().optional(),
  agentId: z.string().min(1),
})

export const DeclareIntentSchema = z.object({
  agentId: z.string().min(1),
  action: z.enum(['read', 'write', 'refactor', 'delete', 'create', 'test']),
  target: z.string().min(1),
  description: z.string().min(1),
})

export const UpdateIntentSchema = z.object({
  status: z.enum(['pending', 'in-progress', 'completed', 'cancelled', 'blocked']),
})

export const RecordDecisionSchema = z.object({
  agentId: z.string().min(1),
  summary: z.string().min(1),
  reasoning: z.string().min(1),
  alternativesConsidered: z.array(z.string()).default([]),
  affectedFiles: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
})

export const RecordFailureSchema = z.object({
  agentId: z.string().min(1),
  task: z.string().min(1),
  target: z.string().min(1),
  errorType: z.string().min(1),
  errorMessage: z.string().min(1),
  context: z.string().min(1),
  stackTrace: z.string().optional(),
})

export const CheckFailuresSchema = z.object({
  target: z.string().min(1),
  agentId: z.string().min(1),
})

export const ResolveConflictSchema = z.object({
  resolution: z.string().min(1),
})

export const WhyQuerySchema = z.object({
  target: z.string().min(1),
})
