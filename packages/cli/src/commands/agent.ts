import { Command } from 'commander'
import { SERVER } from '../config.js'

export const agentCmd = new Command('agent')
  .description('Agent operations')

agentCmd
  .command('register <name>')
  .description('Register a new agent')
  .option('-k, --kind <kind>', 'Agent kind', 'custom')
  .action(async (name, opts) => {
    try {
      const resp = await fetch(`${SERVER}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind: opts.kind }),
      })
      if (!resp.ok) {
        console.error(`Error: HTTP ${resp.status} - ${await resp.text().catch(() => 'unknown error')}`)
        process.exit(1)
      }
      const data = await resp.json()
      console.log(JSON.stringify(data, null, 2))
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : 'Request failed'}`)
      process.exit(1)
    }
  })
