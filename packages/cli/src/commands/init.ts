import { Command } from 'commander'

export const initCmd = new Command('init')
  .description('Initialize MissionControl in current project')
  .action(async () => {
    const { mkdir, writeFile } = await import('fs/promises')
    const { join } = await import('path')
    const cwd = process.cwd()
    const mcDir = join(cwd, '.missioncontrol')
    await mkdir(mcDir, { recursive: true })

    const envContent = `HYDRA_API_KEY=\nHYDRA_TENANT_ID=mc-\nMC_SERVER_PORT=3000\nMC_DASHBOARD_PORT=3001\n`
    try {
      await writeFile(join(cwd, '.env'), envContent, { flag: 'wx' })
    } catch (err: any) {
      if (err?.code !== 'EEXIST') {
        console.error(`[mc] Failed to write .env: ${err?.message || err}`)
      }
    }

    console.log('[mc] Initialized. Edit .env and run `mc start`.')
  })
