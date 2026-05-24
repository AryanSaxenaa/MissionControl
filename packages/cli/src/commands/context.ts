import { Command } from 'commander'

export const contextCmd = new Command('context')
  .description('Context memory operations')
  .command('query <scope>')
  .description('Query context for a scope')
  .option('-a, --agent <agentId>', 'Agent ID')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .action(async (scope, opts) => {
    const { SERVER } = await import('../config.js')
    const params = new URLSearchParams({ scope, agentId: opts.agent || 'cli' })
    if (opts.tags) params.set('tags', opts.tags)
    const resp = await fetch(`${SERVER}/api/context/query?${params}`)
    const data = await resp.json()
    for (const item of data.items) {
      console.log(`[${item.scope}] ${item.content}`)
    }
  })
