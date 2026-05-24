import { Command } from 'commander'
import { spawn } from 'child_process'

export const startCmd = new Command('start')
  .description('Start MissionControl server and dashboard')
  .option('-s, --server-only', 'Start only the server')
  .action(async (opts) => {
    console.log('[mc] Starting server...')
    const server = spawn('pnpm', ['--filter', '@missioncontrol/server', 'dev'], {
      stdio: 'inherit',
    })

    if (!opts.serverOnly) {
      setTimeout(() => {
        console.log('[mc] Starting dashboard...')
        spawn('pnpm', ['--filter', '@missioncontrol/dashboard', 'dev'], {
          stdio: 'inherit',
        })
      }, 2000)
    }

    server.on('exit', (code) => {
      process.exitCode = code ?? 0
    })
  })
