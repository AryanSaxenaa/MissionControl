import { simpleGit } from 'simple-git'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

// Resolve repo root relative to this file (packages/server/src/services/ → ../../../../)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../../')
const TREES_DIR = path.join(REPO_ROOT, '.trees')

const git = simpleGit(REPO_ROOT)

export async function createWorktree(agentId: string, taskName: string): Promise<string> {
  const safeName = taskName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
  const branchName = `agent/${agentId}-${safeName}`
  const worktreePath = path.join(TREES_DIR, agentId)

  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'])
  await git.raw(['worktree', 'lock', '--reason', `MissionControl agent ${agentId}`, worktreePath])

  return worktreePath
}

export async function getWorktreeDiff(agentId: string): Promise<string> {
  const worktreePath = path.join(TREES_DIR, agentId)
  const worktreeGit = simpleGit(worktreePath)

  await worktreeGit.add('.')
  const diff = await worktreeGit.diff(['--cached', 'HEAD'])
  await worktreeGit.reset(['HEAD'])
  return diff
}

export async function mergeWorktree(agentId: string, commitMessage: string): Promise<void> {
  const worktreePath = path.join(TREES_DIR, agentId)
  const worktreeGit = simpleGit(worktreePath)

  // Resolve the actual branch name from the worktree (avoids hardcoding the task-slug suffix)
  const branchResult = await worktreeGit.revparse(['--abbrev-ref', 'HEAD'])
  const branchName = branchResult.trim()

  await worktreeGit.add('.')
  // Only commit if there are staged changes; an empty commit would fail
  const status = await worktreeGit.status()
  if (status.staged.length > 0 || status.files.length > 0) {
    await worktreeGit.commit(commitMessage)
  }

  await git.merge([branchName, '--no-ff', '-m', `merge: ${commitMessage}`])

  await deleteWorktree(agentId)
}

export async function deleteWorktree(agentId: string): Promise<void> {
  const worktreePath = path.join(TREES_DIR, agentId)

  // Resolve the actual branch name before removing the worktree
  // (createWorktree names branches agent/{id}-{task-slug}, not just agent/{id})
  let branchName: string | null = null
  try {
    const worktreeGit = simpleGit(worktreePath)
    branchName = (await worktreeGit.revparse(['--abbrev-ref', 'HEAD'])).trim()
  } catch { /* worktree may already be gone */ }

  await git.raw(['worktree', 'unlock', worktreePath]).catch(() => {})
  await git.raw(['worktree', 'remove', '--force', worktreePath]).catch(() => {})

  if (branchName && branchName !== 'HEAD') {
    await git.raw(['branch', '-D', branchName]).catch(() => {})
  }
}
