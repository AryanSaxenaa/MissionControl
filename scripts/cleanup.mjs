/**
 * pnpm cleanup
 *
 * Removes all orphaned agent git worktrees and branches from .trees/.
 * Run this whenever the server crashed mid-session and left stale worktrees.
 */
import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

console.log('Scanning for orphaned agent worktrees...\n')

// Parse worktree list
const raw = run('git worktree list --porcelain')
const entries = raw.split('\n\n').filter(Boolean)

let removed = 0
for (const entry of entries) {
  const lines = Object.fromEntries(
    entry.split('\n').map(l => {
      const sp = l.indexOf(' ')
      return [l.slice(0, sp), l.slice(sp + 1)]
    })
  )
  const wtPath = lines['worktree']
  const branch = lines['branch']?.replace('refs/heads/', '')

  // Skip the main worktree
  if (wtPath === ROOT.replace(/\\/g, '/')) continue

  console.log(`  Removing worktree: ${wtPath}`)
  run(`git worktree unlock "${wtPath}"`)
  run(`git worktree remove --force "${wtPath}"`)

  // Also remove the branch
  if (branch?.startsWith('agent/')) {
    console.log(`  Deleting branch:   ${branch}`)
    run(`git branch -D "${branch}"`)
  }

  // Force-remove directory if git didn't (EPERM can happen if a process still holds a handle)
  if (existsSync(wtPath)) {
    try {
      rmSync(wtPath, { recursive: true, force: true })
      console.log(`  Force-removed dir: ${wtPath}`)
    } catch (e) {
      console.log(`  Warning: could not remove dir (process may still be running): ${wtPath}`)
      console.log(`  Run again after stopping any processes in that directory.`)
    }
  }

  removed++
}

if (removed === 0) {
  console.log('  Nothing to clean up.')
} else {
  console.log(`\nCleaned up ${removed} orphaned worktree(s).`)
}

// Final state
console.log('\nCurrent worktrees:')
console.log(run('git worktree list'))
