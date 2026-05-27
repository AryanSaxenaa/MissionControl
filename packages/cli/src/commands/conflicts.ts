import { Command } from 'commander'

export const conflictsCmd = new Command('conflicts')
  .description('List active conflicts via the server API')
  .action(async () => {
    const { SERVER } = await import('../config.js')
    try {
      const resp = await fetch(`${SERVER}/api/conflicts/`)
      if (!resp.ok) {
        console.log(`Server returned ${resp.status} — is MissionControl running?`)
        console.log(`Dashboard: http://localhost:3001`)
        return
      }
      const data = (await resp.json()) as Array<{
        id: string
        severity: string
        kind: string
        description: string
        agentIds: string[]
        createdAt: number
      }>

      if (!Array.isArray(data) || data.length === 0) {
        console.log('No active conflicts.')
        return
      }

      const SEVERITY_ICON: Record<string, string> = {
        critical: '!',
        warning:  '~',
        info:     'i',
      }

      for (const c of data) {
        const icon = SEVERITY_ICON[c.severity] ?? '?'
        const time = new Date(c.createdAt).toLocaleTimeString()
        console.log(`[${icon}] ${c.severity.toUpperCase()} (${c.kind}) — ${c.description}`)
        console.log(`    agents: ${c.agentIds.join(', ')}  |  ${time}`)
      }
    } catch (e: any) {
      console.log(`Cannot reach server at ${SERVER}: ${e.message || 'network error'}`)
    }
  })
