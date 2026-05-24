import { Command } from 'commander'

export const conflictsCmd = new Command('conflicts')
  .description('List active conflicts')
  .action(async () => {
    console.log('Conflicts stream via dashboard or WebSocket.')
    console.log(`Dashboard: http://localhost:3001`)
  })
