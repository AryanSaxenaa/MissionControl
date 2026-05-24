interface HookConfig {
  writeTools: string[]
  supportsRelevantContext: boolean
}

const PLATFORM_CONFIG: Record<string, HookConfig> = {
  claude: {
    writeTools: ['Write', 'Edit', 'MultiEdit', 'Bash'],
    supportsRelevantContext: true,
  },
  opencode: {
    writeTools: ['Write', 'Edit', 'Bash'],
    supportsRelevantContext: false,
  },
}

export function generateHooks(
  platform: 'claude' | 'opencode',
  agentId: string,
  serverUrl: string,
): { preToolUse: string; postToolUse: string } {
  const config = PLATFORM_CONFIG[platform]
  const WRITE_TOOLS_JSON = JSON.stringify(config.writeTools)

  const preToolUse = `
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
const INTENT_FILE = join(tmpdir(), 'mc_intent_${agentId}.json')

export default async ({ tool_name, tool_input }) => {
  const WRITE_TOOLS = ${WRITE_TOOLS_JSON}
  if (!WRITE_TOOLS.includes(tool_name)) return { decision: 'allow' }

  const target = tool_input.file_path || tool_input.path || tool_input.command || 'unknown'

  try {
    const failResp = await fetch(\`${serverUrl}/api/failures/check?target=\${encodeURIComponent(target)}&agentId=${agentId}\`)
    const failData = await failResp.json()
    if (failData.failures.length > 0) {
      const f = failData.failures[0]
      process.stderr.write('[MissionControl] Known failure for ' + target + ': ' + f.summary + '\\n')
    }

    const intentResp = await fetch('${serverUrl}/api/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '${agentId}',
        action: 'write',
        target,
        description: tool_input.description || \`\${tool_name} on \${target}\`,
      }),
    })
    const intentData = await intentResp.json()

    writeFileSync(INTENT_FILE, JSON.stringify({ intentId: intentData.intentId }))

    if (intentData.conflicts.length > 0) {
      const c = intentData.conflicts[0]
      if (c.severity === 'critical') {
        return {
          decision: 'block',
          reason: '[MissionControl CONFLICT] ' + c.description,
        }
      }
      process.stderr.write('[MissionControl WARNING] ' + c.description + '\\n')
    }

    ${config.supportsRelevantContext ? `if (intentData.relevantContext) {
      process.stderr.write('[MissionControl Context]\\n' + intentData.relevantContext + '\\n')
    }` : ''}
  } catch (err) {
    process.stderr.write('[MissionControl] Error (non-blocking): ' + err.message + '\\n')
  }

  return { decision: 'allow' }
}`.trim()

  const postToolUse = `
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
const INTENT_FILE = join(tmpdir(), 'mc_intent_${agentId}.json')

export default async ({ tool_name, tool_input, tool_output }) => {
  const WRITE_TOOLS = ${WRITE_TOOLS_JSON}
  if (!WRITE_TOOLS.includes(tool_name)) return

  try {
    if (existsSync(INTENT_FILE)) {
      const { intentId } = JSON.parse(readFileSync(INTENT_FILE, 'utf8'))
      await fetch(\`${serverUrl}/api/intents/\${intentId}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      unlinkSync(INTENT_FILE)
    }

    const target = tool_input.file_path || tool_input.path || tool_input.command || 'unknown'
    await fetch('${serverUrl}/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '${agentId}',
        content: \`Modified \${target}: \${tool_input.description || tool_name + ' operation'}\`,
        scope: target,
        tags: ['modification', tool_name.toLowerCase()],
        confidence: 0.9,
      }),
    })
  } catch (err) {
    process.stderr.write('[MissionControl] PostToolUse error (non-blocking): ' + err.message + '\\n')
  }
}`.trim()

  return { preToolUse, postToolUse }
}

export function buildClaudeSettingsHooks(agentId: string, serverUrl: string): object {
  const { writeTools } = PLATFORM_CONFIG.claude
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: writeTools.join('|'),
          hooks: [{ type: 'command', command: 'node .claude/hooks/mc_pre.js' }],
        },
      ],
      PostToolUse: [
        {
          matcher: writeTools.join('|'),
          hooks: [{ type: 'command', command: 'node .claude/hooks/mc_post.js' }],
        },
      ],
    },
  }
}
