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
  const preToolUse = `
export default async (payload) => {
  try {
    const resp = await fetch(\`${serverUrl}/hooks/pre-tool-use?agentId=${agentId}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await resp.json()
    if (data.hookSpecificOutput) {
      if (data.hookSpecificOutput.permissionDecision === 'deny') {
        return { decision: 'block', reason: data.hookSpecificOutput.permissionDecisionReason }
      }
      if (data.hookSpecificOutput.additionalContext) {
        process.stderr.write(data.hookSpecificOutput.additionalContext + '\\n')
      }
    }
  } catch (err) {
    // silently fail network errors to avoid blocking
  }
  return { decision: 'allow' }
}`.trim()

  const postToolUse = `
export default async (payload) => {
  try {
    await fetch(\`${serverUrl}/hooks/post-tool-use?agentId=${agentId}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    // silently fail
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
