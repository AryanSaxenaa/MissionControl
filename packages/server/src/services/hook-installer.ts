import path from 'path'
import fs from 'fs/promises'
import type { AgentKind } from '@missioncontrol/types'

export function buildClaudeHookConfig(serverUrl: string): object {
  return {
    hooks: {
      PreToolUse: [{
        matcher: 'Write|Edit|MultiEdit|Bash',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/pre-tool-use` }],
      }],
      PostToolUse: [{
        matcher: 'Write|Edit|MultiEdit|Bash',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/post-tool-use` }],
      }],
      PermissionRequest: [{
        matcher: '.*',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/permission-request` }],
      }],
      SessionStart: [{
        matcher: '.*',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/session-start` }],
      }],
    },
  }
}

export function buildCodexHookConfig(serverUrl: string): object {
  return {
    hooks: {
      PreToolUse: [{ type: 'http', url: `${serverUrl}/hooks/pre-tool-use` }],
      PostToolUse: [{ type: 'http', url: `${serverUrl}/hooks/post-tool-use` }],
      PermissionRequest: [{ type: 'http', url: `${serverUrl}/hooks/permission-request` }],
      SessionStart: [{ type: 'http', url: `${serverUrl}/hooks/session-start` }],
    },
  }
}

export function buildOpenCodeConfig(serverUrl: string, agentId: string): object {
  // opencode.json schema: https://opencode.ai/config.json
  // The correct key is "plugin" (singular array), NOT "plugins".
  // MC_SERVER_URL and MC_AGENT_ID are injected as PTY env vars by pty-spawner.ts,
  // so the plugin reads them from process.env at runtime.
  return {
    $schema: 'https://opencode.ai/config.json',
    plugin: ['@missioncontrol/opencode-plugin'],
  }
}

export async function installHooks(
  agentId: string,
  kind: AgentKind,
  worktreePath: string
): Promise<void> {
  const serverUrl = `http://localhost:${process.env.MC_SERVER_PORT ?? 3000}`

  if (kind === 'claude-code') {
    const claudeDir = path.join(worktreePath, '.claude')
    await fs.mkdir(claudeDir, { recursive: true })
    const config = buildClaudeHookConfig(serverUrl)
    await fs.writeFile(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify(config, null, 2)
    )
  } else if (kind === 'codex') {
    const codexDir = path.join(worktreePath, '.codex')
    await fs.mkdir(codexDir, { recursive: true })
    const config = buildCodexHookConfig(serverUrl)
    await fs.writeFile(
      path.join(codexDir, 'hooks.json'),
      JSON.stringify(config, null, 2)
    )
  } else if (kind === 'opencode') {
    const config = buildOpenCodeConfig(serverUrl, agentId)
    await fs.writeFile(
      path.join(worktreePath, 'opencode.json'),
      JSON.stringify(config, null, 2)
    )
  }
}
