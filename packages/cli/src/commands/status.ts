import { Command } from 'commander'

export const statusCmd = new Command('status')
  .description('Show MissionControl status')
  .action(async () => {
    const { SERVER } = await import('../config.js')
    const resp = await fetch(`${SERVER}/api/status`)
    const data = await resp.json()
    console.log(`Agents: ${data.agents}`)
    console.log(`Active intents: ${data.intents}`)
    console.log(`Uptime: ${Math.round(data.uptime)}s`)
  })
