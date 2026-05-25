import path from 'path'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import type { AgentKind } from '@missioncontrol/types'

const execAsync = promisify(exec)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../')

export function buildClaudeHookConfig(serverUrl: string, agentId: string): object {
  const q = `?agentId=${agentId}`
  return {
    hooks: {
      PreToolUse: [{
        matcher: 'Write|Edit|MultiEdit|Bash',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/pre-tool-use${q}` }],
      }],
      PostToolUse: [{
        matcher: 'Write|Edit|MultiEdit|Bash',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/post-tool-use${q}` }],
      }],
      PermissionRequest: [{
        matcher: '.*',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/permission-request${q}` }],
      }],
      SessionStart: [{
        matcher: '.*',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/session-start${q}` }],
      }],
    },
  }
}

export function buildCodexHookConfig(serverUrl: string, agentId: string): object {
  const q = `?agentId=${agentId}`
  return {
    hooks: {
      PreToolUse: [{ type: 'http', url: `${serverUrl}/hooks/pre-tool-use${q}` }],
      PostToolUse: [{ type: 'http', url: `${serverUrl}/hooks/post-tool-use${q}` }],
      PermissionRequest: [{ type: 'http', url: `${serverUrl}/hooks/permission-request${q}` }],
      SessionStart: [{ type: 'http', url: `${serverUrl}/hooks/session-start${q}` }],
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
    const config = buildClaudeHookConfig(serverUrl, agentId)
    await fs.writeFile(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify(config, null, 2)
    )
  } else if (kind === 'codex') {
    const codexDir = path.join(worktreePath, '.codex')
    await fs.mkdir(codexDir, { recursive: true })
    const config = buildCodexHookConfig(serverUrl, agentId)
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

    // Spec §6: Auto-install @missioncontrol/opencode-plugin into worktree.
    // Without this, opencode.json references a package not in node_modules.
    // Uses file: protocol relative path from worktree to monorepo's plugin package
    // so it works without publishing to npm.
    const pluginPkgPath = path.join(MONOREPO_ROOT, 'packages', 'opencode-plugin')
    const relativePluginPath = path.relative(worktreePath, pluginPkgPath)
    try {
      await execAsync(`npm install "${relativePluginPath}"`, { cwd: worktreePath })
    } catch {
      // Non-fatal — agent can still work without the plugin
    }
  }
}
