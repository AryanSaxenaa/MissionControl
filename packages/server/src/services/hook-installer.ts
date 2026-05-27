import path from 'path'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import type { AgentKind } from '@missioncontrol/types'

const execAsync = promisify(exec)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../')

function buildClaudeHookConfig(serverUrl: string, agentId: string): object {
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

function buildCodexHookConfig(serverUrl: string, agentId: string): object {
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

function buildOpenCodeConfig(serverUrl: string, agentId: string): object {
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

    // Auto-install @missioncontrol/opencode-plugin into worktree.
    // Without this, opencode.json references a package not in node_modules.
    // Uses file: protocol relative path from worktree to monorepo's plugin package
    // so it works without publishing to npm.
    const pluginPkgPath = path.join(MONOREPO_ROOT, 'packages', 'opencode-plugin')
    const relativePluginPath = path.relative(worktreePath, pluginPkgPath)
    try {
      await execAsync(`npm install "${relativePluginPath}"`, { cwd: worktreePath })
    } catch (firstErr: any) {
      console.warn(`[hooks] npm install failed for ${agentId}, trying pnpm:`, firstErr?.message || firstErr)
      try {
        await execAsync(`pnpm add "${relativePluginPath}"`, { cwd: worktreePath })
      } catch (pnpmErr: any) {
        console.warn(`[hooks] pnpm install also failed for ${agentId}, trying yarn:`, pnpmErr?.message || pnpmErr)
        try {
          await execAsync(`yarn add "file:${relativePluginPath}"`, { cwd: worktreePath })
        } catch (yarnErr: any) {
          console.error(`[hooks] all package managers failed for ${agentId}. opencode plugin will not be available. yarn error:`, yarnErr?.message || yarnErr)
        }
      }
    }
  } else if (kind === 'custom') {
    // Custom kind = generic shell. We don't know which CLI the user will run.
    // Install configs for all three known agents so whichever one they invoke
    // inside the worktree picks up our hooks automatically. Also drop a NOTE
    // explaining what coverage they have.
    const claudeDir = path.join(worktreePath, '.claude')
    const codexDir  = path.join(worktreePath, '.codex')
    await Promise.all([
      fs.mkdir(claudeDir, { recursive: true }),
      fs.mkdir(codexDir,  { recursive: true }),
    ])
    await Promise.all([
      fs.writeFile(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify(buildClaudeHookConfig(serverUrl, agentId), null, 2)
      ),
      fs.writeFile(
        path.join(codexDir, 'hooks.json'),
        JSON.stringify(buildCodexHookConfig(serverUrl, agentId), null, 2)
      ),
      fs.writeFile(
        path.join(worktreePath, 'opencode.json'),
        JSON.stringify(buildOpenCodeConfig(serverUrl, agentId), null, 2)
      ),
      fs.writeFile(
        path.join(worktreePath, '.mc_note.md'),
        `# MissionControl — custom agent\n\n` +
        `This worktree was spawned as a 'custom' (generic shell) agent.\n` +
        `Hook configs were pre-installed for Claude Code, Codex, and OpenCode,\n` +
        `so any of those CLIs you launch from here will report to MissionControl.\n` +
        `Shells like plain bash/cmd cannot be observed — runs in a raw shell\n` +
        `(direct file edits via 'echo > file', etc.) are invisible to conflict\n` +
        `detection and the Decision Log.\n`
      ),
    ])
  }
}
