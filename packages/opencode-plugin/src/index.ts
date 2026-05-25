// @missioncontrol/opencode-plugin
// OpenCode plugin that integrates with MissionControl server
// Import type from @opencode-ai/plugin when installed

const WRITE_TOOLS = ['write', 'edit', 'bash']

export const MissionControlPlugin = async ({ client, project }: { client: any; project: any }) => {
  const serverUrl = process.env.MC_SERVER_URL!
  const agentId = process.env.MC_AGENT_ID!

  if (!serverUrl || !agentId) {
    console.warn('[MissionControl] MC_SERVER_URL or MC_AGENT_ID not set — plugin inactive')
    return {}
  }

  // Register session with MissionControl
  await fetch(`${serverUrl}/hooks/session-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, session_id: project.id }),
  }).catch(() => {})

  return {
    hooks: {
      'tool.execute.before': async ({ tool, input }: { tool: string; input: any }) => {
        if (!WRITE_TOOLS.includes(tool.toLowerCase())) return

        const resp = await fetch(`${serverUrl}/hooks/pre-tool-use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool_name: tool,
            tool_input: input,
            session_id: project.id,
          }),
        })
        const data = await resp.json()
        if (data?.hookSpecificOutput?.permissionDecision === 'deny') {
          throw new Error(
            data.hookSpecificOutput.permissionDecisionReason ?? 'Blocked by MissionControl'
          )
        }
      },

      'tool.execute.after': async ({ tool, input, output }: { tool: string; input: any; output: any }) => {
        if (!WRITE_TOOLS.includes(tool.toLowerCase())) return

        await fetch(`${serverUrl}/hooks/post-tool-use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool_name: tool,
            tool_input: input,
            tool_output: output,
            session_id: project.id,
          }),
        }).catch(() => {})
      },

      // event is 'permission.ask', NOT 'permission.asked'
      'permission.ask': async ({ tool, input }: { tool: string; input: any; requestId?: string }) => {
        const resp = await fetch(`${serverUrl}/hooks/permission-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool_name: tool,
            tool_input: input,
            session_id: project.id,
          }),
        })
        const data = await resp.json()
        return data?.hookSpecificOutput?.permissionDecision ?? 'allow'
      },

      'session.idle': async () => {
        await fetch(`${serverUrl}/hooks/session-idle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: project.id, agentId }),
        }).catch(() => {})
      },
    },
  }
}

export default MissionControlPlugin
