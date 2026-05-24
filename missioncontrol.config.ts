import { defineConfig } from './packages/sdk/src/index.js'

export default defineConfig({
  server: {
    port: parseInt(process.env.MC_SERVER_PORT || '3000'),
  },
  dashboard: {
    port: parseInt(process.env.MC_DASHBOARD_PORT || '3001'),
  },
  hydra: {
    apiKey: process.env.HYDRA_API_KEY!,
    tenantId: process.env.HYDRA_TENANT_ID!,
  },
})
