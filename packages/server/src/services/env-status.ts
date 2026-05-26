import { existsSync } from 'fs'
import { listSources } from '../hydra.js'

export type EnvIntegrationStatus = {
  hydraConfigured: boolean
  hydraReachable: boolean | null
  hydraError: string | null
  openrouterConfigured: boolean
  envFileFound: boolean
}

export function createEnvStatus(envPath: string): EnvIntegrationStatus {
  return {
    hydraConfigured: Boolean(process.env.HYDRA_API_KEY && process.env.HYDRA_TENANT_ID),
    hydraReachable: null,
    hydraError: null,
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    envFileFound: existsSync(envPath),
  }
}

export function printBootBanner(envStatus: EnvIntegrationStatus, envPath: string) {
  console.log(`[MissionControl] env file: ${envStatus.envFileFound ? envPath : 'NOT FOUND'}`)
  if (!envStatus.hydraConfigured) {
    console.error(
      `[MissionControl] FATAL CONFIG: HYDRA_API_KEY and HYDRA_TENANT_ID are required.\n` +
      `  - HYDRA_API_KEY     : ${process.env.HYDRA_API_KEY ? 'set' : 'MISSING'}\n` +
      `  - HYDRA_TENANT_ID   : ${process.env.HYDRA_TENANT_ID ? 'set' : 'MISSING'}\n` +
      `  Add these to ${envPath} before spawning agents. Memory/decisions/conflicts will not work without them.`
    )
  } else {
    console.log(`[MissionControl] HydraDB configured (tenant: ${process.env.HYDRA_TENANT_ID})`)
  }
  console.log(`[MissionControl] OpenRouter (semantic conflict step): ${envStatus.openrouterConfigured ? 'enabled' : 'disabled (no OPENROUTER_API_KEY)'}`)
}

export function pingHydraDB(envStatus: EnvIntegrationStatus) {
  if (!envStatus.hydraConfigured) {
    envStatus.hydraReachable = false
    envStatus.hydraError = 'HYDRA_API_KEY or HYDRA_TENANT_ID not set'
    return
  }
  listSources()
    .then(() => {
      envStatus.hydraReachable = true
      console.log(`[MissionControl] HydraDB reachable — connectivity verified`)
    })
    .catch((e: any) => {
      envStatus.hydraReachable = false
      envStatus.hydraError = e?.message || String(e)
      console.error(`[MissionControl] HydraDB UNREACHABLE: ${envStatus.hydraError}`)
      console.error(`  All ingestContext/ingestDecision/ingestFailure calls will fail.`)
      console.error(`  Verify HYDRA_API_KEY is valid and your network can reach HydraDB.`)
    })
}
