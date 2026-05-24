import { Command } from 'commander'

export const agentCmd = new Command('agent')
  .description('Agent operations')

agentCmd
  .command('register <name>')
  .description('Register a new agent')
  .option('-k, --kind <kind>', 'Agent kind', 'custom')
  .action(async (name, opts) => {
    const { SERVER } = await import('../config.js')
    const resp = await fetch(`${SERVER}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind: opts.kind }),
    })
    const data = await resp.json()
    console.log(JSON.stringify(data, null, 2))
  })
