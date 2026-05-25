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
  return {
    plugins: ['@missioncontrol/opencode-plugin'],
    env: {
      MC_SERVER_URL: serverUrl,
      MC_AGENT_ID: agentId,
    },
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
