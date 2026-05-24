import { Command } from 'commander'
import { SERVER } from '../config.js'

export const contextCmd = new Command('context')
  .description('Context memory operations')

contextCmd
  .command('query <scope>')
  .description('Query context for a scope')
  .option('-a, --agent <agentId>', 'Agent ID')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .action(async (scope, opts) => {
    try {
      const params = new URLSearchParams({ scope, agentId: opts.agent || 'cli' })
      if (opts.tags) params.set('tags', opts.tags)
      const resp = await fetch(`${SERVER}/api/context/query?${params}`)
      if (!resp.ok) {
        console.error(`Error: HTTP ${resp.status} - ${await resp.text().catch(() => 'unknown error')}`)
        process.exit(1)
      }
      const data = await resp.json()
      if (!data.items || !Array.isArray(data.items)) {
        console.log('No context items found')
        return
      }
      for (const item of data.items) {
        console.log(`[${item.scope}] ${item.content}`)
      }
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : 'Request failed'}`)
      process.exit(1)
    }
  })
