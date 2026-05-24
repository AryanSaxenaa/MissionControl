import { Command } from 'commander'

export const whyCmd = new Command('why')
  .description('Ask why about a target')
  .argument('<target>', 'File or module path')
  .action(async (target) => {
    const { SERVER } = await import('../config.js')
    const resp = await fetch(`${SERVER}/api/decisions/why?target=${encodeURIComponent(target)}`)
    const data = await resp.json()
    console.log(data.answer)
  })
