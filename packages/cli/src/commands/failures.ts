import { Command } from 'commander'

export const failuresCmd = new Command('failures')
  .description('Check known failures')
  .argument('<target>', 'File or module path')
  .action(async (target) => {
    const { SERVER } = await import('../config.js')
    const resp = await fetch(`${SERVER}/api/failures/check?target=${encodeURIComponent(target)}&agentId=cli`)
    const data = await resp.json()
    if (data.failures.length === 0) {
      console.log('No known failures.')
      return
    }
    for (const f of data.failures) {
      console.log(`[${f.errorType}] ${f.summary}`)
    }
  })
