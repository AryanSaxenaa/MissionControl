import { useEffect, useRef, useState } from 'react'
import { useMissionControlStore } from '../store/useStore'
import * as d3 from 'd3'

interface MemoryEntry {
  source_id: string
  sub_tenant_id?: string
  created_at?: string
  metadata?: Record<string, any>
}

const SUB_TENANT_COLORS: Record<string, string> = {
  shared:    '#f97316',  // orange — context writes
  decisions: '#3b82f6',  // blue — decisions
  failures:  '#ef4444',  // red — failures
}

function tenantColor(tenant: string): string {
  return SUB_TENANT_COLORS[tenant] ?? '#a855f7'
}

export default function ContextGraph() {
  const data   = useMissionControlStore(s => s.graphData)
  const svgRef = useRef<SVGSVGElement>(null)
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch actual HydraDB source metadata for the sidebar list
  useEffect(() => {
    setLoading(true)
    fetch('/api/memory/stats')
      .then(r => r.json())
      .then(() => fetch('/api/graph'))
      .then(r => r.json())
      .then(g => {
        const sources: MemoryEntry[] = (g.sources ?? []).slice(0, 100)
        setEntries(sources)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [data])  // re-fetch when graph data updates (i.e. after context ingest)

  useEffect(() => {
    if (!svgRef.current) return
    const svg    = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    if (!data && entries.length === 0) return

    const width  = svgRef.current.clientWidth  || 600
    const height = svgRef.current.clientHeight || 400

    const nodes: any[] = []
    const links: any[] = []
    let counter = 0

    // Agent nodes — large, orange
    for (const a of data?.activeAgents ?? []) {
      nodes.push({ id: a.id, label: a.name, type: 'agent', status: a.status, r: 14 })
    }

    // Super nodes from HydraDB — medium, blue
    for (const n of (data?.superNodes ?? []) as Array<{ id?: string; label?: string; connections?: number }>) {
      const safeId = n.id ?? `super-${counter++}`
      nodes.push({ id: safeId, label: n.label ?? safeId.slice(0, 10), type: 'super', r: Math.min(6 + (n.connections ?? 1), 14) })
    }

    // Source nodes — colour by sub-tenant (decisions=blue, failures=red, shared=orange)
    for (const s of entries.slice(0, 80)) {
      const safeId = s.source_id ?? `src-${counter++}`
      const tenant = s.sub_tenant_id ?? s.metadata?.sub_tenant_id ?? 'shared'
      nodes.push({ id: safeId, label: safeId.slice(-6), type: 'source', tenant, r: 4 })
    }

    // Links: agents → nearest super nodes; super nodes → their source nodes
    const agentNodes = nodes.filter(n => n.type === 'agent')
    const superNodes = nodes.filter(n => n.type === 'super')
    const sourceNodes = nodes.filter(n => n.type === 'source')

    for (const a of agentNodes) {
      for (const s of superNodes.slice(0, 4)) links.push({ source: a.id, target: s.id, strength: 0.5 })
    }
    superNodes.forEach((sn, i) => {
      const chunk = sourceNodes.slice(i * 5, i * 5 + 5)
      for (const src of chunk) links.push({ source: sn.id, target: src.id, strength: 0.2 })
    })

    const simulation = d3.forceSimulation(nodes)
      .force('link',   d3.forceLink(links).id((d: any) => d.id).distance((d: any) => d.strength < 0.3 ? 30 : 60))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.r + 2))

    const link = svg.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#1a1a1a').attr('stroke-width', 1)

    const node = svg.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => {
        if (d.type === 'agent')  return d.status === 'active' ? '#f97316' : d.status === 'failed' ? '#ef4444' : '#22c55e'
        if (d.type === 'super')  return '#3b82f6'
        return tenantColor(d.tenant ?? 'shared')
      })
      .attr('stroke', '#000').attr('stroke-width', 1.5)
      .call(d3.drag<any, any>()
        .on('start', (e: any, d: any) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (e: any, d: any) => { d.fx = e.x; d.fy = e.y })
        .on('end',   (e: any, d: any) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )

    const label = svg.append('g')
      .selectAll('text').data(nodes.filter((d: any) => d.type !== 'source')).join('text')
      .text((d: any) => d.label)
      .attr('font-size', 9).attr('font-family', 'monospace')
      .attr('fill', '#888').attr('dx', 10).attr('dy', 3)

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)
      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y)
    })

    return () => { simulation.stop() }
  }, [data, entries])

  const byTenant = entries.reduce<Record<string, number>>((acc, e) => {
    const t = e.sub_tenant_id ?? e.metadata?.sub_tenant_id ?? 'shared'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-[18px] uppercase tracking-[0.12em] font-bold text-white">
          HydraDB Memory Graph
        </h2>
        <div className="flex items-center gap-4 text-[10px] font-mono text-[#555]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"/>agent</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>super-node</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500/60 inline-block"/>context</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/60 inline-block"/>decision</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/60 inline-block"/>failure</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Graph */}
        <div className="flex-1 border border-[#171717] bg-[#020202] relative">
          {!data && entries.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#555] text-xs uppercase tracking-widest">
                {loading ? 'Loading HydraDB graph...' : 'No memory yet — spawn an agent to start'}
              </span>
            </div>
          ) : null}
          <svg ref={svgRef} className="w-full h-full" />
        </div>

        {/* HydraDB memory sidebar */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">
          {/* Stats by sub-tenant */}
          <div className="border border-[#171717] bg-[#020202] p-3">
            <div className="text-[10px] text-orange-500 uppercase tracking-widest mb-2">Memory Breakdown</div>
            {Object.keys(byTenant).length === 0 ? (
              <div className="text-[#444] text-xs">Empty</div>
            ) : (
              Object.entries(byTenant).map(([tenant, count]) => (
                <div key={tenant} className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: tenantColor(tenant) }} />
                    <span className="text-[#888] font-mono">{tenant}</span>
                  </div>
                  <span className="text-[#555]">{count}</span>
                </div>
              ))
            )}
            <div className="border-t border-[#171717] mt-2 pt-2 flex justify-between text-xs">
              <span className="text-[#555]">total</span>
              <span className="text-orange-500 font-mono">{entries.length}</span>
            </div>
          </div>

          {/* Recent memory entries */}
          <div className="border border-[#171717] bg-[#020202] p-3 flex-1 overflow-auto">
            <div className="text-[10px] text-orange-500 uppercase tracking-widest mb-2">Recent Entries</div>
            {entries.length === 0 ? (
              <div className="text-[#444] text-xs">No entries yet</div>
            ) : (
              entries.slice(0, 30).map(e => {
                const tenant = e.sub_tenant_id ?? e.metadata?.sub_tenant_id ?? 'shared'
                return (
                  <div key={e.source_id} className="mb-2 pb-2 border-b border-[#111] last:border-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tenantColor(tenant) }} />
                      <span className="text-[#555] text-[9px] font-mono uppercase">{tenant}</span>
                    </div>
                    <div className="text-[#666] text-[9px] font-mono truncate">{e.source_id?.slice(-20)}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
