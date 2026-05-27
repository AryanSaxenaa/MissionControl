import { simpleGit } from 'simple-git'
import path from 'path'

/**
 * Every agent gets an isolated git worktree branched off the USER'S PROJECT repo.
 * The projectRoot parameter is the absolute path to the user's project.
 * Worktrees are created inside projectRoot/.trees/.
 */

function getRepoGit(projectRoot: string) {
  return simpleGit(projectRoot)
}

function worktreePath(projectRoot: string, agentId: string): string {
  return path.join(projectRoot, '.trees', agentId)
}

export async function createWorktree(
  agentId: string,
  taskName: string,
  projectRoot: string
): Promise<string> {
  const git     = getRepoGit(projectRoot)
  const safeName  = taskName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || 'session'
  const branchName = `agent/${agentId}-${safeName}`
  const wtPath  = worktreePath(projectRoot, agentId)

  await git.raw(['worktree', 'add', '-b', branchName, wtPath, 'HEAD'])
  await git.raw(['worktree', 'lock', '--reason', `MissionControl agent ${agentId}`, wtPath])

  return wtPath
}

export async function getWorktreeDiff(agentId: string, projectRoot: string): Promise<string> {
  const wtPath     = worktreePath(projectRoot, agentId)
  const worktreeGit = simpleGit(wtPath)

  await worktreeGit.add('.')
  const diff = await worktreeGit.diff(['--cached', 'HEAD'])
  await worktreeGit.reset(['HEAD'])
  return diff
}

export async function mergeWorktree(
  agentId: string,
  commitMessage: string,
  projectRoot: string
): Promise<void> {
  const git      = getRepoGit(projectRoot)
  const wtPath   = worktreePath(projectRoot, agentId)
  const worktreeGit = simpleGit(wtPath)

  const branchName = (await worktreeGit.revparse(['--abbrev-ref', 'HEAD'])).trim()
  if (!branchName || branchName === 'HEAD') {
    throw new Error(`Worktree for agent ${agentId} is in detached HEAD state — cannot merge. Check out a branch first.`)
  }

  await worktreeGit.add('.')
  const status = await worktreeGit.status()
  if (status.staged.length > 0 || status.files.length > 0) {
    await worktreeGit.commit(commitMessage)
  }

  await git.merge([branchName, '--no-ff', '-m', `merge: ${commitMessage}`])
  await deleteWorktree(agentId, projectRoot)
}

export async function deleteWorktree(agentId: string, projectRoot: string): Promise<void> {
  const git    = getRepoGit(projectRoot)
  const wtPath = worktreePath(projectRoot, agentId)

  let branchName: string | null = null
  try {
    const worktreeGit = simpleGit(wtPath)
    branchName = (await worktreeGit.revparse(['--abbrev-ref', 'HEAD'])).trim()
  } catch { /* worktree may already be removed */ }

  await git.raw(['worktree', 'unlock', wtPath]).catch(() => {})
  await git.raw(['worktree', 'remove', '--force', wtPath]).catch(() => {})

  if (branchName && branchName !== 'HEAD') {
    await git.raw(['branch', '-D', branchName]).catch(() => {})
  }
}
