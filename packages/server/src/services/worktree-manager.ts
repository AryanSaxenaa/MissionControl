import { simpleGit } from 'simple-git'
import path from 'path'
import fs from 'fs/promises'

const git = simpleGit(process.cwd())
const TREES_DIR = '.trees'

export async function createWorktree(agentId: string, taskName: string): Promise<string> {
  const safeName = taskName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
  const branchName = `agent/${agentId}-${safeName}`
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)

  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'])
  await git.raw(['worktree', 'lock', '--reason', `MissionControl agent ${agentId}`, worktreePath])

  return worktreePath
}

export async function getWorktreeDiff(agentId: string): Promise<string> {
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)
  const worktreeGit = simpleGit(worktreePath)

  await worktreeGit.add('.')
  const diff = await worktreeGit.diff(['--cached', 'HEAD'])
  await worktreeGit.reset(['HEAD'])
  return diff
}

export async function mergeWorktree(agentId: string, commitMessage: string): Promise<void> {
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)
  const worktreeGit = simpleGit(worktreePath)
  const branchName = `agent/${agentId}`

  await worktreeGit.add('.')
  await worktreeGit.commit(commitMessage)

  await git.merge([branchName, '--no-ff', '-m', `merge: ${commitMessage}`])

  await deleteWorktree(agentId)
}

export async function deleteWorktree(agentId: string): Promise<void> {
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)
  await git.raw(['worktree', 'unlock', worktreePath]).catch(() => {})
  await git.raw(['worktree', 'remove', '--force', worktreePath]).catch(() => {})
  await git.raw(['branch', '-D', `agent/${agentId}`]).catch(() => {})
}
